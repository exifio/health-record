"use client";

import React, { useState } from "react";
import type { DailyRecordMessage } from "@/contracts";

export interface RecordMessageProps {
  message: DailyRecordMessage;
  isConfirmed?: boolean;
  /** F-106: false면 원문 수정/삭제 UI를 숨긴다(비로그인·둘러보기 읽기 전용). */
  canEdit?: boolean;
  onUpdate?: (messageId: string, newContent: string) => Promise<void>;
  onDelete?: (messageId: string) => Promise<void>;
}

export function formatMessageTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const period = hours < 12 ? "오전" : "오후";
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${period} ${displayHours}:${minutes}`;
  } catch {
    return "";
  }
}

export function RecordMessage({
  message,
  isConfirmed = false,
  canEdit = true,
  onUpdate,
  onDelete,
}: RecordMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveEdit = async () => {
    if (!editContent.trim() || isSaving) return;
    if (editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      if (onUpdate) {
        await onUpdate(message.id, editContent.trim());
      }
      setIsEditing(false);
    } catch {
      setError("수정에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (isDeleting) return;
    try {
      setIsDeleting(true);
      setError(null);
      if (onDelete) {
        await onDelete(message.id);
      }
      setShowDeleteConfirm(false);
    } catch {
      setError("삭제에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="record-message-wrapper"
      data-testid={`record-message-${message.id}`}
    >
      <div className="message-bubble">
        {/* Editing mode */}
        {isEditing ? (
          <div className="message-edit-box">
            <textarea
              className="message-edit-textarea"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              disabled={isSaving}
              rows={2}
              aria-label="메시지 내용 수정"
              data-testid="message-edit-input"
            />
            {error && <p className="message-action-error">{error}</p>}
            <div className="message-edit-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  setEditContent(message.content);
                  setIsEditing(false);
                  setError(null);
                }}
                disabled={isSaving}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-save"
                onClick={handleSaveEdit}
                disabled={isSaving || !editContent.trim()}
                data-testid="message-edit-save-btn"
              >
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="message-content">{message.content}</p>
            <div className="message-footer">
              <span className="message-time" data-testid="message-time">
                {formatMessageTime(message.createdAt)}
              </span>

              {/* F-206 & F-207: Only show edit/delete if NOT confirmed and editable */}
              {!isConfirmed && canEdit && (
                <div className="message-actions">
                  <button
                    type="button"
                    className="msg-action-btn"
                    onClick={() => {
                      setEditContent(message.content);
                      setIsEditing(true);
                    }}
                    aria-label="메시지 수정"
                    data-testid="message-edit-btn"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="msg-action-btn msg-action-btn--delete"
                    onClick={() => setShowDeleteConfirm(true)}
                    aria-label="메시지 삭제"
                    data-testid="message-delete-btn"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
            {error && <p className="message-action-error">{error}</p>}
          </>
        )}
      </div>

      {/* F-207: Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div
          className="delete-confirm-overlay"
          data-testid="delete-confirm-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="delete-confirm-card">
            <h4 id="delete-dialog-title" className="delete-dialog-title">
              기록 삭제
            </h4>
            <p className="delete-dialog-desc">
              이 건강 기록을 삭제하시겠습니까? 삭제된 기록은 복구할 수 없습니다.
            </p>
            {error && <p className="message-action-error">{error}</p>}
            <div className="delete-dialog-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setError(null);
                }}
                disabled={isDeleting}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                data-testid="delete-confirm-btn"
              >
                {isDeleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
