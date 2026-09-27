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
  it("rejects a stale consent version like the server", async () => {
    const api = createMockHealthApi();
    const before = await api.getProfile();

    await expect(api.updateProfile({ reason: "consent", consentVersion: "2026-09-27-v1" }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });

    await expect(api.getProfile()).resolves.toEqual(before);
  });

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

    // 7. retrySummary — 실제 서버는 failed/stale/pending만 pending으로 되돌린다(API.md 9절).
    // 기본 fixture는 not_due라 즉시 재시도할 수 없다. 정리 완료 → 원문 변경으로 stale을 만든 뒤 재시도한다.
    await api.runSummaryWorker();
    await api.createMessage("2026-09-25", {
      content: "저녁에 다시 속쓰림이 조금",
      systemTimeZone: "Asia/Seoul",
    });
    const retry = await api.retrySummary("2026-09-25");
    expect(retry.summaryStatus).toBe("pending");

    // 실제 서버와 동일하게, 요약 수정은 초안이 준비된(ready) 상태에서만 가능하다.
    await api.runSummaryWorker();

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

describe("createMockHealthApi — 둘러보기 Demo 샘플 (F-104 / F-105)", () => {
  /** 둘러보기가 제공하는 샘플 날짜(fixtures.ts와 같은 순서). */
  const FIXTURE_DATES = ["2026-09-25", "2026-09-24", "2026-09-23", "2026-09-22"];

  it("목록은 fixture 샘플만 내려준다", async () => {
    const api = createMockHealthApi();

    const list = await api.getDailyRecords("2000-01-01", "2030-12-31");

    // 실행 시점 날짜에 샘플 원문을 복제하면 같은 기록이 두 날짜에 중복돼 보인다.
    expect(list.items.map((item) => item.date)).toEqual(FIXTURE_DATES);
  });

  it("날짜마다 서로 다른 샘플 원문을 제공한다", async () => {
    const api = createMockHealthApi();
    const contents: string[] = [];

    for (const date of FIXTURE_DATES) {
      const res = await api.getDailyRecord(date);
      contents.push(res.record.messages.map((message) => message.content).join("\n"));
    }

    expect(new Set(contents).size).toBe(contents.length);
  });

  it("기록 목록에 보이는 샘플 날짜는 상세 조회도 가능하다", async () => {
    const api = createMockHealthApi();
    const list = await api.getDailyRecords("2000-01-01", "2030-12-31");

    // 목록과 상세가 서로 다른 샘플을 보여 주면 안 된다(F-105).
    for (const item of list.items) {
      const detail = await api.getDailyRecord(item.date);
      expect(detail.record.date).toBe(item.date);
      expect(detail.record.messages.length).toBeGreaterThan(0);
    }
  });
});

describe("createMockHealthApi — business rule parity with real backend (I-001)", () => {
  const staleMessage = { content: "오후에 다시 속이 불편", systemTimeZone: "Asia/Seoul" };

  /** 실제 서버의 스케줄러가 초안을 만드는 단계를 흉내낸다(B3). */
  async function readySummary(api: ReturnType<typeof createMockHealthApi>) {
    await api.runSummaryWorker();
  }

  it("blocks confirmation when the summary is stale after a source change (SUMMARY_STALE)", async () => {
    const api = createMockHealthApi();
    await readySummary(api);

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
    await readySummary(api);
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
    await readySummary(api);

    const before = await api.getDailyRecord("2026-09-25");
    expect(before.record.summaryStatus).toBe("ready");

    await api.createMessage("2026-09-25", staleMessage);
    const after = await api.getDailyRecord("2026-09-25");
    expect(after.record.contentRevision).toBeGreaterThan(before.record.contentRevision);
    expect(after.record.summaryStatus).toBe("stale");
  });
});

describe("createMockHealthApi — 요약 재시도 규칙 정합 (API.md 9절 / I4)", () => {
  const notRetryable = { code: "SUMMARY_NOT_RETRYABLE", status: 409 };

  it("기록이 없으면 404 RECORD_NOT_FOUND", async () => {
    const api = createMockHealthApi();

    await expect(api.retrySummary("2026-09-01")).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
      status: 404,
    });
  });

  it("아직 하루가 끝나지 않은(not_due) 기록은 재시도할 수 없다", async () => {
    const api = createMockHealthApi();

    // fixture의 오늘 기록은 draft + not_due다.
    await expect(api.retrySummary("2026-09-25")).rejects.toMatchObject(notRetryable);
  });

  it("정리 완료된(ready) 기록은 재시도할 수 없다", async () => {
    const api = createMockHealthApi();

    // fixture의 미확인 기록은 draft + ready다.
    await expect(api.retrySummary("2026-09-23")).rejects.toMatchObject(notRetryable);
  });

  it("확정된 기록은 재시도할 수 없다", async () => {
    const api = createMockHealthApi();

    // fixture의 어제 기록은 confirmed다.
    await expect(api.retrySummary("2026-09-24")).rejects.toMatchObject(notRetryable);
  });

  it("stale 기록은 pending으로 되돌리고 원문 revision은 건드리지 않는다", async () => {
    const api = createMockHealthApi();
    await api.runSummaryWorker();
    await api.createMessage("2026-09-25", { content: "점심 후 다시 속쓰림", systemTimeZone: "Asia/Seoul" });

    const before = await api.getDailyRecord("2026-09-25");
    expect(before.record.summaryStatus).toBe("stale");

    const retry = await api.retrySummary("2026-09-25");
    expect(retry.summaryStatus).toBe("pending");

    const after = await api.getDailyRecord("2026-09-25");
    expect(after.record.summaryStatus).toBe("pending");
    // 재시도는 AI를 다시 호출하지 않으므로 content_revision이 그대로여야 한다.
    expect(after.record.contentRevision).toBe(before.record.contentRevision);
  });

  it("pending에서 중복 호출해도 상태를 바꾸지 않고 같은 202를 돌려준다", async () => {
    const api = createMockHealthApi();
    await api.runSummaryWorker();
    await api.createMessage("2026-09-25", { content: "저녁에 다시 멍함", systemTimeZone: "Asia/Seoul" });
    await api.retrySummary("2026-09-25");

    await expect(api.retrySummary("2026-09-25")).resolves.toEqual({ summaryStatus: "pending" });
  });

  it("재시도 실패는 화면이 구분할 수 있는 code로 던진다", async () => {
    const api = createMockHealthApi();

    await expect(api.retrySummary("2026-09-25")).rejects.toMatchObject({
      code: "SUMMARY_NOT_RETRYABLE",
      status: 409,
      message: "지금은 다시 정리할 수 없습니다.",
    });
  });
});
