# BACKEND_TASKS — 백엔드 개발 작업

이 문서는 **Backend AI 전용 작업 목록**입니다.
Frontend 구현을 기다리지 않고 `docs/API.md`, `docs/DATABASE.md`, `src/contracts/**`를 기준으로 실제 DB/API를 개발합니다.

## 상태 표기

- `[ ]` 대기
- `[~]` 진행 중
- `[x]` 완료
- `[!]` 막힘 / 추가 결정 필요

## 수정 가능 영역

```text
src/app/api/**
src/server/**
src/lib/supabase/server*
supabase/migrations/**
```

Frontend UI와 `src/contracts/**`는 임의로 수정하지 않습니다.

---

# B0. 백엔드 기반 / 인증

- [x] **B-001** Supabase 프로젝트 연결
- [x] **B-002** 서버용 Supabase Client 구성
- [x] **B-003** Google OAuth 연결
- [x] **B-004** 서버 세션 Helper 구현
- [x] **B-005** `profiles` Migration 작성
- [x] **B-006** 최초 로그인 profile 생성 흐름 구현
- [x] **B-007** `profiles` RLS 적용
- [x] **B-008** 서버 공통 Error Model 구현
- [x] **B-009** API Runtime Validation 기본 구조 구현

`profiles`에는 사용자 timezone 설정값을 저장하지 않습니다.

### B0 진행 기록

- 실브라우저 성공 확인: `/api/auth/google` → Supabase/Google 동의 → 앱 `/` 복귀 후, 보호된 `GET /api/daily-records?from=2099-01-01&to=2099-01-01`이 `{"items":[],"unreviewedCount":0}`을 반환했다. 같은 경로의 비로그인 요청은 `401 UNAUTHENTICATED`였으므로 OAuth callback의 서버 세션 교환과 쿠키 인증을 확인했다.
- Dashboard 및 OAuth 확인: 제공된 Dashboard에서 Site URL과 `http://localhost:3000/api/auth/callback` allowlist, Google Cloud에서 `http://localhost:3000` origin과 Supabase `/auth/v1/callback` redirect URI를 확인했다. 실제 authorize 요청이 해당 Google Client ID를 사용했고 callback 후 보호 API 인증에 성공해 OAuth credential 교환을 확인했다.
- 프로젝트는 `health-record`가 삭제되고 `health`(ref: `jleboocxejidigclepxt`)로 연결을 변경함.
- 환경 변수: `.env.local`에 프로젝트 URL, publishable key, `SUPABASE_SERVICE_ROLE_KEY` 기록.
- `profiles`의 레거시 `timezone` 컬럼은 제거했고, `consent_version`/`consented_at`은 PRD 9.3(동의 고지 방식) 결정 전까지 보존했다.
- RLS 실측(익명 사용자 2개로 검증 후 삭제): 본인 row SELECT 가능, 타인 row SELECT 불가, 본인 INSERT 불가(서버 trigger만 생성), 타인 UPDATE는 행을 바꾸지 않음.
- 남은 보안 advisor 경고는 레거시 `conversations`/`messages`/`daily_health_records` 정책 관련 항목이며 B1/B6 범위다.

---

# B1. 일일 기록 / 메시지 API

- [x] **B-101** `daily_records` Migration 작성
- [x] **B-102** `record_messages` Migration 작성
- [x] **B-103** `UNIQUE(user_id, local_date)` 적용
- [x] **B-104** 필요한 Index 적용
- [x] **B-105** 기록 관련 RLS 적용
- [x] **B-106** 기록 조회 API 구현
- [x] **B-107** 메시지 생성 API 구현
- [x] **B-108** 메시지 수정 API 구현
- [x] **B-109** 메시지 삭제 API 구현
- [x] **B-110** 원문 변경 시 `content_revision` 증가 처리
- [x] **B-111** 확정된 기록의 메시지 변경 차단
- [x] **B-112** 빈 draft 정리 정책 구현
- [x] **B-113** 시스템 시간대 metadata IANA timezone 검증
- [x] **B-114** 새 daily record 생성 시 `timezone_at_creation` snapshot 저장
- [x] **B-115** `local_date`를 생성 이후 재계산하지 않는 규칙 구현
- [x] **B-116** 사용자 간 RLS 격리 테스트
- [x] **B-117** 기록 API Unit / Integration Test 작성

