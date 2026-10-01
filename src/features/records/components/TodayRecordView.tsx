"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useHealthApi } from "@/features/api/api-adapter";
import { getSystemLocalDate, getSystemTimeZone } from "@/features/api/system-time";
import { API_ERROR_CODES, isApiError } from "@/features/records/api/health-api";
import { useAuth } from "@/features/auth/auth-context";
import { CONSENT_PATH } from "@/server/auth/redirects";
import { RecordTimeline } from "@/components/records/RecordTimeline";
import { RecordComposer } from "@/components/records/RecordComposer";
import { track } from "@/features/analytics/analytics";
import { SuggestionCard } from "@/components/records/SuggestionCard";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { DailyRecord, DailyRecordMessage, Suggestion } from "@/contracts";

export function formatKoreanDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
    const dayName = dayNames[dateObj.getDay()];
    return `${year}년 ${month}월 ${day}일 ${dayName}`;
  } catch {
    return dateStr;
  }
}

export function TodayRecordView() {
  const api = useHealthApi();
  const { status, requestRecordStart } = useAuth();
  const router = useRouter();
  const isAuthenticated = status === "authenticated";

  // F-210 & F-211: Auto-detect local date and timezone
  const todayDate = getSystemLocalDate();
  const systemTimeZone = getSystemTimeZone();

  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [messages, setMessages] = useState<DailyRecordMessage[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSuggestionsDismissed, setIsSuggestionsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // F-305 & F-306: Background refresh for suggestions without blocking user
  const refreshSuggestions = useCallback(async () => {
    try {
      const res = await api.getSuggestions(todayDate);
      setSuggestions(res.suggestions || []);
    } catch {
      setSuggestions([]);
    }
  }, [api, todayDate]);

  useEffect(() => {
    let ignore = false;

    async function loadInitialData() {
      // F-106 / I-106: 비로그인·둘러보기는 샘플(Mock) 오늘 기록을 그대로 보여 준다.
      // 실제 사용자 API는 로그인 상태에서만 호출된다(AuthAwareHealthApiProvider).
      //
      // 제안(suggestions)은 AI 호출이라 수 초 걸릴 수 있으므로 여기서 기다리지 않는다.
      // F-305 / F-306: 제안은 화면을 막지 않는 백그라운드 갱신이다.
      try {
        const res = await api.getDailyRecord(todayDate);
        if (ignore) return;
        setRecord(res.record);
        setMessages(res.record.messages);
      } catch (err: unknown) {
        if (ignore) return;
        // I-201: 실제 API의 404 메시지 문자열이 아니라 contract error code로 판단한다.
        if (isApiError(err, API_ERROR_CODES.recordNotFound)) {
          setRecord(null);
          setMessages([]);
        } else {
          setError("오늘 기록을 불러오지 못했습니다. 다시 시도해주세요.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
        // 기록이 그려진 뒤 제안을 뒤이어 채운다(화면을 기다리게 하지 않는다).
        refreshSuggestions();
      }
    }

    loadInitialData();

    return () => {
      ignore = true;
    };
  }, [api, todayDate, refreshSuggestions]);

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    api.getDailyRecord(todayDate)
      .then((res) => {
        setRecord(res.record);
        setMessages(res.record.messages);
      })
      .catch((err: unknown) => {
        if (isApiError(err, API_ERROR_CODES.recordNotFound)) {
          setRecord(null);
          setMessages([]);
        } else {
          setError("오늘 기록을 불러오지 못했습니다. 다시 시도해주세요.");
        }
      })
      .finally(() => {
        setIsLoading(false);
        refreshSuggestions();
      });
  };

  // I-403: 서버에서 이미 확정된 기록으로 바뀐 경우 원문 편집 시도가 409로 거절된다.
  // 그때는 편집 UI를 그대로 두지 않고 서버 상태를 다시 읽어 확정 상태로 맞춘다.
  const syncRecord = useCallback(async () => {
    try {
      const res = await api.getDailyRecord(todayDate);
      setRecord(res.record);
      setMessages(res.record.messages);
    } catch {
      // 상태 동기화는 부수 작업이라 사용자에게 새 오류로 올리지 않는다.
    }
  }, [api, todayDate]);

  const guardConfirmed = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      try {
        return await action();
      } catch (error: unknown) {
        if (isApiError(error, API_ERROR_CODES.recordConfirmed)) await syncRecord();
        throw error;
      }
    },
    [syncRecord],
  );

  // F-204 & F-212: Create message passing systemTimeZone metadata
  const handleCreateMessage = async (content: string) => {
    const res = await guardConfirmed(() =>
      api.createMessage(todayDate, {
        content,
        systemTimeZone, // F-212
      }).catch((error: unknown) => {
        // PRD 9-3: 서버가 미동의로 거절했다(우회 시도 또는 문구가 바뀌어 재동의가 필요한 경우).
        // 사용자에게 오류를 남기지 않고 동의 페이지로 보낸다.
        if (isApiError(error, API_ERROR_CODES.consentRequired)) {
          router.push(CONSENT_PATH);
        }
        throw error;
      }),
    );

    track("record_created");
    setMessages((prev) => [...prev, res.message]);
    if (record) {
      setRecord({
        ...record,
        recordStatus: res.record.recordStatus,
        summaryStatus: res.record.summaryStatus,
        contentRevision: res.record.contentRevision,
      });
    }

    // Refresh suggestions after recording new information
    refreshSuggestions();
  };

  // F-206: Update message
  const handleUpdateMessage = async (messageId: string, content: string) => {
    const res = await guardConfirmed(() => api.updateMessage(todayDate, messageId, { content }));
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? res.message : m))
    );
    if (record) {
      setRecord({
        ...record,
        recordStatus: res.record.recordStatus,
        summaryStatus: res.record.summaryStatus,
        contentRevision: res.record.contentRevision,
      });
    }
  };

  // F-207: Delete message
  const handleDeleteMessage = async (messageId: string) => {
    await guardConfirmed(() => api.deleteMessage(todayDate, messageId));
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const isConfirmed = record?.recordStatus === "confirmed";

  if (isLoading) {
    return <LoadingState message="오늘 기록을 불러오는 중..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={handleRetry} />;
  }

  return (
    <div className="today-record-view" data-testid="today-record-view">
      {/* F-201: Today date display */}
      <header className="today-header">
        <div className="today-title-area">
          <h2 className="today-heading">오늘 기록</h2>
          <span className="today-date-badge" data-testid="today-date-text">
            {formatKoreanDate(todayDate)}
          </span>
        </div>
        {record && (
          <div className="today-status-badge">
            <StatusBadge status={record.recordStatus === "confirmed" ? "confirmed" : record.summaryStatus} />
          </div>
        )}
      </header>

      {/* F-202 & F-203 & F-205: Timeline and Messages */}
      {/* F-106: 비로그인·둘러보기는 읽기 전용이므로 원문 수정/삭제 UI를 노출하지 않는다. */}
      <RecordTimeline
        messages={messages}
        isConfirmed={isConfirmed}
        canEdit={isAuthenticated}
        onUpdateMessage={handleUpdateMessage}
        onDeleteMessage={handleDeleteMessage}
      />

      {/* F-301 ~ F-304: Suggestions card (only if not dismissed, not confirmed, and suggestions exist) */}
      {!isConfirmed && !isSuggestionsDismissed && suggestions.length > 0 && (
        <SuggestionCard
          suggestions={suggestions}
          onDismiss={() => setIsSuggestionsDismissed(true)}
        />
      )}

      {/* F-204 & F-208: Composer with loading / error handling */}
      {!isConfirmed ? (
        <RecordComposer
          onSubmit={handleCreateMessage}
          isAuthenticated={isAuthenticated}
          onRequireAuth={requestRecordStart}
        />
      ) : (
        <div className="record-confirmed-notice" data-testid="record-confirmed-notice">
          <p>오늘 기록이 확정되었습니다. 원문 수정 및 삭제가 제한됩니다.</p>
        </div>
      )}
    </div>
  );
}
