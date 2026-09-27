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

**I-003 — 완료 (B-613 결정 완료).** B-001~B-612와 B-614~B-711이 `[x]`다. B-613은 Vercel Firewall로 적용하며 규칙은 `docs/SECURITY.md` 10절에 확정했다. 2026-09-27에 WAF 규칙 12개를 게시했고, 실제 429 검증은 배포 후 I-717에서 한다. 백엔드 구현 완료에 영향이 없다.

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

### I4 인수인계 기록 (2026-09-26 작성 → 2026-09-27 마감)

작성 시점에 작업 도중 중단해 아래와 같이 미완료로 남겼었다. **2026-09-27에 아래 항목을 모두 정리했다.**

**마감 내역**

- I-401~I-405 실제 API 검증: 위 `I4 진행 기록`의 결과를 이미 반영하고 있다. 이 문서에서 `[x]`로 마감된 상태다.
- `tests/mocks/mock-health-api.test.ts` 빨간 4건: 해소. 현재 `npx jest`는 모음 포함 전부 통과한다.
- `retrySummary`의 404/409 정합: **완료(2026-09-27)**. 아래 "재사용 노트"의 마지막 항목을 구현했다.

**재사용 노트(당시 상태 기록 — 더 이상 사실이 아니다)**

이 절의 아래 항목들은 2026-09-26 중간의 상태다. Mock↔Backend 정합을 다시 손볼 때 참고만 하고, 현재 규칙의 근거는 `docs/API.md` 9절과 B7 `retry_daily_summary` 마이그레이션이다.

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
  - `retrySummary`는 당시 실제와 달랐다: 백엔드는 기록 없음 404 `RECORD_NOT_FOUND`, 확정/not_due/ready/processing 상태 409 `SUMMARY_NOT_RETRYABLE`(API.md 9절), pending 중복 202인데 Mock은 무조건 `pending`을 돌려준다. **→ 2026-09-27에 반영 완료.**
  - Mock 전용 `runSummaryWorker()`를 `MockHealthApi`에 추가했다(실제 B3 스케줄러 대신 draft+claim 가능 record에 초안을 만들어 ready로 만든다). contract 함수가 아니라 화면 코드는 부르지 않는다.
  - `deleteHealthData`/`deleteAccount`가 `confirmedAt`을 비우지 않던 것도 고쳤다.

**당시 빨간 테스트 (`npx jest` → 4 failed / 255 passed) — 2026-09-27에 해소**

`tests/mocks/mock-health-api.test.ts` 한 파일에만 있었다. 원인은 공통이고, Mock의 default store가 **today fixture 한 개**(2026-09-25, `not_due`, 요약 없음)만 담고 있다는 사실에서 나왔다.

- `createMockHealthApi (F-007)`: flow가 `deleteMessage`로 마지막 메시지를 지우면 record가 store에서 사라진다(B-112 실동작과 일치하는 올바른 동작) → 뒤이은 `updateSummary`가 404. flow를 `customStore`로 `sampleUnreviewedRecordResponse`(draft + ready)를 주입해 다시 쓰거나, 마지막 메시지를 지우기 전에 요약 확정을 끝내는 순서로 바꿔야 한다.
- 새로 추가한 parity 3건: `ready` 상태의 record가 기본 store에 없어 실패한다(실제로는 `not_due`/404가 나온다). `createMockHealthApi({ records })`에 `sampleUnreviewedRecordResponse.record`를 넣은 Map을 주입해 `ready + draft` 상태를 만들고, stale 전이는 그 record에 `createMessage`를 한 뒤 확인하면 된다.
- 회고: 요약 3종 규칙만 고치면 될 줄 알았는데 Mock fixture/flow가 그 상태를 만들지 못해 범위가 커졌다. 남은 Mock 작업은 I4 필수 조건은 아니고 I-001 정합 범위로, I4 본문 검증(실제 API)과 분리해서 진행하는 편이 낫다.

**남은 I4 본문 작업 — 2026-09-26에 모두 완료(위 `I4 진행 기록` 참조)**

- I-401/I-402/I-404/I-405: 실제 API 모드(`NEXT_PUBLIC_USE_MOCK=false`, 셸 환경 변수 오염은 I2/I3 기록의 `env -u` 함정 참고)로 dev 서버 + 실브라우저에서 확인했다. 검증 후 fixture는 삭제했다.
- I-403: 확정 후 실제 409 `RECORD_CONFIRMED`를 재현해 확인했다.
- Mock 빨간 테스트 4건 정리, `retrySummary`의 404/409 규칙 정합까지 완료.
- I-401~I-405는 `[x]`로 마감했고 이 기록은 검증 결과로 교체했다.

**2026-09-27 추가 정합(문서에 `[x]`로 남아 있던 마지막 코드 차이)**

- `retrySummary` Mock 정합: `docs/API.md` 9절과 B7 `retry_daily_summary` RPC를 그대로 따라 404 `RECORD_NOT_FOUND`(기록 없음) → 409 `SUMMARY_NOT_RETRYABLE`(확정/`not_due`/`processing`/`ready`) → 그 외 `pending` 되돌림 순서로 거절하도록 고쳤다. 재시도는 `content_revision`을 건드리지 않는다.
  - `RETRYABLE_SUMMARY_STATUSES`(failed/stale/pending) 상수를 두고, 실제 RPC의 `summary_status not in ('failed','stale','pending')` 조건과 1:1로 대응시켰다.
  - 기존 F-007 통합 flow 테스트는 기본 fixture가 `not_due`라 곧바로 재시도하면 실패하므로, `runSummaryWorker()` → `createMessage`(stale) → 재시도 순서로 고쳤다.
  - 회귀 테스트 7건 추가(`tests/mocks/mock-health-api.test.ts`): 404 / `not_due` 409 / `ready` 409 / 확정 409 / stale→pending과 revision 불변 / pending 중복 호출 / 오류 code·message.

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

