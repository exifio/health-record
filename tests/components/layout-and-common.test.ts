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
    const statuses = [
      { status: "draft", label: "작성 중" },
      { status: "confirmed", label: "확정" },
      { status: "ready", label: "확인 필요" },
      { status: "processing", label: "정리 중" },
      { status: "failed", label: "정리 실패" },
      { status: "stale", label: "수정됨" },
    ] as const;

    for (const { status, label } of statuses) {
      const html = renderToStaticMarkup(React.createElement(StatusBadge, { status }));
      expect(html).toContain(label);
      expect(html).toContain('data-status="' + status + '"');
    }
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
