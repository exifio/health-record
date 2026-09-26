import { MessageMutationResponseSchema } from "@/contracts";
import {
  createMessage,
  deleteMessage,
  getDailyRecord,
  updateMessage,
} from "@/server/daily-records/daily-record-service";

type Query = { table: string; filters: Record<string, unknown>; single: string };

const RECORD_ID = "11111111-1111-4111-8111-111111111111";
const MESSAGE_ID = "22222222-2222-4222-8222-222222222222";

function makeSupabase(overrides: Partial<Record<string, unknown>> = {}) {
  const state: { queries: Query[]; rpcArgs: Record<string, unknown>[] } = { queries: [], rpcArgs: [] };

  const table = (name: string) => {
    const filters: Record<string, unknown> = {};
    const builder: Record<string, unknown> = {
      select(columns: string) {
        filters.__columns = columns;
        return builder;
      },
      eq(column: string, value: unknown) {
        filters[column] = value;
        return builder;
      },
      order() {
        return Promise.resolve({ data: [], error: null });
      },
      maybeSingle() {
        state.queries.push({ table: name, filters, single: "maybeSingle" });
        const data = overrides[name];
        return Promise.resolve({ data: data ?? null, error: null });
      },
    };
    return builder;
  };

  const supabase = {
    state,
    from: table,
    rpc: jest.fn((fn: string, args: Record<string, unknown>) => {
      state.rpcArgs.push(args);
      const configured = overrides[`rpc_${fn}`];
      if (configured && typeof configured === "object" && "error" in (configured as object)) {
        return Promise.resolve({ data: null, error: (configured as { error: unknown }).error });
      }
      const rows = (configured as unknown[] | undefined) ?? [
        { record_id: RECORD_ID, message_id: MESSAGE_ID, content_revision: 1 },
      ];
      return Promise.resolve({ data: rows, error: null });
    }),
  };
  if (overrides.record_messages === undefined) {
    overrides.record_messages = {
      id: MESSAGE_ID,
      content: "오늘 아침 두통",
      created_at: "2026-09-25T00:20:00+00:00",
      updated_at: "2026-09-25T00:20:00+00:00",
    };
  }
  if (overrides.daily_records === undefined) {
    overrides.daily_records = {
      id: RECORD_ID,
      local_date: DATE,
      record_status: "draft",
      summary_status: "not_due",
      content_revision: 1,
      timezone_at_creation: "Asia/Seoul",
    };
  }
  return supabase;
}

const USER = "11111111-1111-4111-8111-111111111111";
const DATE = "2026-09-25";
const TODAY_BODY = { content: "오늘 아침 두통", systemTimeZone: "Asia/Seoul" };

describe("getDailyRecord (B-106)", () => {
  it("기록이 없으면 404를 던진다", async () => {
    const supabase = makeSupabase({ daily_records: null });
    await expect(getDailyRecord(supabase as never, USER, DATE)).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
      status: 404,
    });
  });

  it("invalid 날짜는 400", async () => {
    const supabase = makeSupabase();
    await expect(getDailyRecord(supabase as never, USER, "25-09-2026")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });
});

