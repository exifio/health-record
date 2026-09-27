import { getProfile, updateProfile } from "@/server/profile/profile-service";
import { CURRENT_CONSENT_VERSION } from "@/contracts";

const USER = "11111111-1111-4111-8111-111111111111";

/** update 뒤 getProfile을 다시 호출하므로(select) row를 그대로 돌려주는 클라이언트. */
function makeClient(row: Record<string, unknown>) {
  const update = jest.fn().mockResolvedValue({ error: null });
  const supabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: update.mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: row, error: null }),
  } as never;
  return { supabase, update };
}

const EMPTY_ROW = { onboarding_completed_at: null, consent_version: null };

describe("profile service", () => {
  it("maps a completed onboarding timestamp to true", async () => {
    const { supabase } = makeClient({ ...EMPTY_ROW, onboarding_completed_at: "2026-09-25T00:00:00.000Z" });

    await expect(getProfile(supabase, USER)).resolves.toEqual({
      onboardingCompleted: true,
      consentVersion: null,
    });
  });

  it("treats a null onboarding timestamp as not completed", async () => {
    const { supabase } = makeClient(EMPTY_ROW);

    await expect(getProfile(supabase, USER)).resolves.toEqual({
      onboardingCompleted: false,
      consentVersion: null,
    });
  });

  it("treats a missing profile row as onboarding not completed and no consent", async () => {
    const supabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    } as never;

    await expect(getProfile(supabase, USER)).resolves.toEqual({
      onboardingCompleted: false,
      consentVersion: null,
    });
  });

  it("returns the stored consent version", async () => {
    const { supabase } = makeClient({ ...EMPTY_ROW, consent_version: CURRENT_CONSENT_VERSION });

    await expect(getProfile(supabase, USER)).resolves.toEqual({
      onboardingCompleted: false,
      consentVersion: CURRENT_CONSENT_VERSION,
    });
  });

  it("converts unknown database errors into a generic application error", async () => {
    const supabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: "connection failure" } }),
    } as never;

    await expect(getProfile(supabase, USER)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
    });
  });

  it("stores an ISO timestamp when onboarding is completed", async () => {
    const { supabase, update } = makeClient({ ...EMPTY_ROW, onboarding_completed_at: "2026-09-27T00:00:00.000Z" });

    await updateProfile(supabase, USER, { onboardingCompleted: true });

    const payload = update.mock.calls[0][0] as { onboarding_completed_at: string | null };
    expect(typeof payload.onboarding_completed_at).toBe("string");
    expect(Number.isNaN(Date.parse(payload.onboarding_completed_at as string))).toBe(false);
  });

  it("clears the timestamp when onboarding is reset", async () => {
    const { supabase, update } = makeClient({ ...EMPTY_ROW, onboarding_completed_at: "2026-09-27T00:00:00.000Z" });

    await updateProfile(supabase, USER, { onboardingCompleted: false });

    expect(update.mock.calls[0][0]).toEqual({ onboarding_completed_at: null });
  });

  // PRD 9-3: 온보딩 완료가 동의로 오인되면 고지 없이 데이터가 나가므로 reason으로 분리한다.
  it("records consent only when reason is 'consent'", async () => {
    const { supabase, update } = makeClient({ ...EMPTY_ROW, consent_version: CURRENT_CONSENT_VERSION });

    await updateProfile(supabase, USER, { reason: "consent", consentVersion: CURRENT_CONSENT_VERSION });

    const payload = update.mock.calls[0][0] as { consent_version: string; consented_at: string };
    expect(payload.consent_version).toBe(CURRENT_CONSENT_VERSION);
    expect(Number.isNaN(Date.parse(payload.consented_at))).toBe(false);
  });

  it("rejects a stale consent version without writing it", async () => {
    const { supabase, update } = makeClient(EMPTY_ROW);

    await expect(updateProfile(supabase, USER, {
      reason: "consent",
      consentVersion: "2026-09-27-v1",
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });

    expect(update).not.toHaveBeenCalled();
  });

  it("ignores a bare consentVersion without reason (no accidental consent)", async () => {
    const { supabase, update } = makeClient(EMPTY_ROW);

    await updateProfile(supabase, USER, { consentVersion: CURRENT_CONSENT_VERSION });

    expect(update).not.toHaveBeenCalled();
  });

  it("ignores consent under reason 'onboarding'", async () => {
    const { supabase, update } = makeClient({ ...EMPTY_ROW, onboarding_completed_at: "2026-09-27T00:00:00.000Z" });

    await updateProfile(supabase, USER, {
      onboardingCompleted: true,
      reason: "onboarding",
      consentVersion: CURRENT_CONSENT_VERSION,
    });

    expect(Object.keys(update.mock.calls[0][0] as object)).toEqual(["onboarding_completed_at"]);
  });

  it("does not issue an UPDATE when the request has no profile field", async () => {
    const { supabase, update } = makeClient(EMPTY_ROW);

    await updateProfile(supabase, USER, {});

    expect(update).not.toHaveBeenCalled();
  });
});
