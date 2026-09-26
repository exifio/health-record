"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDefaultHealthApi } from "@/features/api/api-adapter";

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
  needsOnboarding: boolean;
  isReady: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  loginWithGoogle: () => void;
  enterDemoMode: () => void;
  logout: () => Promise<void>;
  completeOnboarding: () => void;
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
  const [needsOnboarding, setNeedsOnboarding] = useState(initialNeedsOnboarding);
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
        if (!ignore) setNeedsOnboarding(!profile.onboardingCompleted);
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

  const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

  const loginWithGoogle = useCallback(() => {
    setIsLoginModalOpen(false);
    // OAuth 흐름은 서버가 세션 쿠키를 교환한다. 목 사용자를 만들지 않는다.
    if (typeof window !== "undefined") {
      // 전체 페이지를 서버 OAuth 엔드포인트로 이동시켜야 세션 쿠키가 교환된다.
      window.location.replace(GOOGLE_LOGIN_PATH);
    }
  }, []);

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
    void getDefaultHealthApi()
      .updateProfile({ onboardingCompleted: true })
      .catch(() => {
        // 저장 실패는 UI 흐름을 막지 않는다(AGENTS.md 2절: AI/부수 작업 실패 격리).
      });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isLoginModalOpen,
      needsOnboarding,
      isReady,
      openLoginModal,
      closeLoginModal,
      loginWithGoogle,
      enterDemoMode,
      logout,
      completeOnboarding,
    }),
    [
      status,
      user,
      isLoginModalOpen,
      needsOnboarding,
      isReady,
      openLoginModal,
      closeLoginModal,
      loginWithGoogle,
      enterDemoMode,
      logout,
      completeOnboarding,
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
