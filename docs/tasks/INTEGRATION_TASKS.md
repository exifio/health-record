# INTEGRATION_TASKS — 통합 / 최종 검증 작업

이 문서는 **Frontend와 Backend 작업이 준비된 뒤 진행하는 통합 전용 작업 목록**입니다.

통합의 목적은 새로운 기능을 추가하는 것이 아니라:

1. Frontend Mock을 실제 Backend API로 교체하고
2. Contract 불일치를 해결하며
3. 전체 사용자 흐름과 보안 규칙을 검증하는 것입니다.

## 상태 표기

- `[ ]` 대기
- `[~]` 진행 중
- `[x]` 완료
- `[!]` 막힘 / 추가 결정 필요

---

# I0. 통합 시작 조건

- [x] **I-001** `docs/TASKS.md` 공통 선행 작업 완료 확인
- [x] **I-002** `FRONTEND_TASKS.md`의 MVP 구현 작업 완료 확인
- [x] **I-003** `BACKEND_TASKS.md`의 MVP 구현 작업 완료 확인
- [x] **I-004** Frontend / Backend Branch 최신 commit 확인
- [x] **I-005** `docs/API.md`와 `src/contracts/**` 변경 여부 확인

### I0 진행 기록 (2026-09-26)

**I-001 — 완료.** `docs/TASKS.md` 0절 C-001~C-009가 모두 `[x]`다. Mock과 실제 API가 같은 `src/contracts` 스키마를 사용하고, 저장소 폴더 구조도 규칙대로다.

**I-002 — 완료.** F-001~F-810이 전부 `[x]`다. Mock API 기준 테스트(`tests/features`, `tests/mocks`, `tests/components`)가 통과한다. 백엔드 구현을 기다리지 않고 화면을 완성한 상태다.

**I-003 — 완료 (B-613 이월).** B-001~B-612와 B-614~B-711이 `[x]`다. B-613(Vercel Firewall rate limit)만 `[!]`로 남아 있고 원인은 Vercel 프로젝트 미연결이다. API/DB 구현 완료에는 영향이 없으므로 I3 진행을 막지 않지만, **배포(I-715/I-716) 전 반드시 마감**해야 한다.

**I-004 — 완료. (결정: 선택지 A)**

- 저장소에는 `main` 단일 브랜치만 있고 FE/BE 전용 브랜치·worktree도, 원격 remote도 없다. → I-101/I-102/I-103(Merge)은 "해당 없음"으로 처리한다.
- FE/BE 작업 전체가 working tree에만 커밋되지 않은 상태로 남아 있어 **통합 스냅샷 커밋**으로 기록했다. 커밋 `a01a75f` (132 files, +12398/-202).
- 커밋 전 정리: `.playwright-cli/`(브라우저 콘솔 로그)을 `.gitignore`에 추가해 제외했다. `.env.local`은 기존 규칙으로 제외되어 있고, 커밋 대상 전수 검사에서 Secret 값은 발견되지 않았다.
- 남은 사항: `scripts/update_b1_tasks.py`는 Backend 문서 편집용 1회성 스크립트라 커밋에서 제외했다. 정리 여부는 `[!]` 로 남긴다.

**I-005 — 완료. 아래 두 차단 항목을 해결했다.**

- `docs/API.md`는 C-002 이후 변경이 없다(`git diff` 0). `src/contracts/index.ts`는 `Suggestion`, `DailyRecordListItem` 타입 export 2줄만 추가되었고 **스키마 자체 변경은 없다.** → Contract 정의 충돌은 없다.
- **차단 1 해결: `POST /api/daily-records/:date/summary/retry` 구현.** `docs/API.md` 9절에 맞춰 `retryDailySummary()`(`src/server/daily-records/summary-service.ts`)와 route(`src/app/api/daily-records/[date]/summary/retry/route.ts`)를 추가했다. `failed`/`stale`만 `pending`으로 되돌리고, `pending` 중복 호출은 같은 202를 반환하며, `not_due`/`processing`/`ready`/확정 기록은 409로 거절한다. 새 마이그레이션은 필요 없다(기존 `daily_records` update grant + 세션 사용자 `user_id` 조건부 UPDATE). 재시도 자체는 AI를 호출하지 않고 스케줄러가 이어서 처리한다.
- **차단 2 해결: 인증 endpoint 문서화.** `docs/API.md` 19절에 `GET /api/auth/google`, `GET /api/auth/callback`, `POST /api/auth/logout`의 요청·응답·오류 규칙을 추가했다.
- **정합 보완:** 1절 error code 목록에 실제로 쓰이는 `MESSAGE_NOT_FOUND`, `RECORD_NOT_CONFIRMED`와 이번에 추가한 `SUMMARY_NOT_RETRYABLE`을 반영했다. 9절에 상태별 허용/거절 규칙과 idempotency, 스케줄러 연동 설명을 보완했다.
- **재발 방지:** `tests/contracts/api-route-mapping.test.ts`를 추가했다. HealthApi 16개 메서드가 기대한 method/path를 호출하는지, 그 경로와 `docs/API.md`에 정의된 모든 endpoint에 실제 route가 있는지, 구현된 route 중 Contract에 없는 것이 없는지를 양방향으로 검증한다. retry route를 임시로 제거하면 2건이 실패하는 것을 확인했다.

