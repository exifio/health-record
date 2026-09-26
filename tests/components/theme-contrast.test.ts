import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const css = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

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
