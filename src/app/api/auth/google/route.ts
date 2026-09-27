import { createServerClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/server/errors/app-error";
import { sanitizeNextPath } from "@/server/auth/redirects";

export async function GET(request: Request): Promise<Response> {
  try {
    // `next`는 사용자 입력이다. callback URL에 심어 OAuth로 전달하고,
    // 실제로 redirect할 때 다시 allowlist로 검증한다.
    const next = sanitizeNextPath(new URL(request.url).searchParams.get("next"));
    const callbackUrl = new URL("/api/auth/callback", request.url);
    callbackUrl.searchParams.set("next", next);

    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });

    if (error || !data.url) {
      throw new AppError("INTERNAL_ERROR", "로그인에 실패했습니다. 다시 시도해주세요.", 500);
    }

    return Response.redirect(data.url, 302);
  } catch (error) {
    return errorResponse(error);
  }
}
