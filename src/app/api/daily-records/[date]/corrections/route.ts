import { CreateCorrectionRequestSchema } from "@/contracts";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/server/auth/require-user";
import { createCorrection } from "@/server/daily-records/daily-record-service";
import { errorResponse } from "@/server/errors/app-error";
import { parseJson } from "@/server/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ date: string }> },
): Promise<Response> {
  try {
    const user = await requireUser();
    const { date } = await params;
    const body = parseJson(CreateCorrectionRequestSchema, await request.text());
    const result = await createCorrection(createAdminClient(), user.id, {
      date,
      body,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