- 스케줄러 자동 실행은 **2026-09-27 기준 해결**(`vercel.json`의 `crons`에 `POST/GET /api/internal/daily-summary/run`이 `0 * * * *`로 등록됨, 커밋 `b80ff4a`). 이 메모를 읽을 당시에는 `vercel.json`이 없었다. 배포 전까지 요약은 수동 job 실행이나 확정 시점의 `user_final`에 의존한다.

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
- [x] **I-714** 개인정보/AI 처리 안내 문구 — **완료(2026-09-27).** 고지 문구 승인 + OpenAI 정책 근거 확인(v1→v2 재동의 실사용자 검증) + 서버 측 기록 작성 강제(B10/B11)까지 마감
- [x] **I-715** Production 환경변수 — 7/7 등록, `OPENAI_API_KEY` Production 등록 확인(값 비노출)
- [x] **I-716** Vercel Production 배포 및 실제 계정 smoke — Google OAuth→v2 동의 저장→기록 생성과 테스트 데이터 정리를 2026-09-27에 확인했다. Vercel 배포 범위는 완료. 백업 복구와 email/password 회원가입 정책은 별도 전체 출시 작업이다.
- [x] **I-717** B-613 rate limit — Firewall 활성화와 12개 유효 규칙, 실제 429 및 본문을 확인함 (`docs/SECURITY.md` 10절)
- [~] **I-718** Supabase Free 백업 — Vercel Blob 비공개 저장소(`icn1`, 서울)와 30일 보존을 승인받아 구현했다. Blob·DB URL secret은 등록됐지만 DB URL이 TLS 사전 검증을 통과하지 못했다. 실제 암호화 백업 업로드·별도 Free 프로젝트 복구 리허설이 남았다. 백업 일정은 값 수정 전까지 꺼 두며 Vercel Production 배포와 별개다.

### I-718 진행 기록 (2026-09-27)

