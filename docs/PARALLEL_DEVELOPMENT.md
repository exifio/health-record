# PARALLEL_DEVELOPMENT — Frontend / Backend 병렬 개발 운영 방법

이 문서는 실제로 여러 개발 AI를 어떻게 나누어 운용하는지 설명합니다.

## 1. 작업 구조

```text
공통 작업
TASKS.md
   ↓
API / DB / Contract 확정
   ↓
┌─────────────────────────┬─────────────────────────┐
│ Frontend AI             │ Backend AI              │
│ FRONTEND_TASKS.md       │ BACKEND_TASKS.md        │
│ Mock API로 전체 UI 개발 │ 실제 DB/API 전체 개발   │
└─────────────────────────┴─────────────────────────┘
              ↓
        양쪽 작업 완료
              ↓
        Integration 담당
     INTEGRATION_TASKS.md
              ↓
         최종 QA / 배포
```

이 프로젝트에서는 기능 단위로 `Frontend → Backend → Integration`을 반복하지 않습니다.
공통 Contract를 먼저 고정한 뒤 Frontend와 Backend를 독립적으로 병렬 개발하고, 두 작업이 준비된 뒤 통합합니다.

---

## 2. 역할 A — Frontend AI

주요 담당:
- UI
- 컴포넌트
- 사용자 Interaction
- Loading/Error 상태
- Mock Data
- Mock API
- 다크모드
- Frontend 테스트

수정 가능:
```text
src/components/**
src/features/**
src/app/(public)/**
src/app/(app)/**
src/mocks/**
```

수정 금지:
```text
src/app/api/**
src/server/**
supabase/migrations/**
src/contracts/**
```

작업 상태는 `docs/tasks/FRONTEND_TASKS.md`에서만 관리합니다.

---

## 3. 역할 B — Backend AI

주요 담당:
- Supabase/Auth
- PostgreSQL/Migration
- RLS
- Route Handler
- Service Layer
- OpenAI
- Scheduler
- 서버 테스트

수정 가능:
```text
src/app/api/**
src/server/**
src/lib/supabase/server*
supabase/migrations/**
```

수정 금지:
```text
src/components/**
src/features/**
src/app/(public)/**
src/app/(app)/**
src/contracts/**
```

작업 상태는 `docs/tasks/BACKEND_TASKS.md`에서만 관리합니다.

---

## 4. 역할 C — Integration 담당

Frontend/Backend가 준비된 뒤 담당합니다.

주요 담당:
- Branch Merge
- Shared Contract 확인
- Mock API → 실제 API 전환
- Integration Test
- RLS 실제 연결 검증
- 전체 사용자 흐름 검증
- 배포 전 QA

작업 상태는 `docs/tasks/INTEGRATION_TASKS.md`에서 관리합니다.

`docs/API.md` 또는 `src/contracts/**` 변경이 필요하면 Integration 담당이 먼저 Contract를 확정한 뒤 양쪽 구현을 맞춥니다.

---

## 5. 처음 개발을 시작하는 순서

### Step 1 — 공통 작업

먼저 `docs/TASKS.md`의 C-001~C-009를 완료합니다.

특히 다음 세 항목이 중요합니다.
- `docs/API.md`
- `docs/DATABASE.md`
- `src/contracts/**`

이 작업이 완료되기 전에는 Frontend/Backend 병렬 개발을 시작하지 않습니다.

### Step 2 — 두 작업 폴더 생성

같은 폴더를 두 AI가 동시에 수정하지 않습니다.

```bash
git checkout main
git pull

git worktree add ../health-record-frontend -b feature/frontend-mvp
git worktree add ../health-record-backend -b feature/backend-mvp
```

구조:
```text
health-record/              ← main / 통합용
health-record-frontend/     ← Frontend AI
health-record-backend/      ← Backend AI
```

### Step 3 — Frontend / Backend 동시 시작

Frontend AI에는 `health-record-frontend`만 맡깁니다.
Backend AI에는 `health-record-backend`만 맡깁니다.

둘은 서로 기다리지 않습니다.

### Step 4 — 각자 전체 담당 작업 완료

Frontend:
- `FRONTEND_TASKS.md` 기준
- 실제 API 대신 Mock 사용

Backend:
- `BACKEND_TASKS.md` 기준
- UI 없이 API/DB 테스트

### Step 5 — Integration

양쪽 작업이 완료되면 commit 후 main에 합칩니다.

```bash
# frontend worktree
git add .
git commit -m "feat: frontend mvp"

# backend worktree
git add .
git commit -m "feat: backend mvp"

# main
git checkout main
git merge feature/backend-mvp
git merge feature/frontend-mvp
```

