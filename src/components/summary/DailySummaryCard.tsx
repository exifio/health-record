"use client";

import React, { useState } from "react";
import type { DailyRecord, DailySummaryContent, LocalDate } from "@/contracts";
import { API_ERROR_CODES, isApiError } from "@/features/records/api/health-api";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState } from "@/components/common/LoadingState";
import { RecordTimeline } from "@/components/records/RecordTimeline";

export interface DailySummaryCardProps {
  date: LocalDate;
  record: DailyRecord;
  /**
   * F-106: 비로그인·둘러보기 읽기 전용 모드.
   * 요약/원문은 그대로 보여 주되 확정·수정·정정·삭제 같은 쓰기 동작은 노출하지 않는다.
   */
  readOnly?: boolean;
  onRetrySummary?: () => Promise<void>;
  onUpdateSummary?: (content: DailySummaryContent) => Promise<void>;
  onConfirmRecord?: () => Promise<void>;
  onCreateCorrection?: (content: string) => Promise<void>;
  onDeleteRecord?: () => Promise<void>;
}

/**
 * I-401~I-404: 실패 이유를 error code로 안내한다.
 * 실제 Backend는 상태 충돌을 409 code로 구분해 돌려주므로 메시지 문자열에 의존하지 않는다.
 */
function actionErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error, API_ERROR_CODES.summaryStale)) {
    return "원문이 바뀌어 최신 요약이 아닙니다. 다시 정리한 뒤 확정해 주세요.";
  }
  if (isApiError(error, API_ERROR_CODES.summaryNotReady)) {
    return "아직 확정할 수 있는 요약이 준비되지 않았어요. 잠시 후 다시 시도해 주세요.";
  }
  if (isApiError(error, API_ERROR_CODES.recordConfirmed)) {
    return "이미 확정된 기록이라 수정할 수 없어요.";
  }
  if (isApiError(error, API_ERROR_CODES.recordNotConfirmed)) {
    return "확정된 기록에만 정정 기록을 추가할 수 있어요.";
  }
  return fallback;
}

export function DailySummaryCard({
  date,
  record,
  readOnly = false,
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

  // 편집 시작 시점의 최신 요약에서 초안을 만든다. reload로 요약이 갱신되어도 지난 편집 내용이 남지 않는다.
  const [editTimelineText, setEditTimelineText] = useState("");

  const startEditing = () => {
    setEditTimelineText(activeContent.timeline.map((t) => t.text).join("\n"));
    setActionError(null);
    setIsEditing(true);
  };

  const isConfirmed = record.recordStatus === "confirmed";
  const { summaryStatus } = record;

  const handleRetry = async () => {
    if (!onRetrySummary || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setActionError(null);
      await onRetrySummary();
    } catch (err: unknown) {
      setActionError(actionErrorMessage(err, "재정리 요청에 실패했습니다. 다시 시도해주세요."));
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
    } catch (err: unknown) {
      setActionError(actionErrorMessage(err, "요약 수정 저장에 실패했습니다."));
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
    } catch (err: unknown) {
      setActionError(actionErrorMessage(err, "기록 확정에 실패했습니다."));
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
    } catch (err: unknown) {
      setActionError(actionErrorMessage(err, "정정 기록 저장에 실패했습니다."));
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
    } catch (err: unknown) {
      setActionError(actionErrorMessage(err, "기록 삭제에 실패했습니다."));
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

        {/* F-507: Danger zone delete record trigger (읽기 전용에서는 숨김) */}
        {!readOnly && (
          <button
            type="button"
            className="btn-danger-outline"
            onClick={() => setShowDeleteConfirm(true)}
            data-testid="delete-day-btn"
          >
            하루 기록 전체 삭제
          </button>
        )}
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
          <p>AI 정리 대기 중입니다. 잠시 후 새로고침해주세요.</p>
        </div>
      )}

      {summaryStatus === "failed" && (
        <div className="summary-status-box summary-status--failed" data-testid="status-failed">
          <p>기록 정리를 완료하지 못했습니다. 작성한 기록은 정상적으로 저장되어 있습니다.</p>
          {!readOnly && onRetrySummary && (
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
          {!readOnly && onRetrySummary && (
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

              {/* DESIGN 6절: 확인 단계에서 무엇을 봐야 하는지 보여 준다.
                  원문이 충분하지 않아 정리가 원문과 비슷해 보일 때 특히 중요한 정보다. */}
              {activeContent.missingInformation.length > 0 && (
                <div className="summary-section" data-testid="missing-information-section">
                  <h4 className="summary-section-title">더 남겨두면 좋은 정보</h4>
                  <ul className="missing-information-list">
                    {activeContent.missingInformation.map((item, idx) => (
                      <li key={idx} className="missing-information-item" data-testid={`missing-information-${idx}`}>
                        • {item.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* F-503, F-504, F-408: Actions when unconfirmed (읽기 전용에서는 숨김) */}
              {!isConfirmed && !readOnly && (
                <div className="summary-controls">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={startEditing}
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
            <RecordTimeline messages={record.messages} isConfirmed={isConfirmed} canEdit={!readOnly} />
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

          {/* F-506: Add correction composer (읽기 전용에서는 숨김) */}
          {!readOnly && (
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
          )}
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