시간대 원칙:
- 사용자가 timezone을 설정하지 않음
- 클라이언트가 기기/브라우저에서 자동 감지한 IANA timezone을 전달
- 서버는 값을 검증하고 daily record 생성 시 내부 snapshot으로만 저장
- 기존 기록의 날짜를 현재 timezone에 맞춰 재분류하지 않음

### B1 진행 기록

- 기록 없는 날짜의 과거 message 생성 허용 여부는 `docs/API.md` 5절에 `추가 결정 필요`로 남아 있어 미구현했다.
- B-113: `src/contracts`의 `SystemTimeZoneSchema`(`Intl.DateTimeFormat`으로 IANA 검증)를 그대로 적용해 `timezone_at_creation`에 검증된 값만 저장한다.
- 마이그레이션을 `health` 프로젝트에 push 완료함.
- `daily-record-service.test.ts`와 `daily-records.test.ts` 17개 테스트 통과함.
- 마이그레이션을 `health` 프로젝트에 push 완료함.
- `daily-record-service.test.ts`와 `daily-records.test.ts` 17개 테스트 통과함.
- 마이그레이션을 `health` 프로젝트에 push 완료함.
- `daily-record-service.test.ts`와 `daily-records.test.ts` 17개 테스트 통과함.

---

# B2. 추가 기록 제안 AI

- [x] **B-201** OpenAI 서버 전용 Client 구현
- [x] **B-202** 모델명 환경설정 분리
- [x] **B-203** Structured Output Schema 구현
- [x] **B-204** 추가 기록 제안 Prompt 작성
- [x] **B-205** 최대 2~3개 제안 규칙 적용
- [x] **B-206** 충분한 기록에는 제안을 생성하지 않는 규칙 적용
- [x] **B-207** 제안 API 구현
- [x] **B-208** AI 실패가 원문 저장에 영향을 주지 않는지 테스트

### B2 진행 기록

- OpenAI Client는 제안 생성 시점에 생성하며, `OPENAI_MODEL`을 사용한다. 설정 키가 없으면 API 요청이 안전한 503으로 실패한다.
- 제안 출력은 Zod Structured Output으로 검증하고, 사용자 원문은 system 지시와 분리해 전달한다. 최대 3개와 충분한 기록에는 빈 제안을 반환하는 규칙을 적용했다.
- 제안 API는 로그인 사용자의 draft record만 조회하며, AI 실패는 별도 503으로 반환한다. 원문 저장 API와 분리된 동작을 API 테스트로 확인했다.
- `npm test -- --runInBand`: 20 suites / 113 tests 통과. `npm run typecheck`, `npm run lint`, `git diff --check` 통과.
- 테스트는 OpenAI SDK를 mock 처리했다. 실제 모델 호출과 AI 품질 Evaluation은 수행하지 않았다.

---

# B3. 자동 일일 요약

