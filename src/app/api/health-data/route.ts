import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/require-user";
import { deleteHealthData } from "@/server/account/account-service";
import { errorResponse } from "@/server/errors/app-error";

export async function DELETE(): Promise<Response> {
  try {
    await requireUser();
    await deleteHealthData(await createServerClient());
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
