"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RecordsShell } from "@/components/layout/RecordsShell";
import { useHealthApi } from "@/features/api/api-adapter";
import { API_ERROR_CODES, isApiError } from "@/features/records/api/health-api";
import { useAuth } from "@/features/auth/auth-context";
import { DailySummaryCard } from "@/components/summary/DailySummaryCard";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import type { DailyRecord, DailySummaryContent, LocalDate } from "@/contracts";

export function RecordDateContent({ date }: { date: LocalDate }) {
  const api = useHealthApi();
  const router = useRouter();
  const { status } = useAuth();
  const isAuthenticated = status === "authenticated";

  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function fetchRecord() {
      // F-106 / I-106: 비로그인·둘러보기는 샘플(Mock) 기록을 읽기 전용으로 보여 준다.
      try {
        const res = await api.getDailyRecord(date);
        if (!ignore) {
          setRecord(res.record);
        }
      } catch (err: unknown) {
        if (!ignore) {
          if (isApiError(err, API_ERROR_CODES.recordNotFound)) {
            setRecord(null);
          } else {
            setError("기록을 불러오지 못했습니다. 다시 시도해주세요.");
          }
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    fetchRecord();

    return () => {
      ignore = true;
    };
  }, [api, date]);

  const reload = () => {
    setIsLoading(true);
    setError(null);
    api.getDailyRecord(date)
      .then((res) => setRecord(res.record))
      .catch((err) => {
        if (isApiError(err, API_ERROR_CODES.recordNotFound)) {
          setRecord(null);
        } else {
          setError("기록을 불러오지 못했습니다. 다시 시도해주세요.");
        }
      })
      .finally(() => setIsLoading(false));
  };

  // I-403: 상태 충돌(확정/오래된 요약)은 서버 상태가 이미 바뀌었다는 뜻이다.
  // 카드를 언마운트하지 않고 상태만 조용히 다시 맞춰 실제 상태와 다른 편집 UI가 남지 않게 한다.
  const CONFLICT_CODES = [
    API_ERROR_CODES.recordConfirmed,
    API_ERROR_CODES.recordNotConfirmed,
    API_ERROR_CODES.summaryStale,
    API_ERROR_CODES.summaryNotReady,
  ] as const;

  const syncAfterConflict = async (error: unknown) => {
    if (!CONFLICT_CODES.some((code) => isApiError(error, code))) return;
    try {
      const res = await api.getDailyRecord(date);
      setRecord(res.record);
    } catch {
      // 상태 동기화는 부수 작업이라 사용자에게 새 오류로 올리지 않는다.
    }
  };

  const handleRetrySummary = async () => {
    await api.retrySummary(date);
    reload();
  };

  const handleUpdateSummary = async (content: DailySummaryContent) => {
    try {
      await api.updateSummary(date, content);
    } catch (error: unknown) {
      await syncAfterConflict(error);
      throw error;
    }
    reload();
  };

  const handleConfirmRecord = async () => {
    try {
      await api.confirmRecord(date);
    } catch (error: unknown) {
      await syncAfterConflict(error);
      throw error;
    }
    reload();
  };

  const handleCreateCorrection = async (content: string) => {
    try {
      await api.createCorrection(date, { content });
    } catch (error: unknown) {
      await syncAfterConflict(error);
      throw error;
    }
    reload();
  };

  const handleDeleteRecord = async () => {
    await api.deleteDailyRecord(date);
    router.push("/records");
  };

  return (
    <RecordsShell>
      <div className="record-detail-page">
        {isLoading && <LoadingState message="기록을 불러오는 중..." />}

        {error && <ErrorState message={error} onRetry={reload} />}

        {!isLoading && !error && !record && (
          <EmptyState
            title="기록이 없습니다"
            description={`${date}에 등록된 건강 기록이 없습니다.`}
            actionLabel="오늘 기록 작성하기"
            onAction={() => router.push("/today")}
          />
        )}

        {!isLoading && !error && record && (
          <DailySummaryCard
            date={date}
            record={record}
            readOnly={!isAuthenticated}
            onRetrySummary={handleRetrySummary}
            onUpdateSummary={handleUpdateSummary}
            onConfirmRecord={handleConfirmRecord}
            onCreateCorrection={handleCreateCorrection}
            onDeleteRecord={handleDeleteRecord}
          />
        )}
      </div>
    </RecordsShell>
  );
}
