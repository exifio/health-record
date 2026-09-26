import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  daysAgoLocalDate,
  formatSidebarDateLabel,
  toRecentRecordItems,
} from "@/components/layout/RecordsShell";
import { Sidebar } from "@/components/layout/Sidebar";
import { DailyRecordListItemSchema } from "@/contracts";

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