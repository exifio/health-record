import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/require-user";
import { deleteMessage, updateMessage } from "@/server/daily-records/daily-record-service";
import { errorResponse } from "@/server/errors/app-error";
import { parseJson } from "@/server/validation";
import { UpdateMessageRequestSchema } from "@/contracts";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ date: string; messageId: string }> },
): Promise<Response> {
  try {
    const user = await requireUser();
    const { date, messageId } = await params;
    const message = await updateMessage(await createServerClient(), user.id, {
      date,
      messageId,
      body: parseJson(UpdateMessageRequestSchema, await request.text()),
    });

    return Response.json(message);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ date: string; messageId: string }> },
): Promise<Response> {
  try {
    const user = await requireUser();
    const { date, messageId } = await params;
    await deleteMessage(await createServerClient(), user.id, { date, messageId });

    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
