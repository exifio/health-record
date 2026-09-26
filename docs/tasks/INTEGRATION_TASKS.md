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
- [!] **I-004** Frontend / Backend Branch 최신 commit 확인
- [!] **I-005** `docs/API.md`와 `src/contracts/**` 변경 여부 확인

### I0 진행 기록 (2026-09-26)

**I-001 — 완료.** `docs/TASKS.md` 0절 C-001~C-009가 모두 `[x]`다. Mock과 실제 API가 같은 `src/contracts` 스키마를 사용하고, 저장소 폴더 구조도 규칙대로다.

**I-002 — 완료.** F-001~F-810이 전부 `[x]`다. Mock API 기준 테스트(`tests/features`, `tests/mocks`, `tests/components`)가 통과한다. 백엔드 구현을 기다리지 않고 화면을 완성한 상태다.

**I-003 — 완료 (B-613 이월).** B-001~B-612와 B-614~B-711이 `[x]`다. B-613(Vercel Firewall rate limit)만 `[!]`로 남아 있고 원인은 Vercel 프로젝트 미연결이다. API/DB 구현 완료에는 영향이 없으므로 I3 진행을 막지 않지만, **배포(I-715/I-716) 전 반드시 마감**해야 한다.

**I-004 — [!] 추가 결정 필요.**

- 저장소에 `main` 단일 브랜치만 있고 FE/BE 전용 브랜치·worktree가 없다. 원격 remote도 없다.
- FE/BE 작업 전체가 working tree에만 있고 **아직 커밋되지 않았다** (`src/app/api/`, `src/server/`, `src/components/`, `src/features/`, `supabase/migrations/`, `tests/`, `evals/`, `scripts/`).
- 따라서 I-101/I-102/I-103(Merge)은 "해당 없음"으로 처리하고, 통합 커밋 방식을 결정해야 한다.
- 커밋 대상 정리 필요: `.playwright-cli/`(브라우저 콘솔 로그 132K)이 untracked로 남아 있어 제외해야 한다. `.env.local`은 `.gitignore`로 제외되어 있다.

**I-005 — [!] Contract 불일치 발견. 아래 차단 항목을 해결하기 전에는 I2/I3의 실제 API 전환을 진행하지 않는다.**

- `docs/API.md`는 C-002 이후 변경이 없다(`git diff` 0). `src/contracts/index.ts`는 `Suggestion`, `DailyRecordListItem` 타입 export 2줄만 추가되었고 **스키마 자체 변경은 없다.** → Contract 정의 충돌은 없다.
- **차단 1: `POST /api/daily-records/:date/summary/retry` 미구현.** `docs/API.md` 9절에 정의돼 있고, `src/features/records/api/health-api.ts:134`의 `retrySummary()`가 UI `다시 정리하기` 버튼(`src/components/summary/DailySummaryCard.tsx:188,205`)에서 호출한다. 대응 route 파일도 service 함수도 없어 실제 API 모드에서는 404가 난다. B-3xx 공백이며 I-304를 직접 막는다. → Contract(`API.md` 9절)에 맞춰 구현해야 한다.
- **차단 2: 인증 endpoint가 `docs/API.md`에 없다.** `/api/auth/google`, `/api/auth/callback`, `/api/auth/logout`이 구현돼 있고 클라이언트(`src/features/auth/auth-context.tsx:33`)가 `POST /api/auth/logout`을 호출하는데 Contract에 정의가 없다. I-105에서 추가된 경로다. 문서화하거나 "Contract 범위 밖"으로 명시해야 한다.
- 참고(차단 아님): 서버가 실제로 쓰는 `MESSAGE_NOT_FOUND`(404), `RECORD_NOT_CONFIRMED`(409)가 API.md 1절 "대표 code" 목록에 없다. `tests/contracts/**`는 응답 스키마만 검증하고 메서드→경로 매핑을 검증하지 않아 위 retry 누락을 잡지 못했다. I2/I3에서 라우트 매핑 contract test를 추가하는 것을 권장한다.

### I0 검증 결과

- `npm run typecheck` 통과
- `npm run lint` 통과
- `npm test` → 36 suites / 198 tests 통과
- `npm run build` 통과, 페이지 6개(`/`, `/today`, `/records`, `/records/[date]`, `/settings`, `/visit-prep`) 전부 Dynamic 렌더링
- 라우트 대조 결과: API.md 18절 기준 17개 endpoint 중 16개 구현, `summary/retry` 1개만 미구현. API.md에 없는 인증 endpoint 3개가 추가 구현되어 있다.

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
