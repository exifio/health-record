const signInWithOAuth = jest.fn();
const exchangeCodeForSession = jest.fn();
const createServerClientMock = jest.fn();
let mockCookies: { getAll: () => unknown[]; setAll: (...args: unknown[]) => void };

jest.mock("@/lib/supabase/server", () => ({ createServerClient: createServerClientMock }));
jest.mock("next/headers", () => async () => mockCookies);

describe("GET /api/auth/google (B-003)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createServerClientMock.mockResolvedValue({ auth: { signInWithOAuth, exchangeCodeForSession } });
    mockCookies = { getAll: () => [], setAll: jest.fn() };
    signInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" },
      error: null,
    });
  });

  it("redirects to Google with a callback on this origin", async () => {
    const { GET } = await import("@/app/api/auth/google/route");
    const response = await GET(new Request("https://health.example/api/auth/google"));

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://health.example/api/auth/callback" },
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("accounts.google.com");
  });

  it("returns INTERNAL_ERROR when the provider URL is missing", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: "oauth disabled" } });
    const { GET } = await import("@/app/api/auth/google/route");

    const response = await GET(new Request("https://health.example/api/auth/google"));
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL_ERROR");
  });
});

describe("GET /api/auth/callback (B-003)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createServerClientMock.mockResolvedValue({ auth: { signInWithOAuth, exchangeCodeForSession } });
    mockCookies = { getAll: () => [], setAll: jest.fn() };
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
  });

  it("exchanges the authorization code and stores session cookies", async () => {
    const { GET } = await import("@/app/api/auth/callback/route");
    const response = await GET(new Request("https://health.example/api/auth/callback?code=abc123"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/");
  });

  it("rejects a missing code with VALIDATION_ERROR", async () => {
    const { GET } = await import("@/app/api/auth/callback/route");
    const response = await GET(new Request("https://health.example/api/auth/callback"));

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("does not leak provider error details on exchange failure", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: "token endpoint 500" } });
    const { GET } = await import("@/app/api/auth/callback/route");
    const response = await GET(new Request("https://health.example/api/auth/callback?code=abc"));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toEqual({
      code: "VALIDATION_ERROR",
      message: "로그인에 실패했습니다. 다시 시도해주세요.",
    });
  });
});
