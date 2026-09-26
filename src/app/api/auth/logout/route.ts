import { createServerClient } from "@/lib/supabase/server";
import { errorResponse } from "@/server/errors/app-error";

export async function POST(): Promise<Response> {
  try {
    const supabase = await createServerClient();
    await supabase.auth.signOut({ scope: "local" });

    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}