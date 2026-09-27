"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDefaultHealthApi } from "@/features/api/api-adapter";
import { CURRENT_CONSENT_VERSION } from "@/contracts";
import { CONSENT_PATH } from "@/server/auth/redirects";

export type AuthStatus = "authenticated" | "unauthenticated" | "demo";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  isLoginModalOpen: boolean;
  /** PRD 9-3: 기록 시작 흐름으로 열린 로그인 모달일 때의 복귀 경로. 없으면 설정 등 단순 로그인. */
  startFlowNext: string | undefined;
  needsOnboarding: boolean;
  /** PRD 9-3: 현재 고지 버전에 동의했는지. false면 기록 시작 시 동의를 받는다. */
  hasConsented: boolean;
  isReady: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  /**
   * PRD 9-3: 기록 시작을 시도했을 때의 판정.
   * 진행 가능하면 true, 모달을 열거나 동의 페이지로 보내야 하면 false.
   */
  requestRecordStart: () => boolean;
  loginWithGoogle: (next?: string) => void;
  enterDemoMode: () => void;
  logout: () => Promise<void>;
  completeOnboarding: () => void;
  /** PRD 9-3: 민감정보 처리 동의. 고지 버전을 서버에 기록한다. */
  recordConsent: (version: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** I-104: 실제 OAuth는 이미 완성된 서버 라우트가 담당한다. */
export const GOOGLE_LOGIN_PATH = "/api/auth/google";
export const LOGOUT_PATH = "/api/auth/logout";

export interface AuthProviderProps {
  children: React.ReactNode;
  /** 서버 세션으로 확인한 초기 상태. 하드코딩하지 않는다. */
  initialStatus?: Exclude<AuthStatus, "demo">;
  initialUser?: AuthUser | null;
  initialShowLoginModal?: boolean;
  initialNeedsOnboarding?: boolean;
}

export function AuthProvider({
  children,
  initialStatus = "unauthenticated",
  initialUser = null,
  initialShowLoginModal = false,
  initialNeedsOnboarding = false,
}: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>(initialStatus);
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(initialShowLoginModal);
  // PRD 9-3: 「기록」을 누른 뒤 로그인 모달이 열렸을 때만 채운다. 설정에서 단순히
  // 로그인한 경우에는 비어 있어 OAuth 복귀가 원래 화면으로 간다.
  const [startFlowNext, setStartFlowNext] = useState<string | undefined>(undefined);
  const [needsOnboarding, setNeedsOnboarding] = useState(initialNeedsOnboarding);
  // PRD 9-3: 현재 고지 버전에 동의한 계정만 통과로 본다. 문구 버전을 올리면
  // 저장된 값과 달라져 여기서 다시 동의 화면이 뜬다.
  const [hasConsented, setHasConsented] = useState(false);
  const router = useRouter();
  // 서버가 세션과 온보딩 상태까지 확인해 초기값을 넘겨준다.
  const [isReady, setIsReady] = useState(initialStatus === "unauthenticated");

  // F-108 / I-104: 온보딩 여부를 서버 프로필 값으로 확인한다.
  // StrictMode는 개발에서 effect를 두 번 실행한다. 한 번만 수행하는 ref 가드를 두면
  // 첫 실행의 결과가 cleanup으로 버려지고 두 번째 실행은 조기 반환되어
  // isReady가 영영 true가 되지 않아 온보딩 안내가 뜨지 않는다.
  // 조회는 멱등 GET이므로 effect를 그대로 두 번 실행해도 안전하다.
  useEffect(() => {
    if (initialStatus !== "authenticated") return;

    let ignore = false;
    getDefaultHealthApi()
      .getProfile()
      .then((profile) => {
        if (ignore) return;
        setNeedsOnboarding(!profile.onboardingCompleted);
        setHasConsented(profile.consentVersion === CURRENT_CONSENT_VERSION);
      })
      .catch(() => {
        // 프로필 확인 실패는 온보딩 표시를 막지 않는다(원문 저장과 분리).
        if (!ignore) setNeedsOnboarding(false);
      })
      .finally(() => {
        if (!ignore) setIsReady(true);
      });

    return () => {
      ignore = true;
    };
  }, [initialStatus]);

  const openLoginModal = useCallback(() => {
    setStartFlowNext(undefined);
    setIsLoginModalOpen(true);
  }, []);
  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

  const loginWithGoogle = useCallback((next?: string) => {
    setIsLoginModalOpen(false);
    // OAuth 흐름은 서버가 세션 쿠키를 교환한다. 목 사용자를 만들지 않는다.
    if (typeof window !== "undefined") {
      // 전체 페이지를 서버 OAuth 엔드포인트로 이동시켜야 세션 쿠키가 교환된다.
      // next는 **네비게이션 의도만** 담는다(동의 상태·건강 기록은 담지 않는다).
      // 서버가 allowlist로 검증한다. 기록 시작 흐름으로 온 경우에만 붙는다.
      const target = next
        ? `${GOOGLE_LOGIN_PATH}?next=${encodeURIComponent(next)}`
        : GOOGLE_LOGIN_PATH;
      window.location.replace(target);
    }
  }, []);

  /**
   * PRD 9-3: 「기록」을 누른 순간에만 로그인·동의를 요구한다.
   * - 데모/비로그인: 로그인 모달을 열고, 로그인 뒤 동의 페이지로 돌아오도록 next를 붙인다.
   * - 로그인+미동의: 전용 동의 페이지로 바로 보낸다(오늘 기록 화면에는 카드를 두지 않는다).
   * - 로그인+동의: 아무것도 하지 않고 진행시킨다.
   * @returns 지금 기록 작성을 계속해도 되는지.
   */
  const requestRecordStart = useCallback((): boolean => {
    if (status === "demo") return false;
    if (status !== "authenticated") {
      setStartFlowNext(CONSENT_PATH);
      setIsLoginModalOpen(true);
      return false;
    }
    if (!hasConsented) {
      router.push(CONSENT_PATH);
      return false;
    }
    return true;
  }, [status, hasConsented, router]);

  const enterDemoMode = useCallback(() => {
    setStatus("demo");
    setUser(null);
    setIsLoginModalOpen(false);
    setNeedsOnboarding(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(LOGOUT_PATH, { method: "POST" });
    } finally {
      // 서버 세션을 지운 뒤에는 다음 렌더에서 인증되지 않은 상태가 되어야 한다.
      setStatus("unauthenticated");
      setUser(null);
      setNeedsOnboarding(false);
      router.refresh();
    }
  }, [router]);

  const completeOnboarding = useCallback(() => {
    setNeedsOnboarding(false);
    // 온보딩 완료 상태는 새로고침 후에도 유지되어야 하므로 서버에 저장한다.
    // 동의 저장은 하지 않는다 — 온보딩 완료가 민감정보 동의로 오인되면 안 된다.
    void getDefaultHealthApi()
      .updateProfile({ onboardingCompleted: true })
      .catch(() => {
        // 저장 실패는 UI 흐름을 막지 않는다(AGENTS.md 2절: AI/부수 작업 실패 격리).
      });
  }, []);

  // PRD 9-3: 서버 저장이 성공한 뒤에만 화면을 닫는다. 실패한 상태로 닫으면
  // 사용자는 "동의했는데도 반복해서 보인다"는 상태가 되고 이력도 남지 않는다.
  const recordConsent = useCallback(async (version: string) => {
    await getDefaultHealthApi().updateProfile({ reason: "consent", consentVersion: version });
    setHasConsented(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isLoginModalOpen,
      startFlowNext,
      needsOnboarding,
      hasConsented,
      isReady,
      openLoginModal,
      closeLoginModal,
      requestRecordStart,
      loginWithGoogle,
      enterDemoMode,
      logout,
      completeOnboarding,
      recordConsent,
    }),
    [
      status,
      user,
      isLoginModalOpen,
      startFlowNext,
      needsOnboarding,
      hasConsented,
      isReady,
      openLoginModal,
      closeLoginModal,
      requestRecordStart,
      loginWithGoogle,
      enterDemoMode,
      logout,
      completeOnboarding,
      recordConsent,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
