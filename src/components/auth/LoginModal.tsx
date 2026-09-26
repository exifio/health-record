"use client";

import React, { useEffect } from "react";

export interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onGoogleLogin?: () => void;
  onExplore?: () => void;
  dismissible?: boolean;
}

export function LoginModal({
  isOpen,
  onClose,
  onGoogleLogin,
  onExplore,
  dismissible = true,
}: LoginModalProps) {
  useEffect(() => {
    if (!isOpen || !dismissible || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, dismissible, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      data-testid="login-modal-overlay"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        aria-describedby="login-modal-description"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="login-modal-title" className="modal-title">
            건강 기록 시작하기
          </h2>
          {dismissible && onClose && (
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="닫기"
            >
              ✕
            </button>
          )}
        </div>

        <p id="login-modal-description" className="modal-description">
          하루의 건강 상태를 편하게 남기고 AI 정리로 확인해보세요.
        </p>

        <div className="login-actions">
          {/* F-102: Google로 계속하기 */}
          <button
            type="button"
            className="login-btn login-btn--google"
            onClick={onGoogleLogin}
            data-testid="google-login-btn"
          >
            <span className="login-btn-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
                <path d="M4 12a8 8 0 0 1 16 0" fill="none" stroke="#4285F4" strokeWidth="3.4" />
                <path d="M13.6 12H20" fill="none" stroke="#FBBC05" strokeWidth="3.4" />
                <path d="M20 12a8 8 0 0 1-8 8" fill="none" stroke="#EA4335" strokeWidth="3.4" />
                <path d="M12 20a8 8 0 0 1-8-8" fill="none" stroke="#34A853" strokeWidth="3.4" />
              </svg>
            </span>
            <span>Google로 계속하기</span>
          </button>

          {/* F-103: Kakao 로그인 — 준비 중 */}
          <button
            type="button"
            className="login-btn login-btn--kakao is-disabled"
            disabled
            aria-disabled="true"
            data-testid="kakao-login-btn"
          >
            <span className="login-btn-icon" aria-hidden="true">
              {/* KakaoTalk 공식 마크 형상(Simple Icons, CC0). 브랜드 노랑 배경 위 검정 아이콘. */}
              <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
                <path
                  d="M22.125 0H1.875C.8394 0 0 .8394 0 1.875v20.25C0 23.1606.8394 24 1.875 24h20.25C23.1606 24 24 23.1606 24 22.125V1.875C24 .8394 23.1606 0 22.125 0zM12 18.75c-.591 0-1.1697-.0413-1.7317-.1209-.5626.3965-3.813 2.6797-4.1198 2.7225 0 0-.1258.0489-.2328-.0141s-.0876-.2282-.0876-.2282c.0322-.2198.8426-3.0183.992-3.5333-2.7452-1.36-4.5701-3.7686-4.5701-6.5135C2.25 6.8168 6.6152 3.375 12 3.375s9.75 3.4418 9.75 7.6875c0 4.2457-4.3652 7.6875-9.75 7.6875z"
                  fill="#191919"
                />
              </svg>
            </span>
            <span>Kakao 로그인 — 준비 중</span>
          </button>

          {/* 둘러보기 (Demo Mode) */}
          {onExplore && (
            <button
              type="button"
              className="login-btn login-btn--explore"
              onClick={onExplore}
              data-testid="explore-demo-btn"
            >
              둘러보기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
