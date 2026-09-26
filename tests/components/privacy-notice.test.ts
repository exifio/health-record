import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const source = readFileSync(join(ROOT, "src/features/settings/SettingsContent.tsx"), "utf8");

describe("I-714 개인정보 및 AI 처리 안내 문구", () => {
  it("외부 AI 처리자로 기록이 전송되는 사실을 고지한다 (PRD 9-3)", () => {
    expect(source).toContain("OpenAI");
    expect(source).toMatch(/전송/);
  });

  it("삭제 후 백업 보존에 관한 사실을 고지한다 (PRD 9-4)", () => {
    expect(source).toMatch(/백업/);
    expect(source).toMatch(/계정 삭제/);
  });

  it("기존 고지 3종을 유지한다", () => {
    expect(source).toMatch(/원본 기록이 언제나 최우선/);
    expect(source).toMatch(/의료 진단, 질병 예측, 약 추천을 수행하지 않으며/);
    expect(source).toMatch(/격리 보관/);
  });

  it("백업 보존 기간을 지어내지 않는다 (운영 정책 확인 전에는 숫자를 쓰지 않는다)", () => {
    expect(source).not.toMatch(/보존 기간은?\s*\d+일/);
    expect(source).not.toMatch(/\d+일간 보관/);
  });
});
