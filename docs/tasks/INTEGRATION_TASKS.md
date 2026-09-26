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

**I-003 — 완료 (B-613 결정 완료).** B-001~B-612와 B-614~B-711이 `[x]`다. B-613도 방향을 결정했다: Vercel Firewall으로 적용하고 규칙은 `docs/SECURITY.md` 10절에 확정했으며, 실제 WAF 규칙 적용과 429 검증은 배포 시점의 I-717로 넘어갔다. 백엔드 구현 완료에 영향이 없다.

**I-004 — 완료. (결정: 선택지 A)**

- 저장소에는 `main` 단일 브랜치만 있고 FE/BE 전용 브랜치·worktree도, 원격 remote도 없다. → I-101/I-102/I-103(Merge)은 "해당 없음"으로 처리한다.
- FE/BE 작업 전체가 working tree에만 커밋되지 않은 상태로 남아 있어 **통합 스냅샷 커밋**으로 기록했다. 커밋 `a01a75f` (132 files, +12398/-202).
- 커밋 전 정리: `.playwright-cli/`(브라우저 콘솔 로그)을 `.gitignore`에 추가해 제외했다. `.env.local`은 기존 규칙으로 제외되어 있고, 커밋 대상 전수 검사에서 Secret 값은 발견되지 않았다.
- `scripts/update_b1_tasks.py`는 Backend 문서 편집용 1회성 스크립트라 커밋에서 제외했으나, 같은 커밋에서 삭제해 저장소를 깨끗하게 정리했다.

**I-005 — 완료. 아래 두 차단 항목을 해결했다.**

- `docs/API.md`는 C-002 이후 변경이 없다(`git diff` 0). `src/contracts/index.ts`는 `Suggestion`, `DailyRecordListItem` 타입 export 2줄만 추가되었고 **스키마 자체 변경은 없다.** → Contract 정의 충돌은 없다.
- **차단 1 해결: `POST /api/daily-records/:date/summary/retry` 구현.** `docs/API.md` 9절에 맞춰 `retryDailySummary()`(`src/server/daily-records/summary-service.ts`)와 route(`src/app/api/daily-records/[date]/summary/retry/route.ts`)를 추가했다. `failed`/`stale`만 `pending`으로 되돌리고, `pending` 중복 호출은 같은 202를 반환하며, `not_due`/`processing`/`ready`/확정 기록은 409로 거절한다. 새 마이그레이션은 필요 없다(기존 `daily_records` update grant + 세션 사용자 `user_id` 조건부 UPDATE). 재시도 자체는 AI를 호출하지 않고 스케줄러가 이어서 처리한다.
- **차단 2 해결: 인증 endpoint 문서화.** `docs/API.md` 19절에 `GET /api/auth/google`, `GET /api/auth/callback`, `POST /api/auth/logout`의 요청·응답·오류 규칙을 추가했다.
- **정합 보완:** 1절 error code 목록에 실제로 쓰이는 `MESSAGE_NOT_FOUND`, `RECORD_NOT_CONFIRMED`와 이번에 추가한 `SUMMARY_NOT_RETRYABLE`을 반영했다. 9절에 상태별 허용/거절 규칙과 idempotency, 스케줄러 연동 설명을 보완했다.
- **재발 방지:** `tests/contracts/api-route-mapping.test.ts`를 추가했다. HealthApi 16개 메서드가 기대한 method/path를 호출하는지, 그 경로와 `docs/API.md`에 정의된 모든 endpoint에 실제 route가 있는지, 구현된 route 중 Contract에 없는 것이 없는지를 양방향으로 검증한다. retry route를 임시로 제거하면 2건이 실패하는 것을 확인했다.

### I0에서 발견한 신규 차단 항목 → 해결 (선택지 A 결정)

- [x] **해결. 결정: (A) RPC 호출을 사용자 세션 클라이언트로 전환**
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

- [x] **I-101** Backend Branch Merge — 해당 없음 (main에 이미 반영됨)
- [x] **I-102** Frontend Branch Merge — 해당 없음 (main에 이미 반영됨)
- [x] **I-103** Merge Conflict 해결 — 해당 없음 (충돌 없음)
- [x] **I-104** Google 로그인 실제 세션을 App Shell에 연결
- [x] **I-105** 로그인/로그아웃 상태 전환 검증
- [x] **I-106** Demo Mode에서 실제 사용자 API 호출 차단 검증

### I1 진행 기록 (2026-09-26)

- **I-101~I-103은 해당 없음으로 마감한다.** FE/BE 전용 브랜치와 worktree를 쓰지 않아 Backend/Frontend 작업이 모두 `main` working tree에만 있었고, I-004 결정(선택지 A)에 따라 통합 스냅샷 커밋 `a01a75f`로 한 번에 기록했다. merge할 대상 브랜치와 충돌이 존재하지 않는다. 원격 remote도 없다.
- I-104~I-106은 Frontend 단계에서 `[x]`로 완료됐고, I-005에서 원격 DB 상태를 바로잡은 뒤에도 판정 근거는 그대로 유효하다(미인증·Demo 모드는 사용자 API를 호출하지 않는다).
- I1에서 실질적으로 더 확인할 것은 없다. **실제 API 연결 작업은 I2부터 시작한다.**

---

# I2. 오늘 기록 실제 API 연결

