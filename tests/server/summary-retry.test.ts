import { retryDailySummary } from "@/server/daily-records/summary-service";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "99999999-9999-4999-8999-999999999999";
const DATE = "2026-09-25";
const RECORD_ID = "33333333-3333-4333-8333-333333333333";

type Call = {
  table: string;
  op: "select" | "update";
  payload?: Record<string, unknown>;
  filters: Record<string, unknown>;
};

function makeSupabase(options: {
  record?: unknown;
  recordError?: { message: string } | null;
  updated?: unknown;
  updateError?: { message: string } | null;
}) {
  const calls: Call[] = [];

  const supabase = {
    from(table: string) {
      const call: Call = { table, op: "select", filters: {} };
      const builder = {
        select(columns: string) {
          call.filters.__columns = columns;
          return builder;
        },
        update(payload: Record<string, unknown>) {
          call.op = "update";
          call.payload = payload;
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters[column] = value;
          return builder;
        },
        in(column: string, values: unknown[]) {
          call.filters[`in:${column}`] = values;
          return builder;
        },
        maybeSingle() {
          calls.push(call);
          if (call.op === "update") {
            return Promise.resolve({ data: options.updated ?? null, error: options.updateError ?? null });
          }
          return Promise.resolve({ data: options.record ?? null, error: options.recordError ?? null });
        },
      };
      return builder;
    },
  };

  return { supabase, calls };
}

function draftRecord(summaryStatus: string, recordStatus = "draft") {
  return { id: RECORD_ID, record_status: recordStatus, summary_status: summaryStatus };
}

describe("요약 재시도 (API.md 9절)", () => {
  it.each(["failed", "stale"])("%s 상태를 pending으로 되돌리고 202 페이로드를 만든다", async (status) => {
    const { supabase, calls } = makeSupabase({ record: draftRecord(status), updated: { id: RECORD_ID } });

    await expect(retryDailySummary(supabase as never, USER, DATE)).resolves.toEqual({
      summaryStatus: "pending",
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].op).toBe("select");
    expect(calls[0].filters).toMatchObject({ user_id: USER, local_date: DATE });
    expect(calls[1].op).toBe("update");
    expect(calls[1].payload).toEqual({ summary_status: "pending", processing_started_at: null });
    expect(calls[1].filters).toMatchObject({ id: RECORD_ID, user_id: USER });
    expect(calls[1].filters["in:summary_status"]).toEqual(["failed", "stale", "pending"]);
  });

  it("pending 중복 호출은 같은 202를 반환하고 원문 revision을 건드리지 않는다", async () => {
    const { supabase, calls } = makeSupabase({ record: draftRecord("pending"), updated: { id: RECORD_ID } });

    await expect(retryDailySummary(supabase as never, USER, DATE)).resolves.toEqual({
      summaryStatus: "pending",
    });
    expect(calls[1].payload).not.toHaveProperty("content_revision");
  });

  it.each(["not_due", "processing", "ready"])("%s 상태는 409로 거절하고 DB를 변경하지 않는다", async (status) => {
    const { supabase, calls } = makeSupabase({ record: draftRecord(status) });

    await expect(retryDailySummary(supabase as never, USER, DATE)).rejects.toMatchObject({
      code: "SUMMARY_NOT_RETRYABLE",
      status: 409,
    });
    expect(calls).toHaveLength(1);
  });

  it("확정된 기록은 다시 정리할 수 없다", async () => {
    const { supabase, calls } = makeSupabase({ record: draftRecord("failed", "confirmed") });

    await expect(retryDailySummary(supabase as never, USER, DATE)).rejects.toMatchObject({
      code: "SUMMARY_NOT_RETRYABLE",
      status: 409,
    });
    expect(calls).toHaveLength(1);
  });

  it("기록이 없으면 404를 반환한다", async () => {
    const { supabase } = makeSupabase({ record: null });

    await expect(retryDailySummary(supabase as never, USER, DATE)).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
      status: 404,
    });
  });

  it("조회와 갱신 모두 세션 사용자 기준으로만 제한한다", async () => {
    const { supabase, calls } = makeSupabase({ record: draftRecord("failed"), updated: { id: RECORD_ID } });

    await retryDailySummary(supabase as never, OTHER_USER, DATE);

    expect(calls.every((call) => call.filters.user_id === OTHER_USER)).toBe(true);
  });

  it("상태가 이미 바뀌어 갱신된 row가 없으면 409로 거절한다", async () => {
    const { supabase } = makeSupabase({ record: draftRecord("failed"), updated: null });

    await expect(retryDailySummary(supabase as never, USER, DATE)).rejects.toMatchObject({
      code: "SUMMARY_NOT_RETRYABLE",
      status: 409,
    });
  });

  it("잘못된 날짜 형식은 DB 호출 전에 400으로 거절한다", async () => {
    const { supabase, calls } = makeSupabase({ record: draftRecord("failed") });

    await expect(retryDailySummary(supabase as never, USER, "2026-9-25")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
    expect(calls).toHaveLength(0);
  });

  it("DB 오류는 내부 정보 없이 일반 500으로 변환한다", async () => {
    const { supabase } = makeSupabase({ record: null, recordError: { message: "connection reset by peer" } });

    await expect(retryDailySummary(supabase as never, USER, DATE)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
      userMessage: "요청을 처리하지 못했습니다.",
    });
  });
});