- [x] **B-301** `daily_summaries` Migration 작성
- [x] **B-302** `record_suggestions` Migration 작성 (B2 Migration에 포함됨)
- [x] **B-303** 요약 상태 필드 적용 (B1 Migration에 포함됨)
- [x] **B-304** `processing_started_at` 적용 (B1 Migration에 포함됨)
- [x] **B-305** 자동 정리용 내부 Endpoint 구현
- [x] **B-306** Scheduler 인증 구현
- [x] **B-307** `timezone_at_creation` 기준으로 local day 종료 여부 판정
- [x] **B-308** 동일 기록 중복 처리 방지 Atomic Claim 구현
- [x] **B-309** 실패/중단 작업 Retry 및 Recovery 처리
- [x] **B-310** `summarizeDailyRecord()` 구현
- [x] **B-311** 결과에 `sourceMessageIds` 연결
- [x] **B-312** 진단/원인 추정/치료 추천 금지 Prompt 적용
- [x] **B-313** Structured Output Runtime Validation 적용
- [x] **B-314** `prompt_version` 저장
- [x] **B-315** 사용 모델 정보 저장
- [x] **B-316** AI 호출 전후 Source Revision 재검사
- [x] **B-317** 오래된 Revision 결과 `stale` 처리
- [x] **B-318** AI 실패 상태 저장

### B3 진행 기록

- B1/B2의 요약 상태 필드와 `record_suggestions`를 재사용하고 `daily_summaries` 및 사용자 소유 RLS를 추가했다.
- 서버 작업은 기록 생성 당시 timezone으로 날짜 종료를 판단하고, service-role 전용 Atomic Claim/완료 함수로 중복 실행과 revision race를 차단한다. 오래된 처리는 15분 후 복구하며 stale 결과는 저장하지 않는다.
- Structured Output, `sourceMessageIds` 검증, 금지 지침, `prompt_version`/모델 기록, `CRON_SECRET` 인증 내부 endpoint를 구현했다. 기록 조회 API도 저장된 요약을 반환한다.
- 확인: 전체 테스트 24 suites/125 tests, typecheck, lint, build, diff check 통과. 임시 PostgreSQL에서 migration, RLS, claim, recovery, revision mismatch, 실패 상태, 마지막 메시지 삭제 smoke 통과.
- 실제 OpenAI 호출과 원격 DB migration 적용은 하지 않았다. 배포 환경에서 이 endpoint를 주기적으로 호출하는 scheduler 연결은 별도 운영 설정이 필요하다.

---

# B4. 요약 수정 / 확정 / 정정

- [x] **B-401** 요약 수정 API 구현
- [x] **B-402** 기록 확정 API 구현
- [x] **B-403** 확정 시 최신 `content_revision` 검증
- [x] **B-404** stale summary 확정 차단
- [x] **B-405** `corrections` Migration 작성
- [x] **B-406** 정정 기록 RLS 적용
- [x] **B-407** 정정 기록 추가 API 구현
- [x] **B-408** 확정된 날짜에만 정정 기록 허용
- [x] **B-409** 확정 후 원문 불변성 테스트

### B4 진행 기록

- 요약 수정·확정·정정 mutation은 로그인 세션에서 확인한 사용자 ID로 service-role 전용 DB 함수를 호출한다. 함수는 record row를 잠가 원문 변경과 상태 전이를 직렬화한다.
- 요약은 `ready`이며 source revision이 최신일 때만 수정/확정한다. 확정 시 `user_final`이 비어 있으면 `ai_draft`를 최종본으로 고정하고, 같은 확정 요청은 기존 결과를 반환한다.
- `corrections` append-only 테이블과 소유자 RLS를 추가하고, 상세 조회 응답에도 정정을 포함했다. 초안에는 정정을 추가할 수 없다.
- 공통 인증 helper가 익명 Supabase 세션도 거부하도록 보완했다.
- 확인: 전체 테스트 26 suites / 144 tests, typecheck, lint, build, diff check 통과. 임시 PostgreSQL에서 B1/B3/B4 migration 적용, latest/stale/not-ready 확정, 확정 후 원문 변경 거부, 정정 권한, append-only 권한, 사용자별 RLS를 확인했다.
- 원격 DB에는 migration을 적용하지 않았다. API Contract는 변경하지 않았다.

---

# B5. 기록 목록 / 진료 준비

