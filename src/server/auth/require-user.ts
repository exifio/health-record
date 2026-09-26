import { createServerClient } from "@/lib/supabase/server";
import { AppError } from "@/server/errors/app-error";

export type AuthenticatedUser = { id: string };

export async function requireUser(): Promise<AuthenticatedUser> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();

  // 요청 body/query의 user_id는 신뢰하지 않는다. 서버가 세션으로 확인한 user만 사용한다.
  if (error || !data.user || data.user.is_anonymous) {
    throw new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }

  return { id: data.user.id };
}
