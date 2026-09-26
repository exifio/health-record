const createAdminClientMock = jest.fn();
const requireUserMock = jest.fn();
const retryDailySummaryMock = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));
jest.mock("@/server/auth/require-user", () => ({ requireUser: requireUserMock }));
jest.mock("@/server/daily-records/summary-service", () => ({ retryDailySummary: retryDailySummaryMock }));

const USER = "11111111-1111-4111-8111-111111111111";
const DATE = "2026-09-25";

function callRoute() {
  return import("@/app/api/daily-records/[date]/summary/retry/route").then(({ POST }) =>
    POST(new Request(`https://health.example/api/daily-records/${DATE}/summary/retry`, { method: "POST" }), {
      params: Promise.resolve({ date: DATE }),
    }),
  );
}

describe("POST /api/daily-records/:date/summary/retry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createAdminClientMock.mockReturnValue({});
    requireUserMock.mockResolvedValue({ id: USER });
    retryDailySummaryMock.mockResolvedValue({ summaryStatus: "pending" });
  });

  it("세션 사용자 ID로 재시도하고 202를 반환한다", async () => {
    const response = await callRoute();

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ summaryStatus: "pending" });
    expect(retryDailySummaryMock).toHaveBeenCalledWith(expect.anything(), USER, DATE);
  });

  it("로그인하지 않으면 AI/DB 호출 없이 401을 반환한다", async () => {
    const { AppError } = await import("@/server/errors/app-error");
    requireUserMock.mockRejectedValue(new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401));

    const response = await callRoute();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." },
    });
    expect(retryDailySummaryMock).not.toHaveBeenCalled();
  });

  it("재시도할 수 없는 상태의 409를 그대로 전달한다", async () => {
    const { AppError } = await import("@/server/errors/app-error");
    retryDailySummaryMock.mockRejectedValue(
      new AppError("SUMMARY_NOT_RETRYABLE", "지금은 다시 정리할 수 없습니다.", 409),
    );

    const response = await callRoute();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "SUMMARY_NOT_RETRYABLE", message: "지금은 다시 정리할 수 없습니다." },
    });
  });

  it("예상하지 못한 오류는 내부 정보를 숨긴 500으로 변환한다", async () => {
    retryDailySummaryMock.mockRejectedValue(new Error("supabase url secret leaked"));

    const response = await callRoute();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "요청을 처리하지 못했습니다." },
    });
  });
});