- [x] **B-501** 기록 목록 조회 API 구현
- [x] **B-502** 미확인 기록 개수 조회 구현
- [x] **B-503** 진료 준비 Service/API 구현
- [x] **B-504** 확정된 기록만 기본 포함
- [x] **B-505** 선택 기간 미확인 기록 개수/날짜 반환
- [x] **B-506** 기록이 없는 날짜 결과에서 제외
- [x] **B-507** 정정 기록 포함
- [x] **B-508** 날짜별 원문 조회 지원
- [x] **B-509** 진료 준비에서 다일 OpenAI 분석을 호출하지 않는지 테스트

### B5 진행 기록

- `GET /api/daily-records`는 inclusive 날짜 범위를 검증하고 날짜 내림차순 목록, 원문 개수, 확인 가능한 `draft + ready` 개수를 반환한다. 날짜별 원문은 기존 `GET /api/daily-records/:date`로 제공한다.
- `GET /api/visit-prep`는 미확인 `draft + ready` 날짜와 확정 기록의 요약 timeline·정정을 날짜 오름차순으로 반환한다. 사용자 확정 요약을 우선하며, 기록이 없는 날짜는 만들지 않고 OpenAI를 호출하지 않는다.
- 확인: 전체 테스트 28 suites / 152 tests, typecheck, lint, production build, `git diff --check` 통과. API Contract 변경과 원격 DB 변경은 없다.

---

# B6. 삭제 / 보안 강화

- [x] **B-601** 하루 기록 전체 삭제 API 및 Cascade 처리
- [x] **B-602** 전체 건강 기록 삭제 Service/API 구현
- [x] **B-603** 계정 삭제 Service/API 구현
- [x] **B-604** Supabase Auth 사용자 삭제 처리
- [x] **B-605** 삭제 후 Session 정리
- [x] **B-606** 모든 사용자 데이터 테이블 RLS 재검토
- [x] **B-607** 사용자 A/B 격리 테스트
- [x] **B-608** Service Role Key 서버 전용 검증
- [x] **B-609** OpenAI API Key 서버 전용 검증
- [x] **B-610** 건강 원문 로그 노출 여부 점검
- [x] **B-611** 오류 모니터링 Health Text 제거 전략 적용
- [x] **B-612** Scheduler Secret 적용
- [!] **B-613** 최소 Rate Limit 적용 여부 결정 및 구현
- [x] **B-614** 파괴적 작업 Transaction / 실패 복구 테스트

### B6 진행 기록

- 날짜 삭제는 `auth.uid()` 기준 RPC 한 번으로 처리하고 `daily_records`의 기존 cascade FK로 원문·요약·제안·정정을 함께 삭제한다. 전체 건강 기록 삭제는 profile/Auth를 유지하고, 계정 삭제는 건강 row와 profile을 한 DB transaction으로 삭제한 뒤 서버 전용 Supabase Auth Admin API를 호출한다.
- Auth 삭제가 실패하면 원문·profile 삭제 단계는 이미 완료된 상태이며 현재 요청 세션을 정리하고 안전한 500을 반환한다. DB 삭제 함수들은 멱등이라 다시 로그인해 재시도할 수 있다. Auth 삭제는 refresh session을 무효화하지만 발급된 access JWT 자체는 만료 전까지 유효할 수 있다.
- 여섯 public 사용자 테이블의 RLS, 사용자 A/B SELECT 격리, 날짜 cascade, profile 유지/삭제, 실패 시 transaction rollback을 임시 로컬 PostgreSQL에서 확인했다. Service Role/OpenAI 모듈은 `server-only`; 빌드된 브라우저 번들 19개에서 Service Role/OpenAI/Scheduler Secret 값은 발견되지 않았다. 별도 오류 모니터링 도구는 없고 API 오류는 일반 메시지로 변환하며 request/response 본문을 전송하지 않는다. Auth 삭제 부분 실패 시에는 건강 데이터 없이 `account_delete_auth_failed` 단계 코드만 기록한다. Scheduler의 `CRON_SECRET` 검증은 B3 구현을 회귀 테스트로 재확인했다.
- 확인: 전체 테스트 31 suites / 164 tests, typecheck, lint, production build, `git diff --check` 통과. 원격 Supabase에는 migration을 적용하지 않았다. API Contract 변경 없음.

