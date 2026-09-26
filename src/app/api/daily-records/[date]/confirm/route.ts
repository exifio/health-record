import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/server/auth/require-user";
import { confirmDailyRecord } from "@/server/daily-records/daily-record-service";
import { errorResponse } from "@/server/errors/app-error";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
): Promise<Response> {
  try {
    const user = await requireUser();
    const { date } = await params;
    const result = await confirmDailyRecord(createAdminClient(), user.id, date);

    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
