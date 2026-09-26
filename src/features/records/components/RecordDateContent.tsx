"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RecordsShell } from "@/components/layout/RecordsShell";
import { useHealthApi } from "@/features/api/api-adapter";
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
      // I-106: 미인증/Demo 모드에서는 실제 사용자 API를 호출하지 않는다.
      if (!isAuthenticated) {
        if (!ignore) setIsLoading(false);
        return;
      }

      try {
        const res = await api.getDailyRecord(date);
        if (!ignore) {
          setRecord(res.record);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const message = err instanceof Error ? err.message : "";
          if (message.includes("기록이 없습니다") || message.includes("404")) {
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
  }, [api, date, isAuthenticated]);

  const reload = () => {
    setIsLoading(true);
    setError(null);
    api.getDailyRecord(date)
      .then((res) => setRecord(res.record))
      .catch((err) => {
        const message = err instanceof Error ? err.message : "";
        if (message.includes("기록이 없습니다") || message.includes("404")) {
          setRecord(null);
        } else {
          setError("기록을 불러오지 못했습니다. 다시 시도해주세요.");
        }
      })
      .finally(() => setIsLoading(false));
  };

  const handleRetrySummary = async () => {
    await api.retrySummary(date);
    reload();
  };

  const handleUpdateSummary = async (content: DailySummaryContent) => {
    await api.updateSummary(date, content);
    reload();
  };

  const handleConfirmRecord = async () => {
    await api.confirmRecord(date);
    reload();
  };

  const handleCreateCorrection = async (content: string) => {
    await api.createCorrection(date, { content });
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
