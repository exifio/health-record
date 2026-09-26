import { ProfileResponseSchema } from "@/contracts";
import { AppError } from "@/server/errors/app-error";

const createServerClientMock = jest.fn();
const requireUserMock = jest.fn();
const getProfileMock = jest.fn();
const updateProfileMock = jest.fn();

jest.mock("@/lib/supabase/server", () => ({ createServerClient: createServerClientMock }));
jest.mock("@/server/auth/require-user", () => ({ requireUser: requireUserMock }));
jest.mock("@/server/profile/profile-service", () => ({
  getProfile: getProfileMock,
  updateProfile: updateProfileMock,
}));

const USER = "11111111-1111-4111-8111-111111111111";
const SESSION_CLIENT = { session: true };

describe("logout route (I-105)", () => {
  const signOut = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    createServerClientMock.mockResolvedValue({ auth: { signOut } });
  });

  it("clears the local session and returns 204", async () => {
    signOut.mockResolvedValue({ error: null });
    const { POST } = await import("@/app/api/auth/logout/route");
    const response = await POST();

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("returns a generic 500 without leaking internals when sign-out fails", async () => {
    signOut.mockRejectedValue(new Error("supabase connection refused: secret-token"));
    const { POST } = await import("@/app/api/auth/logout/route");
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("secret-token");
  });
});

describe("profile route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createServerClientMock.mockResolvedValue(SESSION_CLIENT);
    requireUserMock.mockResolvedValue({ id: USER });
    getProfileMock.mockResolvedValue({ onboardingCompleted: false });
    updateProfileMock.mockResolvedValue({ onboardingCompleted: true });
  });

  it("returns the authenticated user's profile", async () => {
    const { GET } = await import("@/app/api/profile/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(ProfileResponseSchema.parse(await response.json())).toEqual({ onboardingCompleted: false });
    expect(getProfileMock).toHaveBeenCalledWith(SESSION_CLIENT, USER);
  });

  it("persists onboarding completion and echoes the stored shape", async () => {
    const { PATCH } = await import("@/app/api/profile/route");
    const response = await PATCH(
      new Request("https://health.example/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ onboardingCompleted: true }),
      }),
    );

    expect(response.status).toBe(200);
    expect(ProfileResponseSchema.parse(await response.json())).toEqual({ onboardingCompleted: true });
    expect(updateProfileMock).toHaveBeenCalledWith(SESSION_CLIENT, USER, { onboardingCompleted: true });
  });

  it("rejects a malformed body before touching the database", async () => {
    const { PATCH } = await import("@/app/api/profile/route");
    const response = await PATCH(
      new Request("https://health.example/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ onboardingCompleted: "yes" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request before reading the profile", async () => {
    requireUserMock.mockRejectedValueOnce(new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401));
    const { GET } = await import("@/app/api/profile/route");
    const response = await GET();

    expect(response.status).toBe(401);
    expect(getProfileMock).not.toHaveBeenCalled();
  });
});