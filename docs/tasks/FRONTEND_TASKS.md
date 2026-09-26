# FRONTEND_TASKS — 프론트엔드 개발 작업

이 문서는 **Frontend AI 전용 작업 목록**입니다.
Backend 구현을 기다리지 않고 `docs/API.md`와 `src/contracts/**`를 기준으로 Mock API를 사용해 개발합니다.

## 상태 표기

- `[ ]` 대기
- `[~]` 진행 중
- `[x]` 완료
- `[!]` 막힘 / 추가 결정 필요

## 수정 가능 영역

```text
src/components/**
src/features/**
src/app/(public)/**
src/app/(app)/**
src/mocks/**
```

`src/app/api/**`, `src/server/**`, `supabase/migrations/**`, `src/contracts/**`는 임의로 수정하지 않습니다.

---

# F0. 프론트엔드 기반

- [x] **F-001** App Shell 구현
- [x] **F-002** 모바일 퍼스트 공통 레이아웃 구현
- [x] **F-003** 반응형 사이드바 구현
- [x] **F-004** 데스크톱 사이드바 접기/펼치기 구현
- [x] **F-005** 모바일 사이드바 오버레이 구현
- [x] **F-006** API Adapter 인터페이스 구성
- [x] **F-007** Mock Data / Mock API 기본 구조 구현
- [x] **F-008** 공통 Loading / Empty / Error UI 정의

완료 기준:
- 실제 Backend가 없어도 핵심 화면 개발 가능
- Mock Response가 `docs/API.md`와 동일한 타입 사용

---

# F1. 로그인 / 비로그인 Demo Mode / 온보딩

- [x] **F-101** 로그인 모달 UI 구현
- [x] **F-102** `구글로 로그인` UI 구현
- [x] **F-103** `카카오로 로그인` 비활성 상태 구현
- [x] **F-104** Demo Mode 샘플 데이터 작성
- [x] **F-105** Demo Mode 읽기 전용 화면 구현
- [x] **F-106** 비로그인 사용자의 기록 제출 차단
- [x] **F-107** 비로그인 기록 시도 시 로그인 모달 표시
- [x] **F-108** 첫 로그인 온보딩 안내 UI 구현
- [x] **F-109** 비로그인·둘러보기에서 샘플(오늘/과거/요약/진료 준비) 데이터 표시
- [x] **F-110** 비로그인·둘러보기 읽기 전용 처리(쓰기 UI 숨김)
- [x] **F-111** 상태 배지 문구를 PRD 6절 `UI 표시 상태` 표와 일치
- [x] **F-112** 배지 이유 안내(툴팁/스크린리더) + 사이드바 배지 규칙 + 현재 날짜 항목 활성 표시
- [x] **F-114** 9/27 샘플 원문 복제 제거(9/25와 내용이 같아 중복으로 보이던 문제)
- [x] **F-115** `missingInformation`을 `더 남겨두면 좋은 정보`로 화면에 노출(DESIGN 6절 구현 누락 해소)

### F1 진행 기록 (2026-09-27) — 상태 배지 정리

디자인 리뷰 피드백 2건(사이드바 '최근 기록'에서 `기록 중` 배지가 중복/불필요, `확인 필요`가 무엇을 확인해야 하는지 불분명)에 대한 결정과 구현이다.

- **결정:** 사용자가 선택지 A를 골랐다. 배지 어휘를 문서 기준으로 정리하고, `확인 필요`는 문구를 유지하되 이유를 함께 전달하며, 현재 보고 있는 날짜는 활성 표시한다.
- **원인:** 구현이 PRD 6절 표와 다른 문구를 만들어 썼다(`not_due` → `기록 중`, `pending` → `정리 대기`, `stale` → `수정됨`). `기록 중`은 DESIGN.md 9절 배지 어휘에도 없고 `draft`의 `작성 중`과 같은 상황을 다르게 부르는 중복 표현이었다.
- **변경**
  - `src/components/common/StatusBadge.tsx`: PRD 6절 문구로 통일(`작성 중` / `AI 정리 대기` / `AI 정리 중` / `확인 필요` / `정리 필요` / `정리 실패` / `확정`), 상태별 이유 문구(`hint`)를 `title` + 스크린리더 전용 텍스트로 제공(`statusHint()`, `withHint` prop)
  - `src/components/layout/RecordsShell.tsx`: `toSidebarBadgeStatus()`로 사이드바는 행동이 있는 상태와 `확정`만 배지 표시(작성 중/정리 대기/정리 중은 날짜만)
  - `src/components/layout/Sidebar.tsx`: `isActiveRecordPath()` + `aria-current="page"` + `is-active` 스타일, 항목 `title`에 이유 안내
  - `src/app/globals.css`: `.sidebar-record-item.is-active`, `.sr-only` 추가
