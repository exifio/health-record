"use client";

import React, { useState } from "react";
import Link from "next/link";
import { RecordsShell, daysAgoLocalDate, LIST_RANGE_DAYS as VISIT_PREP_RANGE_DAYS } from "@/components/layout/RecordsShell";
import { useHealthApi, getSystemLocalDate } from "@/features/api/api-adapter";
import { useAuth } from "@/features/auth/auth-context";
import { LoadingState } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import type { VisitPrepResponse } from "@/contracts";

export function VisitPrepContent() {
  const api = useHealthApi();
  const { status } = useAuth();
  const isAuthenticated = status === "authenticated";
  const today = getSystemLocalDate();

  // F-605: Date range selection
  const [fromDate, setFromDate] = useState(daysAgoLocalDate(VISIT_PREP_RANGE_DAYS));
  const [toDate, setToDate] = useState(today);
  const [data, setData] = useState<VisitPrepResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // F-610: Unreviewed banner continue state
  const [ignoreUnreviewed, setIgnoreUnreviewed] = useState(false);
  // F-608: Expanded raw records map by date
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const handleFetchPrep = async (e: React.FormEvent) => {
    e.preventDefault();
    // I-106: 미인증/Demo 모드에서는 실제 사용자 API를 호출하지 않는다.
    if (!isAuthenticated) {
      setError("로그인이 필요합니다.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setIgnoreUnreviewed(false);
      const res = await api.getVisitPrep(fromDate, toDate);
      setData(res);
    } catch {
      setError("진료 준비 기록을 불러오지 못했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRaw = (date: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  const showUnreviewedBanner =
    data && data.unreviewed.count > 0 && !ignoreUnreviewed;

  return (
    <RecordsShell>
      <div className="visit-prep-page" data-testid="visit-prep-page">
        <header className="visit-prep-header">
          <h2 className="visit-prep-heading">진료 준비</h2>
          <p className="visit-prep-sub">
            병원 방문 시 의료진에게 보여줄 확정된 건강 기록을 기간별로 모아봅니다.
          </p>
        </header>

        {/* F-605: Date range picker form */}
        <form onSubmit={handleFetchPrep} className="visit-prep-form" data-testid="visit-prep-form">
          <div className="date-input-group">
            <label htmlFor="from-date" className="date-label">
              시작일
            </label>
            <input
              id="from-date"
              type="date"
              className="date-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              required
              data-testid="from-date-input"
            />
          </div>

          <div className="date-input-group">
            <label htmlFor="to-date" className="date-label">
              종료일
            </label>
            <input
              id="to-date"
              type="date"
              className="date-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              required
              data-testid="to-date-input"
            />
          </div>

          <button
            type="submit"
            className="btn-primary visit-prep-submit-btn"
            disabled={isLoading}
            data-testid="fetch-prep-btn"
          >
            {isLoading ? "불러오는 중..." : "기록 불러오기"}
          </button>
        </form>

        {isLoading && <LoadingState message="진료 준비 데이터를 생성하는 중..." />}
        {error && <ErrorState message={error} onRetry={() => {}} />}

        {/* F-610: Unreviewed records notice and branch actions */}
        {showUnreviewedBanner && (
          <div className="unreviewed-prep-notice" data-testid="unreviewed-prep-notice">
            <p className="unreviewed-prep-text">
              선택한 기간에 확인하지 않은 기록이 {data.unreviewed.count}개 있습니다.
            </p>
            <div className="unreviewed-prep-actions">
              <Link
                href={`/records/${data.unreviewed.dates[0] || today}`}
                className="btn-secondary unreviewed-check-btn"
                data-testid="check-unreviewed-btn"
              >
                기록 확인하기
              </Link>
              <button
                type="button"
                className="btn-outline unreviewed-continue-btn"
                onClick={() => setIgnoreUnreviewed(true)}
                data-testid="continue-confirmed-btn"
              >
                확인된 기록만 계속하기
              </button>
            </div>
          </div>
        )}

        {/* Results: F-606 & F-607 & F-608 & F-609 */}
        {data && !isLoading && (
          <div className="visit-prep-results" data-testid="visit-prep-results">
            {data.confirmedRecords.length === 0 ? (
              <EmptyState
                title="확정된 기록이 없습니다"
                description="선택한 기간에 확정된 건강 기록이 없습니다."
              />
            ) : (
              <ul className="confirmed-records-list">
                {/* F-607: Records without entries are omitted */}
                {data.confirmedRecords.map((item) => (
                  <li key={item.date} className="confirmed-record-card" data-testid={`prep-card-${item.date}`}>
                    <div className="prep-card-header">
                      <h3 className="prep-card-date">{item.date}</h3>
                      <span className="prep-card-badge">확정</span>
                    </div>

                    <div className="prep-card-body">
                      <h4 className="prep-section-heading">정리 내용</h4>
                      <ul className="prep-timeline-list">
                        {item.summary.timeline.map((line, idx) => (
                          <li key={idx} className="prep-timeline-item">
                            • {line.text}
                          </li>
                        ))}
                      </ul>

                      {/* F-609: Corrections section */}
                      {item.corrections.length > 0 && (
                        <div className="prep-corrections-box" data-testid={`corrections-${item.date}`}>
                          <h5 className="prep-corrections-heading">정정 기록</h5>
                          <ul className="prep-corrections-list">
                            {item.corrections.map((corr) => (
                              <li key={corr.id} className="prep-correction-item">
                                <span>• {corr.content}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* F-608: Raw record disclosure */}
                      <div className="prep-raw-disclosure">
                        <button
                          type="button"
                          className="btn-raw-toggle"
                          onClick={() => toggleRaw(item.date)}
                          data-testid={`toggle-raw-${item.date}`}
                        >
                          {expandedDates[item.date] ? "원문 접기 ▲" : "원문 보기 ▼"}
                        </button>
                        {expandedDates[item.date] && (
                          <div className="prep-raw-content" data-testid={`raw-content-${item.date}`}>
                            <p className="prep-raw-note">원문 메시지:</p>
                            <ul className="prep-raw-list">
                              {item.summary.timeline.map((t, i) => (
                                <li key={i}>{t.text}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </RecordsShell>
  );
}
