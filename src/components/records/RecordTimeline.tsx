"use client";

import React from "react";
import type { DailyRecordMessage } from "@/contracts";
import { RecordMessage } from "@/components/records/RecordMessage";

export interface RecordTimelineProps {
  messages: DailyRecordMessage[];
  isConfirmed?: boolean;
  /** F-106: false면 각 원문의 수정/삭제 UI를 숨긴다(비로그인·둘러보기 읽기 전용). */
  canEdit?: boolean;
  onUpdateMessage?: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  className?: string;
}

export function RecordTimeline({
  messages,
  isConfirmed = false,
  canEdit = true,
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
              canEdit={canEdit}
              onUpdate={onUpdateMessage}
              onDelete={onDeleteMessage}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