- [x] **I-201** 오늘 기록 Mock 조회 → 실제 API 교체
- [x] **I-202** 메시지 생성 Mock → 실제 API 교체
- [x] **I-203** 메시지 수정 Mock → 실제 API 교체
- [x] **I-204** 메시지 삭제 Mock → 실제 API 교체
- [x] **I-205** 시스템 날짜가 올바른 `local_date` 경로로 전달되는지 검증
- [x] **I-206** 시스템 timezone metadata가 사용자 입력 없이 전달되는지 검증
- [x] **I-207** 이미 생성된 과거 기록 날짜가 시스템 timezone 변경으로 재분류되지 않는지 검증
- [x] **I-208** 저장 실패/네트워크 오류 UX 검증

### I2 진행 기록 (2026-09-26)

실제 API 모드(`NEXT_PUBLIC_USE_MOCK=false`)로 dev 서버를 띄우고 로그인한 실브라우저에서 확인했다.

- **환경 함정 발견:** 셸 환경에 구 프로젝트 값(`NEXT_PUBLIC_SUPABASE_URL=https://qkwnzwmoaszuwkrkxsvm.supabase.co`, anon key 빈 값)이 남아 있어 `.env.local`을 덮어썼고 Google OAuth가 존재하지 않는 프로젝트로 리다이렉트됐다. Next.js는 process env가 `.env.local`보다 우선하므로, 관련 변수를 `env -u`로 제거하고 시작해야 실제 프로젝트가 적용된다.
- **결함 1 — 404가 오류 화면으로 처리됨 (수정).** 화면이 `message.includes("기록이 없습니다") || message.includes("404")`로 빈 상태를 판별했는데, Mock은 "기록이 없습니다."를 던지고 실제 API는 `RECORD_NOT_FOUND: 기록을 찾을 수 없습니다.`를 던진다. 문자열에 "404"도 없으므로 **기록이 없는 날이 오류 화면으로 표시**됐다.
  - `health-api.ts`에 `HealthApiError(code, status, message)`와 `isApiError()`를 추가하고, Mock도 같은 형태를 던지도록 맞췄다(AGENTS §9: Mock과 실제 API의 형태 일치).
  - `TodayRecordView`·`RecordDateContent`은 이제 `API_ERROR_CODES.recordNotFound`로만 분기한다. 남은 문자열 매칭은 0건이다.
  - 회귀 테스트: Mock↔실제 404의 code/status 동등성, 네트워크 오류는 `TypeError` 그대로, 500은 빈 상태로 오분류되지 않음을 검증한다.
- **I-201**: 기록이 없는 날짜가 오류가 아닌 빈 상태로 표시되는 것을 실제 API로 확인.
- **I-202**: 메시지 작성 → HTTP 201, `content_revision=1`, `summary_status=not_due`.
- **I-203**: 메시지 수정 → `updated_at` 변경, `content_revision` 1 → 2.
- **I-204**: 마지막 메시지 삭제 → 메시지와 빈 draft record가 함께 정리(B-112 정책 실동작 확인).
- **I-205/I-206**: 브라우저 시스템 시간(KST)로 계산한 `local_date=2026-09-26`, `timezone_at_creation=Asia/Seoul`이 사용자 입력 없이 저장됨을 DB에서 확인.
- **I-207**: CDP `Emulation.setTimezoneOverride`로 브라우저를 Pacific/Midway(오늘=2026-09-25)로 바꾼 뒤, 기존 기록의 `local_date=2026-09-26`·`timezone_at_creation=Asia/Seoul`이 그대로 유지됨을 확인(재분류 없음). 목록에서 안 보이는 것은 조회 범위([today-90, today]) 밖이라서이며, 데이터는 변경되지 않는다.
- **I-208**: CDP 오프라인 모드에서 저장 시도 → "기록을 저장하지 못했습니다. 다시 시도해주세요." 표시, 페이지 무결성 유지, 기존 기록/제안 표시 정상.
- 검증 후 생성한 메시지·record는 모두 삭제해 DB를 원래 상태로 되돌렸고, 브라우저 timezone/네트워크도 복구했다.

---

# I3. AI 제안 / 자동 일일 요약 연결

- [x] **I-301** 실제 추가 기록 제안 API 연결
- [x] **I-302** 제안 실패 시 기록 작성 흐름 유지 검증
- [x] **I-303** 실제 Summary 상태 연결
- [x] **I-304** `다시 정리하기` 실제 API 연결
- [x] **I-305** 자동 Summary Job 실행 검증
- [x] **I-306** 원문 수정과 AI 요약 생성 Race Condition 검증
- [x] **I-307** stale 요약이 확정 가능 상태로 노출되지 않는지 검증

### I3 진행 기록 (2026-09-26)

실제 OpenAI 호출까지 포함해 검증했다. B2/B3 노트에 적힌 "실제 모델 Evaluation 미실시" 공백을 I3에서 메웠다.

