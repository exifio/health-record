import type { LocalDate } from "@/contracts";

/**
 * F-210 / F-211: 기록 날짜와 timezone은 기기/브라우저 시스템 값에서만 결정한다.
 * 사용자가 직접 설정하는 UI는 제공하지 않는다(PRD 4.2).
 *
 * 이 모듈은 React나 API 구현에 의존하지 않는다. Mock API(둘러보기 샘플)도 같은
 * 날짜 규칙을 써야 하는데, api-adapter가 Mock을 import하므로 규칙을 여기 따로 둔다.
 */

/** Date를 시스템 시간대 기준 YYYY-MM-DD로 변환한다. UTC 변환을 거치지 않는다. */
export function formatLocalDate(now: Date): LocalDate {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as LocalDate;
}

export function getSystemLocalDate(now: Date = new Date()): LocalDate {
  return formatLocalDate(now);
}

export function getSystemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul";
  } catch {
    return "Asia/Seoul";
  }
}