- **문서:** `docs/DESIGN.md` 2절(사이드패널 배지 규칙)·9절, `docs/FRONTEND.md` 9절에 규칙을 명시했다.
- **검증:** `npx jest` 통과(신규 9건 포함), `tsc --noEmit`·`eslint` 이상 없음, 로그인하지 않은 실제 브라우저에서 `/records/2026-09-27` 사이드바 항목이 날짜만 표시 + 활성 표시, `/records` 목록이 `작성 중/확인 필요/확정` 문구와 이유 안내를 렌더링하는 것을 확인했다.

### F1 진행 기록 (2026-09-27) — 샘플 중복 제거와 확인 지점 노출

사용자가 앞선 피드백 2건의 실제 의도를 명확히 한 후 재작업한 내용이다.

- **[F-114] "9/27 Mock 데이터를 없애달라":** 앞 작업에서 `createDemoTodayRecordResponse`가 **9/25 샘플 원문을 오늘 날짜에 그대로 복제**해서 9/27·9/25 두 곳에 같은 기록이 보였다. 복제 함수와 시딩을 제거하고 **샘플 날짜는 fixture 4건(2026-09-22~25)으로 고정**한다.
  - 영향: 비로그인 `/today`는 오늘 날짜에 기록이 없으면 빈 상태가 된다(사이드바/목록도 9/27 항목 없음).
  - 회귀 테스트: 목록이 fixture 4건만 내려온다 / 날짜마다 샘플 원문이 서로 다르다.
- **[F-115] "확인 필요인데 무엇을 확인하는지 모르겠다":** 9/23 샘플의 `missingInformation`("증상이 얼마나 지속되었는지…")이 **데이터에는 있는데 화면에 한 번도 노출되지 않았다.** DESIGN 6절의 `더 남겨두면 좋은 정보` 섹션이 구현 누락이었다.
  - `DailySummaryCard`에 섹션 추가, 원문이 한 줄뿐이라 정리가 원문과 비슷해 보여도 확인할 지점이 드러난다.
  - 회귀 테스트: 보완 정보가 있으면 섹션 표시 / 없으면 섹션 자체를 만들지 않는다.
- **검증:** `npx jest` 통과, `tsc --noEmit`·`eslint` 이상 없음, `next build` 성공, 실제 브라우저에서 9/27 항목 제거와 9/23 상세의 `더 남겨두면 좋은 정보` 표시 확인.

#### 추가 결정 필요 → 결정 완료 (2026-09-27)

- **[x] ~~비로그인 `/today` 화면~~ → 결정: 빈 상태 유지(선택지 ①).**
  - PRD 5절의 "샘플 **오늘** 기록 확인 가능"은 오늘 날짜에 원문을 복제하지 않는 것과 충돌한다. 사용자는 "9/25와 같은 원문이 두 날짜에 중복돼 보이니 없애달라"고 명시적으로 지시했고, 중복 없는 현재 상태(빈 오늘 화면 + 둘러보기 배너 + 로그인 유도)를 채택했다.
  - 따라서 **PRD 5절의 "샘플 오늘 기록" 문구는 제품 정책 담당이 조정할 항목으로 남는다**(현상: 비로그인에서 샘플은 과거 기록 4건·진료 준비·제안만 제공). 구현이 정책을 임의로 바꾸지는 않았다.
- **[x] ~~9/23 샘플 원문/정리 콘텐츠 보강~~ → 결정: 현재 내용 유지(선택지 ②).**
  - 원문 1줄 → 정리 1줄의 구조는 바꾸지 않는다. 대신 F-115의 `더 남겨두면 좋은 정보` 섹션이 확인 지점을 제공한다.
  - 나중에 샘플 원문을 바꾸기로 하면 `src/mocks/fixtures.ts`의 `sampleUnreviewedRecordResponse` 한 곳만 수정하면 된다.

---

### F1 진행 기록 (2026-09-27) — 비로그인 샘플 데이터