### 추가 결정 필요

- [!] **B-613** Vercel Pro Firewall rate limit으로 최소 보호를 적용하는 방향을 정했다. 현재 Vercel 계정과 저장소에는 `health-record` 프로젝트가 아직 연결되어 있지 않아 규칙을 만들거나 검증할 수 없다. 프로젝트 연결 후 메시지 write, AI suggestion, summary retry, internal endpoint를 우선 Log로 관찰하고, 정상 트래픽을 기준으로 한도를 정해 429 제한을 검증한다. 정확한 사용자별 전역 quota가 필요하면 별도 공유 counter가 필요하다.

---

# B7. 백엔드 테스트 / AI Evaluation 준비

- [x] **B-701** 시스템 시간대 23:59 → 같은 `local_date` 검증
- [x] **B-702** 시스템 시간대 다음날 00:00 → 다음 `local_date` 검증
- [x] **B-703** 기존 record의 `local_date` 불변성 검증
- [x] **B-704** summary revision race condition 테스트
- [x] **B-705** confirmed mutation 차단 테스트
- [x] **B-706** visit prep confirmed-only 테스트
- [x] **B-707** 삭제 기능 테스트
- [x] **B-708** API Integration Test 전체 실행
- [x] **B-709** AI Evaluation Dataset 20개 이상 작성
- [x] **B-710** Prompt Injection Case 포함
- [x] **B-711** 진단/원인 추정/치료 추천 금지 Case 검증

### B7 진행 기록

- `tests/server/timezone.test.ts`가 Asia/Seoul 기준 23:59와 다음날 00:00 경계를 검증한다. 기기 timezone 변경 후 기존 날짜 불변성은 service 테스트와 임시 PostgreSQL에서 기존 `local_date` 및 `timezone_at_creation` snapshot 유지로 확인했다.
- Summary race는 실제 migration을 올린 임시 PostgreSQL에서 처리 중 원문 revision이 바뀌면 완료 결과를 저장하지 않고 `stale`로 전환하는 것을 확인했다. 확정 후 메시지 수정·삭제와 summary 수정은 거부됐고, 하루 삭제는 원문·요약·제안·정정 데이터를 cascade 삭제했다.
- 진료 준비 confirmed-only / 빈 날짜 제외 / AI 미호출은 `tests/server/daily-record-queries.test.ts`에서 확인했다. API 전체는 6 suites / 24 tests 통과.
- `evals/daily-summary-cases.json`에 합성 사례 25개를 추가했다. Prompt Injection 3개와 진단 요청 1개, 원인 추정 요청 1개, 치료·약 추천 요청 2개를 포함한다. dataset 테스트가 고유 ID, 원문/필수 사실, 금지 개념, 제안 상한을 검사한다.
- 확인: 관련 회귀 7 suites / 49 tests, 전체 API 6 suites / 24 tests, 전체 Jest 32 suites / 166 tests, typecheck, lint, production build, `git diff --check` 통과. 임시 PostgreSQL은 제거했다. 실제 OpenAI 모델 Evaluation과 원격 DB 변경은 하지 않았고 API Contract 변경도 없다.

---

# 백엔드 완료 기준

- Frontend 없이 API와 DB 규칙을 테스트할 수 있음
- 모든 사용자 데이터에 RLS가 적용됨
- 원문 저장과 AI 실패가 분리됨
- 시간대는 사용자 설정이 아닌 자동 전달 metadata로만 처리됨
- 자동 일일 요약이 record 생성 당시 시스템 시간대를 기준으로 날짜 종료를 판정함
- 담당 테스트 통과
- 완료 후 `docs/TASKS.md`의 백엔드 상태를 갱신
