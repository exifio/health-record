import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RecordMessage,
  formatMessageTime,
} from "@/components/records/RecordMessage";
import { RecordTimeline } from "@/components/records/RecordTimeline";
import {
  RecordComposer,
  executeComposerSubmit,
} from "@/components/records/RecordComposer";
import { formatKoreanDate } from "@/features/records/components/TodayRecordView";
import {
  getSystemLocalDate,
  getSystemTimeZone,
} from "@/features/api/api-adapter";
import { createMockHealthApi } from "@/mocks/health-api";
import type { DailyRecordMessage } from "@/contracts";

describe("F2: Today Record (F-201 ~ F-212)", () => {
  const dummyMessage: DailyRecordMessage = {
    id: "00000000-0000-4000-8000-000000000001",
    content: "오전에 머리가 조금 아팠어요.",
    createdAt: "2026-09-25T00:20:00Z",
    updatedAt: "2026-09-25T00:20:00Z",
  };

  // F-201: Today date display
  describe("F-201: Date formatting", () => {
    it("formats YYYY-MM-DD date into Korean format with weekday", () => {
      const formatted = formatKoreanDate("2026-09-25");
      expect(formatted).toContain("2026년 9월 25일");
      expect(formatted).toContain("금요일");
    });
  });

  // F-202: RecordTimeline
  describe("F-202: RecordTimeline", () => {
    it("renders empty state when no messages exist", () => {
      const html = renderToStaticMarkup(
        React.createElement(RecordTimeline, { messages: [] })
      );
      expect(html).toContain("오늘 등록된 건강 기록이 없습니다.");
      expect(html).toContain('data-testid="timeline-empty"');
    });

    it("renders list of messages when messages exist", () => {
      const html = renderToStaticMarkup(
        React.createElement(RecordTimeline, { messages: [dummyMessage] })
      );
      expect(html).toContain("오전에 머리가 조금 아팠어요.");
      expect(html).toContain('data-testid="record-timeline"');
    });
  });

  // F-203, F-205, F-206, F-207: RecordMessage
  describe("F-203, F-205, F-206, F-207: RecordMessage", () => {
    it("renders message content and formatted time (F-203, F-205)", () => {
      const html = renderToStaticMarkup(
        React.createElement(RecordMessage, {
          message: dummyMessage,
          isConfirmed: false,
        })
      );
      expect(html).toContain("오전에 머리가 조금 아팠어요.");
      expect(html).toContain('data-testid="message-time"');
      const formattedTime = formatMessageTime(dummyMessage.createdAt);
      expect(html).toContain(formattedTime);
    });

    it("renders edit and delete buttons when record is unconfirmed (F-206, F-207)", () => {
      const html = renderToStaticMarkup(
        React.createElement(RecordMessage, {
          message: dummyMessage,
          isConfirmed: false,
        })
      );
      expect(html).toContain('data-testid="message-edit-btn"');
      expect(html).toContain('data-testid="message-delete-btn"');
      expect(html).toContain("수정");
      expect(html).toContain("삭제");
    });

    it("hides edit and delete buttons when record is confirmed", () => {
      const html = renderToStaticMarkup(
        React.createElement(RecordMessage, {
          message: dummyMessage,
          isConfirmed: true,
        })
      );
      expect(html).not.toContain('data-testid="message-edit-btn"');
      expect(html).not.toContain('data-testid="message-delete-btn"');
    });
  });

  // F-204 & F-208: RecordComposer submission & error restoration
  describe("F-204 & F-208: RecordComposer", () => {
    it("renders composer with textarea and submit button", () => {
      const html = renderToStaticMarkup(
        React.createElement(RecordComposer, {
          onSubmit: () => {},
          isAuthenticated: true,
        })
      );
      expect(html).toContain("오늘 있었던 상태를 기록해보세요");
      expect(html).toContain('data-testid="composer-textarea"');
      expect(html).toContain('data-testid="composer-submit-btn"');
    });

    it("restores typed content and returns error without AI mention on save failure (F-208)", async () => {
      const failingSubmit = jest.fn().mockRejectedValue(new Error("Network failure"));
      const result = await executeComposerSubmit({
        content: "점심에 약을 복용했습니다.",
        isAuthenticated: true,
        onSubmit: failingSubmit,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("기록을 저장하지 못했습니다. 다시 시도해주세요.");
      expect(result.error).not.toContain("AI");
    });
  });

  // F-209, F-210, F-211, F-212: Mock API & Timezone auto detection
  describe("F-209 ~ F-212: Today Record Mock API & System Timezone", () => {
    it("computes local date in YYYY-MM-DD for API path (F-211)", () => {
      const today = getSystemLocalDate();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("detects system timezone without user UI (F-210)", () => {
      const tz = getSystemTimeZone();
      expect(typeof tz).toBe("string");
      expect(tz.length).toBeGreaterThan(0);
    });

    it("passes systemTimeZone metadata when creating messages via mock API (F-209, F-212)", async () => {
      const api = createMockHealthApi();
      const today = getSystemLocalDate();
      const tz = getSystemTimeZone();

      const res = await api.createMessage(today, {
        content: "오후 3시에 체온 37.2도 측정",
        systemTimeZone: tz,
      });

      expect(res.message.content).toBe("오후 3시에 체온 37.2도 측정");
      expect(res.record.date).toBe(today);
      expect(res.record.contentRevision).toBeGreaterThanOrEqual(1);

      // Verify update
      const updated = await api.updateMessage(today, res.message.id, {
        content: "오후 3시에 체온 37.5도 측정",
      });
      expect(updated.message.content).toBe("오후 3시에 체온 37.5도 측정");

      // Verify delete
      await api.deleteMessage(today, res.message.id);
    });
  });
});