- **문제:** 사용할 Mock/실제 API를 `NEXT_PUBLIC_USE_MOCK`만 보고 골랐고, 화면들은 `isAuthenticated`가 아니면 조회를 그냥 건너뛰었다. 결과적으로 **로그인해야만 데이터가 보이고 비로그인은 빈 화면**이 되어 제품 흐름(비로그인 샘플 → 로그인 실제 데이터)과 반대였다.
- **API 선택:** `getHealthApiForAuthStatus(status)`를 추가해 로그인=실제 API, 비로그인·둘러보기=정적 샘플(Mock) API로 나눈다.
  - `src/features/api/api-adapter.tsx`, `src/components/layout/AuthAwareHealthApiProvider.tsx` (AuthProvider 안쪽에서 상태를 읽어 API 주입), `src/components/layout/AuthenticatedApp.tsx`
  - 날짜/타임존 유틸은 `src/features/api/system-time.ts`로 분리했다(Mock이 api-adapter를 import하는 순환 방지).
- **읽기 허용 / 쓰기 차단:** 조회 가드를 제거하고 쓰기 UI만 숨긴다.
  - `TodayRecordView`, `RecordsListContent`, `RecordDateContent`, `VisitPrepContent`, `RecordsShell` 조회 가드 제거
  - `RecordTimeline`/`RecordMessage`의 `canEdit`, `DailySummaryCard`의 `readOnly`로 원문 수정·확정·요약 수정·정정 추가·하루 삭제 UI 미노출(데모 write 차단 유지)
  - 기록 입력창은 유지하고 제출 시 로그인 모달(F-106/F-107 그대로)
- **샘플 일관성:** 목록 fixture에 있는 날짜(2026-09-22~25)에 상세 샘플을 채워 목록과 상세가 어긋나지 않게 했다(`src/mocks/fixtures.ts`, `src/mocks/health-api.ts`).
  - (초안에서는 실행 시점 날짜로 샘플 원문을 복제하는 `createDemoTodayRecordResponse`도 넣었으나, **F-114에서 제거했다.** 같은 원문이 두 날짜에 중복 표시되는 문제 때문이며 최종 규칙은 위 "F1 진행 기록 (2026-09-27) — 샘플 중복 제거와 확인 지점 노출" 참조.)
- **검증:** `npx jest` 통과(신규 9건 포함), `tsc --noEmit`·`eslint` 이상 없음, `next build` 성공. 로그인하지 않은 실제 브라우저에서 오늘/목록/상세/진료 준비 샘플 표시와 쓰기 UI 미노출을 확인했다.

---

# F2. 오늘 기록

- [x] **F-201** 오늘 날짜 표시
- [x] **F-202** `RecordTimeline` 구현
- [x] **F-203** `RecordMessage` 구현
- [x] **F-204** `RecordComposer` 구현
- [x] **F-205** 메시지 작성 시간 표시
- [x] **F-206** 메시지 수정 UI 구현
- [x] **F-207** 메시지 삭제 확인 UI 구현
- [x] **F-208** 저장 Loading / Error 상태 구현
- [x] **F-209** 오늘 기록 Mock API Adapter 구현
- [x] **F-210** 기록 작성 시 브라우저/기기의 시스템 시간대를 자동 감지
- [x] **F-211** 현재 시스템 날짜를 `YYYY-MM-DD`로 계산하여 API 경로에 사용
- [x] **F-212** 감지한 시스템 시간대를 사용자 설정 UI 없이 API metadata로 전달

시간대 원칙:
- 사용자에게 timezone을 표시하거나 선택하게 하지 않음
- `Intl.DateTimeFormat().resolvedOptions().timeZone` 등 브라우저 정보를 자동 사용
- 이미 생성된 과거 기록 날짜를 현재 시스템 시간대로 다시 계산하지 않음

---

# F3. 추가 기록 제안

- [x] **F-301** 추가 기록 제안 카드 UI 구현
- [x] **F-302** 제안 최대 2~3개 표시
- [x] **F-303** 제안 무시/닫기 동작 구현
- [x] **F-304** 제안 없음 상태 처리
- [x] **F-305** 제안 API Mock 구현
- [x] **F-306** 제안 실패가 기록 작성 UX를 방해하지 않도록 처리

---

# F4. AI 일일 정리 상태

