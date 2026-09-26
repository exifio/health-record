"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { RecordsShell } from "@/components/layout/RecordsShell";
import { useHealthApi } from "@/features/api/api-adapter";
import { getSystemLocalDate } from "@/features/api/system-time";
import { daysAgoLocalDate, LIST_RANGE_DAYS } from "@/components/layout/RecordsShell";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import type { DailyRecordListItem } from "@/contracts";

export function RecordsListContent() {
  const api = useHealthApi();
  const [items, setItems] = useState<DailyRecordListItem[]>([]);
  const [unreviewedCount, setUnreviewedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = getSystemLocalDate();
  const from = daysAgoLocalDate(LIST_RANGE_DAYS);
  const to = today;

  useEffect(() => {
    let ignore = false;

    async function fetchRecords() {
      // F-106 / I-106: 비로그인·둘러보기도 샘플(Mock) 목록을 조회한다(읽기 전용).
      try {
        const res = await api.getDailyRecords(from, to);
        if (!ignore) {
          setItems(res.items);
          setUnreviewedCount(res.unreviewedCount);
        }
      } catch {
        if (!ignore) {
          setError("기록 목록을 불러오지 못했습니다. 다시 시도해주세요.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    fetchRecords();

    return () => {
      ignore = true;
    };
  }, [api, from, to]);

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    api.getDailyRecords(from, to)
      .then((res) => {
        setItems(res.items);
        setUnreviewedCount(res.unreviewedCount);
      })
      .catch(() => {
        setError("기록 목록을 불러오지 못했습니다. 다시 시도해주세요.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <RecordsShell>
      <div className="records-list-page" data-testid="records-list-page">
        <header className="records-list-header">
          <h2 className="records-list-heading">모든 기록</h2>
          <p className="records-list-sub">작성된 일일 건강 기록 목록입니다.</p>
        </header>

        {/* F-604: Unreviewed count banner */}
        {unreviewedCount > 0 && (
          <div className="unreviewed-banner" data-testid="unreviewed-banner">
            <span>확인하지 않은 기록이 {unreviewedCount}개 있습니다.</span>
            <Link
              href={`/records/${items.find((i) => i.summaryStatus === "ready" && i.recordStatus === "draft")?.date || today}`}
              className="unreviewed-link"
            >
              확인하기 →
            </Link>
          </div>
        )}

        {isLoading && <LoadingState message="기록 목록을 불러오는 중..." />}
        {error && <ErrorState message={error} onRetry={handleRetry} />}

        {!isLoading && !error && items.length === 0 && (
          <EmptyState
            title="등록된 기록이 없습니다"
            description="오늘 건강 상태를 기록해보세요."
            actionLabel="오늘 기록 작성하기"
            onAction={() => {}}
          />
        )}

        {!isLoading && !error && items.length > 0 && (
          <ul className="records-card-list" data-testid="records-card-list">
            {items.map((item) => (
              <li key={item.date} className="record-list-card" data-testid={`record-card-${item.date}`}>
                <Link href={`/records/${item.date}`} className="record-card-link">
                  <div className="record-card-info">
                    <span className="record-card-date">{item.date}</span>
                    <span className="record-card-count">메시지 {item.messageCount}개</span>
                  </div>
                  <div className="record-card-status">
                    <StatusBadge status={item.recordStatus === "confirmed" ? "confirmed" : item.summaryStatus} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RecordsShell>
  );
}
