import { UpdateSummaryRequestSchema } from "@/contracts";
import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/require-user";
import { updateDailySummary } from "@/server/daily-records/daily-record-service";
import { errorResponse } from "@/server/errors/app-error";
import { parseJson } from "@/server/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ date: string }> },
): Promise<Response> {
  try {
    const user = await requireUser();
    const { date } = await params;
    const body = parseJson(UpdateSummaryRequestSchema, await request.text());
    const summary = await updateDailySummary(await createServerClient(), user.id, {
      date,
      body,
    });

    return Response.json(summary);
  } catch (error) {
    return errorResponse(error);
  }
}
