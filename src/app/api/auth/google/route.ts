import { createServerClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/server/errors/app-error";

export async function GET(request: Request): Promise<Response> {
  try {
    const callbackUrl = new URL("/api/auth/callback", request.url).toString();
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });

    if (error || !data.url) {
      throw new AppError("INTERNAL_ERROR", "로그인에 실패했습니다. 다시 시도해주세요.", 500);
    }

    return Response.redirect(data.url, 302);
  } catch (error) {
    return errorResponse(error);
  }
}
