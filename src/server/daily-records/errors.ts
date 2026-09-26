import { AppError } from "@/server/errors/app-error";

/**
 * DB function이 MESSAGE = '<code>'로 올린 예외를 API contract의 error code로 옮긴다.
 * DB 에러 원문은 응답에 포함하지 않는다.
 */
const DB_ERROR_CODES: Record<string, { code: string; message: string; status: number }> = {
  FORBIDDEN: {
    code: "FORBIDDEN",
    message: "접근 권한이 없습니다.",
    status: 403,
  },
  VALIDATION_ERROR: {
    code: "VALIDATION_ERROR",
    message: "요청을 확인해주세요.",
    status: 400,
  },
  RECORD_CONFIRMED: {
    code: "RECORD_CONFIRMED",
    message: "확정된 기록은 수정할 수 없습니다.",
    status: 409,
  },
  RECORD_NOT_CONFIRMED: {
    code: "RECORD_NOT_CONFIRMED",
    message: "확정된 기록에만 정정을 추가할 수 있습니다.",
    status: 409,
  },
  SUMMARY_NOT_READY: {
    code: "SUMMARY_NOT_READY",
    message: "확인할 수 있는 요약이 아직 준비되지 않았습니다.",
    status: 409,
  },
  SUMMARY_STALE: {
    code: "SUMMARY_STALE",
    message: "원문 변경으로 요약이 오래되었습니다. 다시 정리해주세요.",
    status: 409,
  },
  RECORD_NOT_FOUND: {
    code: "RECORD_NOT_FOUND",
    message: "기록을 찾을 수 없습니다.",
    status: 404,
  },
  MESSAGE_NOT_FOUND: {
    code: "MESSAGE_NOT_FOUND",
    message: "메시지를 찾을 수 없습니다.",
    status: 404,
  },
};

export function mapDatabaseError(error: { message?: string } | null): AppError {
  const dbCode = error?.message;
  if (dbCode && DB_ERROR_CODES[dbCode]) {
    const { code, message, status } = DB_ERROR_CODES[dbCode];
    return new AppError(code, message, status);
  }

  return new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
}