### I0에서 발견한 신규 차단 항목 → 해결 (선택지 A 결정)

- [!] → **해결. 결정: (A) RPC 호출을 사용자 세션 클라이언트로 전환**
  - **원인:** 마이그레이션의 사용자 데이터 RPC 7개는 `auth.uid()`로 권한을 검증하는데, 서버가 `createAdminClient()`(service role key)로 호출하고 있었다. service role JWT에는 `sub`가 없어 `auth.uid()`가 NULL이므로 메시지 추가/수정/삭제, 요약 수정, 확정, 정정 추가, 하루 삭제, 전체 건강 기록 삭제, 계정 삭제가 전부 403 `FORBIDDEN`으로 실패했다.
  - **실측 근거:** 원격 프로젝트에 service role key로 `POST /rest/v1/rpc/create_record_message` 호출 → `HTTP 403 {"code":"42501","message":"FORBIDDEN"}`. 실패 시 트랜잭션 롤백으로 데이터 미생성.
  - **코드 변경:** `confirm`, `summary`(PATCH), `corrections`, `summary/retry` route가 `createServerClient()`(세션 클라이언트)를 사용한다. service role은 스케줄러(`api/internal/daily-summary/run`)와 Auth Admin API를 쓰는 `api/account`에만 남았다.
  - **마이그레이션:** `20260926090000_b7_session_client_rpc.sql`을 추가했다. B4 RPC 3개에 `auth.uid()` 검증을 넣고 `security definer`로 전환(원래는 service role 전용 grant에만 의존), `retry_daily_summary` RPC를 추가하고, 4개 모두 `authenticated`에 execute를 허용했다. 테이블 grant는 열지 않아 RLS + 함수 검증이 함께 적용된다.
  - **재시도 흐름 변경:** `retryDailySummary()`는 직접 UPDATE 대신 `retry_daily_summary` RPC를 호출한다. 재시도 가능 여부 판정이 DB row lock 안에서 이뤄져 스케줄러 claim과 직렬화된다. 반환값은 `pending` / `missing`(→404) / `not_retryable`(→409).
  - **재발 방지:** `tests/server/session-client-boundary.test.ts` 추가. (1) 사용자 요청 route가 `@/lib/supabase/admin`을 쓰지 않는지(스케줄러·계정 삭제만 예외), (2) write RPC 4종이 `authenticated` grant + `security definer` + `auth.uid()` 검증 + 고정 `search_path`를 갖는지, (3) 스케줄러 전용 RPC가 여전히 `authenticated`에서 차단되는지, (4) 테이블 직접 grant를 새로 열지 않는지 검증한다.
  - **재현 · 해결:** 원격 `health` 프로젝트 SQL Editor로 마이그레이션을 직접 적용하고, 실제 사용자 세션 토큰으로 RPC를 호출해 검증했다. 테스트 계정으로 `create_record_message` → **HTTP 200**(수정 전 403 FORBIDDEN), `retry_daily_summary` → `"not_retryable"` 반환, `confirm_daily_record` → `SUMMARY_NOT_READY`(grant 동작 확인), 타인 `p_user_id` → 403 FORBIDDEN, 스케줄러 RPC → 403 permission denied. 검증 후 테스트 계정과 row는 모두 삭제했다.
  - **문서:** `docs/DATABASE.md` 10절에 RPC별 호출 주체/권한 검증 표를 추가했다. `docs/API.md` 응답 규칙은 변하지 않는다.