- [x] **F-401** AI 정리 대기 상태 UI 구현
- [x] **F-402** AI 정리 중 상태 UI 구현
- [x] **F-403** AI 정리 실패 상태 UI 구현
- [x] **F-404** AI 정리 완료/확인 필요 상태 UI 구현
- [x] **F-405** `다시 정리하기` UI 구현
- [x] **F-406** Summary 상태 Mock 구현
- [x] **F-407** stale summary 상태 UI 구현
- [x] **F-408** stale 상태에서는 확정 버튼 비활성화

---

# F5. 요약 확인 / 수정 / 확정 / 정정

- [x] **F-501** 요약 확인 화면 구현
- [x] **F-502** AI 결과 정확성 안내 문구 표시
- [x] **F-503** 요약 수정 Editor 구현
- [x] **F-504** 기록 확정 버튼 구현
- [x] **F-505** 확정 후 원문 수정/삭제 UI 제거
- [x] **F-506** 확정 후 정정 기록 추가 UI 구현
- [x] **F-507** 날짜 전체 삭제 진입 UI 유지

---

# F6. 기록 목록 / 진료 준비

- [x] **F-601** 사이드바 최근 기록 목록 구현
- [x] **F-602** 모든 기록 보기 화면 구현
- [x] **F-603** 기록 상태 Badge 구현
- [x] **F-604** 미확인 기록 개수 Banner 구현
- [x] **F-605** 진료 준비 기간 선택 UI 구현
- [x] **F-606** 날짜별 확정 기록 Card 구현
- [x] **F-607** 기록 없는 날짜 미표시
- [x] **F-608** 날짜별 원문 펼쳐보기 구현
- [x] **F-609** 정정 기록 표시 UI 구현
- [x] **F-610** 미확인 기록 안내와 `기록 확인하기` / `확인된 기록만 계속하기` 구현

---

# F7. 설정 / 삭제 / 다크모드

- [x] **F-701** 하루 기록 전체 삭제 확인 UI 구현
- [x] **F-702** 전체 건강 기록 삭제 확인 UI 구현
- [x] **F-703** 계정 삭제 확인 UI 구현
- [x] **F-704** 설정에 `시스템 설정 / 라이트 / 다크` 테마 선택 UI 구현
- [x] **F-705** semantic color token 기반 라이트/다크 스타일 적용
- [x] **F-706** 기본값 `system` 및 `prefers-color-scheme` 연동
- [x] **F-707** 사용자 테마 선택을 브라우저에 저장하고 새로고침 후 복원
- [x] **F-708** 로그인 전/Demo Mode/로그인 모달에도 동일 테마 적용
- [x] **F-709** 초기 테마 깜빡임 및 hydration mismatch 방지
- [x] **F-710** 개인정보/AI 처리 안내 링크 UI 구현
- [x] **F-711** 설정 화면 사이드바도 다른 화면과 같이 최근 기록 표시 (`AppShell` → `RecordsShell`)

> F-711 배경: 설정만 `AppShell`을 직접 쓰고 있어 사이드바가 기록이 있는데도 "아직 기록이 없습니다"로 나왔다.
> 회귀 테스트는 `tests/features/recent-records-sidebar.test.tsx`의 "설정 화면도 같은 사이드바를 쓴다".

시간대 설정 UI는 만들지 않습니다.

---

# F8. 프론트엔드 테스트 / QA

- [x] **F-801** 비로그인 submit 시 로그인 모달 + 실제 write 없음 테스트
- [x] **F-802** confirmed 화면 edit/delete 미표시 테스트
- [x] **F-803** stale summary confirm disabled 테스트
- [x] **F-804** unreviewed banner count 테스트
- [x] **F-805** visit prep no-record day 미표시 테스트
- [x] **F-806** 데스크톱/모바일 사이드바 동작 검증
- [x] **F-807** Demo Mode 검증
- [x] **F-808** AI 실패 상태 검증
- [x] **F-809** 라이트/다크/시스템 테마 전환 검증
- [x] **F-810** 다크모드 텍스트 대비 및 상태 식별 검증

---

# 프론트엔드 완료 기준

- 모든 Frontend 기능이 Mock API 기준으로 동작
- Backend 코드에 의존하지 않고 화면/상호작용 테스트 가능
- API Request/Response 구조가 `docs/API.md`와 일치
- 시스템 시간대는 자동 감지되며 사용자 설정 UI가 없음
- 담당 테스트 통과
- 완료 후 `docs/TASKS.md`의 프론트엔드 상태를 갱신