describe("createMessage (B-107, B-113, B-114)", () => {
  it("검증된 IANA timezone을 snapshot으로 넘긴다", async () => {
    const supabase = makeSupabase();
    await createMessage(supabase as never, USER, { date: DATE, body: TODAY_BODY });

    expect(supabase.rpc).toHaveBeenCalledWith("create_record_message", {
      p_user_id: USER,
      p_local_date: DATE,
      p_timezone: "Asia/Seoul",
      p_content: "오늘 아침 두통",
    });
  });

  it("잘못된 timezone은 400으로 거절한다", async () => {
    const supabase = makeSupabase();
    await expect(
      createMessage(supabase as never, USER, {
        date: DATE,
        body: { content: "오늘 아침 두통", systemTimeZone: "Not/AZone" },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("미래 날짜는 400", async () => {
    const supabase = makeSupabase();
    await expect(
      createMessage(supabase as never, USER, {
        date: "2999-01-01",
        body: TODAY_BODY,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("빈 content는 400", async () => {
    const supabase = makeSupabase();
    await expect(
      createMessage(supabase as never, USER, {
        date: DATE,
        body: { content: "   ", systemTimeZone: "Asia/Seoul" },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("timezone 변경 후에도 기존 record의 local_date를 재계산하지 않는다 (B-703)", async () => {
    const supabase = makeSupabase({
      rpc_create_record_message: [{ record_id: RECORD_ID, message_id: MESSAGE_ID, content_revision: 1 }],
      record_messages: {
        id: MESSAGE_ID,
        content: "오늘 아침 두통",
        created_at: "2026-09-25T00:20:00+00:00",
        updated_at: "2026-09-25T00:20:00+00:00",
      },
      daily_records: {
        id: RECORD_ID,
        local_date: "2026-09-24",
        record_status: "draft",
        summary_status: "not_due",
        content_revision: 1,
        timezone_at_creation: "Asia/Seoul",
      },
    });

    const result = await createMessage(supabase as never, USER, {
      date: "2026-09-24",
      body: { content: "오늘 아침 두통", systemTimeZone: "America/Los_Angeles" },
    });

    expect(MessageMutationResponseSchema.parse(result).record.date).toBe("2026-09-24");
    expect(supabase.rpc).toHaveBeenCalledWith("create_record_message", {
      p_user_id: USER,
      p_local_date: "2026-09-24",
      p_timezone: "America/Los_Angeles",
      p_content: "오늘 아침 두통",
    });
  });
});

describe("updateMessage (B-108, B-110, B-111)", () => {
  it("수정 요청을 RPC에 전달한다", async () => {
    const supabase = makeSupabase();
    await updateMessage(supabase as never, USER, {
      date: DATE,
      messageId: MESSAGE_ID,
      body: { content: "수정" },
    });

    expect(supabase.rpc).toHaveBeenCalledWith("update_record_message", {
      p_user_id: USER,
      p_local_date: DATE,
      p_message_id: MESSAGE_ID,
      p_content: "수정",
    });
  });

  it("DB의 RECORD_CONFIRMED 예외를 409로 변환한다", async () => {
    const supabase = makeSupabase({
      rpc_update_record_message: { error: { message: "RECORD_CONFIRMED" } },
    });
    await expect(
      updateMessage(supabase as never, USER, {
        date: DATE,
        messageId: "22222222-2222-4222-8222-222222222222",
        body: { content: "수정" },
      }),
    ).rejects.toMatchObject({ code: "RECORD_CONFIRMED", status: 409 });
  });

  it("DB의 RECORD_NOT_FOUND 예외를 404로 변환한다", async () => {
    const supabase = makeSupabase({
      rpc_update_record_message: { error: { message: "RECORD_NOT_FOUND" } },
    });
    await expect(
      updateMessage(supabase as never, USER, {
        date: DATE,
        messageId: "22222222-2222-4222-8222-222222222222",
        body: { content: "수정" },
      }),
    ).rejects.toMatchObject({ code: "RECORD_NOT_FOUND", status: 404 });
  });

  it("잘못된 uuid는 400", async () => {
    const supabase = makeSupabase();
    await expect(
      updateMessage(supabase as never, USER, { date: DATE, messageId: "nope", body: { content: "수정" } }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });
});

describe("deleteMessage (B-109, B-112)", () => {
  it("삭제 결과를 resolve한다", async () => {
    const supabase = makeSupabase({ rpc_delete_record_message: [{ record_deleted: true, content_revision: 2 }] });
    await expect(
      deleteMessage(supabase as never, USER, {
        date: DATE,
        messageId: "22222222-2222-4222-8222-222222222222",
      }),
    ).resolves.toBeUndefined();
  });

  it("확정된 record 삭제는 409", async () => {
    const supabase = makeSupabase({
      rpc_delete_record_message: { error: { message: "RECORD_CONFIRMED" } },
    });
    await expect(
      deleteMessage(supabase as never, USER, {
        date: DATE,
        messageId: "22222222-2222-4222-8222-222222222222",
      }),
    ).rejects.toMatchObject({ code: "RECORD_CONFIRMED", status: 409 });
  });
});
