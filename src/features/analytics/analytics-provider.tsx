"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initAnalytics, track } from "./analytics";

/**
 * 경로 변경마다 page_view 1회. consent 게이트는 analytics.ts가 한다.
 * pathname만 키로 쓴다 — utm 쿼리는 Amplitude가 세션 acquisition으로 따로 잡는다.
 * init을 여기서 먼저 부르는 이유: 자식 effect가 부모보다 먼저 돌아가므로
 * AnalyticsProvider에서만 init 하면 첫 page_view 가 init 전에 지나간다.
 */
function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
    track("page_view");
  }, [pathname]);

  return null;
}

export function AnalyticsProvider() {
  return <PageViewTracker />;
}
