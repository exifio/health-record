"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RecordsShell } from "@/components/layout/RecordsShell";
import { useAuth } from "@/features/auth/auth-context";
import { TodayRecordView } from "@/features/records/components/TodayRecordView";
import { DemoModeBanner } from "@/components/auth/DemoModeBanner";
import { LoginModal } from "@/components/auth/LoginModal";
import { OnboardingNotice } from "@/components/onboarding/OnboardingNotice";

const ACCOUNT_DELETED_PARAM = "account-deleted";

/** I-105: 서버 세션이 주입된 AuthProvider 하에서 로그인/온보딩 상태를 표시한다. */
export function HomeContent() {
  return (
    <RecordsShell>
      <Suspense fallback={null}>
        <HomeBody />
      </Suspense>
    </RecordsShell>
  );
}

function HomeBody() {
  const {
    status,
    isLoginModalOpen,
    startFlowNext,
    needsOnboarding,
    isReady,
    openLoginModal,
    closeLoginModal,
    loginWithGoogle,
    enterDemoMode,
    completeOnboarding,
  } = useAuth();
  const searchParams = useSearchParams();
  const paramValue = searchParams.get(ACCOUNT_DELETED_PARAM);
  // 계정 삭제 직후 "?account-deleted=1"로 홈에 오면 삭제 완료를 홈에서 보여 준다.
  // 설정 화면에서 모달로 끝내면 로그아웃 + refresh 타이밍에 모달이 같이 날아가
  // "아무 일도 안 일어난" 것처럼 보이는 문제를 피한다.
  const [showAccountDeletedNotice, setShowAccountDeletedNotice] = useState(paramValue === "1");

  useEffect(() => {
    if (paramValue !== "1") return;
    // 새로고침해도 같은 배너가 다시 뜨지 않도록 쿼리만 지운다(히스토리 추가 없음).
    const url = new URL(window.location.href);
    url.searchParams.delete(ACCOUNT_DELETED_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [paramValue]);

  const isLoggedIn = status === "authenticated";

  return (
    <>
      {showAccountDeletedNotice && (
        <div role="status" className="settings-alert-banner" data-testid="account-deleted-notice">
          계정이 삭제되어 로그아웃되었습니다.
          <button
            type="button"
            className="btn-cancel"
            onClick={() => setShowAccountDeletedNotice(false)}
            data-testid="account-deleted-notice-dismiss-btn"
          >
            닫기
          </button>
        </div>
      )}
      {/* F-105: 비로그인·둘러보기는 샘플(Mock) 데이터를 보여 주므로 샘플임을 항상 알린다. */}
      {status !== "authenticated" && <DemoModeBanner onLoginClick={openLoginModal} />}
      {isLoggedIn && isReady && needsOnboarding && (
        <OnboardingNotice onDismiss={completeOnboarding} />
      )}

      {/* PRD 9-3: 오늘 기록 화면에는 동의 UI를 두지 않는다. 동의는 전용 페이지
          (/onboarding/health-consent)가 맡고, 기록을 시작하려 할 때만 그리로 보낸다. */}
      <TodayRecordView />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        onGoogleLogin={() => loginWithGoogle(startFlowNext)}
        onExplore={enterDemoMode}
        dismissible={true}
      />
    </>
  );
}