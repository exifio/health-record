import { UpdateProfileRequestSchema } from "@/contracts";
import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/require-user";
import { errorResponse } from "@/server/errors/app-error";
import { getProfile, updateProfile } from "@/server/profile/profile-service";
import { parseJson } from "@/server/validation";

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    const profile = await getProfile(await createServerClient(), user.id);

    return Response.json(profile);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const body = parseJson(UpdateProfileRequestSchema, await request.text());
    const profile = await updateProfile(await createServerClient(), user.id, body);

    return Response.json(profile);
  } catch (error) {
    return errorResponse(error);
  }
}