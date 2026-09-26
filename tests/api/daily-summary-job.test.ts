import { readFileSync } from "node:fs";
import { join } from "node:path";

const mockCreateAdminClient = jest.fn();
const mockRunDailySummaryJob = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockCreateAdminClient }));
jest.mock("@/server/daily-records/summary-service", () => ({ runDailySummaryJob: mockRunDailySummaryJob }));

describe("POST /api/internal/daily-summary/run", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mockCreateAdminClient.mockReturnValue({});
    mockRunDailySummaryJob.mockResolvedValue({ claimed: 1, completed: 1, failed: 0 });
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("rejects callers without the scheduler secret before creating the admin client", async () => {
    const { POST } = await import("@/app/api/internal/daily-summary/run/route");
    const response = await POST(new Request("https://health.example/api/internal/daily-summary/run", { method: "POST" }));

    expect(response.status).toBe(403);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockRunDailySummaryJob).not.toHaveBeenCalled();
  });

  it("returns counts only for an authorized scheduler", async () => {
    const { POST } = await import("@/app/api/internal/daily-summary/run/route");
    const response = await POST(new Request("https://health.example/api/internal/daily-summary/run", {
      method: "POST",
      headers: { authorization: "Bearer test-cron-secret" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: 1, completed: 1, failed: 0 });
    expect(mockCreateAdminClient).toHaveBeenCalledTimes(1);
    expect(mockRunDailySummaryJob).toHaveBeenCalledWith({});
  });

  it("fails closed when the scheduler secret is not configured", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await import("@/app/api/internal/daily-summary/run/route");
    const response = await POST(new Request("https://health.example/api/internal/daily-summary/run", {
      method: "POST",
      headers: { authorization: "Bearer test-cron-secret" },
    }));

    expect(response.status).toBe(500);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  // Vercel Cron Jobs는 GET으로 호출하고 CRON_SECRET을 Authorization에 붙인다.
  it("accepts GET for the Vercel cron and returns the same counts", async () => {
    const { GET } = await import("@/app/api/internal/daily-summary/run/route");
    const response = await GET(new Request("https://health.example/api/internal/daily-summary/run", {
      headers: { authorization: "Bearer test-cron-secret" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: 1, completed: 1, failed: 0 });
    expect(mockRunDailySummaryJob).toHaveBeenCalledTimes(1);
  });

  it("rejects a cron GET without the scheduler secret", async () => {
    const { GET } = await import("@/app/api/internal/daily-summary/run/route");
    const response = await GET(new Request("https://health.example/api/internal/daily-summary/run"));

    expect(response.status).toBe(403);
    expect(mockRunDailySummaryJob).not.toHaveBeenCalled();
  });

  it("declares an hourly cron for the summary job so the schedule is not lost", () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };

    const cron = config.crons?.find((entry) => entry.path === "/api/internal/daily-summary/run");
    expect(cron).toBeDefined();
    // 5분 단위는 Hobby 플랜에서 제한되므로 매시로 둔다.
    expect(cron?.schedule).toBe("0 * * * *");
  });
});

export {};