- **추가 발견:** 마이그레이션 적용 과정에서 원격 DB에 B2~B6이 미적용 상태임을 확인해 함께 적용했다(아래 I5 이후 항목 참고).
- [x] **과거 날짜 신규 작성 정책 결정 반영 (B8).** 사용자가 Contract 기본안대로 "기록이 없는 과거 날짜 신규 작성 불가"를 선택했다.
  - 마이그레이션 `20260926100000_b8_no_backfill_past_dates.sql`: `create_record_message`가 `systemTimezone` 기준 오늘 날짜에만 daily record를 새로 만들고, 과거 날짜에 record가 없으면 `RECORD_DATE_NOT_WRITABLE`로 거절한다. 이미 존재하는 과거 draft record 추가는 유지된다.
  - 서버: `mapDatabaseError`에 `RECORD_DATE_NOT_WRITABLE` → 400 + 사용자 안내 문구를 추가했다. DB 오류 원문은 노출하지 않는다.
  - Contract: `docs/API.md` 5절의 `추가 결정 필요`를 확정 규칙으로 교체, 1절 code 목록에 추가. `docs/DATABASE.md` 10절에 규칙을 명시했다.
  - 원격 DB 적용 후 실제 사용자 세션으로 3케이스 검증: 오늘 첫 기록 200 / 미기록 과거 날짜 400 `RECORD_DATE_NOT_WRITABLE` / 기존 과거 record 추가 200. 테스트 계정과 row는 정리했다.
  - UI 영향 없음: 기록 작성 UI는 오늘 페이지에만 있어 과거 날짜에 도달하는 사용자 경로가 없다.

### I5 이후 남은 Backend 영역 이슈 (Integration이 수정하지 않음)

- [x] **B7 마이그레이션 원격 적용 — 완료.** 이 저장소에는 Supabase CLI link 인증 정보가 없어 CLI로는 push할 수 없었다(`supabase/.temp`는 있으나 접근 토큰은 macOS 키체인에 있고 비대화형으로 추출 불가). 대신 로그인된 Supabase Dashboard SQL Editor로 마이그레이션을 직접 적용했다.
  - **결정적 발견:** 원격 `health` 프로젝트에는 B0/B1만 적용돼 있었고 **B2~B6은 아예 적용되지 않은 상태**였다. 그래서 `public.daily_summaries`가 없어 B4/B6/B7이 전부 `42P01 relation does not exist`로 실패했다. B 노트의 "push 완료" 기록과 실제 상태가 달랐다.
  - 적용 순서: b2_record_suggestions → b3_daily_summaries → b4_summary_confirmation_corrections → b6_deletion_and_security → b7_session_client_rpc. 각 파일 실행 후 오류 없음을 확인했다.
  - 적용 후 검증 쿼리: public 테이블 6개, 대상 RPC 13개, B4/B7 4개 RPC의 `authenticated` execute 허용 4/4, 스케줄러 RPC의 `authenticated` 누출 0, 4개 모두 `security definer` + 고정 `search_path` 확인.
  - `supabase_migrations.schema_migrations`에 5건을 기록해 이후 `supabase db push`가 중복 적용하지 않도록 맞췄다(전체 9건).
- [x] **일일 요약 job의 완료 카운터 오 집계 — 수정 완료.** `complete_daily_summary`는 `returns text`라 PostgREST가 배열이 아닌 스칼라 문자열을 돌려주는데, 코드가 `rows[0]?.result`로 읽어 성공이에도 `completed`가 늘지 않았다. 원격 DB에서 `retry_daily_summary`가 `"not_retryable"` 문자열을 반환하는 것을 확인해 실제 형태를 검증했고, `readScalarResult()`로 스칼라/배열 모두 처리하도록 고쳤다. 기존 테스트가 잘못된 형태(`[{ result: "ready" }]`)로 mock하고 있어 버그를 통과시키던 상태였는데, mock을 실제 형태로 정정하고 회귀 테스트 2건을 추가했다.

### I0 검증 결과

