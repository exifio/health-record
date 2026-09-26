import { getDailyRecord } from "@/server/daily-records/daily-record-service";

const RECORD_ID = "11111111-1111-4111-8111-111111111111";
const DATE = "2026-09-25";
const SUMMARY = {
  source_revision: 4,
  ai_draft: {
    timeline: [{ text: "아침에 두통이 있었다고 기록함", sourceMessageIds: ["22222222-2222-4222-8222-222222222222"] }],
    medications: [],
    missingInformation: [],
  },
  user_final: null,
  generated_at: "2026-09-26T00:10:00.000Z",
};

function makeSupabase() {
  const results: Record<string, unknown> = {
    daily_records: {
      id: RECORD_ID,
      local_date: DATE,
      record_status: "draft",
      summary_status: "ready",
      content_revision: 4,
      timezone_at_creation: "Asia/Seoul",
    },
    record_messages: [],
    daily_summaries: SUMMARY,
  };

  return {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        order: () => Promise.resolve({ data: results[table], error: null }),
        maybeSingle: () => Promise.resolve({ data: results[table], error: null }),
      };
      return builder;
    },
  };
}

it("returns the generated summary in the daily record contract shape", async () => {
  const response = await getDailyRecord(makeSupabase() as never, "99999999-9999-4999-8999-999999999999", DATE);

  expect(response.record.summary).toEqual({
    sourceRevision: 4,
    aiDraft: SUMMARY.ai_draft,
    userFinal: null,
    generatedAt: SUMMARY.generated_at,
  });
});
