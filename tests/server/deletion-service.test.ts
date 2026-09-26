import { deleteDailyRecord } from "@/server/daily-records/daily-record-service";
import { deleteAccount, deleteHealthData } from "@/server/account/account-service";

const USER = "11111111-1111-4111-8111-111111111111";
const DATE = "2026-09-25";

function makeSessionClient(rpcResult: { error: unknown } = { error: null }) {
  const events: string[] = [];
  return {
    events,
    rpc: jest.fn(async (name: string, args?: Record<string, unknown>) => {
      events.push(`rpc:${name}:${JSON.stringify(args ?? {})}`);
      return rpcResult;
    }),
    auth: {
      signOut: jest.fn(async ({ scope }: { scope: string }) => {
        events.push(`signOut:${scope}`);
        return { error: null };
      }),
    },
  };
}

function makeAdminClient(deleteError: unknown = null, events: string[] = []) {
  return {
    auth: {
      admin: {
        deleteUser: jest.fn(async (userId: string) => {
          events.push(`deleteUser:${userId}`);
          return { error: deleteError };
        }),
      },
    },
  };
}

describe("B6 deletion services", () => {
  it("deletes a date through the owner-checked atomic function", async () => {
    const supabase = makeSessionClient();
    await deleteDailyRecord(supabase as never, DATE);

    expect(supabase.rpc).toHaveBeenCalledWith("delete_daily_record", { p_local_date: DATE });
  });

  it("rejects invalid dates before the database call", async () => {
    const supabase = makeSessionClient();
    await expect(deleteDailyRecord(supabase as never, "2026-02-30"))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("deletes all health rows through one atomic owner-scoped function", async () => {
    const supabase = makeSessionClient();
    await deleteHealthData(supabase as never);

    expect(supabase.rpc).toHaveBeenCalledWith("delete_health_data");
  });

  it("deletes database data, removes the Auth user, then clears the local session", async () => {
    const supabase = makeSessionClient();
    const admin = makeAdminClient(null, supabase.events);
    await deleteAccount(supabase as never, admin as never, USER);

    expect(supabase.events).toEqual([
      "rpc:delete_account_data:{}",
      `deleteUser:${USER}`,
      "signOut:local",
    ]);
  });

  it("does not delete Auth when the database transaction fails", async () => {
    const supabase = makeSessionClient({ error: { message: "private database detail" } });
    const admin = makeAdminClient(null, supabase.events);

    await expect(deleteAccount(supabase as never, admin as never, USER))
      .rejects.toMatchObject({ code: "INTERNAL_ERROR", status: 500 });
    expect(supabase.events).toHaveLength(1);
  });

  it("clears the current session and returns a safe error when Auth deletion needs retry", async () => {
    const supabase = makeSessionClient();
    const admin = makeAdminClient({ message: "private Auth detail" }, supabase.events);
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      await expect(deleteAccount(supabase as never, admin as never, USER))
        .rejects.toMatchObject({ code: "INTERNAL_ERROR", status: 500 });
      expect(supabase.events).toEqual([
        "rpc:delete_account_data:{}",
        `deleteUser:${USER}`,
        "signOut:local",
      ]);
      expect(log).toHaveBeenCalledWith("account_delete_auth_failed");
      expect(JSON.stringify(log.mock.calls)).not.toContain("private Auth detail");
    } finally {
      log.mockRestore();
    }
  });
});
