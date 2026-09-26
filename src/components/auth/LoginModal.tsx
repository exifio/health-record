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
              G
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
              K
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
