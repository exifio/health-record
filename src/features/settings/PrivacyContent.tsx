import React from "react";
import Link from "next/link";
import { RecordsShell } from "@/components/layout/RecordsShell";

/**
 * F-710: 개인정보 및 AI 처리 상세 페이지(/settings/privacy).
 *
 * 정보를 확인하는 페이지다. 동의 화면이 아니다 — 민감정보 동의·약관 동의는 온보딩 또는 별도 동의
 * 플로우에서 처리한다(I-714). 여기서 "동의" 버튼을 두지 않는다.
 *
 * 설정 화면에는 요약만 남기고 상세는 이 페이지로 보낸다(모달/바텀시트 금지).
 */
export function PrivacyContent() {
  return (
    <RecordsShell>
      <div className="privacy-page" data-testid="privacy-page">
        {/* 뒤로가기: URL 이동이라 새로고침·링크 공유가 되고 브라우저 뒤로가기도 그대로 동작한다. */}
        <Link href="/settings" className="privacy-back-link" data-testid="privacy-back-link">
          ← 설정으로 돌아가기
        </Link>

        <header className="settings-header">
          <h2 className="settings-heading">개인정보 및 AI 처리</h2>
          <p className="settings-sub">작성한 원본 기록과 AI 처리 방식에 대한 안내</p>
        </header>

        <section className="privacy-section" data-testid="privacy-section-original">
          <h3 className="settings-section-title">원본 기록과 AI 결과</h3>
          <p className="privacy-text">사용자가 직접 작성한 건강 기록을 원본 기록으로 취급합니다.</p>
          <p className="privacy-text">
            AI가 생성한 정리·요약 내용은 원본 기록을 바탕으로 생성된 별도의 파생 데이터입니다.
          </p>
          <p className="privacy-text">AI 정리 결과는 사용자가 작성한 원본 기록을 수정하거나 덮어쓰지 않습니다.</p>
        </section>

        <section className="privacy-section" data-testid="privacy-section-data">
          <h3 className="settings-section-title">건강정보 처리</h3>
          <p className="privacy-text">
            사용자가 입력하는 증상, 복약 내용, 건강 상태 등의 정보에는 개인정보 보호법상 민감정보에 해당하는
            건강정보가 포함될 수 있습니다.
          </p>
          <p className="privacy-text">
            해당 정보는 건강 기록 저장, 기록 정리, 병원 방문용 기록 생성 등 서비스 기능을 제공하기 위한
            목적으로 처리됩니다.
          </p>
        </section>

        <section className="privacy-section" data-testid="privacy-section-ai">
          <h3 className="settings-section-title">AI 처리</h3>
          <p className="privacy-text">
            AI 정리 기능을 실행하면 정리에 필요한 건강 기록 내용이 OpenAI API로 전송됩니다.
          </p>
          <p className="privacy-text">
            OpenAI API로 전송된 데이터는 기본적으로 OpenAI 모델의 학습이나 개선에 사용되지 않습니다. 다만
            OpenAI의 악용 방지 목적상 일부 데이터가 최대 30일까지 보관될 수 있습니다.
          </p>
          <p className="privacy-text">
            <a
              href="https://developers.openai.com/api/docs/guides/your-data"
              target="_blank"
              rel="noreferrer noopener"
              className="consent-link"
            >
              OpenAI 데이터 처리 정책 확인
            </a>
          </p>
          <p className="privacy-text">
            AI는 기록을 정리하고 요약하는 보조 기능으로만 사용하며, 의료 진단, 질병 예측 또는 의약품 처방을
            목적으로 하지 않습니다.
          </p>
          <p className="privacy-text">
            AI 결과가 생성되더라도 사용자가 작성한 원본 기록을 수정하거나 덮어쓰지 않습니다.
          </p>
        </section>

        <section className="privacy-section" data-testid="privacy-section-scope">
          <h3 className="settings-section-title">기록의 공개 범위</h3>
          <p className="privacy-text">사용자의 건강 기록은 다른 사용자에게 공개되지 않습니다.</p>
          <p className="privacy-text">
            서비스 운영에 필요한 범위에서 데이터베이스, 호스팅, AI 서비스 제공업체가 정보를 처리할 수 있습니다.
          </p>
        </section>

        {/* F-901 / SECURITY.md 6절: Amplitude 도입으로 제3자 제공자가 늘었으므로 고지한다.
            문구는 "약속"이 아니라 "실제 전송되는 것"만 쓴다 — Amplitude 삭제를 연결하지
            않았으므로 "삭제해 드립니다" 같은 문장은 넣지 않는다. */}
        <section className="privacy-section" data-testid="privacy-section-analytics">
          <h3 className="settings-section-title">사용 통계 분석</h3>
          <p className="privacy-text">
            서비스 개선을 위해 페이지 방문, 로그인, 기록 작성, 기록 확인 등 이용 행동을 익명으로 수집합니다.
          </p>
          <p className="privacy-text">
            수집되는 정보는 익명 기기 식별자, 기기·접속 정보, 행동 구분자이며, 건강 기록 내용, 기록 날짜,
            계정 정보는 수집하지 않습니다.
          </p>
          <p className="privacy-text">
            수집 정보는 Google Analytics 4 및 Amplitude와 그 재처리자를 통해 미국에서 처리됩니다. 당사는
            수집 데이터로 이용자를 식별하거나 이용자의 건강 상태를 파악하지 않습니다.
          </p>
          <p className="privacy-text">
            이 분석 기능은 건강 기록 처리 동의를 승인한 이용자에 대해서만 작동합니다.
          </p>
          <p className="privacy-text">
            <a
              href="https://amplitude.com/subprocessor-list"
              target="_blank"
              rel="noreferrer noopener"
              className="consent-link"
            >
              Amplitude 재처리자 목록 확인
            </a>
          </p>
        </section>

        <section className="privacy-section" data-testid="privacy-section-deletion">
          <h3 className="settings-section-title">기록 및 계정 삭제</h3>
          <p className="privacy-text">
            사용자는 자신의 건강 기록을 삭제할 수 있고, 자신의 계정을 삭제할 수도 있습니다.
          </p>
          <p className="privacy-text">삭제 요청된 데이터는 서비스 데이터베이스에서 삭제 처리됩니다.</p>
          <p className="privacy-text">
            다만 법령상 보존 의무 또는 시스템 백업 정책에 따라 일정 기간 데이터가 남아 있을 수 있으며, 백업
            데이터는 정해진 보존 기간이 지나면 삭제됩니다.
          </p>
        </section>

        <section className="privacy-section" data-testid="privacy-section-policy">
          <h3 className="settings-section-title">개인정보 처리방침</h3>
          <p className="privacy-text">
            개인정보 수집 항목, 보유 기간, 처리 위탁, 국외 이전, 이용자 권리 등에 관한 자세한 내용은 개인정보
            처리방침에서 확인할 수 있습니다.
          </p>
          {/* 처리방침 페이지가 생기기 전에는 깨진 링크를 만들지 않는다(I-714). */}
          <span className="privacy-link privacy-link--disabled" aria-disabled="true">
            개인정보 처리방침 보기 → (준비 중)
          </span>
        </section>
      </div>
    </RecordsShell>
  );
}
