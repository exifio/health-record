import React from "react";
import type { RecordStatus, SummaryStatus } from "@/contracts";

export type DisplayStatus = RecordStatus | SummaryStatus;

interface StatusConfig {
  label: string;
  tone: "draft" | "confirmed" | "warning" | "info" | "danger" | "neutral";
}

const STATUS_MAP: Record<DisplayStatus, StatusConfig> = {
  draft: { label: "작성 중", tone: "draft" },
  confirmed: { label: "확정", tone: "confirmed" },
  not_due: { label: "기록 중", tone: "neutral" },
  pending: { label: "정리 대기", tone: "neutral" },
  processing: { label: "정리 중", tone: "info" },
  ready: { label: "확인 필요", tone: "warning" },
  stale: { label: "수정됨", tone: "warning" },
  failed: { label: "정리 실패", tone: "danger" },
};

export interface StatusBadgeProps {
  status: DisplayStatus;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { label: status, tone: "neutral" };

  return (
    <span
      className={`status-badge status-badge--${config.tone} ${className}`.trim()}
      data-status={status}
    >
      {config.label}
    </span>
  );
}
