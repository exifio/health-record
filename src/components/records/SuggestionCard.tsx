"use client";

import React from "react";
import type { Suggestion } from "@/contracts";

export interface SuggestionCardProps {
  suggestions: Suggestion[];
  onDismiss?: () => void;
  onSelectSuggestion?: (suggestion: Suggestion) => void;
  className?: string;
}

export function SuggestionCard({
  suggestions,
  onDismiss,
  onSelectSuggestion,
  className = "",
}: SuggestionCardProps) {
  // F-304: Do not render when no suggestions exist
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  // F-302: Display at most 2~3 suggestions
  const displaySuggestions = suggestions.slice(0, 3);

  return (
    <aside
      className={`suggestion-card ${className}`.trim()}
      aria-label="추가 기록 제안"
      data-testid="suggestion-card"
    >
      <div className="suggestion-header">
        <h4 className="suggestion-title">기록을 더 남기고 싶다면</h4>
        {/* F-303: Dismiss button */}
        {onDismiss && (
          <button
            type="button"
            className="suggestion-dismiss-btn"
            onClick={onDismiss}
            aria-label="제안 닫기"
            data-testid="suggestion-dismiss-btn"
          >
            닫기
          </button>
        )}
      </div>

      <ul className="suggestion-list">
        {displaySuggestions.map((item) => (
          <li key={item.id} className="suggestion-item" data-testid={`suggestion-${item.id}`}>
            {onSelectSuggestion ? (
              <button
                type="button"
                className="suggestion-item-btn"
                onClick={() => onSelectSuggestion(item)}
              >
                <span className="suggestion-bullet" aria-hidden="true">•</span>
                <span className="suggestion-text">{item.text}</span>
              </button>
            ) : (
              <div className="suggestion-item-text-wrapper">
                <span className="suggestion-bullet" aria-hidden="true">•</span>
                <span className="suggestion-text">{item.text}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
