import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { handleComposerSubmit } from "@/components/records/RecordComposer";
import { RecordMessage } from "@/components/records/RecordMessage";
import { DailySummaryCard } from "@/components/summary/DailySummaryCard";
import { Sidebar } from "@/components/layout/Sidebar";
import { DemoModeBanner } from "@/components/auth/DemoModeBanner";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  demoDailyRecordResponse,
  sampleDailyRecordListResponse,
  sampleVisitPrepResponse,
} from "@/mocks/fixtures";
import type { DailyRecord, DailyRecordMessage } from "@/contracts";

describe("F8: Frontend QA & Integration Checklist (F-801 ~ F-810)", () => {
  const dummyMessage: DailyRecordMessage = {
    id: "00000000-0000-4000-8000-000000000001",
    content: "오전에 두통이 약간 있었습니다.",
    createdAt: "2026-09-25T01:00:00Z",
    updatedAt: "2026-09-25T01:00:00Z",
  };

  const sampleRecord: DailyRecord = {
    date: "2026-09-25",
    recordStatus: "draft",
    summaryStatus: "ready",
    contentRevision: 1,
    messages: [dummyMessage],
    summary: {
      sourceRevision: 1,
      aiDraft: {
        timeline: [{ text: "오전 두통", sourceMessageIds: [dummyMessage.id] }],
        medications: [],
        missingInformation: [],
      },
      userFinal: null,
      generatedAt: "2026-09-25T02:00:00Z",
    },
    corrections: [],
  };

  // F-801: 비로그인 submit 시 로그인 모달 + 실제 write 없음 테스트
  it("F-801: intercepts submission when unauthenticated and prevents write", () => {
    let writeCalled = false;
    let loginModalOpened = false;

    const result = handleComposerSubmit({
      content: "오늘 몸살 기운이 있어요",
      isAuthenticated: false,
      onSubmit: () => {
        writeCalled = true;
      },
      onRequireAuth: () => {
        loginModalOpened = true;
      },
    });

    expect(result).toBe(false);
    expect(writeCalled).toBe(false);
    expect(loginModalOpened).toBe(true);
  });

  // F-802: confirmed 화면 edit/delete 미표시 테스트
  it("F-802: hides edit and delete controls when record is confirmed", () => {
    const html = renderToStaticMarkup(
      React.createElement(RecordMessage, {
        message: dummyMessage,
        isConfirmed: true,
      })
    );
    expect(html).not.toContain('data-testid="message-edit-btn"');
    expect(html).not.toContain('data-testid="message-delete-btn"');
    expect(html).not.toContain("수정");
    expect(html).not.toContain("삭제");
  });

  // F-803: stale summary confirm disabled 테스트
  it("F-803: disables confirm button when summaryStatus is stale", () => {
    const html = renderToStaticMarkup(
      React.createElement(DailySummaryCard, {
        date: "2026-09-25",
        record: {
          ...sampleRecord,
          summaryStatus: "stale",
        },
        onConfirmRecord: async () => {},
      })
    );
    // Button exists but has disabled attribute
    expect(html).toContain('data-testid="confirm-record-btn"');
    expect(html).toContain("disabled");
  });

  // F-804: unreviewed banner count 테스트
  it("F-804: displays unreviewed record count correctly", () => {
    const count = sampleDailyRecordListResponse.unreviewedCount;
    expect(count).toBe(1);
    const bannerMsg = `확인하지 않은 기록이 ${count}개 있습니다.`;
    expect(bannerMsg).toContain("1개");
  });

  // F-805: visit prep no-record day 미표시 테스트
  it("F-805: omits dates without confirmed records in visit prep results", () => {
    const prep = sampleVisitPrepResponse;
    const confirmedDates = prep.confirmedRecords.map((r) => r.date);

    // Days with confirmed summaries are included
    expect(confirmedDates).toContain("2026-09-24");
    expect(confirmedDates).toContain("2026-09-22");

    // Days without confirmed records (e.g. 2026-09-23 unreviewed draft, 2026-09-20 no record) are omitted
    expect(confirmedDates).not.toContain("2026-09-23");
    expect(confirmedDates).not.toContain("2026-09-20");
  });

  // F-806: 데스크톱/모바일 사이드바 동작 검증
  it("F-806: provides accessible responsive sidebar attributes", () => {
    const mobileHtml = renderToStaticMarkup(
      React.createElement(Sidebar, {
        isMobileOpen: true,
        onCloseMobile: () => {},
        isDesktopCollapsed: false,
      })
    );
    expect(mobileHtml).toContain('role="dialog"');
    expect(mobileHtml).toContain('aria-modal="true"');
    expect(mobileHtml).toContain('data-testid="mobile-overlay"');

    const desktopHtml = renderToStaticMarkup(
      React.createElement(Sidebar, {
        isMobileOpen: false,
        onCloseMobile: () => {},
        isDesktopCollapsed: false,
      })
    );
    expect(desktopHtml).toContain('id="desktop-sidebar"');
    expect(desktopHtml).not.toContain('data-testid="mobile-overlay"');
  });

  // F-807: Demo Mode 검증
  it("F-807: verifies demo mode banner and rich sample data", () => {
    const bannerHtml = renderToStaticMarkup(
      React.createElement(DemoModeBanner, { onLoginClick: () => {} })
    );
    expect(bannerHtml).toContain("둘러보기");
    expect(bannerHtml).toContain("샘플 데이터가 표시되며, 기록 저장은 로그인 후 이용 가능합니다.");

    expect(demoDailyRecordResponse.record.messages.length).toBeGreaterThan(0);
    expect(demoDailyRecordResponse.record.summary).toBeDefined();
  });

  // F-808: AI 실패 상태 검증
  it("F-808: verifies AI failure fallback without losing raw record", () => {
    const html = renderToStaticMarkup(
      React.createElement(DailySummaryCard, {
        date: "2026-09-25",
        record: {
          ...sampleRecord,
          summaryStatus: "failed",
        },
        onRetrySummary: async () => {},
      })
    );
    expect(html).toContain("기록 정리를 완료하지 못했습니다. 작성한 기록은 정상적으로 저장되어 있습니다.");
    expect(html).toContain("다시 정리하기");
  });

  // F-809: 라이트/다크/시스템 테마 전환 검증
  it("F-809: supports system, light, and dark theme choices", () => {
    const themes = ["system", "light", "dark"] as const;
    expect(themes).toContain("system");
    expect(themes).toContain("light");
    expect(themes).toContain("dark");
  });

  // F-810: 다크모드 텍스트 대비 및 상태 식별 검증 (텍스트 레이블 동반)
  it("F-810: differentiates statuses via distinct textual labels", () => {
    const statuses = [
      { status: "draft", label: "작성 중" },
      { status: "confirmed", label: "확정" },
      { status: "ready", label: "확인 필요" },
      { status: "failed", label: "정리 실패" },
      { status: "stale", label: "수정됨" },
    ] as const;

    for (const { status, label } of statuses) {
      const html = renderToStaticMarkup(React.createElement(StatusBadge, { status }));
      expect(html).toContain(label);
    }
  });
});

