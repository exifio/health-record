import "server-only";
import {
  ProfileResponseSchema,
  type ProfileResponse,
  type UpdateProfileRequest,
} from "@/contracts";
import { mapDatabaseError } from "@/server/daily-records/errors";
import type { SupabaseClient } from "@/server/daily-records/types";

type DbProfile = { onboarding_completed_at: string | null } | null;

function toProfileResponse(profile: DbProfile): ProfileResponse {
  return ProfileResponseSchema.parse({
    onboardingCompleted: Boolean(profile && profile.onboarding_completed_at !== null),
  });
}

/**
 * 프로필은 로그인 시 auth trigger가 생성한다. row가 없는 사용자도 있을 수 있으므로
 * 부재하면 온보딩 미완료로 간주한다. (RLS가 insert를 서버 전용으로 제한한다)
 */
export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileResponse> {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw mapDatabaseError(error);
  }

  return toProfileResponse((data ?? null) as DbProfile);
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateProfileRequest,
): Promise<ProfileResponse> {
  const completedAt = input.onboardingCompleted ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: completedAt })
    .eq("id", userId);

  if (error) {
    throw mapDatabaseError(error);
  }

  return { onboardingCompleted: input.onboardingCompleted };
}
