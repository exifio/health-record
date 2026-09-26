import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/require-user";
import { getVisitPrep } from "@/server/daily-records/visit-prep-service";
import { errorResponse } from "@/server/errors/app-error";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const query = new URL(request.url).searchParams;
    const result = await getVisitPrep(await createServerClient(), user.id, {
      from: query.get("from"),
      to: query.get("to"),
    });

    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
