import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const source = readFileSync(join(ROOT, "src/features/settings/SettingsContent.tsx"), "utf8");

describe("로그아웃 동작 (I7 결함 반영)", () => {
  it("로그인하지 않은 상태에서는 로그아웃 대신 로그인 버튼을 보여준다", () => {
    // 고장처럼 보이지 않도록, 눌러도 아무 변화가 없는 로그아웃 버튼을 노출하지 않는다.
    expect(source).toContain("isAuthenticated ? (");
    expect(source).toContain('data-testid="login-btn"');
    expect(source).toContain("openLoginModal");
    expect(source).not.toContain('data-testid="account-session-empty"');
  });

  it("설정 화면에서도 로그인 모달을 띄울 수 있어야 한다", () => {
    // 홈에서만 모달을 그리고 있어서 설정에서 로그인 버튼을 누르면 아무 일도 일어나지 않았다.
    expect(source).toContain("<LoginModal");
    expect(source).toContain("isLoginModalOpen");
  });

  it("로그아웃 결과를 화면에 남긴다 (이동만 하면 성공이 보이지 않는다)", () => {
    expect(source).toMatch(/setMessage\("로그아웃되었습니다\."\)/);
    expect(source).toMatch(/로그아웃 중\.\.\./);
  });

  it("로그아웃은 서버 세션만 지우고 기록은 남긴다", () => {
    expect(source).toMatch(/이 기기에서 로그인만 해제합니다\. 기록은 그대로 유지됩니다\./);
  });

  it("로그아웃 버튼이 계정 삭제 경로에 섞이지 않는다", () => {
    const logoutIndex = source.indexOf('data-testid="logout-btn"');
    const deleteIndex = source.indexOf('data-testid="delete-account-btn"');
    expect(logoutIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(-1);
    expect(logoutIndex).not.toBe(deleteIndex);
  });
});
