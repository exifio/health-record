"use client";

import React, { useState } from "react";
import type { DailyRecord, DailySummaryContent, LocalDate } from "@/contracts";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState } from "@/components/common/LoadingState";
import { RecordTimeline } from "@/components/records/RecordTimeline";

export interface DailySummaryCardProps {
  date: LocalDate;
  record: DailyRecord;
  onRetrySummary?: () => Promise<void>;
  onUpdateSummary?: (content: DailySummaryContent) => Promise<void>;
  onConfirmRecord?: () => Promise<void>;
  onCreateCorrection?: (content: string) => Promise<void>;
  onDeleteRecord?: () => Promise<void>;
}

export function DailySummaryCard({
  date,
  record,
  onRetrySummary,
  onUpdateSummary,
  onConfirmRecord,
  onCreateCorrection,
  onDeleteRecord,
}: DailySummaryCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [correctionText, setCorrectionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Editor local state
  const activeContent: DailySummaryContent = record.summary?.userFinal ??
    record.summary?.aiDraft ?? {
      timeline: [],
      medications: [],
      missingInformation: [],
    };

  const [editTimelineText, setEditTimelineText] = useState(
    activeContent.timeline.map((t) => t.text).join("\n")
  );

  const isConfirmed = record.recordStatus === "confirmed";
  const { summaryStatus } = record;

  const handleRetry = async () => {
    if (!onRetrySummary || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await onRetrySummary();
    } catch {
      setActionError("재정리 요청에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSummary = async () => {
    if (!onUpdateSummary || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      const lines = editTimelineText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const updatedContent: DailySummaryContent = {
        timeline: lines.map((line) => ({
          text: line,
          sourceMessageIds: [],
        })),
        medications: activeContent.medications,
        missingInformation: activeContent.missingInformation,
      };

      await onUpdateSummary(updatedContent);
      setIsEditing(false);
    } catch {
      setActionError("요약 수정 저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!onConfirmRecord || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await onConfirmRecord();
    } catch {
      setActionError("기록 확정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateCorrection || !correctionText.trim() || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await onCreateCorrection(correctionText.trim());
      setCorrectionText("");
    } catch {
      setActionError("정정 기록 저장에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteRecord || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await onDeleteRecord();
      setShowDeleteConfirm(false);
    } catch {
      setActionError("기록 삭제에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="daily-summary-card" data-testid="daily-summary-card">
      <div className="summary-card-header">
        <div className="summary-title-row">
          <h3 className="summary-date-title">{date} 요약</h3>
          <StatusBadge status={isConfirmed ? "confirmed" : summaryStatus} />
        </div>

        {/* F-507: Danger zone delete record trigger */}
        <button
          type="button"
          className="btn-danger-outline"
          onClick={() => setShowDeleteConfirm(true)}
          data-testid="delete-day-btn"
        >
          하루 기록 전체 삭제
        </button>
      </div>

      {actionError && (
        <div role="alert" className="summary-action-error" data-testid="summary-action-error">
          {actionError}
        </div>
      )}

      {/* F-401 ~ F-404, F-407: Status view states */}
      {summaryStatus === "not_due" && !isConfirmed && (
        <div className="summary-status-box summary-status--not-due" data-testid="status-not-due">
          <p>오늘의 기록이 작성 중입니다. 하루가 마무리되면 AI가 기록을 정리합니다.</p>
        </div>
      )}

      {summaryStatus === "processing" && (
        <div className="summary-status-box summary-status--processing" data-testid="status-processing">
          <LoadingState message="AI가 오늘의 기록을 정리하고 있습니다..." />
        </div>
      )}

      {summaryStatus === "pending" && (
        <div className="summary-status-box summary-status--pending" data-testid="status-pending">
          <p>정리 대기 중입니다. 잠시 후 새로고침해주세요.</p>
        </div>
      )}

      {summaryStatus === "failed" && (
        <div className="summary-status-box summary-status--failed" data-testid="status-failed">
          <p>기록 정리를 완료하지 못했습니다. 작성한 기록은 정상적으로 저장되어 있습니다.</p>
          {onRetrySummary && (
            <button
              type="button"
              className="btn-retry-summary"
              onClick={handleRetry}
              disabled={isSubmitting}
              data-testid="retry-summary-btn"
            >
              다시 정리하기
            </button>
          )}
        </div>
      )}

      {summaryStatus === "stale" && !isConfirmed && (
        <div className="summary-status-box summary-status--stale" data-testid="status-stale">
          <p>원문이 수정되어 최신 내용과 다릅니다. 다시 정리해주세요.</p>
          {onRetrySummary && (
            <button
              type="button"
              className="btn-retry-summary"
              onClick={handleRetry}
              disabled={isSubmitting}
              data-testid="retry-summary-btn"
            >
              다시 정리하기
            </button>
          )}
        </div>
      )}

      {/* F-501 & F-502: Summary content display when ready or confirmed */}
      {(summaryStatus === "ready" || isConfirmed || summaryStatus === "stale") && record.summary && (
        <div className="summary-content-area" data-testid="summary-content-area">
          {/* F-502: AI Disclaimer Notice */}
          <div className="ai-disclaimer" data-testid="ai-disclaimer">
            <p>AI가 작성한 정리는 실제 기록과 다를 수 있습니다. 저장 전에 내용을 확인해주세요.</p>
          </div>

          {/* F-503: Summary Editor or Content view */}
          {isEditing ? (
            <div className="summary-editor-box" data-testid="summary-editor-box">
              <label htmlFor="summary-editor-textarea" className="summary-editor-label">
                정리된 타임라인 내용 편집 (한 줄에 한 항목)
              </label>
              <textarea
                id="summary-editor-textarea"
                className="summary-editor-textarea"
                rows={4}
                value={editTimelineText}
                onChange={(e) => setEditTimelineText(e.target.value)}
                disabled={isSubmitting}
                data-testid="summary-editor-input"
              />
              <div className="summary-editor-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsEditing(false)}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn-save"
                  onClick={handleSaveSummary}
                  disabled={isSubmitting}
                  data-testid="save-summary-btn"
                >
                  {isSubmitting ? "저장 중..." : "수정 완료"}
                </button>
              </div>
            </div>
          ) : (
            <div className="summary-display">
              <div className="summary-section">
                <h4 className="summary-section-title">정리된 내용</h4>
                <ul className="summary-timeline-list">
                  {activeContent.timeline.map((item, idx) => (
                    <li key={idx} className="summary-timeline-item">
                      • {item.text}
                    </li>
                  ))}
                </ul>
              </div>

              {activeContent.medications.length > 0 && (
                <div className="summary-section">
                  <h4 className="summary-section-title">복용한 약</h4>
                  <ul className="summary-medication-list">
                    {activeContent.medications.map((med, idx) => (
                      <li key={idx} className="summary-medication-item">
                        • {med.name} ({med.timeText}) {med.effectText ? `- ${med.effectText}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* F-503, F-504, F-408: Actions when unconfirmed */}
              {!isConfirmed && (
                <div className="summary-controls">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsEditing(true)}
                    data-testid="edit-summary-btn"
                  >
                    정리 내용 수정
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleConfirm}
                    disabled={summaryStatus !== "ready" || isSubmitting}
                    data-testid="confirm-record-btn"
                  >
                    {isSubmitting ? "확정 중..." : "기록 확정"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* F-608: Raw record disclosure */}
      <div className="raw-record-disclosure">
        <button
          type="button"
          className="raw-record-toggle-btn"
          onClick={() => setShowRaw((prev) => !prev)}
          data-testid="toggle-raw-records-btn"
        >
          {showRaw ? "원문 기록 접기 ▲" : "원문 기록 보기 ▼"}
        </button>
        {showRaw && (
          <div className="raw-record-body" data-testid="raw-record-body">
            <RecordTimeline messages={record.messages} isConfirmed={isConfirmed} />
          </div>
        )}
      </div>

      {/* F-506 & F-609: Corrections section for confirmed record */}
      {isConfirmed && (
        <div className="corrections-section" data-testid="corrections-section">
          <h4 className="corrections-title">정정 기록</h4>
          {record.corrections.length > 0 ? (
            <ul className="corrections-list">
              {record.corrections.map((corr) => (
                <li key={corr.id} className="correction-item" data-testid={`correction-${corr.id}`}>
                  <p className="correction-text">{corr.content}</p>
                  <span className="correction-time">{corr.createdAt.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="corrections-empty">등록된 정정 기록이 없습니다.</p>
          )}

          {/* F-506: Add correction composer */}
          <form onSubmit={handleAddCorrection} className="correction-form" data-testid="correction-form">
            <input
              type="text"
              placeholder="정정할 내용을 입력하세요"
              value={correctionText}
              onChange={(e) => setCorrectionText(e.target.value)}
              className="correction-input"
              disabled={isSubmitting}
              data-testid="correction-input"
            />
            <button
              type="submit"
              className="btn-secondary"
              disabled={!correctionText.trim() || isSubmitting}
              data-testid="add-correction-btn"
            >
              정정 추가
            </button>
          </form>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div
          className="delete-confirm-overlay"
          role="dialog"
          aria-modal="true"
          data-testid="delete-day-dialog"
        >
          <div className="delete-confirm-card">
            <h4 className="delete-dialog-title">하루 기록 전체 삭제</h4>
            <p className="delete-dialog-desc">
              {date}의 모든 원문, 요약, 정정 기록이 영구적으로 삭제됩니다. 계속하시겠습니까?
            </p>
            <div className="delete-dialog-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                disabled={isSubmitting}
                data-testid="confirm-delete-day-btn"
              >
                {isSubmitting ? "삭제 중..." : "전체 삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
