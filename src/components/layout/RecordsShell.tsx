"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import type { RecentRecordItem } from "@/components/layout/Sidebar";
import { useHealthApi, getSystemLocalDate } from "@/features/api/api-adapter";
import { useAuth } from "@/features/auth/auth-context";
import type { DailyRecordListItem } from "@/contracts";

const RECENT_RECORDS_LIMIT = 5;
export const LIST_RANGE_DAYS = 90;

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
    status: item.recordStatus === "confirmed" ? "confirmed" : item.summaryStatus,
  }));
}

/**
 * F-601: 사이드바 최근 기록을 실제 API 데이터로 채운다.
 * AppShell은 이미 recentRecords를 받도록 만들어져 있으므로 여기서 조회를 담당한다.
 */
export function RecordsShell({ children }: { children: React.ReactNode }) {
  const api = useHealthApi();
  const { status } = useAuth();
  const isAuthenticated = status === "authenticated";

  const [recentRecords, setRecentRecords] = useState<RecentRecordItem[]>([]);
  // 조회 범위는 최초 렌더에서 시스템 날짜 기준으로 한 번만 정한다(하루가 바뀌어도 목록은 유지).
  const [range] = useState(() => ({
    from: daysAgoLocalDate(LIST_RANGE_DAYS),
    to: getSystemLocalDate(),
  }));

  useEffect(() => {
    // I-106: 미인증/Demo 모드에서는 실제 사용자 API를 호출하지 않는다.
    if (!isAuthenticated) return;

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
  }, [api, range.from, range.to, isAuthenticated]);

  return <AppShell recentRecords={recentRecords}>{children}</AppShell>;
}