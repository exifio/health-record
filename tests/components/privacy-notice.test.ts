import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const settingsSource = readFileSync(join(ROOT, "src/features/settings/SettingsContent.tsx"), "utf8");
const privacySource = readFileSync(join(ROOT, "src/features/settings/PrivacyContent.tsx"), "utf8");
const privacyPage = readFileSync(join(ROOT, "src/app/settings/privacy/page.tsx"), "utf8");
// 고지 문구는 설정 화면 요약과 상세 페이지로 나뉘어 있다. 어느 쪽이든 고지를 잃으면 안 된다.
const notices = settingsSource + privacySource;

describe("I-714 개인정보 및 AI 처리 안내 문구", () => {
  it("외부 AI 처리자로 기록이 전송되는 사실을 고지한다 (PRD 9-3)", () => {
    expect(notices).toContain("OpenAI");
    expect(notices).toMatch(/전송/);
  });

  it("삭제 후 백업 보존에 관한 사실을 고지한다 (PRD 9-4)", () => {
    expect(notices).toMatch(/백업/);
    expect(notices).toMatch(/계정 삭제/);
  });

  it("원본 우선 · AI 의료 판단 금지 · 비공개 고지를 유지한다", () => {
    expect(notices).toMatch(/원본 기록을 수정하거나 덮어쓰지 않습니다/);
    expect(notices).toMatch(/의료 진단/);
    expect(notices).toMatch(/다른 사용자에게 공개되지 않습니다/);
  });

  it("건강정보가 민감정보에 해당함을 밝힌다 (동의 UI는 두지 않는다)", () => {
    expect(privacySource).toMatch(/민감정보/);
    expect(privacySource).toMatch(/개인정보 보호법/);
    // 동의 화면은 이 페이지가 아니다 — 실제 동의는 온보딩/회원가입 플로우에서 별도로 만든다.
    expect(privacySource).not.toMatch(/type="checkbox"|<button/);
  });

  it("OpenAI API 전송을 단정형으로 알리고 학습 미사용·보유를 함께 밝힌다", () => {
    expect(privacySource).toMatch(/OpenAI API로 전송됩니다/);
    expect(privacySource).toMatch(/학습이나 개선에 사용되지 않습니다/);
    // "일정 기간"은 공식 문서로 확인된 사실(최대 30일)보다 약하다. 출처와 함께 적는다.
    expect(privacySource).toMatch(/최대 30일까지 보관될 수 있습니다/);
    expect(privacySource).toContain("developers.openai.com/api/docs/guides/your-data");
    expect(privacySource).toMatch(/악용 방지/);
    // "전송될 수 있습니다" 같은 가능성 표현으로 약화하지 않는다.
    expect(privacySource).not.toMatch(/전송될 수 있습니다/);
  });

  it("실제보다 강한 보안·삭제 단정은 쓰지 않는다", () => {
    expect(notices).not.toMatch(/철저하게|어떤 경우에도 접근|즉시 완전 삭제/);
  });

  it("보존 기간 숫자를 지어내지 않는다", () => {
    expect(privacySource).not.toMatch(/보존 기간은?\s*\d/);
    expect(privacySource).not.toMatch(/\d+일 이내/);
  });

  it("백업 보존 기간을 지어내지 않는다 (운영 정책 확인 전에는 숫자를 쓰지 않는다)", () => {
    expect(notices).not.toMatch(/보존 기간은?\s*\d+일/);
    expect(notices).not.toMatch(/\d+일간 보관/);
  });

  it("읽기 전용 고지는 설정 위계 밖(최하단)으로 내려 실제 액션을 밀어내지 않는다", () => {
    const order = [
      "theme-settings-section",
      "account-session-section",
      "danger-settings-section",
      "policy-settings-section",
    ].map((id) => settingsSource.indexOf(`data-testid="${id}"`));

    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe("F-710 설정 요약 + 상세 페이지 분리", () => {
  it("설정 화면에는 요약과 상세 링크만 남고 긴 안내문은 남아 있지 않다", () => {
    expect(settingsSource).toContain('href="/settings/privacy"');
    // 상세 페이지로 옮겨야 하는 문장은 설정 화면에 남지 않는다.
    expect(settingsSource).not.toMatch(/격리 보관/);
    expect(settingsSource).not.toMatch(/백업 사본/);
    expect(settingsSource).not.toMatch(/<ul|<li/);
  });

  it("상세 페이지는 독립 라우트로 등록되고 설정으로 돌아간다", () => {
    expect(privacyPage).toContain("PrivacyContent");
    expect(privacySource).toContain('href="/settings"');
  });

  it("요청한 6개 섹션을 모두 담는다", () => {
    for (const title of [
      "원본 기록과 AI 결과",
      "건강정보 처리",
      "AI 처리",
      "기록의 공개 범위",
      "기록 및 계정 삭제",
      "개인정보 처리방침",
    ]) {
      expect(privacySource).toContain(title);
    }
  });

  it("모달이나 바텀시트가 아니라 독립 페이지로만 연결한다", () => {
    expect(privacySource).not.toMatch(/role="dialog"/);
    expect(privacySource).not.toMatch(/delete-confirm-overlay/);
  });

  it("아직 없는 개인정보 처리방침은 깨진 링크 대신 비활성 상태로 둔다", () => {
    expect(privacySource).toMatch(/privacy-link--disabled/);
    expect(privacySource).not.toMatch(/href="\/privacy/);
  });

  it("정보 확인 페이지다 — 동의 액션을 두지 않는다", () => {
    // "consent"는 개인정보 처리방침 섹션의 안내 문구에 쓰이므로 체크박스/버튼만 금지한다.
    expect(privacySource).not.toMatch(/type="checkbox"|<button|동의하기|동의하고 시작/);
  });
});
