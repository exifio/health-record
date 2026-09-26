import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDailySummaryJob } from "@/server/daily-records/summary-service";
import { AppError, errorResponse } from "@/server/errors/app-error";

function requireSchedulerSecret(request: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  const expectedBytes = Buffer.from(secret);
  const tokenBytes = Buffer.from(token);
  const isValid = expectedBytes.length === tokenBytes.length && timingSafeEqual(expectedBytes, tokenBytes);

  if (!isValid) {
    throw new AppError("FORBIDDEN", "요청을 처리할 수 없습니다.", 403);
  }
}

/**
 * Vercel Cron Jobs는 GET으로 경로를 호출하고, 프로젝트에 CRON_SECRET이 설정돼 있으면
 * `Authorization: Bearer $CRON_SECRET`를 자동으로 붙인다.
 * 수동 확인은 POST로 유지하므로 두 메서드가 같은 처리를 공유한다.
 */
async function handleRun(request: Request): Promise<Response> {
  try {
    requireSchedulerSecret(request);
    const result = await runDailySummaryJob(createAdminClient());
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleRun(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleRun(request);
}
