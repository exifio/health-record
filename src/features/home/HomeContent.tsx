"use client";

import React from "react";
import { RecordsShell } from "@/components/layout/RecordsShell";
import { useAuth } from "@/features/auth/auth-context";
import { TodayRecordView } from "@/features/records/components/TodayRecordView";
import { DemoModeBanner } from "@/components/auth/DemoModeBanner";
import { LoginModal } from "@/components/auth/LoginModal";
import { OnboardingNotice } from "@/components/onboarding/OnboardingNotice";

/** I-105: 서버 세션이 주입된 AuthProvider 하에서 로그인/온보딩 상태를 표시한다. */
export function HomeContent() {
  const {
    status,
    isLoginModalOpen,
    needsOnboarding,
    isReady,
    openLoginModal,
    closeLoginModal,
    loginWithGoogle,
    enterDemoMode,
    completeOnboarding,
  } = useAuth();

  return (
    <RecordsShell>
      {/* F-105: 비로그인·둘러보기는 샘플(Mock) 데이터를 보여 주므로 샘플임을 항상 알린다. */}
      {status !== "authenticated" && <DemoModeBanner onLoginClick={openLoginModal} />}
      {status === "authenticated" && isReady && needsOnboarding && (
        <OnboardingNotice onDismiss={completeOnboarding} />
      )}

      <TodayRecordView />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        onGoogleLogin={loginWithGoogle}
        onExplore={enterDemoMode}
        dismissible={true}
      />
    </RecordsShell>
  );
}