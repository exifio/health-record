import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/server/errors/app-error";
import { parseObject } from "@/server/validation";
import { sanitizeNextPath, JUST_LOGGED_IN_COOKIE } from "@/server/auth/redirects";

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
    // just_logged_in은 세션 쿠키에 담기는 즉시 소모되는 1회용 표식이다.
    // 동의 여부나 건강 기록을 담지 않는다(동의의 단일 기준은 서버 프로필).
    const headers = new Headers({
      location: sanitizeNextPath(next),
      "set-cookie": `${JUST_LOGGED_IN_COOKIE}=1; Path=/; Max-Age=60; SameSite=Lax`,
    });
    return new Response(null, { status: 307, headers });
  } catch (error) {
    return errorResponse(error);
  }
}
