import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DailySummaryCard } from "@/components/summary/DailySummaryCard";
import { sampleYesterdayRecordResponse, sampleUnreviewedRecordResponse } from "@/mocks/fixtures";
import type { DailyRecord } from "@/contracts";

describe("F4 & F5: Daily Summary, Statuses, Confirm, Corrections", () => {
  const baseRecord: DailyRecord = {
    date: "2026-09-25",
    recordStatus: "draft",
    summaryStatus: "ready",
    contentRevision: 1,
    messages: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        content: "오전에 두통 발생",
        createdAt: "2026-09-25T01:00:00Z",
        updatedAt: "2026-09-25T01:00:00Z",
      },
    ],
    summary: {
      sourceRevision: 1,
      aiDraft: {
        timeline: [{ text: "오전 두통 발생", sourceMessageIds: [] }],
        medications: [{ name: "타이레놀", timeText: "오전 10시", effectText: "완화", sourceMessageIds: [] }],
        missingInformation: [],
      },
      userFinal: null,
      generatedAt: "2026-09-25T02:00:00Z",
    },
    corrections: [],
  };

  // F-401 ~ F-404: Status Views
  describe("F-401 ~ F-404: Summary Status Views", () => {
    it("renders not_due status box (F-401)", () => {
      const html = renderToStaticMarkup(
        React.createElement(DailySummaryCard, {
          date: "2026-09-25",
          record: { ...baseRecord, summaryStatus: "not_due", summary: null },
        })
      );
      expect(html).toContain('data-testid="status-not-due"');
      expect(html).toContain("오늘의 기록이 작성 중입니다");
    });

    it("renders processing status box (F-402)", () => {
      const html = renderToStaticMarkup(
        React.createElement(DailySummaryCard, {
          date: "2026-09-25",
          record: { ...baseRecord, summaryStatus: "processing" },
        })
      );
      expect(html).toContain('data-testid="status-processing"');
      expect(html).toContain("AI가 오늘의 기록을 정리하고 있습니다");
    });

    it("renders failed status box with retry button (F-403, F-405)", () => {
      const html = renderToStaticMarkup(
        React.createElement(DailySummaryCard, {
          date: "2026-09-25",
          record: { ...baseRecord, summaryStatus: "failed" },
          onRetrySummary: async () => {},
        })
      );
      expect(html).toContain('data-testid="status-failed"');
      expect(html).toContain("기록 정리를 완료하지 못했습니다");
      expect(html).toContain('data-testid="retry-summary-btn"');
      expect(html).toContain("다시 정리하기");
    });

    it("renders ready state with confirmation button enabled (F-404, F-504)", () => {
      const html = renderToStaticMarkup(
        React.createElement(DailySummaryCard, {
          date: "2026-09-25",
          record: { ...baseRecord, summaryStatus: "ready" },
          onConfirmRecord: async () => {},
        })
      );
      expect(html).toContain('data-testid="confirm-record-btn"');
      expect(html).not.toContain('disabled=""');
    });

    it("renders stale summary status and disables confirm button (F-407, F-408)", () => {
      const html = renderToStaticMarkup(
        React.createElement(DailySummaryCard, {
          date: "2026-09-25",
          record: { ...baseRecord, summaryStatus: "stale" },
          onConfirmRecord: async () => {},
          onRetrySummary: async () => {},
        })
      );
      expect(html).toContain('data-testid="status-stale"');
      expect(html).toContain("원문이 수정되어 최신 내용과 다릅니다");
      expect(html).toContain('data-testid="retry-summary-btn"');
      // Confirm button should be disabled when stale (F-408)
      expect(html).toContain("disabled");
    });
  });

  // F-501 ~ F-507: Summary Detail, AI disclaimer, Editor, Corrections
  describe("F-501 ~ F-507: Summary Interaction & Corrections", () => {
    it("renders AI disclaimer notice (F-502)", () => {
      const html = renderToStaticMarkup(
        React.createElement(DailySummaryCard, {
          date: "2026-09-25",
          record: baseRecord,
        })
      );
      expect(html).toContain('data-testid="ai-disclaimer"');
      expect(html).toContain("AI가 작성한 정리는 실제 기록과 다를 수 있습니다");
    });

    it("renders summary content (timeline & medications) and edit button (F-501, F-503)", () => {
      const html = renderToStaticMarkup(
        React.createElement(DailySummaryCard, {
          date: "2026-09-25",
          record: baseRecord,
        })
      );
      expect(html).toContain("정리된 내용");
      expect(html).toContain("오전 두통 발생");
      expect(html).toContain("복용한 약");
      expect(html).toContain("타이레놀");
      expect(html).toContain('data-testid="edit-summary-btn"');
    });

    it("보완할 점이 있으면 '더 남겨두면 좋은 정보'를 보여 준다 (DESIGN 6절)", () => {
      // 원문이 한 줄뿐이라 정리가 원문과 비슷해 보일 때도 무엇을 확인하면 되는지 알려 준다.
      const html = renderToStaticMarkup(
        React.createElement(DailySummaryCard, {
          date: sampleUnreviewedRecordResponse.record.date,
          record: sampleUnreviewedRecordResponse.record,
        })
      );

      expect(html).toContain('data-testid="missing-information-section"');
      expect(html).toContain("더 남겨두면 좋은 정보");
      expect(html).toContain("증상이 얼마나 지속되었는지 기록할 수 있어요.");
    });

    it("보완할 점이 없으면 섹션 자체를 만들지 않는다", () => {
      const html = renderToStaticMarkup(
        React.createElement(DailySummaryCard, {
          date: "2026-09-25",
          record: baseRecord,
        })
      );

      expect(html).not.toContain('data-testid="missing-information-section"');
      expect(html).not.toContain("더 남겨두면 좋은 정보");
    });

    it("renders raw record disclosure button (F-608)", () => {
      const html = renderToStaticMarkup(
        React.createElement(DailySummaryCard, {
          date: "2026-09-25",
          record: baseRecord,
        })
      );
      expect(html).toContain('data-testid="toggle-raw-records-btn"');
      expect(html).toContain("원문 기록 보기");
    });

    it("renders corrections section and form on confirmed records (F-506, F-609)", () => {
      const confirmedRecord: DailyRecord = {
        ...sampleYesterdayRecordResponse.record,
      };

      const html = renderToStaticMarkup(
        React.createElement(DailySummaryCard, {
          date: confirmedRecord.date,
          record: confirmedRecord,
          onCreateCorrection: async () => {},
        })
      );
      expect(html).toContain('data-testid="corrections-section"');
      expect(html).toContain("정정 기록");
      expect(html).toContain("타이레놀 500mg 1정");
      expect(html).toContain('data-testid="correction-form"');
      expect(html).toContain('data-testid="add-correction-btn"');
    });

    it("renders delete day button (F-507)", () => {
      const html = renderToStaticMarkup(
        React.createElement(DailySummaryCard, {
          date: "2026-09-25",
          record: baseRecord,
          onDeleteRecord: async () => {},
        })
      );
      expect(html).toContain('data-testid="delete-day-btn"');
      expect(html).toContain("하루 기록 전체 삭제");
    });
  });
});

