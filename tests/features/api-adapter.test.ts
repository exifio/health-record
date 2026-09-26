import {
  getDefaultHealthApi,
  getHealthApiForAuthStatus,
} from "@/features/api/api-adapter";
import {
  formatLocalDate,
  getSystemLocalDate,
  getSystemTimeZone,
} from "@/features/api/system-time";

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

  describe("로그인 상태에 따른 API 선택 (F-106 / I-106)", () => {
    /** Mock 구현에만 있는 작업이다. 실제 API adapter에는 없다. */
    const MOCK_ONLY_OPERATION = "runSummaryWorker";

    it("비로그인·둘러보기는 샘플 기록을 볼 수 있다", async () => {
      for (const status of ["unauthenticated", "demo"] as const) {
        const api = getHealthApiForAuthStatus(status);
        expect(MOCK_ONLY_OPERATION in api).toBe(true);

        const res = await api.getDailyRecord("2026-09-25");
        expect(res.record.date).toBe("2026-09-25");
        expect(res.record.messages.length).toBeGreaterThan(0);
      }
    });

    it("비로그인·둘러보기 목록은 fixture 샘플만 내려준다(같은 원문 중복 없음)", async () => {
      const api = getHealthApiForAuthStatus("unauthenticated");
      const today = getSystemLocalDate();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 90);

      const list = await api.getDailyRecords(formatLocalDate(fromDate), today);
      const dates = list.items.map((item) => item.date);

      // 실행 시점 날짜에 같은 원문을 복제하면 샘플이 중복돼 보이므로 fixture 4건만 온다.
      expect(dates).toEqual(["2026-09-25", "2026-09-24", "2026-09-23", "2026-09-22"]);
    });

    it("로그인 상태에서는 기본(환경변수로 선택된) API를 그대로 쓴다", () => {
      const defaultApi = getDefaultHealthApi();
      const authenticatedApi = getHealthApiForAuthStatus("authenticated");
      const guestApi = getHealthApiForAuthStatus("unauthenticated");

      expect(MOCK_ONLY_OPERATION in guestApi).toBe(true);
      expect(MOCK_ONLY_OPERATION in authenticatedApi).toBe(MOCK_ONLY_OPERATION in defaultApi);
      expect(typeof authenticatedApi.getDailyRecord).toBe("function");
    });
  });
});

