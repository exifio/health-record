import { createServerClient } from "@/lib/supabase/server";
import { getServerSession } from "@/server/auth/session";

jest.mock("@/lib/supabase/server", () => ({ createServerClient: jest.fn() }));

const mockedCreateServerClient = createServerClient as jest.Mock;

function authWithUser(user: unknown, error: unknown = null) {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error }) } };
}

describe("getServerSession (I-104)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the authenticated user from the server session", async () => {
    mockedCreateServerClient.mockResolvedValue(
      authWithUser({
        id: "user-1",
        email: "user@example.com",
        user_metadata: { full_name: "홍길동" },
      })
    );

    await expect(getServerSession()).resolves.toEqual({
      status: "authenticated",
      user: { id: "user-1", email: "user@example.com", name: "홍길동" },
    });
  });

  it("falls back to the name claim when full_name is absent", async () => {
    mockedCreateServerClient.mockResolvedValue(
      authWithUser({ id: "user-1", email: "a@b.c", user_metadata: { name: "Fallback" } })
    );

    const session = await getServerSession();
    expect(session.user?.name).toBe("Fallback");
  });

  it("omits the name when metadata has no usable claim", async () => {
    mockedCreateServerClient.mockResolvedValue(
      authWithUser({ id: "user-1", email: "a@b.c", user_metadata: {} })
    );

    const session = await getServerSession();
    expect(session.user).toEqual({ id: "user-1", email: "a@b.c" });
  });

  it("treats anonymous sessions as unauthenticated", async () => {
    mockedCreateServerClient.mockResolvedValue(authWithUser({ id: "guest", is_anonymous: true }));

    await expect(getServerSession()).resolves.toEqual({ status: "unauthenticated", user: null });
  });

  it("treats a missing session as unauthenticated", async () => {
    mockedCreateServerClient.mockResolvedValue(authWithUser(null));

    await expect(getServerSession()).resolves.toEqual({ status: "unauthenticated", user: null });
  });

  it("treats a getUser error as unauthenticated instead of throwing", async () => {
    mockedCreateServerClient.mockResolvedValue(authWithUser(null, { message: "network" }));

    await expect(getServerSession()).resolves.toEqual({ status: "unauthenticated", user: null });
  });

  it("treats a server configuration failure as unauthenticated", async () => {
    mockedCreateServerClient.mockRejectedValue(new Error("Missing NEXT_PUBLIC_SUPABASE_URL"));

    await expect(getServerSession()).resolves.toEqual({ status: "unauthenticated", user: null });
  });
});