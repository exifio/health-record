/**
 * Consent gate가 유지되는지 확인한다. SDK는 브라우저 전용이라 모듈만 모킹한다.
 * 저장소(storage) 사용도 함께 막는다 — PRD 9-3: 동의의 단일 기준은 서버 프로필.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SENT: string[] = [];

jest.mock("@amplitude/analytics-browser", () => ({
  init: jest.fn(),
  track: jest.fn((e: string) => {
    SENT.push(e);
  }),
}));

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("analytics consent gate", () => {
  beforeEach(() => {
    jest.resetModules();
    SENT.length = 0;
  });

  it("page_view만 동의 전에 보내고 나머지 이벤트는 막는다", async () => {
    const { initAnalytics, track } = await import("@/features/analytics/analytics");
    process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = "test-key";
    initAnalytics();
    track("page_view");
    track("record_created");
    track("record_history_opened");
    track("summary_viewed");
    track("login_completed");
    expect(SENT).toEqual(["page_view"]);
  });

  it("동의 후에는 기록/요약 이벤트도 보낸다", async () => {
    const { initAnalytics, grantAnalyticsConsent, track } = await import("@/features/analytics/analytics");
    process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = "test-key";
    grantAnalyticsConsent();
    initAnalytics();
    track("record_created");
    track("record_history_opened");
    track("summary_viewed");
    expect(SENT).toEqual(["record_created", "record_history_opened", "summary_viewed"]);
  });

  it("API key가 없으면 아무것도 보내지 않는다", async () => {
    const { initAnalytics, grantAnalyticsConsent, track } = await import("@/features/analytics/analytics");
    delete process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
    grantAnalyticsConsent();
    initAnalytics();
    track("page_view");
    track("record_created");
    expect(SENT).toEqual([]);
  });
});

describe("PRD 9-3 / AGENTS.md 2절 준수", () => {
  it("동의를 브라우저 storage에 쓰지 않는다", () => {
    expect(read("src/features/analytics/analytics.ts")).not.toMatch(/localStorage|sessionStorage/);
    expect(read("src/features/auth/auth-context.tsx")).not.toMatch(/localStorage|sessionStorage/);
  });

  it("이벤트에 건강 원문·날짜 prop을 붙이지 않는다", () => {
    const analytics = read("src/features/analytics/analytics.ts");
    // track() 이 인자를 하나만 받게 하면 prop 실수를 구조적으로 막는다.
    expect(analytics).toMatch(/export function track\(event: string\): void/);
  });

  it("health 원문을 analytics로 보내는 코드가 없다", () => {
    for (const f of [
      "src/features/records/components/TodayRecordView.tsx",
      "src/features/records/components/RecordsListContent.tsx",
      "src/components/summary/DailySummaryCard.tsx",
    ]) {
      const code = read(f);
      const calls = code.match(/track\([^)]*\)/g) ?? [];
      for (const call of calls) {
        expect(call).toMatch(/^track\("[a-z_]+"\)$/);
      }
    }
  });

  // SECURITY.md 6절: URL path/query를 전송하지 않는다.
  // Amplitude SDK는 defaultTracking.pageViews 를 꺼도 autocapture.pageUrlEnrichment 로
  // [Amplitude] Page URL/Path/Domain을 모든 이벤트에 붙인다. 두 설정이 서로 다른 곳을 본다.
  it("SDK가 URL을 이벤트에 붙이지 못하도록 두 설정을 모두 끈다", () => {
    const analytics = read("src/features/analytics/analytics.ts");
    expect(analytics).toMatch(/pageUrlEnrichment: false/);
    expect(analytics).toMatch(/pageViews: false/);
    expect(analytics).not.toMatch(/pageUrlEnrichment: true/);
  });

  // UTM은 defaultTracking.attribution 에서 켠다. autocapture 가 아니라 defaultTracking 이다.
  // isTrackingEnabled 는 키가 없으면 false 라 이게 없으면 유입 측정이 조용히 0 이 된다.
  it("UTM attribution 이 실제로 켜져 있다", () => {
    expect(read("src/features/analytics/analytics.ts")).toMatch(/attribution: true/);
  });

  // consent 게이트를 통과시키는 호출이 실제 로그인 흐름에 존재해야 한다.
  // 이게 없으면 동의한 사용자의 이벤트가 영영 전송되지 않는다.
  it("동의 플래그를 서버 프로필과 동의 화면이 실제로 켠다", () => {
    expect(read("src/features/auth/auth-context.tsx")).toMatch(/grantAnalyticsConsent\(\)/);
    expect(read("src/features/onboarding/HealthConsentContent.tsx")).toMatch(/grantAnalyticsConsent\(\)/);
  });

  it("로그인 표식은 즉시 소모되는 cookie 다 (localStorage/sessionStorage 아님)", () => {
    const callback = read("src/app/api/auth/callback/route.ts");
    expect(callback).toMatch(/JUST_LOGGED_IN_COOKIE/);
    expect(callback).toMatch(/Max-Age=60/);
    // 소비는 클라이언트가 즉시 지운다 — 중복 집계 방지
    const auth = read("src/features/auth/auth-context.tsx");
    expect(auth).toMatch(/Max-Age=0/);
  });

  it("SDK 설정이 없으면 전송하지 않는다 (Production release gate)", () => {
    const analytics = read("src/features/analytics/analytics.ts");
    expect(analytics).toMatch(/if \(!apiKey \|\| ready\) return/);
  });
});
