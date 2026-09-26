import { getSystemLocalDate, getSystemTimeZone, getDefaultHealthApi } from "@/features/api/api-adapter";

describe("api-adapter (F-006)", () => {
  it("computes local date in YYYY-MM-DD format correctly without UTC shifts", () => {
    const fixedDate = new Date(2026, 8, 25, 23, 30); // 2026-09-25 23:30 local
    expect(getSystemLocalDate(fixedDate)).toBe("2026-09-25");
  });

  it("detects system timezone as a non-empty string", () => {
    const tz = getSystemTimeZone();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });

  it("defaults to mock api when NEXT_PUBLIC_USE_MOCK is not false", () => {
    const api = getDefaultHealthApi();
    expect(typeof api.getDailyRecord).toBe("function");
    expect(typeof api.createMessage).toBe("function");
  });
});
