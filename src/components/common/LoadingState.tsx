"use client";

import React from "react";

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = "불러오는 중...", className = "" }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`loading-container ${className}`.trim()}
    >
      <div className="loading-spinner" aria-hidden="true" />
      <span className="loading-text">{message}</span>
    </div>
  );
}
