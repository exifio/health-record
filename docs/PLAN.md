# PLAN — 개발 순서와 병렬 작업 계획

## 1. 개발 전략

이 프로젝트는 하나의 Next.js 저장소를 사용하지만 개발 작업은 세 역할로 분리합니다.

1. Frontend 개발
2. Backend 개발
3. Integration

핵심은 **Frontend와 Backend를 기능별로 번갈아 통합하는 것이 아니라, 공통 Contract를 먼저 확정한 뒤 두 작업 흐름을 독립적으로 병렬 진행하고 마지막에 통합하는 것**입니다.

```text
Stage 0 — 공통 Contract / 기반 작업
                ↓
       ┌────────┴────────┐
       ↓                 ↓
Stage 1A             Stage 1B
Frontend 전체        Backend 전체
Mock API 사용         실제 DB/API 구현
       ↓                 ↓
       └────────┬────────┘
                ↓
Stage 2 — Integration
Mock → 실제 API / 전체 연결
                ↓
Stage 3 — QA / AI Eval / 배포
```

상세 작업은 다음 문서를 사용합니다.

- 전체 현황/공통: `docs/TASKS.md`
- Frontend: `docs/tasks/FRONTEND_TASKS.md`
- Backend: `docs/tasks/BACKEND_TASKS.md`
- Integration: `docs/tasks/INTEGRATION_TASKS.md`
- 실제 병렬 운영: `docs/PARALLEL_DEVELOPMENT.md`

---

# Stage 0 — 공통 Contract 및 프로젝트 기반 확정

병렬 개발 전에 한 번 완료합니다.

주요 작업:
- PRD 핵심 정책 확인
- `docs/API.md` 확정
- `docs/DATABASE.md` 확정
- `src/contracts/**` TypeScript 타입/Schema 생성
- 저장소 기본 구조
- 환경변수 명칭
- Jest/Lint 기본 설정
- Frontend/Backend Branch 또는 Worktree 준비

완료 기준:
- Frontend가 Backend 없이 Mock으로 구현 가능
- Backend가 UI 없이 API를 구현 가능
- Request/Response가 하나의 Contract로 고정됨

---

# Stage 1A — Frontend 개발

담당 문서: `docs/tasks/FRONTEND_TASKS.md`

Frontend는 Backend가 끝나기를 기다리지 않습니다.

작업 범위:
- App Shell / Sidebar
- 로그인/Demo Mode/온보딩 UI
- 오늘 기록
- 기록 수정/삭제 UI
- AI 추가 기록 제안 UI
- 일일 요약 상태/확인/수정/확정 UI
- 기록 목록
- 진료 준비 UI
- 삭제 UI
- 다크모드
- Mock API
- Frontend 테스트

시간 처리:
- 사용자의 브라우저/기기 시스템 시간대를 자동 감지
- 사용자가 timezone을 선택하거나 관리하는 UI는 제공하지 않음
- 시스템 날짜와 IANA timezone metadata를 API Contract에 맞춰 자동 전달

Frontend 완료 조건:
- Mock API 기준으로 MVP 화면과 상호작용이 완결됨
- 실제 Backend 코드를 직접 참조하지 않음
- Contract와 타입이 일치함

---

# Stage 1B — Backend 개발

담당 문서: `docs/tasks/BACKEND_TASKS.md`

Backend는 Frontend가 끝나기를 기다리지 않습니다.

작업 범위:
- Supabase/Auth
- PostgreSQL Schema/Migration
- RLS
- Daily Record/Message API
- AI Service Layer
- 추가 기록 제안
- 자동 일일 요약
- Revision/Stale 처리
- 요약 수정/확정/정정
- 기록 목록/진료 준비
- 삭제
- Scheduler
- Backend/AI 테스트

시간 처리:
- profile에 사용자 timezone 설정값을 저장하지 않음
- Client가 자동 감지한 IANA timezone을 record 생성 시 검증
- `daily_records.timezone_at_creation`에 내부 snapshot 저장
- `local_date`는 생성 후 재계산하지 않음
- Scheduler는 record 생성 당시 timezone을 기준으로 해당 local day가 끝났는지 판정

Backend 완료 조건:
- UI 없이 API/DB 규칙을 테스트 가능
- RLS/보안/AI 장애 격리 검증 완료
- Contract와 타입이 일치함

---

# Stage 2 — Integration

담당 문서: `docs/tasks/INTEGRATION_TASKS.md`

Frontend와 Backend 결과가 준비되면 통합합니다.

순서:
1. Backend Branch Merge
2. Frontend Branch Merge
3. Contract/타입 충돌 해결
4. Frontend Mock API를 실제 API로 교체
5. 인증 연결
6. 기록 CRUD 연결
7. AI 제안/요약 연결
8. 확정/정정 연결
9. 진료 준비 연결
10. 삭제/설정 연결
11. 전체 Integration Test

Integration 단계에서는 새 제품 기능을 추가하지 않습니다.

---

# Stage 3 — 전체 QA / AI Evaluation / 배포 준비

- Jest 전체 실행
- API Integration Test
- RLS Cross-user Test
- AI Evaluation Dataset
- 모바일/데스크톱 QA
- 다크모드 QA
- 시스템 시간대 날짜 경계 검증
- 개인정보/AI 처리 안내 검토
- Production Secret/환경변수 검증
- 운영 로그 Health Text 점검

---

# 작업 충돌 방지 규칙

- Frontend와 Backend AI가 같은 작업 폴더를 동시에 수정하지 않음
- 별도 Branch + Git Worktree 권장
- `src/contracts/**`와 `docs/API.md`는 Shared Contract로 취급
- Contract 변경이 필요하면 양쪽에서 임의 수정하지 않고 통합 담당이 먼저 확정
- 각 AI는 자신의 TASK 문서만 상태 갱신
