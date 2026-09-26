import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LoginModal } from "@/components/auth/LoginModal";
import { DemoModeBanner } from "@/components/auth/DemoModeBanner";
import { OnboardingNotice } from "@/components/onboarding/OnboardingNotice";
import { RecordComposer, handleComposerSubmit } from "@/components/records/RecordComposer";
import { RecordTimeline } from "@/components/records/RecordTimeline";
import { demoDailyRecordResponse } from "@/mocks/fixtures";
import { DailyRecordResponseSchema } from "@/contracts";

describe("F1: Login, Demo Mode, Onboarding", () => {
  describe("LoginModal (F-101 ~ F-103)", () => {
    it("renders dialog with title, description, and action buttons", () => {
      const html = renderToStaticMarkup(
        React.createElement(LoginModal, {
          isOpen: true,
          onClose: () => {},
          onGoogleLogin: () => {},
          onExplore: () => {},
        })
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain("건강 기록 시작하기");
      expect(html).toContain("하루의 건강 상태를 편하게 남기고 AI 정리로 확인해보세요.");

      // F-102: Google login
      expect(html).toContain("구글로 로그인");
      expect(html).toContain('data-testid="google-login-btn"');

      // F-103: Kakao login disabled
      expect(html).toContain("카카오로 로그인");
      expect(html).toContain("disabled");
      expect(html).toContain('aria-disabled="true"');

      // 둘러보기 (Explore)
      expect(html).toContain("둘러보기");
      expect(html).toContain('data-testid="explore-demo-btn"');
    });

    it("renders nothing when isOpen is false", () => {
      const html = renderToStaticMarkup(
        React.createElement(LoginModal, {
          isOpen: false,
        })
      );
      expect(html).toBe("");
    });
  });

  describe("Demo mode sample data (F-104)", () => {
    it("validates demo fixture against DailyRecordResponseSchema", () => {
      const parsed = DailyRecordResponseSchema.parse(demoDailyRecordResponse);
      expect(parsed.record.messages.length).toBeGreaterThan(0);
      expect(parsed.record.summary).toBeDefined();
      expect(parsed.record.summary?.aiDraft.timeline.length).toBeGreaterThan(0);
    });
  });

  describe("DemoModeBanner (F-105)", () => {
    it("renders demo mode notice and login prompt button", () => {
      const html = renderToStaticMarkup(
        React.createElement(DemoModeBanner, {
          onLoginClick: () => {},
        })
      );

      expect(html).toContain("둘러보기");
      expect(html).toContain("샘플 데이터가 표시되며, 기록 저장은 로그인 후 이용 가능합니다.");
      expect(html).toContain("로그인하기");
      expect(html).toContain('data-testid="banner-login-btn"');
    });
  });

  describe("RecordComposer unauthenticated behavior (F-106, F-107)", () => {
    it("renders authentication hint when not authenticated", () => {
      const html = renderToStaticMarkup(
        React.createElement(RecordComposer, {
          onSubmit: () => {},
          isAuthenticated: false,
          onRequireAuth: () => {},
        })
      );

      expect(html).toContain("기록 저장은 로그인 후 이용할 수 있습니다.");
      expect(html).toContain('data-testid="composer-auth-hint"');
    });

    it("does not render auth hint when user is authenticated", () => {
      const html = renderToStaticMarkup(
        React.createElement(RecordComposer, {
          onSubmit: () => {},
          isAuthenticated: true,
        })
      );

      expect(html).not.toContain("기록 저장은 로그인 후 이용할 수 있습니다.");
    });

    it("intercepts submission and triggers onRequireAuth when unauthenticated (F-106, F-107)", () => {
      let submitCalled = false;
      let requireAuthCalled = false;

      const result = handleComposerSubmit({
        content: "두통이 있어요",
        isAuthenticated: false,
        onSubmit: () => {
          submitCalled = true;
        },
        onRequireAuth: () => {
          requireAuthCalled = true;
        },
      });

      expect(result).toBe(false);
      expect(submitCalled).toBe(false);
      expect(requireAuthCalled).toBe(true);
    });

    it("allows submission when authenticated and non-empty", () => {
      let submittedContent = "";

      const result = handleComposerSubmit({
        content: "두통이 있어요",
        isAuthenticated: true,
        onSubmit: (text) => {
          submittedContent = text;
        },
      });

      expect(result).toBe(true);
      expect(submittedContent).toBe("두통이 있어요");
    });
  });

  describe("OnboardingNotice (F-108)", () => {
    it("renders the exact guidance text from DESIGN.md and dismiss button", () => {
      const html = renderToStaticMarkup(
        React.createElement(OnboardingNotice, {
          onDismiss: () => {},
        })
      );

      expect(html).toContain("오늘 있었던 건강 상태를 편하게 남겨보세요.");
      expect(html).toContain("예: 아침부터 머리가 조금 아팠어요 / 점심에 약을 먹었어요 / 저녁에는 괜찮아졌어요.");
      expect(html).toContain("의료 용어를 사용할 필요는 없습니다.");
      expect(html).toContain("시작하기");
    });
  });

  describe("RecordTimeline", () => {
    it("renders messages with timestamps", () => {
      const html = renderToStaticMarkup(
        React.createElement(RecordTimeline, {
          messages: demoDailyRecordResponse.record.messages,
        })
      );

      expect(html).toContain("오전에 두통이 약간 있어서 따뜻한 물을 마셨어요.");
      expect(html).toContain("오후 1시경 타이레놀 1정을 복용했습니다.");
      expect(html).toContain("저녁 무렵 통증이 많이 완화되었어요.");
    });
  });
});

