import {
  DailyRecordListResponseSchema,
  DailyRecordResponseSchema,
  MessageMutationResponseSchema,
  ProfileResponseSchema,
  SuggestionsResponseSchema,
  VisitPrepResponseSchema,
} from "@/contracts";
import { createMockHealthApi } from "@/mocks/health-api";

describe("createMockHealthApi (F-007)", () => {
  it("implements all HealthApi operations and returns valid contract data", async () => {
    const api = createMockHealthApi();

    // 1. getDailyRecord
    const daily = await api.getDailyRecord("2026-09-25");
    expect(DailyRecordResponseSchema.parse(daily)).toBeDefined();
    expect(daily.record.date).toBe("2026-09-25");

    // 2. getDailyRecords
    const list = await api.getDailyRecords("2026-09-01", "2026-09-25");
    expect(DailyRecordListResponseSchema.parse(list)).toBeDefined();

    // 3. createMessage
    const created = await api.createMessage("2026-09-25", {
      content: "점심 식사 후 가벼운 소화불량",
      systemTimeZone: "Asia/Seoul",
    });
    expect(MessageMutationResponseSchema.parse(created)).toBeDefined();
    expect(created.message.content).toBe("점심 식사 후 가벼운 소화불량");

    // 4. updateMessage
    const updated = await api.updateMessage("2026-09-25", created.message.id, {
      content: "점심 식사 후 약간의 속쓰림",
    });
    expect(MessageMutationResponseSchema.parse(updated)).toBeDefined();
    expect(updated.message.content).toBe("점심 식사 후 약간의 속쓰림");

    // 5. deleteMessage (before confirmation)
    await api.deleteMessage("2026-09-25", created.message.id);

    // 6. getSuggestions
    const suggestions = await api.getSuggestions("2026-09-25");
    expect(SuggestionsResponseSchema.parse(suggestions)).toBeDefined();

    // 7. retrySummary
    const retry = await api.retrySummary("2026-09-25");
    expect(retry.summaryStatus).toBe("pending");

    // 8. updateSummary
    const summaryResult = await api.updateSummary("2026-09-25", {
      timeline: [{ text: "점심 후 속쓰림", sourceMessageIds: ["00000000-0000-4000-8000-000000000001"] }],
      medications: [],
      missingInformation: [],
    });
    expect(summaryResult.summary.userFinal?.timeline[0].text).toBe("점심 후 속쓰림");

    // 9. confirmRecord
    const confirmResult = await api.confirmRecord("2026-09-25");
    expect(confirmResult.recordStatus).toBe("confirmed");

    // Confirmed record cannot delete or update message
    await expect(
      api.createMessage("2026-09-25", {
        content: "새 메시지",
        systemTimeZone: "Asia/Seoul",
      }),
    ).rejects.toThrow("확정된 기록은 수정할 수 없습니다.");

    // 10. createCorrection
    const correction = await api.createCorrection("2026-09-25", {
      content: "속쓰림이 아니라 약간의 메스꺼움이었습니다.",
    });
    expect(correction.correction.content).toBe("속쓰림이 아니라 약간의 메스꺼움이었습니다.");

    // 11. getVisitPrep
    const visitPrep = await api.getVisitPrep("2026-09-01", "2026-09-25");
    expect(VisitPrepResponseSchema.parse(visitPrep)).toBeDefined();

    // 12. getProfile & updateProfile
    const profile = await api.getProfile();
    expect(ProfileResponseSchema.parse(profile)).toBeDefined();
    const updatedProfile = await api.updateProfile({ onboardingCompleted: true });
    expect(updatedProfile.onboardingCompleted).toBe(true);

    // 13. deleteDailyRecord
    await api.deleteDailyRecord("2026-09-25");
    await expect(api.getDailyRecord("2026-09-25")).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
      status: 404,
    });

    // 14. deleteHealthData & deleteAccount
    await api.deleteHealthData();
    await api.deleteAccount();
  });
});

describe("createMockHealthApi — business rule parity with real backend (I-001)", () => {
  const staleMessage = { content: "오후에 다시 속이 불편", systemTimeZone: "Asia/Seoul" };

  it("blocks confirmation when the summary is stale after a source change (SUMMARY_STALE)", async () => {
    const api = createMockHealthApi();

    // 원문 추가 → content_revision 증가, 요약을 stale로 표시 (실제 서버와 동일)
    await api.createMessage("2026-09-25", staleMessage);
    const afterChange = await api.getDailyRecord("2026-09-25");
    expect(afterChange.record.summaryStatus).toBe("stale");

    await expect(api.confirmRecord("2026-09-25")).rejects.toMatchObject({
      code: "SUMMARY_STALE",
      status: 409,
    });
  });

  it("blocks editing a stale summary (SUMMARY_STALE)", async () => {
    const api = createMockHealthApi();
    await api.createMessage("2026-09-25", staleMessage);

    await expect(
      api.updateSummary("2026-09-25", {
        timeline: [{ text: "속쓰림", sourceMessageIds: [] }],
        medications: [],
        missingInformation: [],
      }),
    ).rejects.toMatchObject({ code: "SUMMARY_STALE", status: 409 });
  });

  it("blocks corrections before the record is confirmed (RECORD_NOT_CONFIRMED)", async () => {
    const api = createMockHealthApi();

    await expect(api.createCorrection("2026-09-25", { content: "정정입니다." })).rejects.toMatchObject({
      code: "RECORD_NOT_CONFIRMED",
      status: 409,
    });
  });

  it("marks summaryStatus stale when the source changed after the summary was generated", async () => {
    const api = createMockHealthApi();
    const before = await api.getDailyRecord("2026-09-25");
    expect(before.record.summaryStatus).toBe("ready");

    await api.createMessage("2026-09-25", staleMessage);
    const after = await api.getDailyRecord("2026-09-25");
    expect(after.record.contentRevision).toBeGreaterThan(before.record.contentRevision);
    expect(after.record.summaryStatus).toBe("stale");
  });
});
