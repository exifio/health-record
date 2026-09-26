import { AppError } from "@/server/errors/app-error";

const createServerClientMock = jest.fn();
const createAdminClientMock = jest.fn();
const requireUserMock = jest.fn();
const deleteDailyRecordMock = jest.fn();
const deleteHealthDataMock = jest.fn();
const deleteAccountMock = jest.fn();

jest.mock("@/lib/supabase/server", () => ({ createServerClient: createServerClientMock }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));
jest.mock("@/server/auth/require-user", () => ({ requireUser: requireUserMock }));
jest.mock("@/server/daily-records/daily-record-service", () => ({
  deleteDailyRecord: deleteDailyRecordMock,
}));
jest.mock("@/server/account/account-service", () => ({
  deleteHealthData: deleteHealthDataMock,
  deleteAccount: deleteAccountMock,
}));

const USER = "11111111-1111-4111-8111-111111111111";
const DATE = "2026-09-25";
const SESSION_CLIENT = { session: true };
const ADMIN_CLIENT = { admin: true };

describe("B6 destructive routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createServerClientMock.mockResolvedValue(SESSION_CLIENT);
    createAdminClientMock.mockReturnValue(ADMIN_CLIENT);
    requireUserMock.mockResolvedValue({ id: USER });
    deleteDailyRecordMock.mockResolvedValue(undefined);
    deleteHealthDataMock.mockResolvedValue(undefined);
    deleteAccountMock.mockResolvedValue(undefined);
  });

  it("deletes one date through the authenticated service and returns 204", async () => {
    const { DELETE } = await import("@/app/api/daily-records/[date]/route");
    const response = await DELETE(
      new Request(`https://health.example/api/daily-records/${DATE}`, { method: "DELETE" }),
      { params: Promise.resolve({ date: DATE }) },
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(deleteDailyRecordMock).toHaveBeenCalledWith(SESSION_CLIENT, DATE);
  });

  it("deletes all health data while keeping the account route separate", async () => {
    const { DELETE } = await import("@/app/api/health-data/route");
    const response = await DELETE();

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(deleteHealthDataMock).toHaveBeenCalledWith(SESSION_CLIENT);
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  it("deletes the account using the authenticated user and a server admin client", async () => {
    const { DELETE } = await import("@/app/api/account/route");
    const response = await DELETE();

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(deleteAccountMock).toHaveBeenCalledWith(SESSION_CLIENT, ADMIN_CLIENT, USER);
  });

  it("rejects unauthenticated deletion before constructing privileged clients", async () => {
    requireUserMock.mockRejectedValueOnce(new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401));
    const { DELETE } = await import("@/app/api/account/route");
    const response = await DELETE();

    expect(response.status).toBe(401);
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });
});
