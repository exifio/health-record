"use client";

import React, { createContext, useContext, useMemo } from "react";
import { createHealthApi, type HealthApi } from "@/features/records/api/health-api";
import { createMockHealthApi } from "@/mocks/health-api";

/**
 * F-006: 화면이 사용할 API를 고른다.
 * `NEXT_PUBLIC_USE_MOCK=false`면 실제 API, 그 외에는 Mock API를 쓴다.
 * 로그인 상태에 따른 선택은 `getHealthApiForAuthStatus`가 담당한다.
 */
export function getDefaultHealthApi(): HealthApi {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "false") {
    return createHealthApi();
  }
  return createMockHealthApi();
}

/** auth-context의 상태값과 같은 의미를 갖는 최소 타입(auth-context ↔ api-adapter 순환 import 방지). */
export type HealthApiAuthStatus = "authenticated" | "unauthenticated" | "demo";

/**
 * F-106 / I-106: 로그인 상태에 따라 실제 API와 정적 샘플(Mock) API를 나눈다.
 *
 * - 로그인: 실제 사용자 API (env로 Mock 전환한 Frontend 단독 개발만 예외)
 * - 비로그인·둘러보기: 정적 샘플(Mock)만 사용한다. 실제 사용자 API를 호출하지 않으므로
 *   로그인하지 않아도 오늘 기록·기록 목록·요약·진료 준비 샘플을 볼 수 있다.
 */
export function getHealthApiForAuthStatus(status: HealthApiAuthStatus): HealthApi {
  if (status === "authenticated") {
    return getDefaultHealthApi();
  }
  return createMockHealthApi();
}

const HealthApiContext = createContext<HealthApi | null>(null);

export interface HealthApiProviderProps {
  children: React.ReactNode;
  api?: HealthApi;
}

export function HealthApiProvider({ children, api }: HealthApiProviderProps) {
  const resolvedApi = useMemo(() => api ?? getDefaultHealthApi(), [api]);

  return (
    <HealthApiContext.Provider value={resolvedApi}>
      {children}
    </HealthApiContext.Provider>
  );
}

export function useHealthApi(): HealthApi {
  const api = useContext(HealthApiContext);
  if (!api) {
    return getDefaultHealthApi();
  }
  return api;
}
