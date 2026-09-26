import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/require-user";
import { getDailyRecords } from "@/server/daily-records/daily-record-service";
import { errorResponse } from "@/server/errors/app-error";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const query = new URL(request.url).searchParams;
    const records = await getDailyRecords(await createServerClient(), user.id, {
      from: query.get("from"),
      to: query.get("to"),
    });

    return Response.json(records);
  } catch (error) {
    return errorResponse(error);
  }
}