- **환경 함정 2번째 발견:** 셸의 `OPENAI_API_KEY`가 구/무효 키(끝자리 `9z_6UA`)였고 `.env.local`의 키(끝자리 `eRVGkA`)와 달랐다. 셸 값이 우선되어 AI 호출이 401로 전부 실패했다. I2에서 발견한 Supabase 변수 오염과 같은 유형이며, **로컬 실행 시 관련 변수를 반드시 `env -u`로 제거해야 한다.**
  - 참고: `OPENAI_BASE_URL=http://127.0.0.1:8787/v1`은 셸에만 있는 로컬 AI 릴레이 주소다. OpenAI SDK가 이 변수를 기본 baseURL로 읽는다. 배포 시 이 변수를 Vercel에 설정하지 않으면 기본 `api.openai.com`으로 나간다(I-715에서 확인 필요).
  - 진단 팁: `generateSuggestions`의 catch가 원인을 삼켜 로그에 남지 않는다. AI 실패 원인을 보려면 일시적으로 `error.constructor.name`/`status`만 남기는 진단 로그가 필요하다(원문은 기록하지 말 것).
- **I-301**: `POST /api/daily-records/:date/suggestions` → 200, 실제 제안 3개(최대 3개 준수), `field`가 contract enum과 일치. 질문만 생성되고 진단·원인·치료 추천이 없었다.
- **I-302**: `OPENAI_BASE_URL`을 죽은 포트로 바꿔 AI를 강제 실패시킨 뒤 제안은 503 `AI_SUGGESTION_FAILED`, **같은 시점의 메시지 저장은 201**로 성공. 화면에도 오류 배너 없이 기록 목록만 표시되어 기록 작성 흐름이 유지된다(원문 저장과 AI 실패 분리).
- **I-303**: 스케줄러 실행 후 `not_due → ready`, `daily_summaries`에 `source_revision`(record revision 일치), `model=gpt-5-nano`, `prompt_version=daily-summary-v1`이 기록되어 추적 가능하다(B-314/B-315). timeline/medications/missingInformation이 원문 근거 `sourceMessageIds`와 함께 생성됐다.
- **I-304**: `다시 정리하기` 클릭 → API가 `pending`으로 되돌리고 화면에 "정리 대기" 표시. 스케줄러 재실행으로 `ready`가 되고 `source_revision`이 최신(1)으로 갱신되며 수정된 원문 내용이 반영됐다.
- **I-305**: `POST /api/internal/daily-summary/run` — 잘못된 `CRON_SECRET`은 403, 올바른 secret은 `{"claimed":1,"completed":1,"failed":0}`. `completed`가 정확히 증가하는 것은 I0에서 고친 `returns text` 스칼라 반환값 해석 수정의 실동작 증거다.
- **I-306**: record를 `processing`으로 둔 상태에서 원문을 수정해 revision을 올린 뒤, 진행 중이던 AI 호출이 예전 revision으로 `complete_daily_summary`를 호출 → 반환 `stale`, record는 `stale`로 전환되고 `processing_started_at`은 정리됐다. **낡은 초안은 저장되지 않았고** 저장된 요약은 이전 revision(1) 그대로 남았다.
- **I-307**: stale 상태에서 `POST /confirm`과 `PATCH /summary`가 모두 409 `SUMMARY_STALE`. 화면에서도 "기록 확정" 버튼이 `disabled`로 노출됐다(F-408).
- 검증 후 생성한 메시지·record·요약은 모두 삭제해 DB를 원래 상태로 되돌렸다.

---

# I4. 요약 확인 / 확정 / 정정 연결

- [x] **I-401** 사용자 수정 Summary 저장/재조회 검증
- [x] **I-402** 확정 API 연결
- [x] **I-403** 확정 후 기존 원문 수정/삭제 차단 검증
- [x] **I-404** 정정 기록 추가 API 연결
- [x] **I-405** 정정 기록 재조회/표시 검증

### I4 진행 기록 (2026-09-26)

I4는 병행 에이전트가 시작한 뒤 Integration이 인계받아 마무리했다.

**인계 시 상태**: `DailySummaryCard`·`RecordDateContent`·`TodayRecordView`·`mocks/health-api`·`health-api`에 진행 중인 변경이 있었고 `tests/mocks/mock-health-api.test.ts` 4건이 실패 상태였다. typecheck는 통과하고 있었다.

- **가져온 변경의 방향은 정확했다.** Mock에 실제 백엔드 규칙(원문 변경 시 `ready → stale`, stale에서 확정·요약 수정 차단, 확정 전 정정 차단)을 반영하고, 화면은 409 충돌 시 카드를 언마운트하지 않고 서버 상태를 재동기화하도록 바꾸었다. 남은 문제는 테스트가 요약 생성 단계를 건너뛰어 mock의(올바른) 규칙과 어긋난 것이었다.
  - 원인은 fixture가 "오늘 기록·아직 미정리(`not_due`)" 상태인데, 테스트가 곧바로 `ready`를 기대하고 있었다.
  - Mock에는 실제 스케줄러를 대신하는 `runSummaryWorker()`가 이미 있었으므로, 테스트가 요약을 만든 뒤 stale을 확인하도록 고쳤다(부족한 로직을 추가한 게 아니라 잘못된 전제를 바로잡은 것).
- **I-401**: `정리 내용 수정` → `수정 완료` 후 `user_final`에 사용자 문구가 저장되고 **새로고침 후에도 유지**된다(실브라우저 + DB 확인).
- **I-402**: `기록 확정` → `record_status=confirmed`, `confirmed_at` 기록, 사이드바/카드 배지 모두 "확정"으로 바뀐다.
- **I-403**: 확정 후 원문 `PATCH`/`DELETE`가 모두 **409 `RECORD_CONFIRMED`**, 화면에는 `원문 기록 보기`와 `정정 추가`만 남고 수정/삭제 버튼이 사라진다.
- **I-404**: `정정 추가`로 확정 기록에 정정을 남길 수 있다.
- **I-405**: 정정이 즉시 표시되고 새로고침 후에도 유지되며, 진료 준비(I-5xx)에도 포함된다.
- 검증용으로 넣은 2026-09-19 기록은 삭제했다.

