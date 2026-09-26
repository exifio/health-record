"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StatusBadge, statusHint, type DisplayStatus } from "@/components/common/StatusBadge";

export interface RecentRecordItem {
  date: string;
  label: string;
  /** null이면 배지를 표시하지 않는다(사용자가 할 행동이 없는 수동 상태). */
  status: DisplayStatus | null;
}

/** 사이드바에서 현재 보고 있는 기록인지 판정한다(활성 표시 + aria-current). */
export function isActiveRecordPath(pathname: string | null, date: string): boolean {
  return pathname === `/records/${date}`;
}

export interface SidebarProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isDesktopCollapsed: boolean;
  onToggleDesktop?: () => void;
  recentRecords?: RecentRecordItem[];
}

export function PanelLeftIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="4" />
      <path d="M9 3v18" />
    </svg>
  );
}

export function SquarePenIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}

export function StethoscopeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

export function SettingsIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function Sidebar({
  isMobileOpen,
  onCloseMobile,
  isDesktopCollapsed,
  onToggleDesktop,
  // 데이터는 RecordsShell이 주입한다. prop을 주지 않으면 빈 목록으로 렌더링한다(F-601).
  recentRecords = [],
}: SidebarProps) {
  const pathname = usePathname();

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseMobile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const navContent = (
    <div className="sidebar-inner">
      {/* Top Header Row: Title + Sidebar Toggle button */}
      <div className="sidebar-header">
        <Link href="/" className="sidebar-brand" onClick={onCloseMobile}>
          건강 기록
        </Link>
        <div className="sidebar-header-actions">
          <button
            type="button"
            className="sidebar-icon-btn"
            title={isMobileOpen ? "메뉴 닫기" : "사이드바 접기"}
            aria-label={isMobileOpen ? "메뉴 닫기" : "사이드바 접기"}
            onClick={isMobileOpen ? onCloseMobile : onToggleDesktop}
          >
            <PanelLeftIcon />
          </button>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="sidebar-nav" aria-label="메인 메뉴">
        {/* ChatGPT '새 채팅' style primary action */}
        <div className="sidebar-primary-section">
          <Link
            href="/today"
            className="sidebar-compose-btn"
            onClick={onCloseMobile}
          >
            <span className="sidebar-compose-icon">
              <SquarePenIcon />
            </span>
            <span className="sidebar-compose-label">오늘 기록</span>
          </Link>
        </div>

        {/* Other menu items */}
        <div className="sidebar-section">
          <ul className="sidebar-menu">
            <li>
              <Link href="/visit-prep" className="sidebar-menu-item" onClick={onCloseMobile}>
                <span className="sidebar-menu-icon" aria-hidden="true">
                  <StethoscopeIcon />
                </span>
                <span className="sidebar-menu-label">진료 준비</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Recent records */}
        <div className="sidebar-section">
          <div className="sidebar-section-title">최근 기록</div>
          {recentRecords.length > 0 ? (
            <ul className="sidebar-menu sidebar-records-list">
              {recentRecords.map((item) => {
                const isActive = isActiveRecordPath(pathname, item.date);

                return (
                  <li key={item.date}>
                    <Link
                      href={"/records/" + item.date}
                      className={"sidebar-record-item" + (isActive ? " is-active" : "")}
                      aria-current={isActive ? "page" : undefined}
                      title={item.status ? statusHint(item.status) : undefined}
                      onClick={onCloseMobile}
                    >
                      <span className="sidebar-record-date">{item.label}</span>
                      {item.status && <StatusBadge status={item.status} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="sidebar-records-empty" data-testid="sidebar-records-empty">
              아직 기록이 없습니다
            </p>
          )}
          <Link
            href="/records"
            className="sidebar-more-link"
            onClick={onCloseMobile}
          >
            모든 기록 보기 →
          </Link>
        </div>

        {/* Bottom settings */}
        <div className="sidebar-section sidebar-section--bottom">
          <ul className="sidebar-menu">
            <li>
              <Link href="/settings" className="sidebar-menu-item sidebar-user-item" onClick={onCloseMobile}>
                <span className="sidebar-user-avatar" aria-hidden="true">
                  <SettingsIcon />
                </span>
                <span className="sidebar-menu-label">설정</span>
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="mobile-overlay"
          onClick={onCloseMobile}
          aria-hidden="true"
          data-testid="mobile-overlay"
        />
      )}

      {/* Mobile Drawer (visible only on mobile) */}
      <aside
        id="mobile-sidebar"
        role="dialog"
        aria-modal="true"
        aria-label="사이드바 메뉴"
        className={"sidebar sidebar--mobile " + (isMobileOpen ? "is-open" : "")}
      >
        {navContent}
      </aside>

      {/* Desktop Sidebar (visible on desktop) */}
      <aside
        id="desktop-sidebar"
        aria-label="데스크톱 사이드바"
        className={"sidebar sidebar--desktop " + (isDesktopCollapsed ? "is-collapsed" : "")}
      >
        {!isDesktopCollapsed && navContent}
      </aside>
    </>
  );
}
