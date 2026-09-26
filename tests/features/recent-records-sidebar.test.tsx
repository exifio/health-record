import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  daysAgoLocalDate,
  formatSidebarDateLabel,
  toRecentRecordItems,
  toSidebarBadgeStatus,
} from "@/components/layout/RecordsShell";
import { Sidebar, isActiveRecordPath } from "@/components/layout/Sidebar";
import { DailyRecordListItemSchema } from "@/contracts";

const SETTINGS_SOURCE = readFileSync(
  join(resolve(__dirname, "../.."), "src", "features", "settings", "SettingsContent.tsx"),
  "utf8",
);

describe("recent records sidebar (F-601, I-501)", () => {
  describe("daysAgoLocalDate", () => {
    it("computes a past local date from the system date", () => {
      expect(daysAgoLocalDate(0, new Date(2026, 8, 26))).toBe("2026-09-26");
      expect(daysAgoLocalDate(1, new Date(2026, 8, 26))).toBe("2026-09-25");
      expect(daysAgoLocalDate(30, new Date(2026, 8, 26))).toBe("2026-08-27");
    });

    it("handles month and year boundaries", () => {
      expect(daysAgoLocalDate(1, new Date(2026, 0, 1))).toBe("2025-12-31");
      expect(daysAgoLocalDate(1, new Date(2026, 2, 1))).toBe("2026-02-28");
    });
  });

  describe("formatSidebarDateLabel", () => {
    it("formats a Korean date label", () => {
      expect(formatSidebarDateLabel("2026-09-26")).toBe("2026년 9월 26일");
    });

    it("returns the raw value when the date is malformed", () => {
      expect(formatSidebarDateLabel("bad")).toBe("bad");
    });
  });

  describe("toRecentRecordItems", () => {
    const item = (over: Partial<{ date: string; recordStatus: string; summaryStatus: string }> = {}) =>
      DailyRecordListItemSchema.parse({
        date: "2026-09-26",
        recordStatus: "draft",
        summaryStatus: "ready",
        messageCount: 2,
        confirmedAt: null,
        ...over,
      });

    it("maps a confirmed record to the confirmed badge", () => {
      expect(toRecentRecordItems([item({ recordStatus: "confirmed" })])).toEqual([
        { date: "2026-09-26", label: "2026년 9월 26일", status: "confirmed" },
      ]);
    });

    it("maps a draft record to its summary status", () => {
      expect(toRecentRecordItems([item({ summaryStatus: "stale" })]))
        .toEqual([{ date: "2026-09-26", label: "2026년 9월 26일", status: "stale" }]);
    });

    it("limits the list to the sidebar display count", () => {
      const many = Array.from({ length: 12 }, (_, i) =>
        item({ date: `2026-09-${String(26 - i).padStart(2, "0")}` })
      );

      expect(toRecentRecordItems(many)).toHaveLength(5);
    });

    it("returns an empty list when there are no records", () => {
      expect(toRecentRecordItems([])).toEqual([]);
    });
  });

  describe("사이드바 배지 표시 규칙 (F-603)", () => {
    const item = (over: Partial<{ date: string; recordStatus: string; summaryStatus: string }> = {}) =>
      DailyRecordListItemSchema.parse({
        date: "2026-09-26",
        recordStatus: "draft",
        summaryStatus: "ready",
        messageCount: 1,
        confirmedAt: null,
        ...over,
      });

    it("행동이 필요 없는 수동 상태는 배지를 표시하지 않는다", () => {
      for (const summaryStatus of ["not_due", "pending", "processing"] as const) {
        expect({ summaryStatus, status: toSidebarBadgeStatus(item({ summaryStatus })) }).toEqual({
          summaryStatus,
          status: null,
        });
      }
    });

    it("미확정이지만 사용자가 확인할 상태는 배지를 표시한다", () => {
      expect(toSidebarBadgeStatus(item({ summaryStatus: "ready" }))).toBe("ready");
      expect(toSidebarBadgeStatus(item({ summaryStatus: "stale" }))).toBe("stale");
      expect(toSidebarBadgeStatus(item({ summaryStatus: "failed" }))).toBe("failed");
    });

    it("확정된 기록은 요약 상태와 무관하게 확정으로 표시한다", () => {
      expect(toSidebarBadgeStatus(item({ recordStatus: "confirmed" }))).toBe("confirmed");
      expect(
        toSidebarBadgeStatus(item({ recordStatus: "confirmed", summaryStatus: "not_due" }))
      ).toBe("confirmed");
    });
  });

  describe("isActiveRecordPath", () => {
    it("현재 경로가 그 기록 상세일 때만 true다", () => {
      expect(isActiveRecordPath("/records/2026-09-27", "2026-09-27")).toBe(true);
      expect(isActiveRecordPath("/records/2026-09-26", "2026-09-27")).toBe(false);
      expect(isActiveRecordPath("/records", "2026-09-27")).toBe(false);
      expect(isActiveRecordPath("/today", "2026-09-27")).toBe(false);
      // 라우터 없이 렌더링되는 경우(usePathname() → null)에는 아무 것도 활성화하지 않는다.
      expect(isActiveRecordPath(null, "2026-09-27")).toBe(false);
    });
  });

  describe("Sidebar rendering", () => {
    it("renders only supplied records and never a hardcoded fallback", () => {
      const html = renderToStaticMarkup(
        React.createElement(Sidebar, {
          isMobileOpen: false,
          onCloseMobile: () => {},
          isDesktopCollapsed: false,
          onToggleDesktop: () => {},
          recentRecords: [
            { date: "2026-09-26", label: "2026년 9월 26일", status: "confirmed" },
          ],
        })
      );

      expect(html).toContain("2026년 9월 26일");
      // 이전 하드코딩 샘플 날짜가 남아 있으면 안 된다.
      expect(html).not.toContain("9월 25일");
      expect(html).not.toContain("2026-09-25");
    });

    it("renders the empty state without fake record entries", () => {
      const html = renderToStaticMarkup(
        React.createElement(Sidebar, {
          isMobileOpen: false,
          onCloseMobile: () => {},
          isDesktopCollapsed: false,
          onToggleDesktop: () => {},
          recentRecords: [],
        })
      );

      expect(html).toContain("최근 기록");
      expect(html).not.toContain("sidebar-record-item");
    });

    it("explains that there are no records yet instead of rendering an empty list", () => {
      const html = renderToStaticMarkup(
        React.createElement(Sidebar, {
          isMobileOpen: false,
          onCloseMobile: () => {},
          isDesktopCollapsed: false,
          onToggleDesktop: () => {},
          recentRecords: [],
        })
      );

      expect(html).toContain("아직 기록이 없습니다");
      expect(html).toContain('data-testid="sidebar-records-empty"');
    });

    it("does not show the empty note when records exist", () => {
      const html = renderToStaticMarkup(
        React.createElement(Sidebar, {
          isMobileOpen: false,
          onCloseMobile: () => {},
          isDesktopCollapsed: false,
          onToggleDesktop: () => {},
          recentRecords: [{ date: "2026-09-26", label: "2026년 9월 26일", status: "draft" }],
        })
      );

      expect(html).not.toContain("아직 기록이 없습니다");
    });

    it("수동 상태(작성 중)는 날짜만 보여 주고 배지는 넣지 않는다", () => {
      const html = renderToStaticMarkup(
        React.createElement(Sidebar, {
          isMobileOpen: false,
          onCloseMobile: () => {},
          isDesktopCollapsed: false,
          onToggleDesktop: () => {},
          recentRecords: [{ date: "2026-09-27", label: "2026년 9월 27일", status: null }],
        })
      );

      expect(html).toContain("2026년 9월 27일");
      expect(html).not.toContain("status-badge");
    });

    it("확인할 상태만 배지와 이유 설명을 함께 보여 준다", () => {
      const html = renderToStaticMarkup(
        React.createElement(Sidebar, {
          isMobileOpen: false,
          onCloseMobile: () => {},
          isDesktopCollapsed: false,
          onToggleDesktop: () => {},
          recentRecords: [{ date: "2026-09-23", label: "2026년 9월 23일", status: "ready" }],
        })
      );

      expect(html).toContain("확인 필요");
      expect(html).toContain('data-status="ready"');
      // 이유를 툴팁/스크린리더로 알려 준다(F-603).
      expect(html).toContain("AI 정리 초안이 준비되었습니다");
    });

    it("keeps the 'all records' link reachable in both states", () => {
      const props = {
        isMobileOpen: false,
        onCloseMobile: () => {},
        isDesktopCollapsed: false,
        onToggleDesktop: () => {},
      };

      expect(
        renderToStaticMarkup(React.createElement(Sidebar, { ...props, recentRecords: [] }))
      ).toContain("모든 기록 보기");
      expect(
        renderToStaticMarkup(
          React.createElement(Sidebar, {
            ...props,
            recentRecords: [{ date: "2026-09-26", label: "2026년 9월 26일", status: "draft" }],
          })
        )
      ).toContain("모든 기록 보기");
    });
  });
});

describe("설정 화면도 같은 사이드바를 쓴다 (F-601)", () => {
  it("AppShell이 아니라 RecordsShell로 감싸 최근 기록이 비어 보이지 않는다", () => {
    // AppShell을 직접 쓰면 설정에서만 사이드바가 "아직 기록이 없습니다"가 되어
    // 기록이 있는데도 없는 것처럼 보인다.
    expect(SETTINGS_SOURCE).toContain("<RecordsShell>");
    expect(SETTINGS_SOURCE).toContain("</RecordsShell>");
    expect(SETTINGS_SOURCE).not.toContain("<AppShell>");
  });
});