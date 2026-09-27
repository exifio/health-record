import "server-only";
import type { SupabaseClient as AdminSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient as SessionSupabaseClient } from "@/server/daily-records/types";
import { AppError } from "@/server/errors/app-error";
import { mapDatabaseError } from "@/server/daily-records/errors";

export async function deleteHealthData(supabase: SessionSupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("delete_health_data");
  if (error) throw mapDatabaseError(error);
}

export async function deleteAccount(
  supabase: SessionSupabaseClient,
  admin: AdminSupabaseClient,
  userId: string,
): Promise<void> {
  const { error: databaseError } = await supabase.rpc("delete_account_data");
  if (databaseError) throw mapDatabaseError(databaseError);

  // 데이터 삭제(RPC)가 끝난 뒤에야 Auth 사용자를 지운다. 순서가 바뀌면
  // 데이터는 남고 세션만 깨지는 반쪽 삭제가 된다.
  try {
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) {
      console.error("account_delete_auth_failed");
      throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
    }
  } catch (error) {
    // AppError는 그대로 전달하고, 네트워크 등 예기치 않은 실패만 기록한다.
    if (error instanceof AppError) throw error;
    console.error("account_delete_auth_failed");
    throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
  }

  // Auth 삭제가 성공했을 때만 세션을 정리한다. 실패했는데 signOut부터 하면
  // 스크린샷처럼 "페이지로 돌아와 아무 일도 안 일어난" 것처럼 보인다.
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Auth 삭제가 세션 토큰을 무효화했으므로 쿠키 정리는 실패해도 무시한다.
  }
}
