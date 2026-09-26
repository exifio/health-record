import { retryDailySummary } from "@/server/daily-records/summary-service";

const USER = "11111111-1111-4111-8111-111111111111";
const DATE = "2026-09-25";

function makeSupabase(result: { data?: unknown; error?: { message: string } | null }) {
  const rpc = jest.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { rpc };
}

describe("요약 재시도 (API.md 9절)", () => {
  it("세션 클라이언트로 DB RPC를 호출해 재시도 상태 전이를 요청한다", async () => {
    const supabase = makeSupabase({ data: "pending" });

    await expect(retryDailySummary(supabase as never, USER, DATE)).resolves.toEqual({
      summaryStatus: "pending",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("retry_daily_summary", {
      p_user_id: USER,
      p_local_date: DATE,
    });
  });

  it("pending 중복 호출도 같은 202 페이로드를 만든다", async () => {
    const supabase = makeSupabase({ data: "pending" });

    await expect(retryDailySummary(supabase as never, USER, DATE)).resolves.toEqual({
      summaryStatus: "pending",
    });
  });

  it("DB가 pending으로 되돌리지 못하면 409로 거절한다", async () => {
    const supabase = makeSupabase({ data: "not_retryable" });

    await expect(retryDailySummary(supabase as never, USER, DATE)).rejects.toMatchObject({
      code: "SUMMARY_NOT_RETRYABLE",
      status: 409,
    });
  });

  it("기록이 없으면 404를 반환한다", async () => {
    const supabase = makeSupabase({ data: "missing" });

    await expect(retryDailySummary(supabase as never, USER, DATE)).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
      status: 404,
    });
  });

  it("FORBIDDEN은 사용자 격리 실패가 아니라 권한 문제로 그대로 전달한다", async () => {
    const supabase = makeSupabase({ data: null, error: { message: "FORBIDDEN" } });

    await expect(retryDailySummary(supabase as never, USER, DATE)).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("잘못된 날짜 형식은 DB 호출 전에 400으로 거절한다", async () => {
    const supabase = makeSupabase({ data: "pending" });

    await expect(retryDailySummary(supabase as never, USER, "2026-9-25")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("DB 오류는 내부 정보 없이 일반 500으로 변환한다", async () => {
    const supabase = makeSupabase({ data: null, error: { message: "connection reset by peer" } });

    await expect(retryDailySummary(supabase as never, USER, DATE)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
      userMessage: "요청을 처리하지 못했습니다.",
    });
  });
});