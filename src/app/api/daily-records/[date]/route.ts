import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/require-user";
import { deleteDailyRecord, getDailyRecord } from "@/server/daily-records/daily-record-service";
import { errorResponse } from "@/server/errors/app-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ date: string }> },
): Promise<Response> {
  try {
    const user = await requireUser();
    const { date } = await params;
    const record = await getDailyRecord(await createServerClient(), user.id, date);

    return Response.json(record);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
): Promise<Response> {
  try {
    await requireUser();
    const { date } = await params;
    await deleteDailyRecord(await createServerClient(), date);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
