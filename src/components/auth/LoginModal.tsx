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
              {/* Kakao 공식 말풍선 마크. 사용자가 제공한 브랜드 가이드라인 이미지에서 윤곽을 추적해 만든 벡터다. */}
              <svg viewBox="0 0 42.67 38.17" width="18" height="18" focusable="false">
                <path d="M 15.62 0.17 C 15.02 0.33 13.35 0.67 12.02 1.17 C 10.70 1.67 9.09 2.25 7.67 3.17 C 6.26 4.08 4.55 5.67 3.52 6.67 C 2.50 7.67 2.03 8.33 1.52 9.17 C 1.02 10.00 0.72 10.58 0.47 11.67 C 0.22 12.75 0.00 14.33 0.02 15.67 C 0.05 17.00 0.40 18.75 0.62 19.67 C 0.85 20.58 0.91 20.42 1.38 21.17 C 1.84 21.92 2.72 23.33 3.42 24.17 C 4.12 25.00 4.61 25.42 5.57 26.17 C 6.54 26.92 8.59 28.17 9.22 28.67 C 9.86 29.17 9.66 28.08 9.38 29.17 C 9.09 30.25 7.90 33.83 7.52 35.17 C 7.15 36.50 7.10 36.75 7.12 37.17 C 7.15 37.58 7.58 37.58 7.67 37.67 C 7.89 37.58 7.34 38.17 8.97 37.17 C 10.61 36.17 14.13 32.83 17.47 31.67 C 20.82 30.50 26.28 30.75 29.02 30.17 C 31.77 29.58 32.60 28.83 33.92 28.17 C 35.25 27.50 36.10 26.83 36.97 26.17 C 37.85 25.50 38.32 25.33 39.17 24.17 C 40.03 23.00 41.58 20.50 42.12 19.17 C 42.67 17.83 42.41 17.33 42.42 16.17 C 42.44 15.00 42.47 13.33 42.22 12.17 C 41.98 11.00 41.68 10.25 40.97 9.17 C 40.27 8.08 39.00 6.67 37.97 5.67 C 36.95 4.67 36.07 3.92 34.82 3.17 C 33.57 2.42 31.78 1.67 30.47 1.17 C 29.17 0.67 29.45 0.33 26.97 0.17 C 24.50 0.00 17.52 0.17 15.62 0.17 Z" fill="currentColor" />
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
