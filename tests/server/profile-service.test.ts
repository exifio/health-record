import { getProfile, updateProfile } from "@/server/profile/profile-service";

const USER = "11111111-1111-4111-8111-111111111111";

function selectChain(maybeSingle: jest.Mock) {
  return {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle,
  };
}

describe("profile service", () => {
  it("maps a completed onboarding timestamp to true", async () => {
    const supabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { onboarding_completed_at: "2026-09-25T00:00:00.000Z" },
        error: null,
      }),
    } as never;

    await expect(getProfile(supabase, USER)).resolves.toEqual({ onboardingCompleted: true });
  });

  it("treats a null onboarding timestamp as not completed", async () => {
    const supabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { onboarding_completed_at: null }, error: null }),
    } as never;

    await expect(getProfile(supabase, USER)).resolves.toEqual({ onboardingCompleted: false });
  });

  it("treats a missing profile row as onboarding not completed", async () => {
    const supabase = selectChain(jest.fn().mockResolvedValue({ data: null, error: null })) as never;

    await expect(getProfile(supabase, USER)).resolves.toEqual({ onboardingCompleted: false });
  });

  it("converts unknown database errors into a generic application error", async () => {
    const supabase = selectChain(
      jest.fn().mockResolvedValue({ data: null, error: { message: "connection failure" } }),
    ) as never;

    await expect(getProfile(supabase, USER)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
    });
  });

  it("stores an ISO timestamp when onboarding is completed", async () => {
    const update = jest.fn().mockResolvedValue({ error: null });
    const eq = jest.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: jest.fn().mockReturnThis(),
      update: update.mockReturnThis(),
      eq,
    } as never;

    await expect(
      updateProfile(supabase, USER, { onboardingCompleted: true }),
    ).resolves.toEqual({ onboardingCompleted: true });

    const payload = update.mock.calls[0][0] as { onboarding_completed_at: string | null };
    expect(typeof payload.onboarding_completed_at).toBe("string");
    expect(Number.isNaN(Date.parse(payload.onboarding_completed_at as string))).toBe(false);
  });

  it("clears the timestamp when onboarding is reset", async () => {
    const update = jest.fn().mockReturnThis();
    const supabase = {
      from: jest.fn().mockReturnThis(),
      update,
      eq: jest.fn().mockResolvedValue({ error: null }),
    } as never;

    await expect(
      updateProfile(supabase, USER, { onboardingCompleted: false }),
    ).resolves.toEqual({ onboardingCompleted: false });
    expect(update.mock.calls[0][0]).toEqual({ onboarding_completed_at: null });
  });
});