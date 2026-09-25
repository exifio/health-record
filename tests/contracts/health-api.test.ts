import { DailyRecordResponseSchema } from "@/contracts";
import { createHealthApi } from "@/features/records/api/health-api";
import { createMockHealthApi } from "@/mocks/health-api";

const recordResponse = {
  record: {
    date: "2026-09-25",
    recordStatus: "draft",
    summaryStatus: "not_due",
    contentRevision: 1,
    messages: [],
    summary: null,
    corrections: [],
  },
};

describe("health API adapters", () => {
  it("validates HTTP responses against the shared contract", async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify(recordResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const api = createHealthApi(fetcher);
    const result = await api.getDailyRecord("2026-09-25");

    expect(calls).toEqual(["/api/daily-records/2026-09-25"]);
    expect(DailyRecordResponseSchema.parse(result)).toEqual(recordResponse);
  });

  it("rejects malformed HTTP responses instead of passing them to the UI", async () => {
    const fetcher: typeof fetch = async () =>
      new Response(JSON.stringify({
        record: { ...recordResponse.record, recordStatus: "unknown" },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    await expect(createHealthApi(fetcher).getDailyRecord("2026-09-25")).rejects.toThrow();
  });

  it("validates a mock fixture through the same response schema", async () => {
    const result = await createMockHealthApi().getDailyRecord("2026-09-25");

    expect(DailyRecordResponseSchema.parse(result)).toEqual(result);
  });

  it("does not invent records for dates without a fixture", async () => {
    await expect(createMockHealthApi().getDailyRecord("2026-09-24")).rejects.toThrow(
      "기록이 없습니다.",
    );
  });
});