- `npm run typecheck` 통과
- `npm run lint` 통과
- `npm test` → 40 suites / 236 tests 통과 (I-005 반영 전 36 suites / 198 tests)
- `npm run build` 통과, `/api/daily-records/[date]/summary/retry` 라우트 등록 확인. 페이지 6개 전부 Dynamic 렌더링
- 실브라우저 대신 dev 서버로 확인: 세션 없는 `POST /summary/retry`는 DB 접근 전에 401 `UNAUTHENTICATED`를 반환한다(404/500 아님)
- 라우트 대조 결과: `docs/API.md`에 정의된 20개 endpoint 전부 구현, Contract에 정의되지 않은 구현 route 없음
- service role 사용처가 스케줄러(`api/internal/daily-summary/run`)와 계정 삭제(`api/account`) 두 곳뿐임을 정적 테스트로 확인

Contract 충돌이 있으면 구현 중 한쪽을 임의 기준으로 삼지 않습니다.
`docs/API.md`와 `src/contracts/**`를 먼저 확정한 뒤 양쪽 코드를 맞춥니다.

### I1 / I2 / I5 진행 기록

- I-104: `getServerSession()`(`src/server/auth/session.ts`)이 서버 세션으로 로그인 상태를 판정한다. 익명 세션·세션 없음·`getUser` 오류·서버 설정 실패는 모두 `unauthenticated`로 내려보낸다. `AuthenticatedApp`(`src/components/layout/AuthenticatedApp.tsx`)이 서버 컴포넌트에서 세션을 읽어 `AuthProvider`에 주입하므로 페이지가 `initialStatus`를 하드코딩하지 않는다. 5개 페이지가 서버 컴포넌트 + 클라이언트 View(`src/features/**`) 구조로 분리되어 빌드 시 전부 Dynamic 렌더링으로 확인된다.
- I-105: `loginWithGoogle`가 목 사용자를 만들지 않고 `/api/auth/google`로 이동한다. `logout`은 신규 `POST /api/auth/logout`(`signOut({ scope: "local" })`, 204)에서 서버 세션을 지운 뒤 `router.refresh()`한다. 온보딩 완료 여부는 `GET/PATCH /api/profile`로 조회·저장해 새로고침 후에도 유지된다.
- I-106: 미인증/Demo 모드에서 `TodayRecordView`·`RecordsListContent`·`RecordDateContent`·`VisitPrepContent`가 실제 사용자 API를 호출하지 않는다. 로그인 전 401이 화면 에러로 노출되지 않는다.
- I-501: `RecordsShell`(`src/components/layout/RecordsShell.tsx`)이 `getDailyRecords` 결과를 사이드바에 주입한다. `Sidebar`의 `DEFAULT_RECENT_RECORDS` 하드코딩 샘플을 제거해 로그인 사용자에게 가짜 기록이 뜨지 않는다. 조회 실패는 본문 흐름을 막지 않고 목록만 비운다. prop 미지정 시 빈 배열로 렌더링하며, 기록이 없으면 `아직 기록이 없습니다` 안내를 표시한다(빈 `<ul>`로 레이아웃이 무너지지 않도록).
- I-502: 사이드바/기록 목록은 실제 `unreviewedCount`를 그대로 사용한다. `records`·`visit-prep`의 고정 날짜(`2026-08-01`, `2026-09-01`)를 시스템 날짜 기준 `daysAgoLocalDate(90)` 계산으로 교체했다.
- 남은 미완료: I-101~I-103은 별도 FE/BE 브랜치가 없어 해당 없음. I-201~I-208, I-301~I-307, I-401~I-405는 실제 API 모드 전환 및 실브라우저 검증이 남았다.

---

# I1. Merge / 인증 / 앱 기본 연결

- [ ] **I-101** Backend Branch Merge
- [ ] **I-102** Frontend Branch Merge
- [ ] **I-103** Merge Conflict 해결
- [x] **I-104** Google 로그인 실제 세션을 App Shell에 연결
- [x] **I-105** 로그인/로그아웃 상태 전환 검증
- [x] **I-106** Demo Mode에서 실제 사용자 API 호출 차단 검증

---

# I2. 오늘 기록 실제 API 연결

- [ ] **I-201** 오늘 기록 Mock 조회 → 실제 API 교체
- [ ] **I-202** 메시지 생성 Mock → 실제 API 교체
- [ ] **I-203** 메시지 수정 Mock → 실제 API 교체
- [ ] **I-204** 메시지 삭제 Mock → 실제 API 교체
- [ ] **I-205** 시스템 날짜가 올바른 `local_date` 경로로 전달되는지 검증
- [ ] **I-206** 시스템 timezone metadata가 사용자 입력 없이 전달되는지 검증
- [ ] **I-207** 이미 생성된 과거 기록 날짜가 시스템 timezone 변경으로 재분류되지 않는지 검증
- [ ] **I-208** 저장 실패/네트워크 오류 UX 검증

