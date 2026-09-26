import React from "react";
import type { RecordStatus, SummaryStatus } from "@/contracts";

export type DisplayStatus = RecordStatus | SummaryStatus;

interface StatusConfig {
  label: string;
  tone: "draft" | "confirmed" | "warning" | "info" | "danger" | "neutral";
  /**
   * F-603: 배지 문구만으로는 "무엇을 확인/정리해야 하는지" 알 수 없다.
   * 이유와 다음 행동을 함께 두고 툴팁/스크린리더로 전달한다(DESIGN.md 12절).
   */
  hint: string;
}

/**
 * PRD 6절 `UI 표시 상태` 표를 그대로 옮긴 것이다.
 * - draft + not_due  → 작성 중
 * - draft + pending  → AI 정리 대기
 * - draft + processing → AI 정리 중
 * - draft + ready    → 확인 필요
 * - draft + stale    → 정리 필요
 * - draft + failed   → 정리 실패
 * - confirmed        → 확정
 */
const STATUS_MAP: Record<DisplayStatus, StatusConfig> = {
  draft: {
    label: "작성 중",
    tone: "draft",
    hint: "아직 확정하지 않은 기록입니다. 계속 기록을 남길 수 있습니다.",
  },
  confirmed: {
    label: "확정",
    tone: "confirmed",
    hint: "확정된 기록입니다. 원문은 수정할 수 없고 정정 기록만 추가할 수 있습니다.",
  },
  not_due: {
    label: "작성 중",
    tone: "neutral",
    hint: "아직 하루가 끝나지 않아 AI 정리가 시작되지 않았습니다.",
  },
  pending: {
    label: "AI 정리 대기",
    tone: "neutral",
    hint: "AI 정리 차례를 기다리고 있습니다.",
  },
  processing: {
    label: "AI 정리 중",
    tone: "info",
    hint: "AI가 기록을 정리하고 있습니다.",
  },
  ready: {
    label: "확인 필요",
    tone: "warning",
    hint: "AI 정리 초안이 준비되었습니다. 내용을 확인하고 확정해 주세요.",
  },
  stale: {
    label: "정리 필요",
    tone: "warning",
    hint: "원문이 바뀌어 정리된 내용이 최신 기록과 다릅니다. 다시 정리해 주세요.",
  },
  failed: {
    label: "정리 실패",
    tone: "danger",
    hint: "기록 정리를 완료하지 못했습니다. 작성한 기록은 그대로 저장되어 있습니다.",
  },
};

/** 상태를 설명하는 문구(툴팁·스크린리더·목록 안내용). */
export function statusHint(status: DisplayStatus): string {
  return STATUS_MAP[status]?.hint ?? "";
}

export interface StatusBadgeProps {
  status: DisplayStatus;
  className?: string;
  /** 이유 설명을 툴팁/스크린리더에 함께 넣을지 여부(기본값 true). */
  withHint?: boolean;
}

export function StatusBadge({ status, className = "", withHint = true }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, tone: "neutral", hint: "" };
  const hint = withHint ? config.hint : "";

  return (
    <span
      className={`status-badge status-badge--${config.tone} ${className}`.trim()}
      data-status={status}
      title={hint || undefined}
    >
      {config.label}
      {hint && <span className="sr-only"> — {hint}</span>}
    </span>
  );
}

