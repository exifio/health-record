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

  it("계정 삭제는 성공하면 모달을 닫고 홈에서 끝낸다", () => {
    // 성공: 삭제+로그아웃이 끝난 뒤 모달을 닫고 "?account-deleted=1" 홈으로 보낸다.
    // 이전처럼 모달을 먼저 닫고 설정 화면에 남기면 로그인 상태 그대로 보여
    // "아무 일도 안 일어난" 것처럼 보인다.
    const handlerStart = source.indexOf("const handleDeleteAccount");
    const handlerEnd = source.indexOf("};", handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);
    const deleteIndex = handler.indexOf("await api.deleteAccount();");
    const logoutIndex = handler.indexOf("await logout();");
    const closeIndex = handler.indexOf("setShowDeleteAccountModal(false);");
    const replaceIndex = handler.indexOf('router.replace("/?account-deleted=1");');
    expect(deleteIndex).toBeGreaterThan(-1);
    expect(logoutIndex).toBeGreaterThan(deleteIndex);
    expect(closeIndex).toBeGreaterThan(logoutIndex);
    expect(replaceIndex).toBeGreaterThan(closeIndex);
    expect(handler).not.toContain("setShowDeleteAccountModal(true)");
    expect(handler).not.toContain("isDeleteAccountDone");
    expect(handler).not.toContain("delete-account-done");
    // 실패: 모달은 열어 둔 채 모달 안 에러로만 보여 준다(모달 닫고 배너 금지).
    expect(handler).toContain("setDeleteAccountError");
    expect(handler).not.toContain('setMessage("계정 삭제에 실패했습니다.');
    expect(source).toContain('data-testid="delete-account-error"');
  });

  it("계정 삭제는 홈 완료 배너로 끝낸다 (모달이 refresh에 날아가도 보인다)", () => {
    const homeSource = readFileSync(join(ROOT, "src/features/home/HomeContent.tsx"), "utf8");
    // 삭제 성공 후 "?account-deleted=1"로 홈에 오면 배너를 보여 주고 쿼리만 지운다.
    expect(homeSource).toContain("account-deleted");
    expect(homeSource).toContain('data-testid="account-deleted-notice"');
    expect(homeSource).toContain("계정이 삭제되어 로그아웃되었습니다.");
  });

  it("삭제가 끝나기 전에 로그아웃이 끼어들지 않는다", () => {
    // handleDeleteAccount 안에서 deleteAccount → logout 순서대로 await 되어야
    // 로그아웃 refresh가 삭제 완료보다 먼저 도는 경쟁을 막는다.
    const handlerStart = source.indexOf("const handleDeleteAccount");
    const handler = source.slice(handlerStart, handlerStart + 800);
    const deleteIndex = handler.indexOf("await api.deleteAccount();");
    const logoutIndex = handler.indexOf("await logout();");
    expect(deleteIndex).toBeGreaterThan(-1);
    expect(logoutIndex).toBeGreaterThan(deleteIndex);
  });
});

describe("데이터 관리 메뉴의 로그인 게이팅 (I7 결함 반영)", () => {
  it("계정 삭제는 로그인한 사용자에게만 노출한다", () => {
    // 계정은 로그인한 사용자에게만 존재한다. 익명/데모에서 누르면 서버가 401로 거절한다.
    expect(source).toContain("const canDeleteAccount = isAuthenticated;");
    const accountRow = source.indexOf('data-testid="delete-account-btn"');
    const guard = source.lastIndexOf("{canDeleteAccount && (", accountRow);
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(accountRow);
  });

  it("전체 건강 기록 삭제는 로그인/데모에서만 노출한다", () => {
    // 익명 사용자에게는 지울 데이터가 없고(비로그인 건강정보 입력 금지), API도 401로 거절한다.
    expect(source).toContain("const canDeleteHealthData = isAuthenticated || isDemo;");
    const healthRow = source.indexOf('data-testid="delete-all-health-data-btn"');
    const guard = source.lastIndexOf("{canDeleteHealthData && (", healthRow);
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(healthRow);
  });

  it("노출할 항목이 하나도 없으면 데이터 관리 섹션 자체를 감춘다", () => {
    // 빈 섹션 헤더만 남는 것을 막는다.
    expect(source).toContain("{(canDeleteHealthData || canDeleteAccount) && (");
  });
});
