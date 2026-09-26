"use client";

import React from "react";

export interface DemoModeBannerProps {
  onLoginClick?: () => void;
  className?: string;
}

export function DemoModeBanner({ onLoginClick, className = "" }: DemoModeBannerProps) {
  return (
    <div
      role="status"
      className={`demo-mode-banner ${className}`.trim()}
      data-testid="demo-mode-banner"
    >
      <div className="demo-banner-content">
        <span className="demo-badge">둘러보기</span>
        <span className="demo-text">
          샘플 데이터가 표시되며, 기록 저장은 로그인 후 이용 가능합니다.
        </span>
      </div>
      {onLoginClick && (
        <button
          type="button"
          className="demo-login-btn"
          onClick={onLoginClick}
          data-testid="banner-login-btn"
        >
          로그인하기
        </button>
      )}
    </div>
  );
}
