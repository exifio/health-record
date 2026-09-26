import {
  confirmDailyRecord,
  createCorrection,
  getDailyRecord,
  updateDailySummary,
} from "@/server/daily-records/daily-record-service";

const USER = "11111111-1111-4111-8111-111111111111";
const DATE = "2026-09-25";
const MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const RECORD_ID = "33333333-3333-4333-8333-333333333333";
const SUMMARY_CONTENT = {
  timeline: [{ text: "오전에 가벼운 두통을 기록함", sourceMessageIds: [MESSAGE_ID] }],
  medications: [],
  missingInformation: [],
};

function makeSupabase(result: unknown) {
  const rpc = jest.fn().mockResolvedValue(result);
  return { rpc };
}

describe("B4 summary edit and confirmation", () => {
  it("최신 revision의 초안을 userFinal로 저장한다", async () => {
    const supabase = makeSupabase({
      data: [{
        source_revision: 3,
        ai_draft: SUMMARY_CONTENT,
        user_final: SUMMARY_CONTENT,
        generated_at: "2026-09-25T15:10:00Z",
      }],
      error: null,
    });

    const response = await updateDailySummary(supabase as never, USER, {
      date: DATE,
      body: SUMMARY_CONTENT,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("update_daily_summary", {
      p_user_id: USER,
      p_local_date: DATE,
      p_user_final: SUMMARY_CONTENT,
    });
    expect(response.summary).toEqual({
      sourceRevision: 3,
      aiDraft: SUMMARY_CONTENT,
      userFinal: SUMMARY_CONTENT,
        generatedAt: "2026-09-25T15:10:00.000Z",
    });
  });

  it.each(["SUMMARY_STALE", "SUMMARY_NOT_READY", "RECORD_CONFIRMED"])(
    "요약 수정에서 DB의 %s 상태를 안전한 409로 변환한다",
    async (code) => {
      const supabase = makeSupabase({ data: null, error: { message: code } });

      await expect(updateDailySummary(supabase as never, USER, {
        date: DATE,
        body: SUMMARY_CONTENT,
      })).rejects.toMatchObject({ code, status: 409 });
    },
  );

  it("잘못된 본문은 DB 호출 전에 400으로 거절한다", async () => {
    const supabase = makeSupabase({ data: null, error: null });
    await expect(updateDailySummary(supabase as never, USER, {
      date: DATE,
      body: { ...SUMMARY_CONTENT, unexpected: true },
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("최신 summary만 확정하고 DB 시각을 반환한다", async () => {
    const supabase = makeSupabase({
      data: [{ record_status: "confirmed", confirmed_at: "2026-09-26T02:00:00Z" }],
      error: null,
    });

    await expect(confirmDailyRecord(supabase as never, USER, DATE)).resolves.toEqual({
      recordStatus: "confirmed",
      confirmedAt: "2026-09-26T02:00:00.000Z",
    });
    expect(supabase.rpc).toHaveBeenCalledWith("confirm_daily_record", {
      p_user_id: USER,
      p_local_date: DATE,
    });
  });

  it.each(["SUMMARY_STALE", "SUMMARY_NOT_READY", "RECORD_CONFIRMED"])(
    "확정에서 DB의 %s 상태를 안전한 409로 변환한다",
    async (code) => {
      const supabase = makeSupabase({ data: null, error: { message: code } });
      await expect(confirmDailyRecord(supabase as never, USER, DATE))
        .rejects.toMatchObject({ code, status: 409 });
    },
  );
});

describe("B4 correction", () => {
  it("기록 상세 응답에 소유 기록의 정정을 시간순으로 포함한다", async () => {
    const correction = {
      id: MESSAGE_ID,
      content: "당시 복용한 약은 B였습니다.",
      created_at: "2026-09-26T02:00:00Z",
    };
    const record = {
      id: RECORD_ID,
      local_date: DATE,
      record_status: "confirmed",
      summary_status: "ready",
      content_revision: 1,
      timezone_at_creation: "Asia/Seoul",
    };
    const supabase = {
      from(table: string) {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => ({ data: table === "daily_records" ? record : null, error: null }),
          order: async () => ({ data: table === "corrections" ? [correction] : [], error: null }),
        };
        return builder;
      },
    };

    const result = await getDailyRecord(supabase as never, USER, DATE);
    expect(result.record.corrections).toEqual([{
      id: MESSAGE_ID,
      content: correction.content,
      createdAt: "2026-09-26T02:00:00.000Z",
    }]);
  });

  it("확정된 기록에 append-only correction을 추가한다", async () => {
    const supabase = makeSupabase({
      data: [{ id: MESSAGE_ID, content: "당시 복용한 약은 B였습니다.", created_at: "2026-09-26T02:00:00Z" }],
      error: null,
    });

    await expect(createCorrection(supabase as never, USER, {
      date: DATE,
      body: { content: "당시 복용한 약은 B였습니다." },
    })).resolves.toEqual({
      correction: {
        id: MESSAGE_ID,
        content: "당시 복용한 약은 B였습니다.",
        createdAt: "2026-09-26T02:00:00.000Z",
      },
    });
    expect(supabase.rpc).toHaveBeenCalledWith("create_record_correction", {
      p_user_id: USER,
      p_local_date: DATE,
      p_content: "당시 복용한 약은 B였습니다.",
    });
  });

  it("초안에는 정정을 추가하지 않는다", async () => {
    const supabase = makeSupabase({ data: null, error: { message: "RECORD_NOT_CONFIRMED" } });
    await expect(createCorrection(supabase as never, USER, {
      date: DATE,
      body: { content: "정정 내용" },
    })).rejects.toMatchObject({ code: "RECORD_NOT_CONFIRMED", status: 409 });
  });

  it("공백만 있는 정정은 DB 호출 전에 거절한다", async () => {
    const supabase = makeSupabase({ data: null, error: null });
    await expect(createCorrection(supabase as never, USER, {
      date: DATE,
      body: { content: "   " },
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