이후 `INTEGRATION_TASKS.md`를 진행합니다.

---

## 6. 시간대 처리에서 역할 분리

사용자에게 timezone 설정 화면을 제공하지 않습니다.

Frontend:
```text
기기/브라우저 시스템 timezone 자동 감지
→ 현재 시스템 날짜 계산
→ API 호출 시 metadata로 전달
```

Backend:
```text
IANA timezone 검증
→ 새 daily_record 생성 시 timezone_at_creation 저장
→ local_date 고정
→ 자동 정리 시 해당 snapshot 기준으로 날짜 종료 판정
```

Integration:
```text
timezone 설정 UI가 없는지 확인
→ 시스템 시간대가 자동 전달되는지 확인
→ 과거 local_date가 재계산되지 않는지 확인
```

---

## 7. Frontend AI 시작 프롬프트

```text
당신은 이 프로젝트의 Frontend 개발 담당입니다.

작업 전에 다음 문서를 순서대로 읽으세요.
1. AGENTS.md
2. docs/PRD.md
3. docs/API.md
4. docs/DATABASE.md
5. docs/DESIGN.md
6. docs/FRONTEND.md
7. docs/TESTING.md
8. docs/tasks/FRONTEND_TASKS.md

당신은 Frontend 영역만 담당합니다.
Backend 구현을 기다리지 말고 docs/API.md와 src/contracts/**를 기준으로 Mock API를 사용하세요.

수정 가능:
- src/components/**
- src/features/**
- src/app/(public)/**
- src/app/(app)/**
- src/mocks/**

수정 금지:
- src/app/api/**
- src/server/**
- supabase/migrations/**
- src/contracts/**

작업 시작 시 FRONTEND_TASKS.md의 해당 항목을 [~]로 바꾸고,
구현과 테스트가 끝나면 [x]로 바꾸세요.

API Contract 변경이 필요하면 임의로 변경하지 말고 완료 보고에 남기세요.
FRONTEND_TASKS.md 범위를 완료하되 Backend 또는 Integration 작업은 시작하지 마세요.
```

---

## 8. Backend AI 시작 프롬프트

```text
당신은 이 프로젝트의 Backend 개발 담당입니다.

작업 전에 다음 문서를 순서대로 읽으세요.
1. AGENTS.md
2. docs/PRD.md
3. docs/API.md
4. docs/DATABASE.md
5. docs/ARCHITECTURE.md
6. docs/BACKEND.md
7. docs/SECURITY.md
8. docs/AI.md
9. docs/TESTING.md
10. docs/tasks/BACKEND_TASKS.md

당신은 Backend 영역만 담당합니다.
Frontend 구현을 기다리지 말고 docs/API.md와 src/contracts/**를 기준으로 실제 DB/API를 구현하세요.

수정 가능:
- src/app/api/**
- src/server/**
- src/lib/supabase/server*
- supabase/migrations/**

수정 금지:
- src/components/**
- src/features/**
- src/app/(public)/**
- src/app/(app)/**
- src/contracts/**

작업 시작 시 BACKEND_TASKS.md의 해당 항목을 [~]로 바꾸고,
구현과 테스트가 끝나면 [x]로 바꾸세요.

API Contract 변경이 필요하면 임의로 변경하지 말고 완료 보고에 남기세요.
BACKEND_TASKS.md 범위를 완료하되 Frontend 또는 Integration 작업은 시작하지 마세요.
```

---

## 9. Integration 담당 시작 프롬프트

```text
당신은 이 프로젝트의 Integration 담당입니다.

먼저 다음 문서를 읽으세요.
1. AGENTS.md
2. docs/PRD.md
3. docs/API.md
4. docs/DATABASE.md
5. docs/PLAN.md
6. docs/TESTING.md
7. docs/tasks/FRONTEND_TASKS.md
8. docs/tasks/BACKEND_TASKS.md
9. docs/tasks/INTEGRATION_TASKS.md

Frontend와 Backend 구현 결과를 합치고 INTEGRATION_TASKS.md만 진행하세요.

주요 목표:
- Branch Merge
- Contract 불일치 해결
- Mock API를 실제 API로 교체
- 전체 사용자 흐름 검증
- RLS/보안/삭제/AI 실패 검증
- 최종 QA

새 제품 기능은 추가하지 마세요.
Contract 변경이 꼭 필요하면 docs/API.md와 src/contracts/**를 먼저 동기화한 뒤 구현을 수정하세요.
```

---

## 10. 완료 보고 형식

각 AI는 작업 후 다음을 남깁니다.

```text
완료한 Task ID:
주요 구현 내용:
수정 파일:
실행한 테스트:
테스트 결과:
Contract 변경 필요 여부:
추가 결정 필요:
```
