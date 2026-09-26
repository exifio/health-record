"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import type { RecentRecordItem } from "@/components/layout/Sidebar";
import { useHealthApi } from "@/features/api/api-adapter";
import { getSystemLocalDate } from "@/features/api/system-time";
import type { DisplayStatus } from "@/components/common/StatusBadge";
import type { DailyRecordListItem } from "@/contracts";

const RECENT_RECORDS_LIMIT = 5;
export const LIST_RANGE_DAYS = 90;

/**
 * F-603: 사이드바 '최근 기록'은 네비게이션 목록이라 사용자가 할 행동이 있는 상태만 배지로 보여 준다.
 * (작성 중/AI 정리 대기/AI 정리 중은 기다리면 되는 수동 상태라 목록을 소음만 키운다.
 *  같은 상태의 문구는 기록 목록·상세 화면에서 PRD 6절 표대로 그대로 보여 준다.)
 */
const PASSIVE_SUMMARY_STATUSES: DisplayStatus[] = ["draft", "not_due", "pending", "processing"];

/** 목록 항목을 사이드바 배지 상태로 바꾼다. null이면 배지를 표시하지 않는다. */
export function toSidebarBadgeStatus(item: DailyRecordListItem): DisplayStatus | null {
  if (item.recordStatus === "confirmed") return "confirmed";
  return PASSIVE_SUMMARY_STATUSES.includes(item.summaryStatus) ? null : item.summaryStatus;
}

/** 오늘(시스템 시간 기준)로부터 N일 전의 local_date를 계산한다. */
export function daysAgoLocalDate(days: number, now: Date = new Date()): string {
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatSidebarDateLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  return `${year}년 ${month}월 ${day}일`;
}

export function toRecentRecordItems(items: DailyRecordListItem[]): RecentRecordItem[] {
  return items.slice(0, RECENT_RECORDS_LIMIT).map((item) => ({
    date: item.date,
    label: formatSidebarDateLabel(item.date),
    status: toSidebarBadgeStatus(item),
  }));
}

/**
 * F-601: 사이드바 최근 기록을 실제 API 데이터로 채운다.
 * AppShell은 이미 recentRecords를 받도록 만들어져 있으므로 여기서 조회를 담당한다.
 */
export function RecordsShell({ children }: { children: React.ReactNode }) {
  const api = useHealthApi();

  const [recentRecords, setRecentRecords] = useState<RecentRecordItem[]>([]);
  // 조회 범위는 최초 렌더에서 시스템 날짜 기준으로 한 번만 정한다(하루가 바뀌어도 목록은 유지).
  const [range] = useState(() => ({
    from: daysAgoLocalDate(LIST_RANGE_DAYS),
    to: getSystemLocalDate(),
  }));

  useEffect(() => {
    // I-106 / F-106: 비로그인·둘러보기도 샘플(Mock) 목록을 조회해 최근 기록을 보여 준다.
    // 실제 사용자 API는 로그인 상태에서만 호출된다(AuthAwareHealthApiProvider).
    let ignore = false;

    api
      .getDailyRecords(range.from, range.to)
      .then((res) => {
        if (!ignore) setRecentRecords(toRecentRecordItems(res.items));
      })
      .catch(() => {
        // 사이드바 목록 실패는 조용히 비워 둔다(본문 흐름을 막지 않는다).
        if (!ignore) setRecentRecords([]);
      });

    return () => {
      ignore = true;
    };
  }, [api, range.from, range.to]);

  return <AppShell recentRecords={recentRecords}>{children}</AppShell>;
}