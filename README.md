# 건강 기록 MVP

병원에 주기적으로 방문하는 사용자가 하루의 건강 상태를 채팅하듯 기록하고, 하루가 끝난 뒤 AI가 원문을 구조화한 초안을 생성하며, 사용자가 확인·수정·확정한 기록만 진료 준비 화면에 포함하는 서비스입니다.

이 프로젝트의 핵심은 의료 판단이 아니라 **사용자가 직접 남긴 사실을 잃지 않고, 진료 시 기억을 보조하는 것**입니다.

## 핵심 제품 원칙

1. 사용자 원문이 항상 원본이며 AI 결과는 파생 데이터입니다.
2. AI는 진단, 원인 추정, 치료·약 추천을 하지 않습니다.
3. 원문 저장과 AI 처리를 분리합니다. AI 실패가 기록 저장 실패가 되어서는 안 됩니다.
4. 하루의 기준은 기록 시점의 기기/브라우저 시스템 시간 기준 `00:00~23:59`입니다. 사용자가 시간대를 직접 설정하지 않습니다.
5. 확정 전에는 원문을 수정할 수 있고, 확정 후에는 원문을 덮어쓰지 않습니다.
6. 진료 준비에는 사용자가 확인한 확정 기록만 기본 포함합니다.
7. 비로그인 사용자는 샘플 데이터 기반 Demo Mode만 사용할 수 있고 실제 건강 기록은 입력하지 않습니다.
8. 사용자 데이터 격리는 애플리케이션 코드가 아니라 Supabase RLS까지 포함해 DB 수준에서 보장합니다.

## 기술 스택

- Next.js App Router
- React
- TypeScript
- Supabase PostgreSQL
- Supabase Auth + Google OAuth
- Supabase RLS
- OpenAI API (`gpt-5-nano`, 설정 레이어에서 관리)
- Jest

## 저장소 구조 권장안

```text
src/
  app/
    (public)/
    (app)/
    api/                 # Backend 담당
  components/            # Frontend 담당
  features/              # Frontend 담당
  contracts/             # API Contract. 임의 수정 금지
  lib/
    supabase/
  server/                # Backend 담당
    services/
    repositories/
    ai/
    auth/
  mocks/                  # Frontend Mock 구현
supabase/
  migrations/             # Backend 담당
docs/
  TASKS.md                 # 전체 현황 + 공통 선행 작업
  tasks/
    FRONTEND_TASKS.md      # Frontend AI 전용
    BACKEND_TASKS.md       # Backend AI 전용
    INTEGRATION_TASKS.md   # 통합/최종 검증 전용
```

### 작업 경계

- 프론트엔드 AI: `src/components`, `src/features`, `src/app/(public)`, `src/app/(app)`, `src/mocks`
- 백엔드 AI: `src/app/api`, `src/server`, `supabase/migrations`, 서버용 Supabase 설정
- Shared Contract: `src/contracts`는 통합 담당자만 변경
- 문서 계약 변경이 필요한 경우 먼저 `docs/API.md`와 `src/contracts`를 갱신한 뒤 양쪽 작업을 진행

## 개발 시작 전 읽기 순서

모든 개발 AI는 먼저 루트의 `AGENTS.md`를 읽습니다.

1. `AGENTS.md`
2. `docs/PRD.md`
3. `docs/API.md`
4. `docs/DATABASE.md`
5. Frontend 작업자는 `docs/DESIGN.md` → `docs/FRONTEND.md`
6. Backend 작업자는 `docs/ARCHITECTURE.md` → `docs/BACKEND.md` → `docs/SECURITY.md` → `docs/AI.md`
7. 실제 병렬 개발 방법은 `docs/PARALLEL_DEVELOPMENT.md`
8. 공통으로 `docs/TESTING.md`, `docs/PLAN.md`, `docs/TASKS.md`
9. 역할별 작업은 `docs/tasks/FRONTEND_TASKS.md`, `BACKEND_TASKS.md`, `INTEGRATION_TASKS.md`


## 실제 병렬 개발 방법

먼저 `docs/TASKS.md`의 공통 기반 작업에서 API / DB / Contract를 확정합니다. 그 다음 Frontend와 Backend를 서로 독립적으로 동시에 개발하고, 두 작업이 준비된 뒤 통합합니다.

```text
공통 Contract 확정
        ↓
┌──────────────────┬──────────────────┐
│ Frontend AI      │ Backend AI       │
│ FRONTEND_TASKS   │ BACKEND_TASKS    │
└──────────────────┴──────────────────┘
        ↓              ↓
          두 작업 완료
              ↓
       INTEGRATION_TASKS
```

- 프론트엔드 AI는 `docs/tasks/FRONTEND_TASKS.md`만 관리하며 Mock API를 사용합니다.
- 백엔드 AI는 `docs/tasks/BACKEND_TASKS.md`만 관리하며 실제 DB/API를 구현합니다.
- 통합 담당은 두 작업이 준비된 뒤 `docs/tasks/INTEGRATION_TASKS.md`를 진행합니다.
- 두 AI가 같은 작업 폴더를 동시에 수정하지 않도록 Branch + Git Worktree 사용을 권장합니다.
- 실제 Worktree 생성 방법과 각 역할의 시작 프롬프트는 `docs/PARALLEL_DEVELOPMENT.md`에 있습니다.

## 로컬 개발 환경변수 예시

`.env.example`에 고정된 변수명을 사용하고 로컬 값은 `.env.local`에 설정합니다. `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`은 서버 전용이며 브라우저 번들에 포함하지 않습니다.

## 개발 원칙

- 데이터와 API Contract를 UI보다 먼저 고정합니다.
- 현재 MVP에 없는 기능을 개발 중 편의상 추가하지 않습니다.
- 의료적 해석보다 데이터 보존과 추적 가능성을 우선합니다.
- 사용자 건강 원문을 서버 로그, 분석 도구, 오류 추적 도구에 그대로 남기지 않습니다.
- 날짜, 상태 전이, RLS, 확정 후 불변성은 반드시 테스트로 보호합니다.