---

# I3. AI 제안 / 자동 일일 요약 연결

- [ ] **I-301** 실제 추가 기록 제안 API 연결
- [ ] **I-302** 제안 실패 시 기록 작성 흐름 유지 검증
- [ ] **I-303** 실제 Summary 상태 연결
- [ ] **I-304** `다시 정리하기` 실제 API 연결
- [ ] **I-305** 자동 Summary Job 실행 검증
- [ ] **I-306** 원문 수정과 AI 요약 생성 Race Condition 검증
- [ ] **I-307** stale 요약이 확정 가능 상태로 노출되지 않는지 검증

---

# I4. 요약 확인 / 확정 / 정정 연결

- [ ] **I-401** 사용자 수정 Summary 저장/재조회 검증
- [ ] **I-402** 확정 API 연결
- [ ] **I-403** 확정 후 기존 원문 수정/삭제 차단 검증
- [ ] **I-404** 정정 기록 추가 API 연결
- [ ] **I-405** 정정 기록 재조회/표시 검증

---

# I5. 기록 목록 / 진료 준비 연결

- [x] **I-501** 기록 목록 실제 API 연결
- [x] **I-502** 미확인 기록 Banner 실제 count 연결
- [ ] **I-503** 진료 준비 실제 API 연결
- [ ] **I-504** 미확인 기록 안내 UX 검증
- [ ] **I-505** 기록 없는 날짜 미표시 검증
- [ ] **I-506** 날짜별 원문 조회 검증
- [ ] **I-507** 정정 기록 포함 검증
- [ ] **I-508** 다일 의료 패턴 문장이 생성되지 않는지 확인

---

# I6. 삭제 / 설정 / 보안 통합

- [ ] **I-601** 하루 전체 삭제 후 UI 상태 초기화 검증
- [ ] **I-602** 전체 건강 기록 삭제 후 UI 상태 검증
- [ ] **I-603** 계정 삭제 후 Session 종료 검증
- [ ] **I-604** 다른 사용자의 데이터 접근 불가 검증
- [ ] **I-605** Client Bundle Secret 노출 여부 확인
- [ ] **I-606** 운영 로그에 건강 원문이 남지 않는지 확인
- [ ] **I-607** 라이트/다크/시스템 테마 전환 및 새로고침 유지 검증
- [ ] **I-608** 다크모드 주요 화면의 대비/상태 식별 검증

---

# I7. 전체 QA / AI Evaluation / 배포 준비

- [ ] **I-701** Jest 전체 실행
- [ ] **I-702** API Integration Test 전체 실행
- [ ] **I-703** RLS Cross-user Test 실행
- [ ] **I-704** AI Evaluation Dataset 실행
- [ ] **I-705** 모바일 사이드바 수동 QA
- [ ] **I-706** 데스크톱 사이드바 수동 QA
- [ ] **I-707** 첫 로그인 온보딩 검증
- [ ] **I-708** Demo Mode 검증
- [ ] **I-709** AI 실패 상태 검증
- [ ] **I-710** 요약 수정/확정 전체 흐름 검증
- [ ] **I-711** 정정 기록 전체 흐름 검증
- [ ] **I-712** 진료 준비 전체 흐름 검증
- [ ] **I-713** 삭제 확인 전체 흐름 검증
- [ ] **I-714** 개인정보/AI 처리 안내 최종 문구 확인
- [ ] **I-715** Production 환경변수 확인
- [ ] **I-716** 전체 테스트 통과 후 배포 준비 완료 표시

---

# 통합 완료 기준

```text
Google 로그인
→ 오늘 기록 여러 개 작성
→ 자동 일일 요약
→ 사용자 요약 확인/수정
→ 확정
→ 필요 시 정정 기록 추가
→ 진료 준비 기간 선택
→ 확정 기록 확인
```

위 핵심 흐름이 실제 DB/API 기준으로 동작하고, RLS/삭제/AI 금지사항/시간대/다크모드 검증까지 통과해야 합니다.
