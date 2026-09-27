import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/server/errors/app-error";
import { parseObject } from "@/server/validation";
import { sanitizeNextPath } from "@/server/auth/redirects";

const CallbackQuerySchema = z.strictObject({
  code: z.string().min(1),
  next: z.string().optional(),
});

export async function GET(request: Request): Promise<Response> {
  try {
    const searchParams = new URL(request.url).searchParams;
    const { code, next } = parseObject(CallbackQuerySchema, {
      code: searchParams.get("code") ?? undefined,
      next: searchParams.get("next") ?? undefined,
    });

    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw new AppError("VALIDATION_ERROR", "로그인에 실패했습니다. 다시 시도해주세요.", 400);
    }

    // allowlist 밖의 경로는 여기서 한 번 더 막는다(리다이렉트 직전 최종 검증).
    return new Response(null, { status: 307, headers: { location: sanitizeNextPath(next) } });
  } catch (error) {
    return errorResponse(error);
  }
}
