import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const css = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
const loginModal = readFileSync(path.join(ROOT, "src/components/auth/LoginModal.tsx"), "utf8");

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channel = (index: number) => {
    const part = parseInt(value.slice(index * 2, index * 2 + 2), 16) / 255;
    return part <= 0.03928 ? part / 12.92 : Math.pow((part + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [high, low] = a > b ? [a, b] : [b, a];
  return (high + 0.05) / (low + 0.05);
}

function tokensFor(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[match[1]] = match[2];
  }
  return tokens;
}

const themeBlocks = [
  { name: "라이트 테마", block: css.slice(0, css.indexOf('[data-theme="dark"]')) },
  { name: "다크 테마", block: css.slice(css.indexOf('[data-theme="dark"]'), css.indexOf("@media (prefers-color-scheme: dark)")) },
  { name: "prefers-color-scheme 다크", block: css.slice(css.indexOf("@media (prefers-color-scheme: dark)")) },
];

describe("I6-608 다크모드 대비", () => {
  it.each(themeBlocks)("$name 에서 본문 대비가 WCAG AA(4.5)를 만족한다", ({ block }) => {
    const t = tokensFor(block);

    expect(contrast(t.foreground, t.background)).toBeGreaterThanOrEqual(4.5);
    // 보조 텍스트는 카드(surface) 위에 놓이므로 surface 기준으로 검사한다.
    expect(contrast(t["muted-foreground"], t.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t["muted-foreground"], t.surface)).toBeGreaterThanOrEqual(4.5);
    // 기본 버튼(흰 글자 14px/600)은 4.5:1 이상이어야 한다.
    expect(contrast(t["primary-foreground"], t.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t["primary-foreground"], t["primary-hover"])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(themeBlocks)("$name 에서 상태 배지 대비가 WCAG AA(4.5)를 만족한다", ({ block }) => {
    const t = tokensFor(block);

    expect(contrast(t["badge-draft-fg"], t["badge-draft-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t["badge-confirmed-fg"], t["badge-confirmed-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t["badge-warning-fg"], t["badge-warning-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t["badge-info-fg"], t["badge-info-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t["badge-danger-fg"], t["badge-danger-bg"])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(themeBlocks)("$name 에서 위험 버튼 대비가 WCAG AA(4.5)를 만족한다", ({ block }) => {
    const t = tokensFor(block);

    // 다크 테마의 --danger는 텍스트/테두리용 밝은 빨강이라 solid 버튼 배경으로 재사용하면 안 된다.
    expect(contrast(t["danger-foreground"], t["danger-solid"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t["danger-foreground"], t["danger-solid-hover"])).toBeGreaterThanOrEqual(4.5);
    // outline 버튼(배경 투명)은 다크 테마의 밝은 danger를 그대로 텍스트 색으로 사용한다.
    expect(contrast(t.danger, t.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("브랜드 로그인 버튼이 대비 기준을 유지한다 (다크/라이트 공통)", () => {
    // Google: 중립 배경 + 어두운 글자
    expect(contrast("#1f2328", "#f8f9fa")).toBeGreaterThanOrEqual(4.5);
    // Kakao: 브랜드 노랑 + 검정 글자
    expect(contrast("#191919", "#fee500")).toBeGreaterThanOrEqual(4.5);
  });

  it("카카오 버튼은 준비 중일 때 활성 버튼과 구분된다", () => {
    const disabled = css.match(/\.login-btn--kakao\.is-disabled[^{]*\{[^}]+\}/)?.[0] ?? "";

    expect(disabled).toContain("cursor: not-allowed");
    // 비활성인데 브랜드 노랑을 그대로 쓰면 활성 Google 버튼과 무게감이 같아
    // 눌러도 비활성처럼 보이지 않는다. 채도/명도를 낮춘 톤으로 물러뜨린다.
    expect(disabled).not.toContain("#fee500");
    const bg = disabled.match(/background-color:\s*(#[0-9a-f]{6})/i)?.[1] ?? "";
    const fg = disabled.match(/color:\s*(#[0-9a-f]{6})/i)?.[1] ?? "";
    expect(bg).toMatch(/^#[0-9a-f]{6}$/i);
    expect(fg).toMatch(/^#[0-9a-f]{6}$/i);
    // 비활성 글씨는 읽을 수 있어야 한다(WCAG AA).
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    // 비활성 배경은 활성 배경보다 어두워야(active보다 약하게 보인다).
    expect(luminance(bg)).toBeLessThan(luminance("#fee500"));
  });

  it("비활성 카카오 버튼은 hover 로도 밝아지지 않는다", () => {
    // disabled 버튼에도 :hover 가 매칭돼 브랜드 노랑으로 밝아지면
    // 오히려 사용 가능한 것처럼 보이므로 hover 규칙까지 함께 덮어써야 한다.
    expect(css).toMatch(/\.login-btn--kakao\.is-disabled,\s*\n\s*\.login-btn--kakao\.is-disabled:hover\s*\{/);
  });

  it("로그인 버튼 아이콘은 브랜드 공식 마크를 유지한다", () => {
    const googleIcon = loginModal.match(/viewBox="0 0 256 262"[\s\S]*?<\/svg>/)?.[0] ?? "";
    // Kakao: 말풍선 마크(사용자 제공 이미지에서 추적한 벡터). 브랜드 노랑 배경 위 검정 단일 path.
    const kakaoIcon = loginModal.match(/viewBox="0 0 42\.67 38\.17"[\s\S]*?<\/svg>/)?.[0] ?? "";

    // Google: 4색 G는 4개 path(파랑/초록/노랑/빨강)를 모두 써야 한다. 하나라도 빠지면 단색/깨진 로고가 된다.
    const googleFills = [...googleIcon.matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase());
    expect(googleFills).toEqual(["#4285F4", "#34A853", "#FBBC05", "#EB4335"]);

    expect(kakaoIcon).toContain('fill="currentColor"');
    // 닫힌 단일 path여야 한다 (여러 조각으로 쪼개지면 말풍선 윤곽이 깨진다).
    expect([...kakaoIcon.matchAll(/<path/g)]).toHaveLength(1);
    expect(kakaoIcon).toMatch(/d="[^"]*Z"/);
  });

  it(".btn-danger은 solid 토큰을 배경으로 사용한다", () => {
    const rules = css.match(/\.btn-danger\s*\{[^}]+\}/g) ?? [];

    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule).toContain("var(--danger-solid)");
      expect(rule).not.toMatch(/background-color:\s*var\(--danger\)/);
    }
    expect(css).toMatch(/\.btn-danger:hover\s*\{[^}]*var\(--danger-solid-hover\)/);
  });

  it("모든 테마 블록에 danger-solid 토큰이 정의돼 있다", () => {
    for (const { name, block } of themeBlocks) {
      expect({ name, hasSolid: Boolean(tokensFor(block)["danger-solid"]) }).toEqual({
        name,
        hasSolid: true,
      });
    }
  });
});
