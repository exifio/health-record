import {
  CreateMessageRequestSchema,
  DailyRecordResponseSchema,
} from "@/contracts";

const validRecord = {
  record: {
    date: "2026-09-25",
    recordStatus: "draft",
    summaryStatus: "not_due",
    contentRevision: 1,
    messages: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        content: "  오늘 조금 피곤했어요.  ",
        createdAt: "2026-09-25T00:20:00Z",
        updatedAt: "2026-09-25T00:20:00Z",
      },
    ],
    summary: null,
    corrections: [],
  },
};

describe("daily record API contract", () => {
  it("accepts the documented response and preserves the original text", () => {
    const parsed = DailyRecordResponseSchema.parse(validRecord);

    expect(parsed.record.messages[0].content).toBe("  오늘 조금 피곤했어요.  ");
  });

  it("rejects impossible calendar dates and undocumented response fields", () => {
    expect(
      DailyRecordResponseSchema.safeParse({
        ...validRecord,
        record: { ...validRecord.record, date: "2026-02-30", extra: true },
      }).success,
    ).toBe(false);
  });

  it("rejects blank messages and invalid system time zones without trimming valid content", () => {
    expect(
      CreateMessageRequestSchema.safeParse({
        content: "  \n ",
        systemTimeZone: "Asia/Seoul",
      }).success,
    ).toBe(false);
    expect(
      CreateMessageRequestSchema.safeParse({
        content: "기록 내용 ",
        systemTimeZone: "Not/A_Zone",
      }).success,
    ).toBe(false);
    expect(
      CreateMessageRequestSchema.parse({
        content: "기록 내용 ",
        systemTimeZone: "Asia/Seoul",
      }).content,
    ).toBe("기록 내용 ");
  });
});
