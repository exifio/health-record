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
              <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
                <path
                  d="M12 3C6.3 3 2 6.6 2 11.1c0 2.9 1.7 5.4 4.3 6.8-.2 1.2-.8 2.6-1.9 3.6 2.4-.2 4.4-1.1 5.7-2.3.6.1 1.3.2 1.9.2 5.7 0 10-3.6 10-8.1S17.7 3 12 3z"
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
