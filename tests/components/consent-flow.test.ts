import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CURRENT_CONSENT_VERSION } from "@/contracts";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const page = read("src/features/onboarding/HealthConsentContent.tsx");
const authContext = read("src/features/auth/auth-context.tsx");
const home = read("src/features/home/HomeContent.tsx");
const todayView = read("src/features/records/components/TodayRecordView.tsx");
const loginModal = read("src/components/auth/LoginModal.tsx");
const privacy = read("src/features/settings/PrivacyContent.tsx");
const errors = read("src/server/daily-records/errors.ts");
const b10 = read("supabase/migrations/20260927110000_b10_enforce_health_consent.sql");
const b9 = read("supabase/migrations/20260927090000_b9_sensitive_info_consent.sql");

const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

describe("PRD 9-3 전용 동의 페이지 (/onboarding/health-consent)", () => {
  it("전용 페이지를 만든다 (모달이 아니라 full page)", () => {
    expect(read("src/app/onboarding/health-consent/page.tsx")).toContain("HealthConsentContent");
    expect(page).not.toMatch(/role="dialog"|modal-overlay/);
  });

  it("로그인 모달은 인증만 담당한다", () => {
    expect(code(loginModal)).not.toMatch(/동의|consent/);
  });

  it("오늘 기록 화면에서 동의 UI를 완전히 제거한다", () => {
    expect(home).not.toMatch(/ConsentCard|consent-card|민감정보/);
    expect(home).not.toMatch(/needsConsent|canWrite/);
    expect(todayView).not.toMatch(/ConsentCard|canWrite/);
  });

  it("동의는 기록 시작 시도에만 보낸다 (단순 로그인으로 자동 이동하지 않음)", () => {
    expect(authContext).toMatch(/router\.push\(CONSENT_PATH\)/);
    // openLoginModal(설정·데모배너 등)은 next를 채우지 않는다.
    expect(authContext).toMatch(/const openLoginModal = useCallback\(\(\) => \{\s*setStartFlowNext\(undefined\);/);
    expect(authContext).toMatch(/setStartFlowNext\(CONSENT_PATH\);\s*setIsLoginModalOpen\(true\);/);
  });

  it("동의 여부는 서버 DB로만 판단한다", () => {
    expect(code(authContext)).not.toMatch(/localStorage|sessionStorage/);
    expect(authContext).toMatch(/setHasConsented\(profile\.consentVersion === CURRENT_CONSENT_VERSION\)/);
  });
});

describe("동의 페이지 UI", () => {
  it("요구된 제목·설명·항목을 담는다", () => {
    expect(page).toContain("건강 기록을 시작하기 전에 확인해주세요");
    expect(page).toContain("민감정보에 해당하는 건강정보가 포함될 수 있습니다");
    expect(page).toMatch(/수집·이용 항목/);
    expect(page).toMatch(/이용 목적/);
    expect(page).toMatch(/AI 처리/);
    expect(page).toMatch(/진료 준비용 기록 생성/);
    expect(page).toContain("OpenAI API로 전송");
    expect(page).toMatch(/원본 기록을\s*수정하거나 덮어쓰지 않습니다/);
  });

  it("상세 고지는 기존 페이지를 재사용하고, 상세 페이지에는 동의 UI가 없다", () => {
    expect(page).toContain('href="/settings/privacy"');
    expect(code(privacy)).not.toMatch(/type="checkbox"|동의하고/);
  });

  it("체크 전에는 동의 버튼이 비활성이고, 필수 표기가 있다", () => {
    expect(page).toMatch(/disabled=\{!isChecked \|\| isSubmitting\}/);
    expect(page).toContain("[필수] 민감정보(건강정보) 처리에 동의합니다.");
  });

  it("'나중에' 표현을 쓰지 않는다", () => {
    expect(page).not.toContain("나중에");
    expect(page).toContain("동의하지 않고 돌아가기");
  });

  it("저장 실패하면 이동하지 않는다", () => {
    // 실패한 채 이동하면 이력이 없는 상태로 기록 화면에 도착한다.
    expect(page).toMatch(/await recordConsent\(CURRENT_CONSENT_VERSION\);\s*router\.push\(next\);/);
    expect(page).toMatch(/동의 저장에 실패했습니다/);
  });

  it("이미 동의한 계정은 다시 묻지 않는다", () => {
    expect(page).toContain("이미 동의하셨습니다");
  });

  it("로그인 없이 직접 URL로 들어오면 안내만 한다", () => {
    expect(page).toMatch(/status !== "authenticated"/);
  });

  it("보관 기간은 OpenAI 정책에서 확인된 값만 적는다", () => {
    // 출처가 있는 숫자(최대 30일)만 쓴다. 앱의 백업 보존 기간은 아직 미정이므로 지어내지 않는다.
    expect(page).toMatch(/최대 30일까지 보관될 수 있습니다/);
    expect(page).toContain("developers.openai.com/api/docs/guides/your-data");
    expect(page).not.toMatch(/백up|백업 사본|보존 기간은?\s*\d일/);
  });
});

describe("서버 측 강제 (우회 방지)", () => {
  it("기록 추가 RPC가 동의를 확인한다", () => {
    expect(b10).toMatch(/create or replace function public\.create_record_message/);
    expect(b10).toMatch(/create or replace function public\.create_record_correction/);
    expect(b10.match(/raise exception 'CONSENT_REQUIRED'/g)?.length).toBe(2);
  });

  // TS와 SQL에 버전이 여러 번 적혀 있다(마이그레이션마다 새 정의를 추가한다).
  // 마지막 정의만 유효하므로 "가장 나중 파일"이 CURRENT_CONSENT_VERSION과 같아야 한다.
  const b11 = read("supabase/migrations/20260927120000_b11_consent_version_v2.sql");

  it("DB의 최신 버전 문자열이 CURRENT_CONSENT_VERSION과 같다", () => {
    expect(b11).toContain(`consent_version = '${CURRENT_CONSENT_VERSION}'`);
  });

  it("B10/B11 둘 다 두 함수를 재정의한다 (마지막 정의가 살아야 한다)", () => {
    for (const sql of [b10, b11]) {
      expect(sql).toMatch(/create or replace function public\.create_record_message/);
      expect(sql).toMatch(/create or replace function public\.create_record_correction/);
      expect(sql.match(/raise exception 'CONSENT_REQUIRED'/g)?.length).toBe(2);
    }
  });

  it("동의 필드는 B9 컬럼을 재사용한다 (중복 컬럼 없음)", () => {
    expect(b9).toMatch(/consent_version text null/);
    expect(b9).toMatch(/consented_at timestamptz null/);
    expect(b10).not.toMatch(/add column/);
  });

  it("CONSENT_REQUIRED를 API 오류 코드로 매핑한다", () => {
    expect(errors).toMatch(/CONSENT_REQUIRED: \{[\s\S]*?code: "CONSENT_REQUIRED"[\s\S]*?status: 403/);
  });

  it("서버가 거절하면 클라이언트가 동의 페이지로 보낸다", () => {
    expect(todayView).toMatch(/isApiError\(error, API_ERROR_CODES\.consentRequired\)/);
    expect(todayView).toMatch(/router\.push\(CONSENT_PATH\)/);
  });

  it("차단은 원문 추가 경로에만 둔다 (조회·삭제는 열어 둔다)", () => {
    // 동의 거부 상태에서도 사용자는 자기 데이터를 지울 수 있어야 한다.
    expect(b10).not.toMatch(/delete_daily_record|delete_health_data|delete_account_data/);
  });

  // B7이 두 함수를 security definer로 바꿨다. B10이 옛 정의를 복사하면
  // 소유권 검증이 사라져 타인 기록에 접근할 수 있다.
  it("B7의 security definer + 소유권 검정을 되돌려 쓰지 않는다", () => {
    const sql = b10.replace(/--.*$/gm, "");
    expect(sql.match(/security definer/g)?.length).toBe(2);
    expect(b10.replace(/--.*$/gm, "")).not.toMatch(/security invoker/);
    expect(b10.match(/auth\.uid\(\)\) is distinct from p_user_id/g)?.length).toBe(2);
  });
});

describe("OAuth 복귀 (시나리오 A/D/F)", () => {
  it("네비게이션 의도만 allowlist로 전달한다", () => {
    const redirects = read("src/server/auth/redirects.ts");
    expect(redirects).toContain("ALLOWED_NEXT_PATHS");
    expect(redirects).toContain("CONSENT_PATH");
  });

  it("동의 상태나 건강 기록을 storage에 쓰지 않는다", () => {
    expect(code(authContext)).not.toMatch(/localStorage|sessionStorage/);
    expect(code(page)).not.toMatch(/localStorage|sessionStorage/);
  });
});
