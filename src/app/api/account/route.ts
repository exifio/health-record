import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/require-user";
import { deleteAccount } from "@/server/account/account-service";
import { errorResponse } from "@/server/errors/app-error";

export async function DELETE(): Promise<Response> {
  try {
    const user = await requireUser();
    const supabase = await createServerClient();
    await deleteAccount(supabase, createAdminClient(), user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
