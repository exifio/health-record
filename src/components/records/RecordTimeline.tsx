"use client";

import React from "react";
import type { DailyRecordMessage } from "@/contracts";
import { RecordMessage } from "@/components/records/RecordMessage";

export interface RecordTimelineProps {
  messages: DailyRecordMessage[];
  isConfirmed?: boolean;
  onUpdateMessage?: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  className?: string;
}

export function RecordTimeline({
  messages,
  isConfirmed = false,
  onUpdateMessage,
  onDeleteMessage,
  className = "",
}: RecordTimelineProps) {
  if (messages.length === 0) {
    return (
      <div className={`timeline-empty ${className}`.trim()} data-testid="timeline-empty">
        <p>오늘 등록된 건강 기록이 없습니다.</p>
        <p className="timeline-empty-sub">아래 입력창에 오늘 있었던 상태를 남겨보세요.</p>
      </div>
    );
  }

  return (
    <div className={`record-timeline ${className}`.trim()} data-testid="record-timeline">
      <ul className="timeline-message-list">
        {messages.map((msg) => (
          <li key={msg.id} className="timeline-message-item">
            <RecordMessage
              message={msg}
              isConfirmed={isConfirmed}
              onUpdate={onUpdateMessage}
              onDelete={onDeleteMessage}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
