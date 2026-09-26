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

  let authDeleteFailed = false;
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    authDeleteFailed = Boolean(error);
  } catch {
    authDeleteFailed = true;
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Auth deletion revokes refresh tokens; local sign-out also clears the request cookie.
  }

  if (authDeleteFailed) {
    console.error("account_delete_auth_failed");
    throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
  }
}
