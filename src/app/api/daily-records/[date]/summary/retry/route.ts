import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/require-user";
import { retryDailySummary } from "@/server/daily-records/summary-service";
import { errorResponse } from "@/server/errors/app-error";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
): Promise<Response> {
  try {
    const user = await requireUser();
    const { date } = await params;
    const result = await retryDailySummary(await createServerClient(), user.id, date);

    return Response.json(result, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}