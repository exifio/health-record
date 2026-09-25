import {
  DailyRecordResponseSchema,
  type DailyRecordResponse,
} from "@/contracts";

export const sampleDailyRecordResponse: DailyRecordResponse = DailyRecordResponseSchema.parse({
  record: {
    date: "2026-09-25",
    recordStatus: "draft",
    summaryStatus: "not_due",
    contentRevision: 1,
    messages: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        content: "오전에 몸이 조금 피곤했어요.",
        createdAt: "2026-09-25T00:20:00Z",
        updatedAt: "2026-09-25T00:20:00Z",
      },
    ],
    summary: null,
    corrections: [],
  },
});
