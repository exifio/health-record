import { ApiErrorResponseSchema } from "@/contracts";
import { AppError, errorResponse } from "@/server/errors/app-error";

describe("errorResponse (B-008)", () => {
  it("returns documented shape for AppError", async () => {
    const response = errorResponse(new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(ApiErrorResponseSchema.parse(body)).toEqual({
      error: { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." },
    });
  });

  it("hides internal details for unknown errors", async () => {
    const response = errorResponse(new Error("relation daily_records does not exist"));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(ApiErrorResponseSchema.parse(body)).toEqual({
      error: { code: "INTERNAL_ERROR", message: "요청을 처리하지 못했습니다." },
    });
    expect(JSON.stringify(body)).not.toContain("daily_records");
  });
});
