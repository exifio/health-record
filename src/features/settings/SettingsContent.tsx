"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RecordsShell } from "@/components/layout/RecordsShell";
import { useHealthApi } from "@/features/api/api-adapter";
import { useAuth } from "@/features/auth/auth-context";
import { useTheme, type Theme } from "@/features/theme/theme-context";
import { LoginModal } from "@/components/auth/LoginModal";

export function SettingsContent() {
  const api = useHealthApi();
  const router = useRouter();
  const { status, logout, isLoginModalOpen, openLoginModal, closeLoginModal, loginWithGoogle, enterDemoMode } = useAuth();
  const isAuthenticated = status === "authenticated";
  const isDemo = status === "demo";
  // 계정은 로그인한 사용자에게만 존재한다. 익명/데모에 두면 눌러도 서버가 401로 거절해 고장처럼 보인다.
  const canDeleteAccount = isAuthenticated;
  // 익명 사용자는 건강 정보를 입력할 수 없어 지울 데이터가 없다(비로그인 건강정보 입력 금지).
  // 데모는 Mock 저장소라 실제로 비워지므로 그대로 둔다.
  const canDeleteHealthData = isAuthenticated || isDemo;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setMessage(null);
    try {
      await logout();
      // 이동을 시키면 결과 메시지가 보이지 않아 "아무 일도 안 일어난" 것처럼 보인다.
      // 서버 세션만 지우고 현재 화면에 결과를 남긴다(로그아웃은 router.refresh()로 반영된다).
      setMessage("로그아웃되었습니다.");
    } catch {
      setMessage("로그아웃에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoggingOut(false);
    }
  };
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleDeleteAllHealthData = async () => {
    try {
      setIsDeleting(true);
      await api.deleteHealthData();
      setShowDeleteDataModal(false);
      setMessage("모든 건강 기록이 삭제되었습니다.");
    } catch {
      setMessage("건강 기록 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 계정 삭제 성공: 확인 모달을 닫고 서버 세션 정리 + 클라이언트 로그아웃을 모두
  // 끝낸 뒤에야 홈으로 보낸다. 모달을 먼저 닫고 끝내면(이전 동작) 설정 화면이
  // 로그인 상태 그대로 남아 "아무 일도 안 일어난" 것처럼 보인다.
  // 실패: 모달은 열어 둔 채 모달 안에만 에러를 보여 준다. 이전처럼 닫고 배너에
  // 남기면 화면 아래라 사용자가 실패를 못 보고 "다른 페이지 갔다 와야 안다"가 된다.
  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      setDeleteAccountError(null);
      await api.deleteAccount();
      await logout();
      setShowDeleteAccountModal(false);
      router.replace("/?account-deleted=1");
    } catch {
      setDeleteAccountError("계정 삭제에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    // RecordsShell은 AppShell에 최근 기록까지 넣어 준다. AppShell을 직접 쓰면
    // 설정에서만 사이드바가 "아직 기록이 없습니다"로 보여 다른 화면과 어긋난다.
    <RecordsShell>
      <div className="settings-page" data-testid="settings-page">
        <header className="settings-header">
          <h2 className="settings-heading">설정</h2>
          <p className="settings-sub">앱 환경 설정 및 데이터 관리</p>
        </header>

        {message && (
          <div role="status" className="settings-alert-banner" data-testid="settings-alert">
            {message}
          </div>
        )}

        {/* F-704 ~ F-707: Theme Selection UI */}
        <section className="settings-section" data-testid="theme-settings-section">
          <h3 className="settings-section-title">화면 테마</h3>
          <p className="settings-section-desc">
            현재 화면 테마를 선택하세요. (현재 적용: {resolvedTheme === "dark" ? "다크" : "라이트"})
          </p>

          <div className="theme-options-group" role="radiogroup" aria-label="화면 테마">
            {(["system", "light", "dark"] as Theme[]).map((t) => {
              const labelMap: Record<Theme, string> = {
                system: "시스템 설정",
                light: "라이트",
                dark: "다크",
              };

              return (
                <label
                  key={t}
                  className={`theme-radio-label ${theme === t ? "is-selected" : ""}`}
                  data-testid={`theme-option-${t}`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={t}
                    checked={theme === t}
                    onChange={() => setTheme(t)}
                    className="theme-radio-input"
                  />
                  <span>{labelMap[t]}</span>
                </label>
              );
            })}
          </div>
        </section>

        {/* 계정 종료: 공용 기기에서 다른 사람이 내 계정으로 들어오지 못하도록 반드시 제공되어야 한다.
            로그인하지 않은 상태(익명/데모)에 두면 눌러도 아무 변화가 없어 고장처럼 보이므로 감춘다. */}
        {isAuthenticated ? (
          <section className="settings-section" data-testid="account-session-section">
            <h3 className="settings-section-title">계정</h3>
            <div className="danger-actions-list">
              <div className="danger-action-row">
                <div className="danger-action-info">
                  <h4 className="danger-action-name">로그아웃</h4>
                  <p className="danger-action-desc">
                    이 기기에서 로그인만 해제합니다. 기록은 그대로 유지됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  data-testid="logout-btn"
                >
                  {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="settings-section" data-testid="account-session-section">
            <h3 className="settings-section-title">계정</h3>
            <div className="danger-actions-list">
              <div className="danger-action-row">
                <div className="danger-action-info">
                  <h4 className="danger-action-name">로그인</h4>
                  <p className="danger-action-desc">
                    로그인하면 이 자리에서 계정 확인과 로그아웃을 할 수 있습니다.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={openLoginModal}
                  data-testid="login-btn"
                >
                  로그인
                </button>
              </div>
            </div>
          </section>
        )}

      {/* 홈 화면에서만 로그인 모달을 그리므로, 설정에서 여는 경우에도 같은 흐름을 쓴다. */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        onGoogleLogin={loginWithGoogle}
        onExplore={enterDemoMode}
        dismissible={true}
      />

        {/* F-702 & F-703: Dangerous Data Deletion Actions
            서버는 두 삭제 API 모두 requireUser()를 거치므로 로그인하지 않은 상태에서는 401로 실패한다.
            눌러도 아무 일도 일어나지 않는 버튼을 두지 않도록, 지울 대상이 있는 상태에서만 노출한다. */}
        {(canDeleteHealthData || canDeleteAccount) && (
        <section className="settings-section settings-section--danger" data-testid="danger-settings-section">
          <h3 className="settings-section-title settings-section-title--danger">데이터 관리</h3>

          <div className="danger-actions-list">
            {canDeleteHealthData && (
            <div className="danger-action-row">
              <div className="danger-action-info">
                <h4 className="danger-action-name">전체 건강 기록 삭제</h4>
                <p className="danger-action-desc">
                  계정은 유지되지만 지금까지 기록한 모든 건강 데이터와 요약이 삭제됩니다.
                </p>
              </div>
              <button
                type="button"
                className="btn-danger-outline"
                onClick={() => setShowDeleteDataModal(true)}
                data-testid="delete-all-health-data-btn"
              >
                건강 기록 삭제
              </button>
            </div>
            )}

            {/* 계정 행은 로그인 상태에서만 노출한다(익명/데모에는 계정 자체가 없음). */}
            {canDeleteAccount && (
            <div className="danger-action-row">
              <div className="danger-action-info">
                <h4 className="danger-action-name">계정 삭제</h4>
                <p className="danger-action-desc">
                  모든 건강 기록 및 프로필 정보가 완전히 삭제되며 되돌릴 수 없습니다.
                </p>
              </div>
              <button
                type="button"
                className="btn-danger"
                onClick={() => setShowDeleteAccountModal(true)}
                data-testid="delete-account-btn"
              >
                계정 삭제
              </button>
            </div>
            )}
          </div>
        </section>
        )}

        {/* F-710: 개인정보 및 AI 처리 안내.
            설정 화면에는 요약만 두고 상세는 /settings/privacy 독립 페이지로 보낸다(모달/바텀시트 금지).
            읽기 전용 고지라 설정 항목이 아니므로 최하단에 두어 계정·데이터 관리 같은 실제 액션을 밀어내지 않는다. */}
        <section className="settings-section" data-testid="policy-settings-section">
          <h3 className="settings-section-title">개인정보 및 AI 처리</h3>
          <p className="settings-section-desc">작성한 건강 기록은 사용자 계정을 기준으로 관리됩니다.</p>
          <p className="settings-section-desc">
            AI 정리 기능 사용 시 필요한 기록이 외부 AI 서비스로 전송될 수 있으며, AI가 생성한 내용은 사용자가
            작성한 원본 기록을 변경하지 않습니다.
          </p>
          <Link href="/settings/privacy" className="privacy-link" data-testid="privacy-detail-link">
            개인정보 및 AI 처리 자세히 보기 →
          </Link>
        </section>

        {/* F-702 Confirm Modal */}
        {showDeleteDataModal && (
          <div className="delete-confirm-overlay" role="dialog" aria-modal="true" data-testid="delete-health-data-dialog">
            <div className="delete-confirm-card">
              <h4 className="delete-dialog-title">전체 건강 기록 삭제</h4>
              <p className="delete-dialog-desc">
                정말로 모든 건강 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며 원문과 AI 요약이 모두 영구 삭제됩니다.
              </p>
              <div className="delete-dialog-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowDeleteDataModal(false)}
                  disabled={isDeleting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleDeleteAllHealthData}
                  disabled={isDeleting}
                  data-testid="confirm-delete-data-btn"
                >
                  {isDeleting ? "삭제 중..." : "모든 기록 삭제"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* F-703 Confirm Modal: 실패는 모달 안에서 보여 준다. 닫고 배너에 남기면
            화면 아래라 실패를 못 보고 "다른 페이지 가야 안다"가 되기 때문이다. */}
        {showDeleteAccountModal && (
          <div className="delete-confirm-overlay" role="dialog" aria-modal="true" data-testid="delete-account-dialog">
            <div className="delete-confirm-card">
              <h4 className="delete-dialog-title">계정 영구 삭제</h4>
              <p className="delete-dialog-desc">
                계정과 관련된 모든 정보가 완전히 삭제되며 즉시 로그아웃됩니다. 계속하시겠습니까?
              </p>
              {deleteAccountError && (
                <p role="alert" className="delete-dialog-error" data-testid="delete-account-error">
                  {deleteAccountError}
                </p>
              )}
              <div className="delete-dialog-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => { setShowDeleteAccountModal(false); setDeleteAccountError(null); }}
                  disabled={isDeleting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  data-testid="confirm-delete-account-btn"
                >
                  {isDeleting ? "삭제 중..." : "계정 삭제"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RecordsShell>
  );
}
