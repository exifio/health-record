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
              {/* Google 공식 4색 G 마크(4개 path, 브랜드 컬러). 단색 워드마크 마크가 아니라 아이콘 형태를 쓰되 색은 공식 값을 그대로 유지한다. */}
              <svg viewBox="0 0 256 262" width="18" height="18" focusable="false">
                <path
                  fill="#4285F4"
                  d="M255.878,133.451 C255.878,122.717 255.007,114.884 253.122,106.761 L130.55,106.761 L130.55,155.209 L202.497,155.209 C201.047,167.249 193.214,185.381 175.807,197.565 L175.563,199.187 L214.318,229.21 L217.003,229.478 C241.662,206.704 255.878,173.196 255.878,133.451"
                />
                <path
                  fill="#34A853"
                  d="M130.55,261.1 C165.798,261.1 195.389,249.495 217.003,229.478 L175.807,197.565 C164.783,205.253 149.987,210.62 130.55,210.62 C96.027,210.62 66.726,187.847 56.281,156.37 L54.75,156.5 L14.452,187.687 L13.925,189.152 C35.393,231.798 79.49,261.1 130.55,261.1"
                />
                <path
                  fill="#FBBC05"
                  d="M56.281,156.37 C53.525,148.247 51.93,139.543 51.93,130.55 C51.93,121.556 53.525,112.853 56.136,104.73 L56.063,103 L15.26,71.312 L13.925,71.947 C5.077,89.644 0,109.517 0,130.55 C0,151.583 5.077,171.455 13.925,189.152 L56.281,156.37"
                />
                <path
                  fill="#EB4335"
                  d="M130.55,50.479 C155.064,50.479 171.6,61.068 181.029,69.917 L217.873,33.943 C195.245,12.91 165.798,0 130.55,0 C79.49,0 35.393,29.301 13.925,71.947 L56.136,104.73 C66.726,73.253 96.027,50.479 130.55,50.479"
                />
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
