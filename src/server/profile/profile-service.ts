import "server-only";
import {
  CURRENT_CONSENT_VERSION,
  ProfileResponseSchema,
  type ProfileResponse,
  type UpdateProfileRequest,
} from "@/contracts";
import { mapDatabaseError } from "@/server/daily-records/errors";
import { AppError } from "@/server/errors/app-error";
import type { SupabaseClient } from "@/server/daily-records/types";

type DbProfile = {
  onboarding_completed_at: string | null;
  consent_version: string | null;
} | null;

function toProfileResponse(profile: DbProfile): ProfileResponse {
  return ProfileResponseSchema.parse({
    onboardingCompleted: Boolean(profile && profile.onboarding_completed_at !== null),
    consentVersion: profile ? profile.consent_version : null,
  });
}

/**
 * 프로필은 로그인 시 auth trigger가 생성한다. row가 없는 사용자도 있을 수 있으므로
 * 부재하면 온보딩 미완료·미동의로 간주한다. (RLS가 insert를 서버 전용으로 제한한다)
 */
export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileResponse> {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, consent_version")
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
  const storesOnboarding = input.onboardingCompleted !== undefined;
  // 동의 이력은 'reason: consent'로 명시한 요청만 쓴다. 온보딩 완료가 동의로 오인되지 않게 한다.
  const storesConsent = input.reason === "consent" && input.consentVersion !== undefined;

  if (storesConsent && input.consentVersion !== CURRENT_CONSENT_VERSION) {
    throw new AppError("VALIDATION_ERROR", "요청을 확인해주세요.", 400);
  }

  // 실제로 쓸 값이 하나도 없으면 UPDATE를 보내지 않는다(빈 patch는 무의미한 쓰기).
  if (!storesOnboarding && !storesConsent) {
    return getProfile(supabase, userId);
  }

  const patch: Record<string, string | null> = {};

  if (storesOnboarding) {
    patch.onboarding_completed_at = input.onboardingCompleted ? new Date().toISOString() : null;
  }
  if (storesConsent) {
    patch.consent_version = input.consentVersion as string;
    patch.consented_at = new Date().toISOString();
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);

  if (error) {
    throw mapDatabaseError(error);
  }

  return getProfile(supabase, userId);
}
