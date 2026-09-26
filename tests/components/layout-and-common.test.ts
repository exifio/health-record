import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LoadingState } from "@/components/common/LoadingState";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { AppShell } from "@/components/layout/AppShell";
import { Sidebar } from "@/components/layout/Sidebar";

describe("common components (F-008)", () => {
  it("renders LoadingState with accessible role and message", () => {
    const html = renderToStaticMarkup(React.createElement(LoadingState, { message: "테스트 로딩 중..." }));
    expect(html).toContain('role="status"');
    expect(html).toContain("테스트 로딩 중...");
    expect(html).toContain("loading-spinner");
  });

  it("renders EmptyState with title, description, and action button", () => {
    const html = renderToStaticMarkup(
      React.createElement(EmptyState, {
        title: "기록 없음",
        description: "아직 등록된 기록이 없습니다.",
        actionLabel: "기록 추가하기",
        onAction: () => {},
      })
    );
    expect(html).toContain("기록 없음");
    expect(html).toContain("아직 등록된 기록이 없습니다.");
    expect(html).toContain("기록 추가하기");
  });

  it("renders ErrorState with alert role, message, and retry button", () => {
    const html = renderToStaticMarkup(
      React.createElement(ErrorState, {
        title: "네트워크 오류",
        message: "서버와 연결할 수 없습니다.",
        retryLabel: "다시 시도",
        onRetry: () => {},
      })
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("네트워크 오류");
    expect(html).toContain("서버와 연결할 수 없습니다.");
    expect(html).toContain("다시 시도");
  });

  it("renders StatusBadge with correct Korean labels for all statuses", () => {
    // PRD 6절 `UI 표시 상태` 표와 같은 문구를 쓴다.
    const statuses = [
      { status: "draft", label: "작성 중" },
      { status: "not_due", label: "작성 중" },
      { status: "pending", label: "AI 정리 대기" },
      { status: "processing", label: "AI 정리 중" },
      { status: "ready", label: "확인 필요" },
      { status: "stale", label: "정리 필요" },
      { status: "failed", label: "정리 실패" },
      { status: "confirmed", label: "확정" },
    ] as const;

    for (const { status, label } of statuses) {
      const html = renderToStaticMarkup(React.createElement(StatusBadge, { status }));
      expect(html).toContain(label);
      expect(html).toContain('data-status="' + status + '"');
    }
  });

  it("상태 배지는 이유를 툴팁과 스크린리더 텍스트로 함께 알려 준다", () => {
    // "확인 필요"만으로는 무엇을 확인해야 하는지 알 수 없다(F-603).
    const html = renderToStaticMarkup(React.createElement(StatusBadge, { status: "ready" }));

    expect(html).toContain('title="AI 정리 초안이 준비되었습니다. 내용을 확인하고 확정해 주세요."');
    expect(html).toContain("sr-only");
    expect(html).toContain("내용을 확인하고 확정해 주세요");
  });

  it("withHint=false면 이유 설명을 넣지 않는다", () => {
    const html = renderToStaticMarkup(
      React.createElement(StatusBadge, { status: "ready", withHint: false })
    );

    expect(html).not.toContain("title=");
    expect(html).not.toContain("sr-only");
    expect(html).toContain("확인 필요");
  });
});

describe("AppShell and Sidebar layout (F-001 ~ F-005)", () => {
  it("renders AppShell with header, desktop sidebar, and children content", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        AppShell,
        null,
        React.createElement("div", { "data-testid": "child-content" }, "콘텐츠 본문")
      )
    );
    expect(html).toContain("건강 기록");
    expect(html).toContain("오늘 기록");
    expect(html).toContain("진료 준비");
    expect(html).toContain("최근 기록");
    expect(html).toContain("모든 기록 보기");
    expect(html).toContain("설정");
    expect(html).toContain("콘텐츠 본문");
    expect(html).toContain('id="desktop-sidebar"');
    expect(html).toContain('id="mobile-sidebar"');
  });

  it("renders mobile sidebar with accessibility attributes", () => {
    const html = renderToStaticMarkup(
      React.createElement(Sidebar, {
        isMobileOpen: true,
        onCloseMobile: () => {},
        isDesktopCollapsed: false,
      })
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="사이드바 메뉴"');
    expect(html).toContain('data-testid="mobile-overlay"');
  });

  it("omits mobile overlay when isMobileOpen is false", () => {
    const html = renderToStaticMarkup(
      React.createElement(Sidebar, {
        isMobileOpen: false,
        onCloseMobile: () => {},
        isDesktopCollapsed: false,
      })
    );
    expect(html).not.toContain('data-testid="mobile-overlay"');
  });
});
