"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { LocalDate } from "@/contracts";
import { createHealthApi, type HealthApi } from "@/features/records/api/health-api";
import { createMockHealthApi } from "@/mocks/health-api";

export function getSystemLocalDate(now: Date = new Date()): LocalDate {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as LocalDate;
}

export function getSystemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul";
  } catch {
    return "Asia/Seoul";
  }
}

export function getDefaultHealthApi(): HealthApi {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "false") {
    return createHealthApi();
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
