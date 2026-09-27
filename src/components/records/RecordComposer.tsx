"use client";

import React, { useState } from "react";

export interface RecordComposerProps {
  onSubmit: (content: string) => Promise<void> | void;
  disabled?: boolean;
  isAuthenticated?: boolean;
  /** PRD 9-3: 로그인이 필요하면 「건강 기록 시작하기」 로그인 모달을 연다. */
  onRequireAuth?: () => void;
  placeholder?: string;
}

export async function executeComposerSubmit({
  content,
  disabled = false,
  isAuthenticated = false,
  onSubmit,
  onRequireAuth,
}: {
  content: string;
  disabled?: boolean;
  isAuthenticated?: boolean;
  onSubmit: (content: string) => Promise<void> | void;
  onRequireAuth?: () => void;
}): Promise<{ success: boolean; error?: string }> {
  // F-106: Block submission for unauthenticated or demo users.
  // 동의는 여기서 판정하지 않는다 — 오늘 기록 화면이 `canWrite`로 기록 입력 자체를
  // 숨기므로, 컴포저는 로그인만 책임진다(职责을 둘로 쪼갠다).
  if (!isAuthenticated) {
    onRequireAuth?.();
    return { success: false };
  }

  const trimmed = content.trim();
  if (!trimmed || disabled) {
    return { success: false };
  }

  try {
    await onSubmit(trimmed);
    return { success: true };
  } catch {
    // F-208: Error message without mentioning AI
    return {
      success: false,
      error: "기록을 저장하지 못했습니다. 다시 시도해주세요.",
    };
  }
}

// Backward compatible helper for synchronous checks
export function handleComposerSubmit(args: {
  content: string;
  disabled?: boolean;
  isAuthenticated?: boolean;
  onSubmit: (content: string) => void;
  onRequireAuth?: () => void;
}): boolean {
  if (!args.isAuthenticated) {
    args.onRequireAuth?.();
    return false;
  }
  const trimmed = args.content.trim();
  if (!trimmed || args.disabled) return false;
  args.onSubmit(trimmed);
  return true;
}

export function RecordComposer({
  onSubmit,
  disabled = false,
  isAuthenticated = false,
  onRequireAuth,
  placeholder = "오늘 있었던 상태를 기록해보세요",
}: RecordComposerProps) {
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setError(null);
    setIsSaving(true);

    const result = await executeComposerSubmit({
      content,
      disabled,
      isAuthenticated,
      onSubmit,
      onRequireAuth,
    });

    setIsSaving(false);

    if (result.success) {
      setContent("");
    } else if (result.error) {
      // F-208: Error state with typed text preserved
      setError(result.error);
    }
  };

  const handleFocus = () => {
    if (!isAuthenticated && onRequireAuth) {
      onRequireAuth();
    }
  };

  return (
    <div className="record-composer-container">
      <form
        className="record-composer-form"
        onSubmit={handleSubmit}
        data-testid="record-composer-form"
      >
        <div className="composer-input-row">
          <textarea
            className="composer-textarea"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError(null);
            }}
            onFocus={handleFocus}
            placeholder={placeholder}
            disabled={disabled || isSaving}
            rows={2}
            aria-label="건강 기록 입력"
            data-testid="composer-textarea"
          />
          <button
            type="submit"
            className="composer-submit-btn"
            disabled={disabled || isSaving || (isAuthenticated && !content.trim())}
            data-testid="composer-submit-btn"
          >
            {isSaving ? "저장 중..." : "기록"}
          </button>
        </div>

        {!isAuthenticated && (
          <p className="composer-auth-hint" data-testid="composer-auth-hint">
            기록 저장은 로그인 후 이용할 수 있습니다.
          </p>
        )}
      </form>

      {/* F-208: Save error message */}
      {error && (
        <div
          role="alert"
          className="composer-error-banner"
          data-testid="composer-error-banner"
        >
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
