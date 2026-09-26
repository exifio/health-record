# FRONTEND — 구현 가이드

## 1. 담당 범위

Frontend AI가 주로 수정할 영역:

```text
src/app/(public)
src/app/(app)
src/components
src/features
src/mocks
```

읽기 전용에 가까운 영역:
- `src/contracts`
- `docs/API.md`

Backend 영역을 직접 수정하지 않습니다.

## 2. 페이지 권장 구조

```text
/(public or landing)        비로그인 앱 셸 + 로그인 모달
/today                      오늘 기록
/records                    모든 기록
/records/[date]             날짜 상세
/visit-prep                 진료 준비
/settings                   설정
```

실제 route group 명은 구현 시 조정 가능합니다.

## 3. 컴포넌트

### 공통
- `AppShell`
- `Sidebar`
- `SidebarToggle`
- `LoginModal`
- `DemoModeBanner`
- `StatusBadge`
- `ConfirmDialog`

### 오늘 기록
- `RecordTimeline`
- `RecordMessage`
- `RecordComposer`
- `SuggestionCard`

### 요약 확인
- `DailySummaryCard`
- `SummaryEditor`
- `AiDraftNotice`
- `CorrectionList`
- `CorrectionComposer`

### 진료 준비
- `DateRangePicker`
- `UnreviewedNotice`
- `VisitPrepDayCard`
- `RawRecordDisclosure`

## 4. Server/Client Component 원칙

### Server Component에 적합
- 초기 페이지 셸
- 로그인 상태 기반 리다이렉트/분기
- 초기 읽기 전용 데이터 로드

### Client Component가 필요한 곳
- 메시지 입력
- 수정/삭제 메뉴
- summary 편집
- 사이드패널 토글
- 날짜 범위 상호작용
- 확인 모달

모든 페이지를 습관적으로 Client Component로 만들지 않습니다.

## 5. 상태 관리

MVP에서는 전역 상태 라이브러리를 먼저 도입하지 않습니다.

구분:
- 서버 데이터: API가 원본
- 임시 UI 상태: `useState` 등 로컬 상태
- 인증 상태: Supabase/서버 세션
- 사이드바 접힘 등 UI 상태: 로컬 또는 작은 context
- 화면 테마: `system | light | dark` 값으로 관리하고 브라우저에 저장

캐시 라이브러리가 필요해지는 시점에만 도입합니다.

## 6. API Client

UI에서 `fetch('/api/...')`를 여기저기 직접 호출하지 않고 feature별 client를 둡니다.

예:

```text
src/features/records/api/records-api.ts
src/features/visit-prep/api/visit-prep-api.ts
```

응답 타입은 `src/contracts`에서 가져옵니다.

### 시스템 날짜 / 시간대 전달

사용자에게 timezone 설정 UI를 제공하지 않습니다. 오늘 기록을 작성할 때 Frontend가 기기/브라우저 정보를 자동 사용합니다.

- 현재 날짜: 시스템 로컬 날짜를 `YYYY-MM-DD`로 계산해 URL의 `:date`에 사용
- 시스템 시간대: `Intl.DateTimeFormat().resolvedOptions().timeZone` 등으로 IANA timezone 자동 감지
- 메시지 생성 요청의 `systemTimeZone` metadata로 전달
- 사용자가 직접 입력하거나 선택하게 하지 않음
- 과거 기록을 표시할 때 현재 timezone으로 날짜를 다시 계산하지 않음

## 7. Mock 전략

Backend 완성 전에도 Frontend를 진행할 수 있어야 합니다.

권장:
- `src/mocks/fixtures.ts`: 샘플 record, summary, visit prep
- `src/mocks/mock-health-api.ts`: 실제 API client와 동일 interface 구현
- 개발 설정에서 명시적으로 mock adapter 선택

Mock response shape는 실제 Contract와 동일해야 합니다.

금지:
- UI 컴포넌트 내부에 임의 JSON 하드코딩
- Backend와 다른 field name 사용

## 8. Optimistic UI

건강 원문은 저장 성공이 중요하므로 과도한 optimistic UI를 피합니다.

### 메시지 작성
- 전송 중 temporary state 표시 가능
- 서버 201 응답 후 확정 표시
- 실패 시 사용자가 입력한 텍스트를 composer에 복구

### 삭제
- 서버 성공 전 UI에서 완전히 사라지게 하지 않는 편을 권장

## 9. 상태별 UI 규칙

### 상태 문구 (F-603)

- 배지 문구는 PRD 6절 `UI 표시 상태` 표를 그대로 쓴다.
  - `draft + not_due` → `작성 중`, `pending` → `AI 정리 대기`, `processing` → `AI 정리 중`,
    `ready` → `확인 필요`, `stale` → `정리 필요`, `failed` → `정리 실패`, `confirmed` → `확정`
- 문구만으로 이유를 알 수 없으므로 배지에 이유/다음 행동을 함께 둔다(`title` + 스크린리더 전용 텍스트).
  예: `확인 필요` → "AI 정리 초안이 준비되었습니다. 내용을 확인하고 확정해 주세요."
- `missingInformation`은 카드에서 `더 남겨두면 좋은 정보` 섹션으로 보여 준다(DESIGN 6절).
  원문이 한 줄뿐이라 정리가 원문과 비슷해 보일 때도 **무엇을 확인하면 되는지**가 드러나야 한다.
