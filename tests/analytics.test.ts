/**
 * Consent gate와벤더 중립성을 검증한다. 데이터 수집은 전부 GTM 이 담당하고
 * 앱 코드는 dataLayer 에 이벤트만 민다 (F-901 / I-719).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const SENT: string[] = [];
const CONSENT_PUSHED: string[] = [];

/** dataLayer 대신 배열로 대체한다. */
function installDataLayer() {
  delete (globalThis as unknown as { dataLayer?: unknown[] }).dataLayer;
}

describe("analytics consent gate", () => {
  beforeEach(() => {
    jest.resetModules();
    SENT.length = 0;
    CONSENT_PUSHED.length = 0;
    installDataLayer();
    const layer = (globalThis as unknown as { dataLayer: unknown[] }).dataLayer = [] as unknown[];
    layer.push = ((...args: unknown[]) => {
      for (const a of args) {
        const e = a as { event?: string };
        if (e?.event === "analytics_consent") CONSENT_PUSHED.push("consent");
        else if (e?.event) SENT.push(e.event);
      }
      return 0;
    }) as unknown[]["push"];
  });

  it("page_view 만 동의 전에 내보내고 나머지는 막는다", async () => {
    const { initAnalytics, track } = await import("@/features/analytics/analytics");
    initAnalytics();
    track("page_view");
    track("record_created");
    track("record_history_opened");
    track("summary_viewed");
    track("login_completed");
    expect(SENT).toEqual(["page_view"]);
  });

  it("동의 후에는 기록/요약 이벤트도 내보낸다", async () => {
    const { initAnalytics, grantAnalyticsConsent, track } = await import("@/features/analytics/analytics");
    grantAnalyticsConsent();
    initAnalytics();
    track("record_created");
    track("record_history_opened");
    track("summary_viewed");
    expect(SENT).toEqual(["record_created", "record_history_opened", "summary_viewed"]);
  });

  it("동의 시 GTM consent 상태를 함께 갱신한다", async () => {
    const { grantAnalyticsConsent } = await import("@/features/analytics/analytics");
    grantAnalyticsConsent();
    expect(CONSENT_PUSHED).toEqual(["consent"]);
  });
});

describe("GTM 연동", () => {
  it("컨테이너 ID가 없으면 아무것도 로드하지 않는다 (비활성 기본값)", () => {
    const gtm = read("src/features/analytics/gtm-script.tsx");
    expect(gtm).toMatch(/if \(!containerId\) return null/);
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/NEXT_PUBLIC_GTM_ID/);
  });

  it("앱 코드가 dataLayer 로드하지 않는다 — GTM 이 컨테이너를 싣는다", () => {
    const gtm = read("src/features/analytics/gtm-script.tsx");
    expect(gtm).toContain("googletagmanager.com/gtm.js");
  });

  // 벤더를 GTM 으로 옮기면서 Amplitude 전용 설정이 그대로 남지 않았는지 확인한다.
  // Amplitude SDK 는 URL 이 자동으로 붙였다. GTM 으로 옮기면 그 대신 GTM 태그가
  // 붙이므로, 태그 설정 화면에서 Page URL을 반드시 꺼야 한다 (SECURITY.md 6절).
  it("앱 코드가 dataLayer 에 URL이나 경로를 넣지 않는다", () => {
    for (const f of [
      "src/features/analytics/analytics.ts",
      "src/features/analytics/analytics-provider.tsx",
    ]) {
      const code = read(f);
      expect(code).not.toMatch(/Page URL|Page Path|Page Location/);
      // pathname 은 라우트 변경 감지에만 쓰인다. dataLayer push 안에는 절대 넣지 않는다.
      const pushes = code.match(/dataLayer\(\)\.push\([^)]*\)/g) ?? [];
      for (const p of pushes) {
        expect(p).not.toMatch(/pathname|path|url|href|location/i);
      }
    }
  });
});

describe("PRD 9-3 / SECURITY.md 6절 준수", () => {
  it("동의를 브라우저 storage에 쓰지 않는다", () => {
    expect(read("src/features/analytics/analytics.ts")).not.toMatch(/localStorage|sessionStorage/);
    expect(read("src/features/auth/auth-context.tsx")).not.toMatch(/localStorage|sessionStorage/);
  });

  it("track() 은 문자열 인자 1개만 받아 prop 실수를 구조적으로 막는다", () => {
    expect(read("src/features/analytics/analytics.ts")).toMatch(
      /export function track\(event: string\): void/,
    );
  });

  it("호출부마다 prop 없이 이벤트 이름만 보낸다", () => {
    for (const f of [
      "src/features/records/components/TodayRecordView.tsx",
      "src/features/records/components/RecordsListContent.tsx",
      "src/components/summary/DailySummaryCard.tsx",
      "src/features/auth/auth-context.tsx",
      "src/features/onboarding/HealthConsentContent.tsx",
    ]) {
      const calls = read(f).match(/track\([^)]*\)/g) ?? [];
      for (const call of calls) {
        expect(call).toMatch(/^track\("[a-z_]+"\)$/);
      }
    }
  });

  it("동의 플래그를 서버 프로필과 동의 화면이 실제로 켠다", () => {
    expect(read("src/features/auth/auth-context.tsx")).toMatch(/grantAnalyticsConsent\(\)/);
    expect(read("src/features/onboarding/HealthConsentContent.tsx")).toMatch(/grantAnalyticsConsent\(\)/);
  });

  it("로그인 표식은 즉시 소모되는 cookie 다", () => {
    expect(read("src/app/api/auth/callback/route.ts")).toMatch(/JUST_LOGGED_IN_COOKIE/);
    expect(read("src/features/auth/auth-context.tsx")).toMatch(/Max-Age=0/);
  });
});