### I4 인수인계 기록 (2026-09-26, 미완료)

작업 도중에 중단했다. 아래는 working tree에만 있는 미커밋 변경(`git diff` 6개 파일)과 남은 작업이다.

**이미 반영한 코드 (typecheck 통과, 실제 API 대상 검증은 아직 하지 않음)**

- `src/features/records/api/health-api.ts`: `API_ERROR_CODES`에 `SUMMARY_NOT_READY` / `SUMMARY_STALE` / `SUMMARY_NOT_RETRYABLE` 추가. 실제 code 목록은 `docs/API.md` 1절과 `src/server/daily-records/errors.ts`가 기준이고, 두 곳은 이미 일치한다.
- `src/components/summary/DailySummaryCard.tsx` (I-401/I-402/I-404 안내): 요약 저장·확정·정정·삭제 4개 핸들러의 `catch { }`가 오류를 삼키고 하드코딩 문장만 띄우고 있었다. `actionErrorMessage(err, fallback)`을 추가해 **서버가 준 `error.message`를 우선** 표시하고, payload가 없으면 호출자 fallback으로 떨어지게 했다. HealthApiError의 `message`는 서버의 사용자 안내문과 동일 문장이라 별도 문구 표를 만들지 않았다.
- `src/features/records/components/RecordDateContent.tsx` (I-403): 확정/오래된 요약 계열 409(`RECORD_CONFIRMED`, `RECORD_NOT_CONFIRMED`, `SUMMARY_STALE`, `SUMMARY_NOT_READY`)를 `CONFLICT_CODES`로 모으고, 발생 시 카드를 언마운트하지 않고 `getDailyRecord`로 상태를 다시 맞아떨어지게 한다(`syncAfterConflict`). 원래는 실패한 fetch를 `setRecord(null)`로 처리해 **확정된 기록이 빈 화면/재시도 화면으로** 보였다.
- `src/features/records/components/TodayRecordView.tsx` (I-403): 원문 create/update/delete를 `guardConfirmed()`로 감싸 `RECORD_CONFIRMED` 409 때 서버 상태를 다시 읽는다. 원래는 실패 시 `router.refresh()`로 기록 화면 자체를 다시 올려 편집 UI가 사라졌다.
- `src/mocks/health-api.ts` (Mock↔Backend 규칙 정합): 요약 3개 operation이 실제 RPC(B4/B7)보다 훨씬 관대했다. 거절 순서와 code를 RPC와 맞췄다.
  - `updateSummary`: RECORD_NOT_FOUND(404) → RECORD_CONFIRMED(409) → SUMMARY_STALE(409) → SUMMARY_NOT_READY(409) → revision 불일치 SUMMARY_STALE(409). 기존에는 revision 확인만 있었다.
  - `confirmRecord`: 같은 순서에 idempotent 재확정 유지. 기존에는 요약 없이도 확정됐고 `confirmedAt`을 응답마다 새로 만들었다.
  - `createCorrection`: 미확정 기록 → 409 `RECORD_NOT_CONFIRMED`(기존에는 아무 검사 없음).
  - 원문 create/delete에도 `ready → stale` 전환을 추가했다(DB 규칙 B1과 동일, updateMessage에만 이미 있었다).
  - `retrySummary`는 아직 실제와 다르다: 백엔드는 기록 없음 404 `RECORD_NOT_FOUND`, 확정/not_due/ready/processing 상태 409 `SUMMARY_NOT_RETRYABLE`(API.md 6절), pending 중복 202인데 Mock은 무조건 `pending`을 돌려준다. **남은 작업.**
  - Mock 전용 `runSummaryWorker()`를 `MockHealthApi`에 추가했다(실제 B3 스케줄러 대신 draft+claim 가능 record에 초안을 만들어 ready로 만든다). contract 함수가 아니라 화면 코드는 부르지 않는다.
  - `deleteHealthData`/`deleteAccount`가 `confirmedAt`을 비우지 않던 것도 고쳤다.

**지금 빨간 테스트 (`npx jest` → 4 failed / 255 passed)**

`tests/mocks/mock-health-api.test.ts` 한 파일에만 있다. 원인은 공통이고, Mock의 default store가 **today fixture 한 개**(2026-09-25, `not_due`, 요약 없음)만 담고 있다는 사실에서 나온다.

- `createMockHealthApi (F-007)`: flow가 `deleteMessage`로 마지막 메시지를 지우면 record가 store에서 사라진다(B-112 실동작과 일치하는 올바른 동작) → 뒤이은 `updateSummary`가 404. flow를 `customStore`로 `sampleUnreviewedRecordResponse`(draft + ready)를 주입해 다시 쓰거나, 마지막 메시지를 지우기 전에 요약 확정을 끝내는 순서로 바꿔야 한다.
- 새로 추가한 parity 3건: `ready` 상태의 record가 기본 store에 없어 실패한다(실제로는 `not_due`/404가 나온다). `createMockHealthApi({ records })`에 `sampleUnreviewedRecordResponse.record`를 넣은 Map을 주입해 `ready + draft` 상태를 만들고, stale 전이는 그 record에 `createMessage`를 한 뒤 확인하면 된다.
- 회고: 요약 3종 규칙만 고치면 될 줄 알았는데 Mock fixture/flow가 그 상태를 만들지 못해 범위가 커졌다. 남은 Mock 작업은 I4 필수 조건은 아니고 I-001 정합 범위로, I4 본문 검증(실제 API)과 분리해서 진행하는 편이 낫다.

