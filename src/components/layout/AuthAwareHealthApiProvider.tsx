"use client";

import React, { useMemo } from "react";
import { getHealthApiForAuthStatus, HealthApiProvider } from "@/features/api/api-adapter";
import { useAuth } from "@/features/auth/auth-context";

/**
 * F-106 / I-106: 화면이 쓸 API를 로그인 상태에 따라 갈아 끼운다.
 * - 로그인: 실제 API
 * - 비로그인·둘러보기: 정적 샘플(Mock)만 보여 주고 실제 사용자 API를 호출하지 않는다.
 *
 * 로그인 상태는 AuthProvider 안에서만 읽을 수 있어 별도 컴포넌트로 분리했다.
 * status가 바뀔 때만 API를 새로 만들므로(로그인/로그아웃) 같은 세션 안에서는
 * Mock 저장소 하나를 계속 공유한다.
 */
export function AuthAwareHealthApiProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const api = useMemo(() => getHealthApiForAuthStatus(status), [status]);

  return <HealthApiProvider api={api}>{children}</HealthApiProvider>;
}
