"use client";

/**
 * GTM 경유 이벤트 전송 (F-901 / I-719).
 *
 * Amplitude와 GA4 태그를 GTM 안에서 관리한다. 앱 코드는 dataLayer에 이벤트만 밀어 넣고,
 * 어떤 벤더로 어디로 보내는지는 GTM 설정이 책임진다. 벤더를 바꾸어도 이 파일은 안 건다.
 *
 * 개인정보 (SECURITY.md 6절):
 * - track() 는 문자열 인자 1개만 받는다. prop을 실수로 붙일 수 없다.
 * - 건강 원문, 기록 날짜, 계정 ID, URL path/query 를 dataLayer에 넣지 않는다.
 * - 동의 전에는 page_view 만 민다. 나머지는 PRD 9-3 동의 이후에만 나간다.
 */

/** 유일하게 동의 전에 내보내는 이벤트. 유입(utm) 측정을 위해 필요합니다. */
const ALLOWED_BEFORE_CONSENT = new Set(["page_view"]);

/** PRD 9-3: 동의의 단일 기준은 서버 프로필이다. 브라우저 storage에 복사본을 두지 않습니다. */
let consented = false;

function dataLayer(): unknown[] {
  const g = globalThis as unknown as { dataLayer?: unknown[] };
  g.dataLayer ??= [];
  return g.dataLayer;
}

/**
 * GTM 컨테이너 스크립트는 layout 에서 먼저 로드된다. 여기서는 그 초기화가
 * 끝났음을 보장하며 이벤트를 밀어 넣는다.
 */
export function initAnalytics(): void {
  dataLayer();
}

/**
 * 동의 화면에서 서버 프로필 저장에 성공한 뒤 호출합니다.
 * 세션 동안만 유지됩니다 — 새로고침하면 서버 프로필이 다시 판정합니다.
 * storage에 쓰지 않으므로 PRD 9-3의 "동의 단일 기준은 서버"가 유지됩니다.
 */
export function grantAnalyticsConsent(): void {
  consented = true;
  // GTM의 consent 상태도 함께 갱신한다. 태그가 조건을 참조할 수 있게.
  dataLayer().push({ event: "analytics_consent", analytics_consent: "granted" });
}

/**
 * MVP 이벤트 5개만 보냅니다. prop 을 붙이지 않는 것이 의도입니다.
 * 기기 단위 식별자와 이벤트 이름만으로 funnel 3단(방문 → 기록 → 재확인)이 계산되고,
 * 건강 정보가 유출될 여지가 0 이 됩니다.
 * utm_source/medium/campaign 은 GTM의 GA4/Amplitude 태그가 landing page 에서 읽습니다.
 *
 * ponytail: 기기 단위 추적만 한다(계정 단위 없음). 다중 기기 중복 집계가 필요해지면
 * 그때 해시된 user id 를 dataLayer에 추가한다.
 */
export function track(event: string): void {
  if (!ALLOWED_BEFORE_CONSENT.has(event) && !consented) return;
  dataLayer().push({ event });
}