- `scripts/backup/supabase-backup.sh`가 PostgreSQL 17 `pg_dump` 한 번으로 `public.*`, `auth.users`, `auth.identities`의 일관된 데이터 snapshot을 만든다. Auth session/refresh token 등은 백업하지 않아 복구 뒤 사용자가 다시 로그인해야 한다.
- archive manifest에 schema migrations를 제공하는 Git commit SHA를 기록한다. 복구 스크립트는 그 commit checkout과 빈 복구 프로젝트를 확인한 뒤, 해당 migrations를 새 Supabase 프로젝트에 적용하고 data를 불러온다. RLS 6개 테이블, Auth 생성 trigger, retry RPC, Auth FK 참조를 검증한다.
- `.github/workflows/supabase-backup.yml`은 매일 18:00 UTC(한국 03:00)에 실행되며 `SUPABASE_BACKUP_ENABLED=true`일 때만 schedule을 활성화한다. 수동 실행도 같은 변수가 `true`가 아니면 dump·upload·30일 삭제 전에 실패한다. GitHub Actions에는 `contents: read`만 부여하고, age로 암호화된 파일만 Vercel Blob 비공개 저장소에 전송한다.
- 새 암호화 백업의 업로드와 크기를 확인한 뒤 전용 pathname 규칙에 해당하는 백업 중 30일이 지난 항목만 삭제한다. workflow artifact나 공개 repository에는 dump를 저장하지 않는다.
- age 개인 키는 로컬 `~/.config/health-record/backup-age-identity.txt`에 권한 `600`으로 생성했고, 공개 수신자 `AGE_RECIPIENT`만 GitHub repository variable에 등록했다. 개인 키는 GitHub에 두지 않는다.
- **사용자 결정(2026-09-27):** Cloudflare는 사용하지 않는다. Vercel Blob private store `health-record-supabase-backups`, region `icn1`(서울), 30일 보존을 승인했다. store는 생성됐고 private 설정이다. `BLOB_READ_WRITE_TOKEN`은 GitHub Actions repository secret에 등록하고 Vercel Preview 환경변수에서는 제거했다. Vercel Production 환경에는 넣지 않았다. 개인정보 안내 문구 변경은 사용자가 별도 검토하기로 한 범위라 아직 수정하지 않았다.
- GitHub repository variable `AGE_RECIPIENT`는 이미 등록돼 있다. `SUPABASE_DB_URL` secret은 존재하지만 workflow가 요구하는 `sslmode=require`, `sslmode=verify-ca`, `sslmode=verify-full` 중 하나가 확인되지 않았다. 검증 동안 `SUPABASE_BACKUP_ENABLED=false`로 두며 DB 연결 URL은 저장소에 기록하지 않는다.
- Vercel Blob은 사용량 기반으로 청구되며 플랜별 포함량을 넘으면 비용이 발생할 수 있다. 실제 덤프 크기를 확인한 뒤 Vercel usage에서 확인한다([Vercel Blob 가격](https://vercel.com/docs/vercel-blob/usage-and-pricing)).
- synthetic PostgreSQL source/restore rehearsal에서 `auth.users`, `auth.identities`, profile, daily record, message, summary, suggestion, correction 데이터를 같은 dump로 복원했다. 복원 후 Auth 트리거가 중복 profile을 만들지 않는 것도 확인했다.
- **검증 기록 (2026-09-27):** `SUPABASE_DB_URL` secret이 09:29 UTC에 갱신된 뒤 실행한 Actions run `36309606194`도 `Check backup configuration` 단계에서 `SUPABASE_DB_URL must enable TLS`로 중단됐다. DB 접속·dump·Blob 업로드·삭제 단계는 실행되지 않았다. `SUPABASE_BACKUP_ENABLED`는 `false`로 두었다. Secret 값 자체는 읽거나 출력하지 않았다. 이전 동일 검증 실패: `36308665590`, `36308828931`, `36309138544`, `36309400175`.
- **남은 운영 gate:** `SUPABASE_DB_URL` secret에 TLS 연결 옵션을 반영해 사전 검증을 통과시킨 뒤 Production 암호화 백업 1건 업로드·목록 확인, 새 빈 Supabase Free 프로젝트로 복구해 Auth 사용자·앱 데이터·RLS·trigger를 검증한다. 개인정보 안내에 30일 보존과 저장 위치를 반영하는 작업은 별도 보류다. 따라서 I-718은 완료 처리하지 않는다. 이 작업은 Vercel 배포에 필요하지 않다.

### I-716 배포 확인 (2026-09-27)

- Commit `124f18b`를 공개 GitHub `main`에 push했고 Vercel Production 배포 `dpl_C41xz95VDcrMRRkYnMwwtEUDjkkn`이 `Ready`가 됐다.
- `https://health-record-one.vercel.app/`, `/onboarding/health-consent`, `/settings/privacy`가 각각 HTTP 200을 반환한다. DB에는 B9-B11이 이미 적용돼 있다.
- 당시 익명 GET에서는 페이지 route만 확인했다. 실제 계정 연속 흐름은 아래 2026-09-27 smoke에서 별도 검증했다.

### I-716 실제 계정 OAuth·동의·기록 smoke (2026-09-27)

- 첫 Production OAuth 시도는 `localhost:3000/today`로 돌아왔다. Supabase Auth URL Configuration의 Site URL이 `http://localhost:3000`이고 허용 목록에 로컬 callback만 있는 것을 확인했다. Site URL을 `https://health-record-one.vercel.app`으로 변경하고 `https://health-record-one.vercel.app/api/auth/callback`을 추가했으며 로컬 callback은 유지했다. 저장 후 Dashboard를 새로고침해 두 설정을 확인했다.
- 사용자가 Google 계정을 직접 선택한 뒤 Production `/api/profile`과 오늘 기록 목록 조회가 각각 200이었다. 동의 저장 전 `consentVersion`은 비어 있었고, 오늘 기록은 0건이었다.
- Production 동의 화면에서 필수 체크와 저장을 진행했다. 이후 `/api/profile`이 `consentVersion: 2026-09-27-v2`를 반환했다.
- 오늘 기록 화면에서 실제 건강 상태가 아닌 고유 테스트 문구를 입력해 메시지 저장을 확인했다. 상세 조회는 200, 기록은 `draft`, revision 1, 테스트 메시지 1개였다.
- 해당 메시지 ID만 DELETE해 204를 확인했다. 정리 후 오늘 목록은 0건, 상세 조회는 404였고, 프로필의 동의 버전은 v2로 유지됐다. 계정 이메일과 테스트 문구 원문은 저장소 문서에 기록하지 않았다.
- **Vercel 배포 범위의 I-716은 완료다.** 실제 OAuth·동의·기록 흐름을 통과했다. I-718 백업 복구와 email/password 회원가입 정책은 별도의 전체 출시 판단으로 남아 있다.

### 남은 3건 처리 결과 (2026-09-26 당시 기록)

※ 아래는 2026-09-26 시점의 기록이다. 현재 Vercel/Supabase 상태는 뒤의 **2026-09-27 실계정 후속 점검**을 기준으로 한다.
※ 아래 동의 구현 보류 문구도 당시 스냅샷이며, 이후 상태는 이 문서의 I-714 진행 기록을 따른다.

**I-714 — 결락 고지 2건을 UI에 반영했다.**
- AI 정리를 위해 기록이 OpenAI로 전송된다는 사실을 고지에 추가했다(앱이 실제로 전송하므로 필수).
- 삭제 시 DB에는 즉시 반영되나 백업 사본은 정책 기간 동안 남을 수 있다는 사실을 추가했다.
- **보존 기간 숫자는 넣지 않았다.** 운영 백업 정책 확인 전의 구체적 기간은 검증되지 않은 사실이 된다. `tests/components/privacy-notice.test.ts`가 숫자 주입을 막는다.
- 남은 것은 사람이 읽고 승인하는 것뿐이다. 특히 **동의 화면이 구현에 없다는 점**은 별도 결정이 필요하다(첫 로그인 동의 화면 또는 약관 페이지 중 택일).

**I-717 — 프로젝트는 만들었으나 규칙 적용은 완료하지 못했다.**
- Vercel `exifio-4593s-projects`(Pro)에 `health-record` 프로젝트를 생성했다(배포하지 않음, 공개되지 않으며 `vercel project rm`으로 되돌릴 수 있다).
- Firewall API 접근은 확인했고, 경로 조건(`type: path`, `op: pre`)과 `action.mitigate.action: "rate_limit"` 형태의 규칙은 등록된다(`valid: true`까지 확인).
- **그러나 한도 값(requests/window)을 넣을 자리를 API 스키마에서 찾지 못했다.** `rateLimit`은 규칙·조건·설정 어디에도 허용되지 않고, 한도 없는 규칙은 실제 제한을 걸지 못한다. 그러므로 **"적용 완료"로 두지 않고 Firewall 설정을 원래대로 되돌렸다**(비활성 + 규칙 0건).
- 남은 방법: Vercel 대시보드 Security → Firewall에서 직접 rate limit 규칙을 추가하거나(경로별 requests/분 입력), 또는 최신 API 문서에서 한도 필드명을 확인해야 한다.
- 429 검증은 어차피 **배포 후 실제 트래픽이 있어야** 가능하므로 배포와 함께 처리한다.

**I-716 — 아직 표시하지 않는다.** 선행 조건 3개:
1. 위 I-714 문구의 사용자 승인
2. Vercel 배포 및 환경변수 7개 설정
3. I-717 rate limit 규칙 실제 적용

**보안 주의(당시):** Vercel CLI 토큰 파일과 셸 히스토리를 확인해야 했다. 2026-09-27 재확인 결과 `/tmp/vercel-token.txt`는 없고, zsh history에 해당 파일명·Vercel API host·Firewall 명령이 남아 있지 않았다.

### 2026-09-27 재확인 — 코드 없이 닫을 수 있는 항목 처리 (당시 기록)

※ 이 기록 후 Vercel/Supabase 실계정과 다시 대조했다. 최신 결과는 아래 **실계정 후속 점검**이다.

**레거시 테이블은 원격에 없다 → drop 마이그레이션이 불필요하다.**

- `BACKEND_TASKS.md` B0 노트가 "남은 보안 advisor 경고는 레거시 `conversations`/`messages`/`daily_health_records` 정책 관련 항목"이라고 남겼지만, 2026-09-27 실측 결과 **세 테이블 모두 원격 `health` 프로젝트에 존재하지 않는다.**
  - 확인 방법: `.env.local`의 service role 키로 `GET /rest/v1/{table}?select=*&limit=1` → 3종 모두 `PGRST205 Could not find the table 'public.X' in the schema cache`. anon(공개) 키로도 동일하게 404여서 익명 노출 가능성도 없다.
  - 반면 앱이 쓰는 6개 테이블(`profiles`/`daily_records`/`record_messages`/`daily_summaries`/`record_suggestions`/`corrections`)은 모두 200으로 확인했다.
  - `supabase/migrations/`에도 이 테이블을 만드는 마이그레이션이 없다. 따라서 **파괴적 drop 마이그레이션을 추가하지 않았다.** advisor 경고가 남는다면 다른 원인이므로, 배포 전 Supabase Dashboard → Advisors에서 실제 항목을 다시 확인해야 한다(CLI/Dashboard 접근 없이 advisor 목록은 조회 불가).

**당시 미결 항목 (2026-09-27 재확인 시점, 이후 갱신됨):** 아래 동의/UI 대기 내용은 I-714 진행 기록으로 종결·갱신됐다.

1. **I-714 문구 승인** — UI 반영은 끝났으므로 사람이 읽고 승인하면 된다. 백업 보존 기간 숫자는 운영 확인 전까지 넣지 않는다.
2. **동의 화면** — 구현에 없다(코드 전체에 동의 화면/컴포넌트 0건). `profiles.consent_version`/`consented_at` 컬럼은 B0에서 "PRD 9.3 결정 전까지 보존"으로 남겨뒀다. 첫 로그인 동의 화면과 약관 페이지는 AGENTS §3(범위 확장 금지)과 PRD 9.3이 충돌하므로 **임의 구현하지 않고 결정만 남긴다.**
3. **배포와 rate limit(I-716/I-717)** — Vercel 배포, 환경변수 7개, Firewall 규칙 적용, 429 검증.

**참고(I-717 재시도 시):** 이번에 Vercel 문서 URL을 다시 조회했으나 관련 페이지가 404를 반환해 한도 필드명을 문서로 확정하지 못했다. API 대신 **대시보드 Security → Firewall → rate limit 규칙에서 경로별 requests/분 값을 직접 입력**하는 경로를 사용하면 된다(`docs/SECURITY.md` 10절의 표가 그대로 입력값이 된다).

**이번 세션의 코드 변경:** `src/mocks/health-api.ts`의 `retrySummary` 정합 + 회귀 테스트 7건(I4 인수인계 마지막 항목). 그 외 미커밋 변경은 2026-09-27 F1 작업분이다.

### 2026-09-27 실계정 후속 점검 — 당시 확인 내용

※ 이 시점 뒤에 동의 구현과 Production 배포 상태가 다시 바뀌었다. 현재 상태는 상단 I-716/I-718 체크리스트와 이후 I-714 진행 기록을 기준으로 한다.

- **I-714 / 개인정보 및 백업:** 사용자는 Supabase Free 유지를 선택했다. 현재 공식 문서상 Free에는 포함된 자동 백업과 대시보드 다운로드가 없으며, 별도 FAQ는 Free 프로젝트에도 현재 최대 7개의 일일 백업이 생성되어 유료 플랜으로 올린 뒤 제공될 수 있지만 향후 중단될 수 있다고 안내한다. Supabase는 Free 프로젝트에 정기 `db dump`와 off-site 백업을 권한다. 이 프로젝트의 실제 백업 존재/보존은 확인하지 않았고 별도 백업 대상도 정하지 않았다. 따라서 UI 문구 최종 승인, 실제 복구 경로/보존 정책 결정, PRD 9-3 동의 방식 결정이 남아 있어 기간 숫자를 추가하지 않았다([백업 안내](https://supabase.com/docs/guides/platform/backups), [Free 프로젝트 FAQ](https://supabase.com/docs/guides/troubleshooting/will-backups-be-accessible-from-the-dashboard-immediately-after-upgrading-to-a-paid-plan-hXY4rs)).
- **Supabase Free 백업 권장안 (제안, 미적용):** Free를 유지하면서 매일 GitHub Actions가 DB 백업을 생성하고, 클라이언트 측 암호화 후 별도 비공개 object storage로 직접 업로드한다. 후보는 Cloudflare R2 Standard다(현재 월 10 GB-month 무료 범위, 초과 시 종량 과금; [가격](https://developers.cloudflare.com/r2/pricing/)). R2의 APAC 위치 힌트는 최선 노력일 뿐 보장된 데이터 지역이 아니며, 보장된 jurisdiction 목록에 한국은 없다([데이터 위치](https://developers.cloudflare.com/r2/reference/data-location/)). 저장 사업자/위치에 대한 개인정보·국외 이전 검토 전에는 버킷을 만들지 않는다. 보존 기간은 **초기 권고 30일**이며, 사용자가 승인하기 전에는 lifecycle 삭제 규칙과 개인정보 문구에 반영하지 않는다. 이 기간에는 앱에서 삭제한 데이터 사본도 백업 만료까지 남을 수 있다. 백업이 매일 정상 완료된다는 전제에서 복구 지점은 최대 약 24시간 전까지다.
- **백업 보안/완료 조건:** 저장소가 public이므로 건강 원문·덤프를 Git commit, release, workflow artifact 또는 로그에 남기지 않는다. Actions에는 DB 연결 문자열과 업로드 권한만 secret으로 두고, 복호화 개인 키는 별도로 오프라인 보관한다. 실패 알림을 설정하고, 암호화 파일 업로드 및 삭제 주기를 확인한 뒤 복구 리허설을 한다.
- **Auth 데이터 범위 주의:** 기본 `supabase db dump`는 Supabase 관리 스키마인 `auth`와 `storage`를 제외한다([CLI 레퍼런스](https://supabase.com/docs/reference/cli/supabase-db-dump)). 그런데 이 앱의 `profiles.id`와 `daily_records.user_id`는 `auth.users.id`를 참조한다. 따라서 일반 스키마/데이터 dump만으로 완료 처리하지 않는다. Supabase가 안내하는 Auth schema export/import 경로를 별도로 포함하고, 별도 Free 프로젝트에서 user ID, 관련 앱 데이터, 로그인 재인증, RLS와 trigger를 복구하는 절차를 확인해야 한다. Auth 덤프도 건강 데이터와 같은 수준으로 암호화·접근 제한한다([CLI 백업/복구](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [Auth 사용자 마이그레이션](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)).
- **인증 보안:** 원격 Auth 설정은 email과 Google이 모두 켜져 있고 `disable_signup=false`다. `auth_leaked_password_protection` Advisor 경고가 남아 있으며 현재 Free 플랜에서는 해당 보호 설정을 사용할 수 없다([Supabase 문서](https://supabase.com/docs/guides/auth/password-security)). 인증 제공자를 변경하거나 유료 플랜으로 올리지는 않았다. Advisor의 `SECURITY DEFINER` 경고 10건은 함수별로 확인했다: 전부 빈 `search_path`, `auth.uid()` 검증, authenticated 실행 허용, anon 실행 거부가 적용돼 있다. Performance Advisor 경고는 없었다.
- **I-715 / Vercel Production:** Production 변수 7개를 등록했다: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_USE_MOCK=false`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `CRON_SECRET`. `OPENAI_API_KEY`는 Production 대상의 sensitive 변수로 존재하며 값은 읽거나 출력하지 않았다. 배포 `health-record-nou1g1j12-exifio-4593s-projects.vercel.app`은 `READY`/Production이다. `vercel crons list`에서 `/api/internal/daily-summary/run`의 `0 * * * *` 등록을 확인했고, Production runtime log에 18:00:02 UTC의 GET 200이 있다. 시각은 Cron 일정과 일치하지만 응답 내용/처리 건수는 읽지 않았으며, 기록 요약 생성 자체를 검증한 것은 아니다.
- **I-717 / Firewall:** 처음 조회했을 때 12개 rate-limit 규칙은 active/valid였지만 프로젝트의 `firewallEnabled`가 `false`라 실제 적용되지 않았다. 기존 규칙·조건·값을 보존해 Firewall만 켰고, Vercel overview에서 `Enabled`, 12 active 규칙을 다시 확인했다. 내부 스케줄러 GET을 같은 60초 동안 5회 호출한 결과 1~4회는 앱의 무인증 `403`, 5회째는 WAF `429`였다. 429 본문은 비어 있지 않은 75바이트 `text/plain`이며 검사한 health 관련 문자열은 없었다. 4회/분 내부 규칙은 실측했고, 나머지 11개 한도는 실제로 초과 호출하지 않고 active/valid 설정만 확인했다. 카운터는 region별이어서 전역 quota가 아니다(`docs/SECURITY.md` 10절).
- **배포 게이트(실계정 재확인 당시):** 배포 `READY`, 7개 환경변수, scheduler GET 200, WAF 429를 확인했지만 그 시점에는 I-714 문구·동의 흐름·백업 복구와 인증 구성이 결정 대기였다. 이후 I-714/I-716은 마감했고, R2 제안은 사용하지 않기로 했다. 백업 대상·지역·보존 기간은 상단 I-718 기록의 최신 결정(Vercel Blob private `icn1`, 30일)을 따른다. email/password 회원가입 정책은 별도 출시 결정으로 남아 있다.

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

#### I-714 검토용 초안 (2026-09-26 작성 → 2026-09-27에 UI 반영됨)

아래 초안은 검토용으로 준비했고, **같은 날 `SettingsContent.tsx`에 반영했다**(위 "남은 3건 처리 결과" 참조). `tests/components/privacy-notice.test.ts`가 반영 상태를 고정한다. 사람이 사실 확인을 해야 하는 값만 `확인 필요`로 남겼다.

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
     - **→ 2026-09-27 정정:** 이미 등록되어 있다(커밋 `b80ff4a`). Vercel Cron은 GET으로 호출하고 `CRON_SECRET`이 설정돼 있으면 `Authorization: Bearer $CRON_SECRET`를 붙이므로, route의 GET/POST 분기(`src/app/api/internal/daily-summary/run/route.ts`)가 이 형식에 맞춰져 있다. 남은 건 배포 후 cron이 실제로 한 번 도는지 확인하는 것뿐이다.

### I-714 진행 기록 (2026-09-27) — 민감정보 동의 A안

**진행 결정: 전용 동의 페이지를 기록 시작 시 요구한다.** 초기 결정 기록에는 첫 로그인 온보딩(A안)으로 적었지만, 최종 구현은 로그인·설정 탐색은 유지하고 `requestRecordStart()`에서 동의 상태를 확인한다. 이에 따라 실제 사용자 경로는 첫 기록 작성 시 미동의자를 전용 페이지로 보낸다.

- **마이그레이션 `20260927090000_b9_sensitive_info_consent.sql`.** `profiles`에 `consent_version` text / `consented_at` timestamptz 추가. B0 마이그레이션이 "PRD 9.3 결정 전까지 보존"으로 남겨둔 컬럼이다. RLS·grant는 B0 policies를 그대로 쓴다(신규 컬럼이라 정책 변경 없음). 원격 `health` 프로젝트에 적용했고 `supabase_migrations.schema_migrations`에 11번째로 기록했다.
- **Contract (`src/contracts`).** `ProfileResponse`가 `consentVersion`을 노출한다. 현재 `CURRENT_CONSENT_VERSION = "2026-09-27-v2"`다 — **고지 문구를 바꾸면 이 값을 새 마이그레이션의 요구 버전과 함께 올려야 하고**, 이미 동의한 계정은 저장된 값과 달라져 자동으로 다시 동의 화면이 뜬다.
- **`reason` 규칙(오인 방지).** `PATCH /api/profile`는 `consentVersion`을 `reason: "consent"`일 때만 저장한다. reason 없이 보내도 `"onboarding"`으로 보내도 저장되지 않는다. 온보딩 완료가 동의로 오인되면 **고지 없이 민감정보가 나가므로** 강제하는 지점은 서버 한 곳으로 모았다. 실제로 쓸 값이 하나도 없으면 `UPDATE` 자체를 보내지 않는다. `docs/API.md` 15절과 `docs/DATABASE.md` 2절에 반영했다.
- **UI — 최종형(3차): 로그인 모달(인증) + 전용 동의 페이지(동의).** 같은 날 형태를 세 번 바꿨고, 판단 근거를 남긴다.
  1. **1차(폐기):** 「건강 기록 시작하기」 단일 모달 2단계. `LoginModal`에 `step` prop을 두고 Google OAuth의 `window.location.replace()` 전체 이동으로 깨진 흐름을 sessionStorage intent로 메웠다. **동의 상태를 클라이언트 storage에 두게 되어** PRD 9-3의 핵심 원칙(서버 DB가 단일 기준)을 약화시킨다고 판단해 폐기. `ConsentStep.tsx`, `StartFlowModal.tsx` 삭제.
  2. **2차(폐기):** 로그인 모달(인증) + 오늘 기록 화면 인라인 동의 카드. `ConsentCard.tsx`를 만들었다. 오늘 기록이 이미 무거운 화면인데 동의까지 얹히면 기록 기능에 집중하기 어렵고, 요구사항 9(오늘 기록은 기능 중심으로 단순하게)가 충족되지 않았다. 삭제.
  3. **3차(현재):** 로그인 모달은 **인증만**. 동의는 전용 full page `/onboarding/health-consent`에서 받는다. 오늘 기록에서 인라인 동의 UI를 완전히 제거했다.
     - **왜 페이지인가:** 모달이 아니므로 주소가 있어 공유·인쇄가 되고 동의 사실을 문서로 남길 수 있다. 모바일에서 중앙 팝업이 아니라 자연스러운 full page onboarding이 되고, 데스크톱은 `max-width: 44rem`으로 본문이 늘어나지 않는다.
     - **동의는 「기록」을 누른 순간에만 요구한다.** `requestRecordStart()`가 판정한다: 비로그인 → 로그인 모달(기록 시작 플로우 표시) / 로그인+미동의 → 동의 페이지로 `router.push` / 로그인+동의 → 진행.
     - **단순 로그인으로 자동 이동하지 않는다(요구사항 12).** `openLoginModal`(설정·데모 배너)은 `startFlowNext`를 비우고, `requestRecordStart`만 `CONSENT_PATH`를 채운다. OAuth `next`는 이 값이 있을 때만 붙는다.
     - **이미 동의한 계정은 재요청하지 않는다** — 재방문·새로고침·재로그인·다른 기기 모두. 서버 DB 값만 본다. 고지 문구를 바꾸려면 `CURRENT_CONSENT_VERSION`과 새 마이그레이션의 SQL 문자열을 **둘 다** 올려야 한다(하나만 올리면 조용히 차단된다 — 테스트로 고정).
     - **저장 실패 시 이동하지 않는다.** 카드에 오류를 남기고 재시도하게 한다. 실패한 채 이동하면 이력 없는 상태로 기록 화면에 도착한다.
     - **모바일.** 480px 이하에서 액션 버튼을 세로로 쌓고(`column-reverse`, 주 버튼이 위) 각 44px 터지 확보. 고지 글자 14px.
- **서버 측 강제 (B10, 10절).** 클라이언트 버튼 비활성화만으로는 API 직접 호출로 우회할 수 있어, **원문을 새로 만드는 함수 안에서** 동의를 확인한다.
  - 대상은 `create_record_message`(기록 작성)와 `create_record_correction`(정정 추가) 2개. 둘 다 사용자 원문이므로 함께 막는다.
  - **조회·삭제·수정은 열어 둔다.** 동의 거부 상태에서도 사용자는 자기 데이터를 지울 수 있어야 한다("돌아가기"로 빠져나갈 수 있어야 하므로). 설계 판단이다.
  - `CONSENT_REQUIRED` → 403으로 매핑하고, 클라이언트는 이 코드로 동의 페이지로 보낸다. 서버가 버전을 모르면 조용히 막힌 것처럼 보이므로, 오류 발생 시 `onboarding/health-consent`으로 보낸다.
  - **주의(적용 중 발견):** B10 작성 시 `create_record_correction` 정의를 B4에서 복사했다가 **B7이 `security definer` + `auth.uid()` 소유권 검증으로 바꿔둔 것을 놓칠 뻔했다.** 그대로 적용하면 소유권 검증이 사라져 타인 기록에 접근할 수 있었다. 배포 전 DB의 `prosecdef`를 조회해 확인했고, 정의에서 `--` 주석을 제외한 `security definer` 2개 + `auth.uid() 소유권 검증` 2개를 테스트로 고정했다.
  - 마이그레이션 `20260927110000_b10_enforce_health_consent.sql`, 원격 `health` 프로젝트에 적용(12번째), `schema_migrations` 기록.
- **OAuth 복귀 (8절).** `next`는 **네비게이션 의도만**이다. 동의 여부·건강 기록은 담지 않는다. `/api/auth/google?next=…` → `redirectTo`에 심어 전달 → `/api/auth/callback`가 allowlist로 최종 검증 후 307. allowlist는 `/onboarding/health-consent` 하나뿐이고, 그 외 값(`https://evil.example`, `//evil.example`, `/settings`, 경로 조작)은 전부 `/today`로 떨어뜨린다. open redirect 회귀 테스트 4건 포함.
- **회귀 테스트.** `tests/components/consent-flow.test.ts`(22건): 전용 페이지 존재/모달 아님·로그인 모달에 동의 없음·오늘 기록에 동의 UI 0(ConsentCard/canWrite/needsConsent 모두 없음)·기록 시작 시에만 이동·단순 로그인은 이동 안 함·storage에 동의 상태 없음·요구된 제목/설명/항목·상세 페이지 재사용+상세 페이지에 동의 UI 없음·체크 전 disabled+[필수] 표기·"나중에" 없음·저장 실패 시 이동 안 함·이미 동의 재요청 없음·비로그인 직접 URL·B10의 CONSENT_REQUIRED 2개·DB 버전 문자열 = `CURRENT_CONSENT_VERSION`·B9 컬럼 재사용(중복 컬럼 없음)·차단 대상이 삭제 경로를 포함하지 않음·security definer/소유권 검증 유지. `tests/api/google-oauth.test.ts`에 next 전달·allowlist 통과·open redirect 4건 추가. `tests/server/profile-service.test.ts`·`tests/api/profile.test.ts`는 서버 `reason` 규칙, `tests/features/{auth-and-demo,frontend-qa}.test.ts`는 컴포저 가드.
- **실사용자 검증(테스트 계정).** 미동의 상태로 `POST /api/daily-records/:date/messages` 직접 호출 → **403 `CONSENT_REQUIRED`**, DB에 record/message **0건**(우회 차단 확인) → 동의 저장 200 → 재호출 **201 저장**, `record_messages`에 실제로 들어감 → 테스트 계정 삭제 후 record/message 모두 0건, 기존 실사용자 계정은 미동의 상태 그대로 유지.
- **Mock 정합.** `updateProfile`이 서버와 같은 `reason` 규칙을 따르고, fixture에 `consentVersion`을 넣었다. 계정 삭제 시 `consentVersion: null`로 되돌린다(AGENTS §9: Mock과 실제 API 형태 일치).
- **실사용자 검증(테스트 계정).**
- **회귀 테스트.** `tests/components/consent-flow.test.ts`(신규 10건: 카드 분리·"나중에"로 닫기·체크 전 시작 불가·저장 실패 시 닫지 않음·온보딩≠동의·성공 후에만 인정·재동의 안 뜸·고지 문구·보존 기간 숫자 금지 + Contract 2건), `tests/server/profile-service.test.ts`(동의 저장·reason 없는 consentVersion 무시·`"onboarding"` 무시·빈 patch 무 UPDATE), `tests/api/profile.test.ts`(reason 통과). 기존 profile 테스트는 새 필드에 맞춰 갱신했다.
- **실사용자 검증(테스트 계정).** 신규 계정 → `GET /api/profile` `{onboardingCompleted:false, consentVersion:null}` → reason 없이 `consentVersion`만 PATCH → **저장되지 않음(null 유지)** → `reason:"consent"`로 PATCH → 200 저장 → 재조회 일치 → DB에서 `consent_version`/`consented_at` 확인. 검증 뒤 테스트 계정은 삭제했다(기존 실사용자 계정은 미동의 상태 그대로 유지).

### I-714 종결 (2026-09-27) — 남은 2건 처리

**① 고지 문구 최종 승인 — 완료(사용자 승인).** 사용자가 2026-09-27에 문구를 승인했다.

**② "학습에 사용되지 않습니다"의 정책 근거 — 확인 완료.** OpenAI 공식 문서로 실측했다. 출처: [Data controls in the OpenAI platform](https://developers.openai.com/api/docs/guides/your-data) (2026-09-27 확인).

| 항목 | 공식 문구 | 이 앱 |
|---|---|---|
| API 데이터의 학습 사용 | "data sent to the OpenAI API is **not used to train or improve** OpenAI models (unless you explicitly opt in)" | 해당 |
| 엔드포인트별 학습 사용 | `/v1/chat/completions` → **No** | `chat.completions.parse`를 쓴다(`src/server/ai/daily-summary.ts`, `suggestions.ts`) |
| 악용 모니터링 보관 | "retained for **up to 30 days**, unless longer retention is required by law, or is reasonably necessary to protect our services" | 30일 |

→ **문구가 틀리지 않았고, 오히려 불필요하게 모호했다.** "일정 기간"이라고만 적어 검증된 숫자를 놓치고 있었다. 이 저장소 규칙은 "보관 기간 숫자를 **지어내지 않는다**"이므로 출처가 있는 값은 써야 한다. 두 화면(`/settings/privacy`의 AI 처리 섹션, `/onboarding/health-consent`의 보관 항목)에 **"최대 30일까지" + 공식 문서 링크**를 넣었다.

- **동의 버전 v1 → v2.** 문구가 바뀌었으므로 `CURRENT_CONSENT_VERSION`을 올렸다. 이전 문구에 동의한 계정을 새 문구에 동의한 것으로 취급하지 않기 위해서다. DB 쪽은 이미 적용된 마이그레이션을 고치지 않고 **B11**(`20260927120000`)을 새로 추가해 두 함수의 요구 버전을 교체했다. `schema_migrations` 13번째.
- **재동의가 실제로 동작함을 실사용자 세션으로 검증했다.** v1로 동의한 계정 → 기록 작성 **403 `CONSENT_REQUIRED`**(버전이 달라져 무효) → v2로 재동의 → 기록 작성 **201**. 프로필 판정값도 v2로 전환. 테스트 계정 삭제 후 record/message 0건.
- **두 값이 어긋나면 사용자가 조용히 차단된다.** 그래서 `tests/components/consent-flow.test.ts`가 "마지막 마이그레이션의 요구 버전 = `CURRENT_CONSENT_VERSION`"을 고정한다. 앞으로 문구를 바꾸면 **① `CURRENT_CONSENT_VERSION` ② 새 마이그레이션으로 DB 요구 버전 교체** 둘 다 해야 한다.

**서버 측 기록 작성 차단 — 넣었다(B10).** 앞서 "별도 결정"으로 남겨 뒀던 것을 이번에 implements 했다. 미동의 계정은 `create_record_message`/`create_record_correction`이 `CONSENT_REQUIRED`로 거절한다. 조회·수정·삭제는 열어 뒀다(동의 거부 상태에서도 자기 데이터를 지울 수 있어야 한다).

**I-714는 `[x]`로 마감한다.**

### I7에서 고친 결함 2건

- **로그아웃 UI가 없음 (추가).** `logout()`은 계정 삭제 후에만 호출되고 로그아웃 버튼이 어디에도 없었다. 로그인한 사용자가 계정을 전부 삭제하는 방법 밖에는 로그아웃할 수 없었다. 설정 화면 데이터 관리 위에 `로그아웃` 버튼을 추가했다(기록은 유지, 세션만 종료).
  - **후속 수정(사용자 보고):** 버튼을 추가한 뒤 "작동이 안 된다"는 제게가 들어왔다. 확인 결과 API는 정상(204 → 이후 401)이고 로그인 상태에서는 동작했다. 실제로 문제가 된 것은 두 가지였다. ① **로그인하지 않은 상태(익명/데모)에서도 버튼이 노출**되어 눌러도 화면이 그대로여서 고장처럼 보였다 ② 성공 시 홈으로 이동해 **성공 사실을 확인할 수 없었다**.
  - 로그인 상태가 아니면 버튼 대신 "현재 로그인한 계정이 없습니다" 안내를 보여주고, 로그아웃 후에는 현재 화면에 "로그아웃되었습니다."를 남기도록 바꿨다. `tests/components/logout-control.test.ts`로 고정했다.
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
