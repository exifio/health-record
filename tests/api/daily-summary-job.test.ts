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
});

export {};
