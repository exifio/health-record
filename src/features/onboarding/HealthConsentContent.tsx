"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RecordsShell } from "@/components/layout/RecordsShell";
import { useAuth } from "@/features/auth/auth-context";
import { sanitizeNextPath, JUST_LOGGED_IN_COOKIE } from "@/server/auth/redirects";
import { CURRENT_CONSENT_VERSION } from "@/contracts";
import { grantAnalyticsConsent, track } from "@/features/analytics/analytics";

const NEXT_PARAM = "next";

/**
 * PRD 9-3: 건강정보 처리 동의 전용 페이지(/onboarding/health-consent).
 *
 * 왜 전용 페이지인가:
 * - 로그인 모달은 **인증만** 한다. 로그인 행위만으로 민감정보 동의를 강제하면 안 된다.
 * - 오늘 기록 화면에 상시 카드를 두지 않되, 기록을 시작하려는 순간에 확실히 보여야 한다.
 * - 모달이 아니므로 주소가 있어 공유·인쇄가 되고, 동의 사실을 문서로 남길 수 있다.
 *
 * 서버 저장이 성공하기 전에는 이동하지 않는다.
 */
export function HealthConsentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, hasConsented, recordConsent } = useAuth();
  const next = sanitizeNextPath(searchParams.get(NEXT_PARAM));

  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이미 로그인이 안 된 상태로 이 페이지에 오면(직접 URL 입력) 동의 자체가 불가하다.
  if (status !== "authenticated") {
    return (
      <RecordsShell>
        <div className="health-consent-page" data-testid="health-consent-page">
          <h2 className="settings-heading">건강 기록을 시작하기 전에 확인해주세요</h2>
          <p className="settings-sub">동의는 로그인한 계정에만 저장할 수 있습니다.</p>
          <Link href="/" className="privacy-link" data-testid="consent-need-login-link">
            홈으로 돌아가기 →
          </Link>
        </div>
      </RecordsShell>
    );
  }

  const handleAgree = async () => {
    if (!isChecked || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await recordConsent(CURRENT_CONSENT_VERSION);
      router.push(next);
      // 첫 로그인이 여기서 끝나는 경우가 많다. cookie 표식이 남아 있으면 login_completed 소모.
      grantAnalyticsConsent();
      if (document.cookie.includes(`${JUST_LOGGED_IN_COOKIE}=`)) {
        document.cookie = `${JUST_LOGGED_IN_COOKIE}=; Path=/; Max-Age=0`;
        track("login_completed");
      }
    } catch {
      // 저장이 안 되면 이동하지 않는다. 카드로 돌아가 재시도하게 한다.
      setError("동의 저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RecordsShell>
      <div className="health-consent-page" data-testid="health-consent-page">
        <h2 className="settings-heading">건강 기록을 시작하기 전에 확인해주세요</h2>
        <p className="settings-sub">
          건강 기록에는 증상, 복약 내용, 건강 상태 등 민감정보에 해당하는 건강정보가 포함될 수 있습니다.
        </p>

        {/* 이미 동의한 계정은 다시 묻지 않는다(재방문·재로그인·다른 기기 모두). */}
        {hasConsented ? (
          <section className="privacy-section" data-testid="health-consent-done">
            <h3 className="settings-section-title">이미 동의하셨습니다</h3>
            <p className="privacy-text">
              건강정보 처리에 동의한 계정입니다. 오늘 기록에서 바로 기록을 남길 수 있습니다.
            </p>
            <div className="consent-actions">
              <button
                type="button"
                className="onboarding-confirm-btn"
                onClick={() => router.push(next)}
                data-testid="consent-go-record-btn"
              >
                오늘 기록으로
              </button>
            </div>
          </section>
        ) : (
          <section className="privacy-section" data-testid="health-consent-form">
            <h3 className="settings-section-title">민감정보(건강정보) 처리</h3>

            <dl className="consent-defs">
              <div className="consent-def">
                <dt>수집·이용 항목</dt>
                <dd>사용자가 직접 작성하는 증상, 복약 내용, 건강 상태 등의 건강 기록</dd>
              </div>
              <div className="consent-def">
                <dt>이용 목적</dt>
                <dd>건강 기록 저장, 기록 정리, 진료 준비용 기록 생성 등 서비스 기능 제공</dd>
              </div>
              <div className="consent-def">
                <dt>AI 처리</dt>
                <dd>
                  AI 정리 기능을 사용할 경우 정리에 필요한 건강 기록이 <strong>OpenAI API로 전송</strong>
                  됩니다. AI는 기록 정리 및 요약을 위한 보조 기능으로 사용하며 의료 진단, 질병 예측 또는
                  의약품 처방을 목적으로 하지 않습니다. AI가 생성한 결과는 사용자가 작성한 원본 기록을
                  수정하거나 덮어쓰지 않습니다.
                </dd>
              </div>
              <div className="consent-def">
                <dt>보관</dt>
                <dd>
                  OpenAI API로 전송된 데이터는 기본적으로 OpenAI 모델의 학습이나 개선에 사용되지 않습니다.
                  다만 OpenAI의 악용 방지 목적상 일부 데이터가 최대 30일까지 보관될 수 있습니다.{" "}
                  <a
                    href="https://developers.openai.com/api/docs/guides/your-data"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="consent-link"
                  >
                    OpenAI 데이터 처리 정책
                  </a>
                </dd>
              </div>
            </dl>

            <p className="consent-more">
              <Link href="/settings/privacy" className="consent-link" data-testid="consent-detail-link">
                개인정보 및 AI 처리 자세히 보기 →
              </Link>
            </p>

            <label className="consent-check">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(event) => setIsChecked(event.target.checked)}
                className="consent-input"
                data-testid="consent-checkbox"
              />
              <span>[필수] 민감정보(건강정보) 처리에 동의합니다.</span>
            </label>

            {error && (
              <p role="alert" className="consent-error" data-testid="consent-error">
                {error}
              </p>
            )}

            <div className="consent-actions">
              <Link
                href={next}
                className="btn-cancel"
                aria-disabled={isSubmitting}
                data-testid="consent-back-btn"
              >
                동의하지 않고 돌아가기
              </Link>
              <button
                type="button"
                className="onboarding-confirm-btn"
                onClick={handleAgree}
                disabled={!isChecked || isSubmitting}
                data-testid="consent-agree-btn"
              >
                {isSubmitting ? "저장 중..." : "동의하고 시작하기"}
              </button>
            </div>
          </section>
        )}
      </div>
    </RecordsShell>
  );
}
