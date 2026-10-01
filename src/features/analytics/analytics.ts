"use client";

import * as Amplitude from "@amplitude/analytics-browser";

/**
 * 유일하게 동의 전에 올리는 이벤트. 유입(utm) 측정을 위해 필요하다.
 * 나머지 이벤트는 사용자의 민감정보 동의(PRD 9-3) 이후에만 전송한다.
 */
const ALLOWED_BEFORE_CONSENT = new Set(["page_view"]);

let ready = false;
/** PRD 9-3: 동의의 단일 기준은 서버 프로필이다. 브라우저 storage에 복사본을 두지 않는다. */
let consented = false;

/**
 * Amplitude SDK는 init이 프로젝트 단위라 이벤트별로 나눌 수 없다.
 * 대신 track() 래퍼에서 consent gate를 건다 — 한 번 init하고 거기서 막는다.
 */
export function initAnalytics(): void {
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey || ready) return;
  ready = true;
  Amplitude.init(apiKey, {
    defaultTracking: {
      pageViews: false, // 경로 정의가 analytics-provider.tsx 한 곳에 있으므로 자동 추적을 끈다.
      formInteractions: false,
      fileDownloads: false,
      sessions: true,
      // UTM 채널 측정. CampaignParser가 utm_*/click id/referrer 같은
      // allowlist 항목만 뽑아내므로 query string 전체가 전송되지는 않는다.
      attribution: true,
    },
    // SECURITY.md 6절: URL path/query를 전송하지 않는다. 기본값(true)이면 SDK가
    // [Amplitude] Page URL/Path/Domain을 모든 이벤트에 붙인다 — defaultTracking만으로는
    // 안 꺼지고, 이 autocapture.pageUrlEnrichment를 꺼야 한다.
    autocapture: {
      fileDownloads: false,
      formInteractions: false,
      pageViews: false,
      sessions: true,
      elementInteractions: false,
      pageUrlEnrichment: false,
      networkTracking: false,
      webVitals: false,
      frustrationInteractions: false,
    },
  });
}

/**
 * 동의 화면에서 서버 프로필 저장에 성공한 뒤 호출한다.
 * 세션 동안만 유지된다 — 새로고침하면 서버 프로필이 다시 판정한다.
 * storage에 쓰지 않으므로 PRD 9-3의 "동의 단일 기준은 서버"가 유지된다.
 */
export function grantAnalyticsConsent(): void {
  consented = true;
  console.debug("[amp] consent granted");
}

/**
 * MVP 이벤트 5개만 전송한다. prop을 붙이지 않는 것이 의도다.
 * 건강 원문·날짜·user id를 서드파티로 내보내지 않으면서,
 * funnel 3단(방문 → 기록 → 재확인)은 device_id와 이벤트 이름만으로 계산된다.
 * utm_source/medium/campaign 은 Amplitude가 acquisition으로 자동 수집한다.
 *
 * ponytail: 기기 단위 식별자만 쓴다(계정 단위 추적 없음). 다중 기기에서 중복 집계가
 * 필요해지면 그때 user id 를 sha256 해시로 넘긴다.
 */
export function track(event: string): void {
  const allowed = ALLOWED_BEFORE_CONSENT.has(event);
  const blocked = !ready || (!allowed && !consented);
  console.debug(`[amp] track(${event}) ready=${ready} consented=${consented} ${blocked ? "BLOCKED" : "sent"}`);
  if (!ready) return;
  if (!ALLOWED_BEFORE_CONSENT.has(event) && !consented) return;
  Amplitude.track(event);
}