- 사이드바 '최근 기록'은 네비게이션 목록이라 행동이 필요 없는 수동 상태(`작성 중`/`AI 정리 대기`/`AI 정리 중`)는 배지를 표시하지 않는다.
- 현재 보고 있는 날짜 항목은 `aria-current="page"` + 강조 스타일로 표시한다.

### confirmed
- 원문 edit/delete 메뉴 숨김
- summary editor 숨김
- correction 추가만 허용

### summary processing/pending/stale
- confirm 비활성화
- PRD 6절 문구 그대로 상태 표시(`AI 정리 대기` / `AI 정리 중` / `정리 필요`)

### summary failed
- 원문 정상 저장 문구
- `다시 정리하기`

## 10. Demo Mode

Demo Mode는 실제 사용자 API를 호출하지 않습니다.

- 정적 fixture만 사용
- 입력 제출 차단
- 실제 건강 정보가 브라우저 로그나 서버로 전송되지 않도록 함
- 사용자가 기능을 누르면 로그인 모달

### 로그인 상태에 따른 API 선택 (F-106)

- `AuthAwareHealthApiProvider`가 `AuthProvider`의 상태를 읽어 화면이 쓸 API를 고릅니다.
  - `authenticated`: 실제 API (`getDefaultHealthApi()`, `NEXT_PUBLIC_USE_MOCK=false` 기준)
  - `unauthenticated` / `demo`: 정적 샘플(Mock) API만 사용
- 그래서 로그인하지 않아도 기록 목록·날짜 상세·요약·진료 준비 샘플을 볼 수 있고,
  실제 사용자 API는 호출되지 않습니다.
- 샘플 날짜는 `fixtures.ts`의 4건(2026-09-22 ~ 2026-09-25)으로 고정합니다.
  실행 시점 날짜에 같은 원문을 복제하면 샘플이 두 곳에서 중복돼 보이므로 하지 않습니다.
- 기록 목록 fixture에 보이는 날짜는 상세 화면에서도 같은 샘플을 보여 줍니다.

> **결정(2026-09-27)**: PRD 5절의 "샘플 **오늘** 기록"은 제공하지 않는다(사용자 지시:
> 9/25와 같은 원문이 오늘 날짜에 복제돼 중복으로 보였기 때문). 비로그인 `/today`는 빈 상태로
> 두고 둘러보기 배너와 입력창 안내로 로그인을 유도한다. PRD 5절 문구 조정은 제품 정책 담당이
> 볼 항목이며, 선택지와 근거는 `docs/tasks/FRONTEND_TASKS.md`의 "추가 결정 필요 → 결정 완료"에 남겨 두었다.

### 읽기 전용 규칙 (F-106)

비로그인·둘러보기 화면은 조회만 허용합니다.

- `RecordTimeline` / `RecordMessage`: `canEdit={false}` → 원문 수정/삭제 UI 숨김
- `DailySummaryCard`: `readOnly` → 확정·요약 수정·정정 추가·하루 삭제 UI 숨김
- 기록 입력창은 그대로 노출하고 제출·포커스 시 로그인 모달을 띄웁니다(`RecordComposer`)

## 11. 화면 테마 / 다크모드

MVP는 `system | light | dark` 세 가지 테마 모드를 지원합니다.

### 기본 동작
- 최초 기본값은 `system`
- `system`일 때 `prefers-color-scheme` 변경을 반영
- 사용자가 직접 `light` 또는 `dark`를 고르면 해당 선택을 우선
- 선택값은 `localStorage` 등 브라우저 UI 저장소에 보존
- 테마 설정을 건강 기록 DB에 저장하지 않음

### 구현 원칙
- 색상을 컴포넌트마다 직접 하드코딩하지 않고 semantic CSS variable/token을 사용
- 예: `--background`, `--surface`, `--foreground`, `--muted-foreground`, `--border`, `--danger`
- 루트 요소의 class 또는 `data-theme`를 기준으로 테마를 적용
- 초기 렌더링에서 잘못된 테마가 잠깐 보이는 현상과 hydration mismatch를 방지
- 로그인 전 앱 셸과 로그인 모달에도 동일한 Theme Provider/규칙 사용
- `system` 선택 중 OS 테마가 바뀌면 새 설정을 즉시 반영

테마 전환은 표현 계층의 기능이며 API Contract나 Backend Business Logic에 의존하지 않습니다.

## 12. 접근성

- 상태를 색상만으로 구분하지 않음
- 메뉴/아이콘에 accessible label
- confirm/delete 위험 작업은 키보드 접근 가능
- AI 안내 문구를 작은 회색 글씨로 숨겨 읽기 어렵게 만들지 않음

## 13. Frontend 완료 기준

- 작은 화면/큰 화면 모두 사이드패널 토글 가능
- 비로그인 Demo Mode에서 실제 API write 없음
- 오늘 기록 작성/수정/삭제 UI가 API Contract와 일치
- summary 상태에 따라 버튼이 올바르게 활성/비활성
- 미확인 기록 개수 표시
- 진료 준비에서 빈 날짜 미표시
- 확정 후 correction UX 제공
- `시스템 설정 / 라이트 / 다크` 전환과 브라우저 내 선택 유지가 정상 동작
- 새로고침 시 테마 깜빡임 또는 hydration 오류가 발생하지 않음

