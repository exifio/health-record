"use client";

import React from "react";

export interface OnboardingNoticeProps {
  onDismiss: () => void;
  className?: string;
}

export function OnboardingNotice({ onDismiss, className = "" }: OnboardingNoticeProps) {
  return (
    <div
      role="region"
      aria-label="온보딩 안내"
      className={`onboarding-card ${className}`.trim()}
      data-testid="onboarding-notice"
    >
      <div className="onboarding-content">
        <h3 className="onboarding-title">건강 기록 안내</h3>
        <p className="onboarding-main-text">
          오늘 있었던 건강 상태를 편하게 남겨보세요.
        </p>
        <p className="onboarding-example">
          예: 아침부터 머리가 조금 아팠어요 / 점심에 약을 먹었어요 / 저녁에는 괜찮아졌어요.
        </p>
        <p className="onboarding-tip">
          의료 용어를 사용할 필요는 없습니다.
        </p>
      </div>
      <button
        type="button"
        className="onboarding-confirm-btn"
        onClick={onDismiss}
        data-testid="onboarding-dismiss-btn"
      >
        시작하기
      </button>
    </div>
  );
}
