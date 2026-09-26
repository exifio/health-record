import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/require-user";
import { createSuggestions } from "@/server/daily-records/suggestion-service";
import { errorResponse } from "@/server/errors/app-error";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ date: string }> },
): Promise<Response> {
  try {
    const user = await requireUser();
    const { date } = await params;
    const suggestions = await createSuggestions(await createServerClient(), user.id, date);

    return Response.json(suggestions);
  } catch (error) {
    return errorResponse(error);
  }
}
