"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useHealthApi } from "@/features/api/api-adapter";
import { useAuth } from "@/features/auth/auth-context";
import { useTheme, type Theme } from "@/features/theme/theme-context";

export function SettingsContent() {
  const api = useHealthApi();
  const router = useRouter();
  const { status, logout } = useAuth();
  const isAuthenticated = status === "authenticated";

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

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      await api.deleteAccount();
      setShowDeleteAccountModal(false);
      logout();
      router.push("/");
    } catch {
      setMessage("계정 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppShell>
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

        {/* F-710: Privacy and AI policy link / notice */}
        <section className="settings-section" data-testid="policy-settings-section">
          <h3 className="settings-section-title">개인정보 및 AI 처리 안내</h3>
          <div className="policy-info-card">
            <p className="policy-info-text">
              • 사용자가 작성한 원본 기록이 언제나 최우선 원본이며, AI 결과는 파생 데이터입니다.
            </p>
            <p className="policy-info-text">
              • AI는 의료 진단, 질병 예측, 약 추천을 수행하지 않으며, 일일 요약 보조 기능으로만 활용됩니다.
            </p>
            <p className="policy-info-text">
              • AI 정리를 위해 그날 작성한 기록의 <strong>내용이 OpenAI(외부 AI 처리자)로 전송</strong>됩니다. AI는
              대화하지 않고 기록을 정리만 하며, 전송된 내용으로 원본이 바뀌지는 않습니다.
            </p>
            <p className="policy-info-text">
              • 작성하신 건강 정보는 철저히 사용자 본인 계정에만 격리 보관되며, 다른 사용자에게 제공되지 않습니다.
            </p>
            <p className="policy-info-text">
              • <strong>전체 건강 기록 삭제·계정 삭제</strong>를 하면 서비스가 사용하는 데이터베이스에서는 즉시
              반영됩니다. 다만 운영을 위한 백업 사본은 내부 보존 정책에 따라 일정 기간 남아 있을 수 있으며,
              기간이 지나면 복구할 수 없습니다.
            </p>
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
            <p className="settings-section-desc" data-testid="account-session-empty">
              현재 로그인한 계정이 없습니다. 로그인하면 이 자리에서 로그아웃할 수 있습니다.
            </p>
          </section>
        )}

        {/* F-702 & F-703: Dangerous Data Deletion Actions */}
        <section className="settings-section settings-section--danger" data-testid="danger-settings-section">
          <h3 className="settings-section-title settings-section-title--danger">데이터 관리</h3>

          <div className="danger-actions-list">
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
          </div>
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

        {/* F-703 Confirm Modal */}
        {showDeleteAccountModal && (
          <div className="delete-confirm-overlay" role="dialog" aria-modal="true" data-testid="delete-account-dialog">
            <div className="delete-confirm-card">
              <h4 className="delete-dialog-title">계정 영구 삭제</h4>
              <p className="delete-dialog-desc">
                계정과 관련된 모든 정보가 완전히 삭제되며 즉시 로그아웃됩니다. 계속하시겠습니까?
              </p>
              <div className="delete-dialog-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowDeleteAccountModal(false)}
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
    </AppShell>
  );
}
