"use client";

import React from "react";

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function AlertCircleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

export function ErrorState({
  title = "오류가 발생했습니다",
  message,
  onRetry,
  retryLabel = "다시 시도",
  className = "",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`error-state-container ${className}`.trim()}
    >
      <div className="error-state-icon" aria-hidden="true">
        <AlertCircleIcon />
      </div>
      <h3 className="error-state-title">{title}</h3>
      <p className="error-state-message">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="error-state-retry-btn"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