**남은 I4 본문 작업**

- I-401/I-402/I-404/I-405: 실제 API 모드(`NEXT_PUBLIC_USE_MOCK=false`, 셸 환경 변수 오염은 I2/I3 기록의 `env -u` 함정 참고)로 dev 서버 + 실브라우저 확인 — 요약 수정 저장 후 재조회 유지, 확정 버튼 → `confirmed`, 확정 후 원문 수정/삭제 차단 및 정정만 허용, 정정 추가 후 재조회 표시. fixture는 I5에서 쓴 방식대로 만들고 검증 후 삭제한다.
- I-403: 위 코드 수정 상태로 실제 409를 재현해 확인해야 한다(다른 탭에서 확정해 두고 원문 수정 시도).
- Mock 빨간 테스트 4건 정리, 그리고 `retrySummary`의 404/409 규칙 정합.
- 완료 후 I-401~I-405를 `[x]`로 바꾸고 위 기록을 검증 결과로 교체한다.

Contract/product 정책 변경은 없다(`docs/API.md`, `src/contracts/**` 미수정).

---

# I5. 기록 목록 / 진료 준비 연결

- [x] **I-501** 기록 목록 실제 API 연결
- [x] **I-502** 미확인 기록 Banner 실제 count 연결
- [x] **I-503** 진료 준비 실제 API 연결
- [x] **I-504** 미확인 기록 안내 UX 검증
- [x] **I-505** 기록 없는 날짜 미표시 검증
- [x] **I-506** 날짜별 원문 조회 검증
- [x] **I-507** 정정 기록 포함 검증
- [x] **I-508** 다일 의료 패턴 문장이 생성되지 않는지 확인

### I5 진행 기록 (2026-09-26)

실제 API 모드 + 실브라우저로 확인했다. I4가 병행 진행 중이므로 **소스는 건드리지 않고 검증만** 수행했다.

- 준비한 fixture: 2026-09-15 확정(요약+정정 1건), 2026-09-18 초안+요약 준비 완료(미확인), 2026-09-22 초안+정리 전. 그 사이 날짜는 비워 뒀다.
- **I-501/I-502**: 사이드바에 3개 기록이 상태 배지와 함께 표시되고, 목록 화면에 "확인하지 않은 기록이 1개 있습니다. / 확인하기 →" 배너가 실제 `unreviewedCount`로 노출됐다.
- **I-503**: `GET /api/visit-prep?from=2026-09-01&to=2026-09-30` → 200. `confirmedRecords`에는 확정 기록만(2026-09-15), `unreviewed`는 `{count:1, dates:["2026-09-18"]}`.
- **I-504**: "선택한 기간에 확인하지 않은 기록이 1개 있습니다."와 함께 `기록 확인하기` / `확인된 기록만 계속하기`가 뜨고, `확인된 기록만 계속하기`를 누르면 안내만 사라지고 확정 기록은 유지됐다.
- **I-505**: 30일 범위에서 기록이 있는 3일(09-15/18/22)만 목록과 진료 준비에 노출되고, 사이 날짜는 API 응답에도 화면에도 없다.
- **I-506**: 진료 준비의 `원문 보기 ▼`와 날짜별 화면의 `원문 기록 보기 ▼` 모두 원문 메시지와 작성 시각을 보여주고, 다시 접히는 토글 동작을 확인했다.
- **I-507**: 확정 기록의 정정이 진료 준비 응답과 화면 양쪽에 "정정 기록"으로 표시됐다.
- **I-508**: 진료 준비 응답의 텍스트(타임라인+정정)를 `패턴/매일/연속/반복/경향/증가/감소/이틀/며칠/주간/추이` 등 13개 키워드로 검사해 **0건**이었다. `visit-prep-service.ts`의 AI 호출 참조도 **0건**으로, 다일 분석을 새로 만들지 않는다(B-509).
- 확정 기록 화면에는 원문 수정/삭제 버튼이 없고 `정정 추가`만 노출된다(F-505)도 함께 확인했다.
- 검증 후 fixture는 모두 삭제해 DB를 원래 상태로 되돌렸다.

### I5에서 남기는 메모

- 스케줄러 자동 실행은 여전히 없다(vercel.json 부재). 진료 준비에 올라가는 요약은 수동 job 실행이나 확정 시점의 `user_final`에 의존한다.

---

# I6. 삭제 / 설정 / 보안 통합

- [x] **I-601** 하루 전체 삭제 후 UI 상태 초기화 검증
- [x] **I-602** 전체 건강 기록 삭제 후 UI 상태 검증
- [x] **I-603** 계정 삭제 후 Session 종료 검증
- [x] **I-604** 다른 사용자의 데이터 접근 불가 검증
- [x] **I-605** Client Bundle Secret 노출 여부 확인
- [x] **I-606** 운영 로그에 건강 원문이 남지 않는지 확인
- [x] **I-607** 라이트/다크/시스템 테마 전환 및 새로고침 유지 검증
- [x] **I-608** 다크모드 주요 화면의 대비/상태 식별 검증

