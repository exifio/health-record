import { ApiErrorResponseSchema } from "@/contracts";
import { AppError, errorResponse } from "@/server/errors/app-error";
import { mapDatabaseError } from "@/server/daily-records/errors";

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

describe("mapDatabaseError (B-008)", () => {
  it("DB의 RECORD_DATE_NOT_WRITABLE을 사용자에게 이해 가능한 400으로 변환한다", () => {
    const error = mapDatabaseError({ message: "RECORD_DATE_NOT_WRITABLE" });
    const response = errorResponse(error);

    expect(error.status).toBe(400);
    expect(error.code).toBe("RECORD_DATE_NOT_WRITABLE");
    expect(error.userMessage).toContain("처음 기록을 남길 수 없어요");
    expect(response.status).toBe(400);
  });

  it("알 수 없는 DB 오류 원문은 응답에 노출하지 않는다", () => {
    const error = mapDatabaseError({ message: "deadlock detected on daily_records" });

    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.userMessage).toBe("요청을 처리하지 못했습니다.");
  });
});
