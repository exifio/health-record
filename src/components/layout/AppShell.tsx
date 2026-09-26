"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sidebar, PanelLeftIcon, type RecentRecordItem } from "@/components/layout/Sidebar";

export interface AppShellProps {
  children: React.ReactNode;
  recentRecords?: RecentRecordItem[];
}

export function AppShell({ children, recentRecords }: AppShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  return (
    <div className={"app-shell " + (isDesktopCollapsed ? "sidebar-collapsed" : "")}>
      {/* Sidebar Component (Full-height on Desktop / Drawer on Mobile) */}
      <Sidebar
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        isDesktopCollapsed={isDesktopCollapsed}
        onToggleDesktop={() => setIsDesktopCollapsed((prev) => !prev)}
        recentRecords={recentRecords}
      />

      <div className="app-main">
        {/* Main Content Area Header */}
        <header className="app-header">
          <div className="app-header-left">
            {/* Mobile hamburger button */}
            <button
              type="button"
              className="header-btn header-btn--mobile-toggle"
              onClick={() => setIsMobileOpen(true)}
              aria-label="메뉴 열기"
              aria-controls="mobile-sidebar"
              aria-expanded={isMobileOpen}
            >
              <PanelLeftIcon />
            </button>

            {/* Desktop sidebar expand button (shown when desktop sidebar is collapsed) */}
            <button
              type="button"
              className="header-btn header-btn--desktop-toggle"
              onClick={() => setIsDesktopCollapsed((prev) => !prev)}
              aria-label={isDesktopCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
              aria-controls="desktop-sidebar"
              aria-expanded={!isDesktopCollapsed}
            >
              <PanelLeftIcon />
            </button>

            <Link href="/" className="header-logo">
              건강 기록
            </Link>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="app-content">
          <div className="app-content-inner">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