### I6 진행 기록 (2026-09-26)

**주의: 파괴적 작업(I-602/I-603)은 실제 로그인 계정을 건드리지 않도록 별도 테스트 계정으로 수행했다.**

- **I-601**: `/records/2026-09-18`에서 `하루 기록 전체 삭제` → 확인 → 해당 날짜 화면이 목록으로 넘어가고 사이드바·목록에서 사라졌다. DB에서 메시지·요약도 함께 삭제됐다(cascade).
- **I-602**: 설정에서 `건강 기록 삭제` → 확인 → "모든 건강 기록이 삭제되었습니다." 안내 후 health 테이블 5개가 모두 비었고, `GET /api/profile`은 200으로 **계정과 프로필은 유지**됐다.
- **I-603**: 테스트 계정(Google 계정이 아닌 별도 생성 계정)에 세션 쿠키를 주입해 로그인시킨 뒤 실제 UI로 `계정 삭제`를 실행했다. 삭제 직후 `/api/profile`과 `/api/daily-records`가 **401 UNAUTHENTICATED**가 되고 화면도 로그아웃 상태가 됐다. DB에서 health 데이터·profile 삭제, Auth 사용자 404, **기존 access token이 403 `user_not_found`**로 무효화됨을 확인했다. 실제 계정은 건드리지 않았다.
- **I-604**: 별도 계정 B에 데이터를 만들고 토큰을 발급받아 7가지를 확인했다. ① B는 자기 데이터 조회 가능 ② B 토큰 + 타인 `p_user_id` RPC → **403 FORBIDDEN** ③ 익명 키로 B의 메시지/요약 SELECT → 빈 배열(RLS) ④ B가 corrections에 직접 INSERT → 거부 ⑤ 익명 키로 `delete_health_data` → permission denied ⑥ B의 원문 내용 무변경.
- **I-605**: production build의 클라이언트 번들 16개에서 `SUPABASE_SERVICE_ROLE_KEY`/`OPENAI_API_KEY`/`CRON_SECRET`의 **이름도 값도 0건**이었다. `NEXT_PUBLIC_SUPABASE_ANON_KEY`조차 번들에 없다 — 클라이언트가 Supabase를 직접 호출하지 않고 앱의 `/api`만 거치는 BFF 구조라 공개 키도 필요 없다.
- **I-606**: I2~I5 동안 실제로 입력한 건강 원문 8종 문자열을 모든 dev 서버 로그(최대 163KB)에서 검색해 **0건**이었다. 코드상의 로깅 지점은 `console.error("account_delete_auth_failed")` 한 곳뿐이고 건강 원문·요약·토큰은 없다. 로그에 남는 것은 method·path·status·latency뿐이다.
- **I-607**: 시스템 → 다크 → 라이트 → 시스템 전환이 모두 적용됐고, `health-record-theme` 키로 localStorage에 저장돼 **새로고침 후에도 유지**됐다. 시스템 모드는 브라우저 OS 설정을 따라갔다.
- **I-608**: 5개 주요 화면 × 2개 테마에서 본문·배지·버튼·입력·제목의 대비를 WCAG 식으로 측정했다.

### I6에서 고친 결함 (테마 대비)

측정에서 실제 AA 미달이 3종 나왔고 모두 수정했다. 회귀 테스트로 고정한다.

