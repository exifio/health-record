import { createServerClient } from "@/lib/supabase/server";
import { CreateMessageRequestSchema } from "@/contracts";
import { requireUser } from "@/server/auth/require-user";
import { createMessage } from "@/server/daily-records/daily-record-service";
import { errorResponse } from "@/server/errors/app-error";
import { parseJson } from "@/server/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ date: string }> },
): Promise<Response> {
  try {
    const user = await requireUser();
    const { date } = await params;
    const message = await createMessage(await createServerClient(), user.id, {
      date,
      body: parseJson(CreateMessageRequestSchema, await request.text()),
    });

    return Response.json(message, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
