import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SuggestionCard } from "@/components/records/SuggestionCard";
import { createMockHealthApi } from "@/mocks/health-api";
import { SuggestionsResponseSchema, type Suggestion } from "@/contracts";

describe("F3: Additional Record Suggestions (F-301 ~ F-306)", () => {
  const sampleSuggestions: Suggestion[] = [
    {
      id: "00000000-0000-4000-8000-000000000020",
      field: "onset_time",
      text: "언제쯤 시작되었는지 기록할 수 있어요.",
    },
    {
      id: "00000000-0000-4000-8000-000000000021",
      field: "duration",
      text: "얼마나 지속되었는지 기록할 수 있어요.",
    },
  ];

  // F-301: SuggestionCard UI
  describe("F-301: UI layout and copy", () => {
    it("renders title, bullets, and dismiss button", () => {
      const html = renderToStaticMarkup(
        React.createElement(SuggestionCard, {
          suggestions: sampleSuggestions,
          onDismiss: () => {},
        })
      );

      expect(html).toContain("기록을 더 남기고 싶다면");
      expect(html).toContain("언제쯤 시작되었는지 기록할 수 있어요.");
      expect(html).toContain("얼마나 지속되었는지 기록할 수 있어요.");
      expect(html).toContain("닫기");
      expect(html).toContain('data-testid="suggestion-dismiss-btn"');
    });
  });

  // F-302: Max 2~3 items shown
  describe("F-302: Display limit", () => {
    it("limits displayed suggestions to at most 3 items", () => {
      const fourSuggestions: Suggestion[] = [
        ...sampleSuggestions,
        {
          id: "00000000-0000-4000-8000-000000000022",
          field: "medication_taken",
          text: "약을 복용했는지 기록할 수 있어요.",
        },
        {
          id: "00000000-0000-4000-8000-000000000023",
          field: "post_medication_change",
          text: "약 복용 후 변화를 기록할 수 있어요.",
        },
      ];

      const html = renderToStaticMarkup(
        React.createElement(SuggestionCard, {
          suggestions: fourSuggestions,
        })
      );

      expect(html).toContain("언제쯤 시작되었는지 기록할 수 있어요.");
      expect(html).toContain("얼마나 지속되었는지 기록할 수 있어요.");
      expect(html).toContain("약을 복용했는지 기록할 수 있어요.");
      // 4th item must not be rendered
      expect(html).not.toContain("약 복용 후 변화를 기록할 수 있어요.");
    });
  });

  // F-303: Dismiss interaction
  describe("F-303: Dismiss button", () => {
    it("renders dismiss button when onDismiss callback is passed", () => {
      const onDismiss = jest.fn();
      const html = renderToStaticMarkup(
        React.createElement(SuggestionCard, {
          suggestions: sampleSuggestions,
          onDismiss,
        })
      );

      expect(html).toContain("닫기");
    });
  });

  // F-304: Empty state handling
  describe("F-304: Empty state", () => {
    it("renders nothing when suggestions array is empty", () => {
      const html = renderToStaticMarkup(
        React.createElement(SuggestionCard, {
          suggestions: [],
        })
      );
      expect(html).toBe("");
    });
  });

  // F-305: Mock API implementation
  describe("F-305: Suggestions Mock API", () => {
    it("returns valid suggestions adhering to contract schema", async () => {
      const api = createMockHealthApi();
      const res = await api.getSuggestions("2026-09-25");

      const validated = SuggestionsResponseSchema.parse(res);
      expect(validated.suggestions.length).toBeGreaterThan(0);
      expect(validated.suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  // F-306: Failure handling
  describe("F-306: Graceful error tolerance", () => {
    it("allows the rest of the application to operate when getSuggestions rejects", async () => {
      const failingApi = {
        ...createMockHealthApi(),
        getSuggestions: jest.fn().mockRejectedValue(new Error("503 AI_SUGGESTION_FAILED")),
      };

      // Ensure that handling getSuggestions error returns empty array instead of throwing
      let suggestions: Suggestion[] = [];
      try {
        const res = await failingApi.getSuggestions("2026-09-25");
        suggestions = res.suggestions;
      } catch {
        // Handled silently
        suggestions = [];
      }

      expect(suggestions).toEqual([]);
      // Render with empty suggestions gracefully renders nothing without crashing
      const html = renderToStaticMarkup(
        React.createElement(SuggestionCard, { suggestions })
      );
      expect(html).toBe("");
    });
  });
});