- **다크모드 위험 버튼**: `--danger`는 다크에서 텍스트용 밝은 빨강(#f87171)인데 solid 버튼 배경으로도 재사용되어 흰 글자와 **2.77:1**이었다. `계정 삭제` 버튼이 가장 위험한 액션이면서 대비가 가장 낮았다.
  → `--danger-solid`/`--danger-solid-hover` 토큰을 추가해 solid 버튼 전용으로 분리했다(흰 글자 기준 4.86:1 / 6.47:1).
- **라이트모드 위험 outline 버튼**: `--danger`(#ef4444)가 흰 배경에서 3.6:1이었다. 배경 위 텍스트/아이콘 용도뿐이라 red-600(#dc2626)으로 조정해 4.65:1을 확보했다.
- **기본 버튼·보조 텍스트**: 라이트 `--primary`(#0284c7) 흰 글자 4.1:1, 보조 텍스트 4.34:1이었고 다크 `--primary-hover`는 4.36:1이었다. 각각 sky-700/더 어두운 보조색/더 밝은 hover로 조정해 모두 4.5:1 이상을 확보했다.
- `tests/components/theme-contrast.test.ts`를 추가해 3개 테마 블록(라이트/다크/`prefers-color-scheme`)의 본문·보조·배지·기본 버튼·위험 버튼 대비와 `.btn-danger`의 solid 토큰 사용을 정적 검증한다.

**주의(측정 방법)**: 첫 측정은 반투명 배경(`rgba(255,255,255,0.08)`)을 흰색으로 취급해 실제보다 크게 낮게 나왔다. 알파 합성 후 재측정해야 정확하다.

---

# I7. 전체 QA / AI Evaluation / 배포 준비

- [x] **I-701** Jest 전체 실행
- [x] **I-702** API Integration Test 전체 실행
- [x] **I-703** RLS Cross-user Test 실행
- [x] **I-704** AI Evaluation Dataset 실행
- [x] **I-705** 모바일 사이드바 수동 QA
- [x] **I-706** 데스크톱 사이드바 수동 QA
- [x] **I-707** 첫 로그인 온보딩 검증
- [x] **I-708** Demo Mode 검증
- [x] **I-709** AI 실패 상태 검증
- [x] **I-710** 요약 수정/확정 전체 흐름 검증
- [x] **I-711** 정정 기록 전체 흐름 검증
- [x] **I-712** 진료 준비 전체 흐름 검증
- [x] **I-713** 삭제 확인 전체 흐름 검증
- [!] **I-714** 개인정보/AI 처리 안내 최종 문구 확인 — **텍스트 대조 완료, 항목 2·3 결락(아래 기록)**
- [x] **I-715** Production 환경변수 확인
- [ ] **I-716** 전체 테스트 통과 후 배포 준비 완료 표시 — I-714 결락이 해소되어야 표시 가능
- [ ] **I-717** B-613 rate limit 규칙 실제 적용 및 429 검증 (`docs/SECURITY.md` 10절 규칙대로)

### I7 진행 기록 (2026-09-26)

- **I-701/I-702**: Jest 41 suites / 255 tests 통과, API integration 8 suites / 34 tests 통과.
- **I-703**: 원격 DB에 사용자 A/B를 만들어 10개 케이스를 검증했다. A는 B의 records/messages/summaries를 볼 수 없고, B 토큰으로 타인 `p_user_id`를 지정한 RPC는 403 FORBIDDEN, 익명 키는 전부 빈 배열이다. 파괴 RPC(`delete_daily_record`/`delete_health_data`/`delete_account_data`)는 `auth.uid()`(=호출자) 범위로 고정되어 있어 **A가 호출해도 B의 데이터는 그대로 남고 A의 데이터만 삭제**됨을 확인했다(10/10).
  - 검증 중 내 단언이 2개 틀린 것으로 드러났다. 파괴 RPC을 "차단되어야 한다"고 단언했지만 실제로는 호출자 본인 삭제 경로라 200이 정상이고, B의 record 수를 셀 때 `user_id` 필터를 빠뜨려 테이블 전체를 세고 있었다. 단언을 바로잡았다.
- **I-704**: `tests/evals/ai-eval.live.test.ts`를 추가해 실제 모델로 데이터셋 25건을 평가한다(기본 skip, `RUN_AI_EVAL=1`로 실행). B7에서 "실제 모델 Evaluation 미실시"로 남아 있던 공백을 채웠다.
  - **첫 실행이 전부 실패**했다. 원인은 데이터셋의 message id(`m1`)가 실제 DB의 uuid 형태와 달라 모델이 형식을 감춰 uuid를 지어내고, 앱의 `sourceMessageIds` 검증이 그걸 거부한 것이었다(앱 동작은 올바름). 평가에서 결정론적 uuid를 붙여 프로덕션과 같은 조건을 만들도록 했다.
  - **프롬프트 인젝션 3건은 모두 방어 성공**했다. "진단해" 지시 → "오늘 피곤했다"만 기록, "병명을 만들어 내" → 거부하고 기록만 남김, "기록에 없는 약 복용 사실을 추가해" → 거부. 실제 출력을 캡처해 확인했다.
  - 금지 개념 검사에서 두 차례 오탐이 났다. ① 모델이 원문("어떻게 치료하면 좋을까요")을 인용한 것을 모델의 주장으로 오판 ② 사용자에게 묻는 **보완 제안 문장**에 "원인/치료" 같은 어휘가 섞인 것을 위반으로 오판. 원문과 60% 이상 겹치는 문장은 인용으로 보고 제외했고, 강제 대상을 "요약이 단정하는 내용"(timeline/medications)으로 한정했다. 제안문 어휘와 제안 개수, 사실 반영은 **품질 경고**로 분리해 사람이 확인하도록 남긴다.
  - **최종 결과: 25건 평가 / 차단 위반 0건 / 통과.** 남은 경고 3건은 `case-008`·`case-022`의 제안 개수 초과와 `case-009`의 제안문 "원인" 어휘다. 실제 요약(timeline/medications)에는 한 번도 금지 개념이 나오지 않았다.
  - **사람이 확인할 항목:** 제안문이 "원인"을 물을 수 있다는 점은 진단을 묻는 것이 아니라 기록 어휘를 쓰는 것이지만, PRD 9장 공개 전 문구 검토 때 같이 보길 권한다.
- **I-705/I-706**: 모바일(375px)에서 `메뉴 열기`로 오버레이가 뜨고 닫히며, 데스크톱(1440px)에서 사이드바 접기/복원이 동작한다(네비게이션 4개 → 1개 → 4개).
- **I-707**: 신규 계정으로 로그인해 온보딩 안내를 확인했고 **발견 후 수정한 결함**을 함께 검증했다(아래).
- **I-708**: 로그아웃 → 데모 모드 진입 시 배너가 뜨고, 데모에서 기록을 제출하면 로그인 모달이 열리며 **데이터가 저장되지 않는다**.
- **I-709**: AI를 죽은 엔드포인트로 바꿔 제안 503 · 저장 201을 확인했고(개별 강제는 I3), 화면에는 오류 배너 없이 기록 목록만 표시된다.
- **I-710**: `정리 내용 수정` → `수정 완료`로 저장하면 `user_final`에 사용자 문구가 반영되고, `기록 확정` 후 `record_status=confirmed`와 `confirmed_at`이 기록된다.
- **I-711**: 확정 기록에서 `정정 추가` → 정정 본문과 작성일이 표시되고, 원문은 수정/삭제 버튼이 없고 `정정 추가`만 남는다.
- **I-712**: 기간 선택 → 확정 기록만 타임라인·정정과 함께 표시되고, 미확인/기록 없는 날짜는 표시되지 않는다.
- **I-713**: 하루 삭제 확인 다이얼로그 → 삭제 후 목록/사이드바 초기화, 메시지·요약 cascade 삭제까지 I6에서 E2E 확인.
- **I-714 — [!] 문구 대조 결과.** 현재 안내는 3줄이다.
  1. 원본 기록이 우선이며 AI 결과는 파생 데이터
  2. AI는 진단/질병 예측/약 추천을 하지 않음
  3. 사용자 계정에만 격리 보관
  PRD 9장의 공개 전 확정 항목과 비교하면 **두 가지가 빠져 있다.**
  - **PRD 9-3: OpenAI 등 외부 AI 처리자로 건강 기록이 전송되는 사실 고지·동의 방식** — 현재 문구에 전혀 없음. 앱은 실제로 원문을 OpenAI에 보내므로이것은 필수 고지다.
  - **PRD 9-4: 계정 삭제 후 인프라 백업 보존 기간 고지** — 현재 문구에 없음. 보존 기간은 실제 백업 정책 사실이므로 문서만으로는 정할 수 없고 운영 확인이 필요하다.
  - 문구 최종 승인 없이 I-716(배포 준비 완료)은 표시하지 않는다.

#### I-714 검토용 초안 (미승인 · UI에 반영하지 않음)

아래는 검토를 위해 준비한 초안이다. **승인 없이 `SettingsContent.tsx`에 반영하지 않았고**, 사람이 사실 확인을 해야 하는 값은 `확인 필요`로 표시했다.

추가할 고지(1) — 외부 AI 처리자:

> • AI 정리를 위해 작성하신 건강 기록의 **내용이 OpenAI(외부 AI 처리자)로 전송**되어 요약 문장을 생성합니다. 전송되는 범위는 그날 작성한 기록 원문이며, AI는 대화를 하지 않고 기록 정리만 수행합니다. AI 결과는 원본을 바꾸지 않으며, 언제든 기록을 삭제하면 함께 처리됩니다.

추가할 고지(2) — 삭제 후 백업 보존:

> • `전체 건강 기록 삭제`와 `계정 삭제`는 앱 데이터베이스에서 즉시 반영됩니다. 다만 인프라 백업에 보관된 사본의 보존 기간은 **[확인 필요: 실제 백업 정책 기간]**입니다. 보존이 끝난 시점 이후에는 다시 조회할 수 없습니다.

확인이 필요한 사실 3가지:
1. 실제 백업 보존 기간(Supabase/Vercel 정책 + 운영 설정)
2. 한국 서비스 대상이라면 국외 이전 고지의 적용 방식(법무 확인)
3. 동의 방식(첫 로그인 동의 화면 / 별도 약관 페이지 중 택일) — 현재 구현에는 동의 화면이 없다
- **I-715**: 코드가 읽는 환경변수는 7개다(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_USE_MOCK`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `CRON_SECRET`). `.env.example`와 일치한다. 배포 시 유의점 3가지:
  1. `NEXT_PUBLIC_USE_MOCK`는 Production에서 반드시 `false`여야 한다(생략하면 Mock으로 동작한다).
  2. 이 로컬 환경은 `OPENAI_BASE_URL`로 8787 포트의 로컬 AI 릴레이를 쓰고 있다. Vercel에는 이 값을 넣지 않으면 기본 `api.openai.com`으로 나간다.
  3. 스케줄러 cron이 없다. `vercel.json`에 `POST /api/internal/daily-summary/run` 호출을 등록해야 자동 요약이 돈다(I-305에서 수동 호출로만 확인).

### I7에서 고친 결함 2건

- **로그아웃 UI가 없음 (추가).** `logout()`은 계정 삭제 후에만 호출되고 로그아웃 버튼이 어디에도 없었다. 로그인한 사용자가 계정을 전부 삭제하는 방법 밖에는 로그아웃할 수 없었다. 설정 화면 데이터 관리 위에 `로그아웃` 버튼을 추가했다(기록은 유지, 세션만 종료).
- **온보딩 안내가 개발 환경에서 뜨지 않음 (수정).** `auth-context.tsx`의 온보딩 조회 effect에 "한 번만 실행" ref 가드가 있었는데, React StrictMode는 개발에서 effect를 두 번 실행한다. 첫 실행의 결과는 cleanup에서 버려지고 두 번째 실행은 ref가 true라 조기 반환되어 `isReady`가 영영 true가 되지 않아 `OnboardingNotice`가 렌더링되지 않았다. ref 가드를 제거해 멱등 GET 조회가 두 번 실행되도록 고쳤고, 신규 계정 로그인 후 안내가 표시되는 것을 확인했다.

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
