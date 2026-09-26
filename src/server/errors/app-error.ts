export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly userMessage: string,
    readonly status: number,
  ) {
    super(userMessage);
    this.name = "AppError";
  }
}

const INTERNAL_ERROR_MESSAGE = "요청을 처리하지 못했습니다.";

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { error: { code: error.code, message: error.userMessage } },
      { status: error.status },
    );
  }

  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: INTERNAL_ERROR_MESSAGE } },
    { status: 500 },
  );
}
