import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/require-user";
import { AppError } from "@/server/errors/app-error";

jest.mock("@/lib/supabase/server", () => ({ createServerClient: jest.fn() }));

const mockedCreateServerClient = createServerClient as jest.Mock;

function authWithUser(user: { id: string; is_anonymous?: boolean } | null) {
  return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) } };
}

describe("requireUser (B-004)", () => {
  afterEach(() => jest.resetAllMocks());

  it("returns the server-verified user", async () => {
    mockedCreateServerClient.mockReturnValue(authWithUser({ id: "user-1" }));

    await expect(requireUser()).resolves.toEqual({ id: "user-1" });
  });

  it("throws UNAUTHENTICATED without a session", async () => {
    mockedCreateServerClient.mockReturnValue(authWithUser(null));

    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  });

  it("treats anonymous Supabase sessions as unauthenticated", async () => {
    mockedCreateServerClient.mockReturnValue(authWithUser({ id: "guest-1", is_anonymous: true }));

    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  });

  it("throws UNAUTHENTICATED when getUser itself fails", async () => {
    mockedCreateServerClient.mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: "x" } }) },
    });

    await expect(requireUser()).rejects.toBeInstanceOf(AppError);
  });
});
