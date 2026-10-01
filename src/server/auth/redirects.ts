/**
 * PRD 9-3: OAuth 복귀 후 이동할 경로를 **allowlist로** 제한한다.
 *
 * `next`는 사용자 입력(쿼리 파라미터)이므로 그대로 redirect에 쓰면 open redirect가 된다.
 * 허용 목록에 없는 값은 모두 기본 경로로 떨어뜨린다.
 *
 * 여기 담는 것은 **네비게이션 의도**뿐이다. 동의 여부나 건강 기록 내용은 담지 않는다
 * (동의의 단일 기준은 서버 DB).
 */
export const CONSENT_PATH = "/onboarding/health-consent";
export const DEFAULT_AFTER_AUTH_PATH = "/today";

/**
 * OAuth 복귀가 실제 로그인 1회였음을 클라이언트에 알리는 즉시 소모형 표식.
 * 동의 여부나 건강 기록을 담지 않는다. sessionStorage/localStorage는 쓰지 않는다
 * (PRD 9-3: 동의를 브라우저 storage에 복사하지 않는다).
 */
export const JUST_LOGGED_IN_COOKIE = "hr_just_logged_in";

const ALLOWED_NEXT_PATHS: readonly string[] = [CONSENT_PATH];

export function sanitizeNextPath(next: string | null | undefined): string {
  if (!next) return DEFAULT_AFTER_AUTH_PATH;
  // "/settings"만 허용하고 "//evil.com"(protocol-relative)과 "https://..."는 모두 배제한다.
  if (!ALLOWED_NEXT_PATHS.includes(next)) return DEFAULT_AFTER_AUTH_PATH;
  return next;
}
