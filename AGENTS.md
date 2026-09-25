# AGENTS.md — 건강 기록 MVP 개발 규칙
이 저장소에서 작업하는 모든 개발 AI가 **가장 먼저 읽는 규칙 파일**입니다.
제품 세부사항은 각 문서를 따르고, 여기서는 작업 방식과 변경 금지 원칙을 정의합니다.
## 1. 작업 시작 순서
1. `AGENTS.md`
2. `docs/PRD.md`
3. `docs/API.md` + `docs/DATABASE.md`
4. 담당 문서
   - Frontend: `docs/DESIGN.md` → `docs/FRONTEND.md`
   - Backend: `docs/ARCHITECTURE.md` → `docs/BACKEND.md` → `docs/SECURITY.md` → `docs/AI.md`
5. `docs/PARALLEL_DEVELOPMENT.md`
6. `docs/TESTING.md` → `docs/PLAN.md` → `docs/TASKS.md`
7. 역할별 TASK 문서 확인
   - Frontend: `docs/tasks/FRONTEND_TASKS.md`
   - Backend: `docs/tasks/BACKEND_TASKS.md`
   - Integration: `docs/tasks/INTEGRATION_TASKS.md`
8. 자신의 TASK 문서에서 작업 상태를 갱신한 뒤 구현
문서 충돌 시 우선순위:

`PRD 정책 → API Contract → DATABASE → 담당 영역 문서 → PLAN/TASKS`

정책 자체가 충돌하면 임의로 결정하지 말고 `추가 결정 필요`로 남깁니다.
## 2. 변경 금지 제품 원칙

- 사용자 원문이 항상 원본이며 AI 결과는 파생 데이터입니다.
- AI는 진단, 질병 가능성 제시, 원인 추정, 치료·약 추천을 하지 않습니다.
- AI는 사용자가 기록하지 않은 사실을 추가하지 않습니다.
- 기록이 없는 날짜를 증상이 없었던 날로 해석하지 않습니다.
- 원문 저장과 AI 처리를 분리합니다. AI 실패가 원문 저장 실패가 되어서는 안 됩니다.
- 하루는 기록 시점의 기기/브라우저 시스템 시간 기준 `00:00~23:59`입니다. 사용자가 timezone을 직접 설정하지 않습니다.
- 사용자별 자동 정리 시간 설정은 MVP에 포함하지 않습니다.
- 화면 테마는 `시스템 설정 / 라이트 / 다크`를 지원하며 UI 설정으로만 취급합니다.
- AI 일일 요약은 사용자가 확인하기 전까지 확정 데이터가 아닙니다.
- 확정된 과거 원문은 덮어쓰지 않고 정정 기록을 추가합니다.
- 사용자는 하루 전체 기록을 삭제할 수 있습니다.
- 진료 준비에는 기본적으로 확정된 기록만 사용합니다.
- 진료 준비에서 다일 기록에 대한 의료적 종합·패턴 분석을 하지 않습니다.
- 비로그인 사용자의 실제 건강정보 입력을 허용하지 않습니다.
## 3. MVP 범위 확장 금지

다음 기능은 구현하지 않습니다.

- 의료 진단/질병 예측/AI 의료 상담
- 치료 또는 약 추천
- 의료 차트, 복잡한 그래프, 의료 패턴 분석
- 사용자별 자동 정리 시간
- 푸시 알림
- 의사 직접 전송 또는 의료기관/EMR 연동
- 가족 계정, 음성 입력, 검사 결과 업로드
- Apple 로그인, 실제 Kakao 로그인
- 복잡한 PDF 출력

새 아이디어는 구현하지 말고 `Future Scope` 후보로만 기록합니다.
## 4. 병렬 개발 실행 규칙

- 먼저 `docs/TASKS.md`의 공통 Contract/기반 작업을 완료합니다.
- 이후 Frontend와 Backend를 독립적으로 동시에 진행합니다.
- Frontend는 `docs/tasks/FRONTEND_TASKS.md`를 기준으로 Mock API를 사용합니다.
- Backend는 `docs/tasks/BACKEND_TASKS.md`를 기준으로 실제 DB/API를 구현합니다.
- 두 AI가 같은 로컬 작업 폴더를 동시에 수정하지 않습니다. 별도 Branch와 Git Worktree 사용을 권장합니다.
- 두 작업이 준비된 뒤 Integration 담당이 `docs/tasks/INTEGRATION_TASKS.md`를 진행합니다.
- 실제 운영 방법과 AI별 시작 프롬프트는 `docs/PARALLEL_DEVELOPMENT.md`를 따릅니다.
## 5. 파일 작업 경계

### Frontend AI
수정 가능:
- `src/components/**`
- `src/features/**`
- `src/app/(public)/**`
- `src/app/(app)/**`
- `src/mocks/**`

임의 수정 금지:
- `src/app/api/**`
- `src/server/**`
- `supabase/migrations/**`
- `src/contracts/**`

### Backend AI
수정 가능:
- `src/app/api/**`
- `src/server/**`
- `supabase/migrations/**`
- 서버 전용 Supabase 설정

임의 수정 금지:
- `src/components/**`
- `src/features/**`
- `src/app/(public)/**`
- `src/app/(app)/**`
- `src/contracts/**`

### Shared Contract
- `src/contracts/**`
- `docs/API.md`

Contract는 통합 담당만 수정합니다.
변경 필요 시 `docs/API.md` → `src/contracts` 순서로 갱신한 뒤 Frontend/Backend를 수정합니다.
## 6. 데이터 및 상태 규칙

- 사용자별 같은 `local_date`에는 하나의 `daily_record`만 존재합니다.
- 기록 날짜는 클라이언트가 기기/브라우저 시스템 시간으로 계산하고, 서버는 전달된 IANA timezone metadata를 검증해 record 생성 시 snapshot으로 저장합니다.
- 원문 변경 시 `content_revision`을 증가시킵니다.
- AI 요약에는 생성 당시 source revision을 저장합니다.
- 현재 revision과 다른 요약은 확정할 수 없습니다.
- record 상태와 summary 상태는 분리합니다.
- 확정 후 원문 메시지의 일반 PATCH/DELETE를 차단합니다.
- 정정은 append-only로 저장합니다.
- 하루 전체 삭제 시 연결된 원문·요약·제안·정정 데이터도 함께 처리합니다.

자세한 내용은 `docs/DATABASE.md`를 따릅니다.
## 7. 인증 및 보안

- Authentication과 Authorization을 분리합니다.
- 사용자 데이터 접근 제한은 Supabase RLS까지 적용합니다.
- 클라이언트가 전달한 `user_id`만으로 권한을 판단하지 않습니다.
- 다른 사용자의 ID를 임의로 요청해도 데이터 접근이 불가능해야 합니다.
- `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`은 서버 전용입니다.
- 건강 원문을 일반 로그, analytics, 오류 추적 이벤트에 그대로 남기지 않습니다.
- API 오류 응답에 내부 DB 정보나 Secret을 노출하지 않습니다.
## 8. AI 구현 규칙

- AI 호출은 `src/server/ai/**` 등 서버 전용 계층에 격리합니다.
- 모델 이름을 여러 파일에 하드코딩하지 않습니다.
- Structured Output과 runtime schema validation을 사용합니다.
- prompt/model/version을 추적 가능하게 저장합니다.
- AI 출력은 신뢰하지 않고 애플리케이션 규칙으로 검증합니다.
- AI 결과로 사용자 원문을 덮어쓰지 않습니다.
- AI 실패 시 원문 저장 상태를 변경하지 않습니다.
- 일일 요약 완료 전 source revision을 다시 확인합니다.
- 오래된 revision 결과는 폐기하거나 stale 처리합니다.
- MVP 진료 준비에서는 새로운 다일 의료 분석 AI 호출을 만들지 않습니다.
## 9. API 규칙

- Route Handler는 얇게 유지합니다.
- 기본 순서: 입력 검증 → 인증/인가 → Service 호출 → 응답 변환.
- 비즈니스 규칙을 Route Handler에 흩뿌리지 않습니다.
- Frontend는 DB가 아니라 API Contract에 의존합니다.
- Backend 미완성 시 Frontend는 Mock API/fixture를 사용합니다.
- Mock과 실제 API의 Response 형태는 같아야 합니다.
## 10. 테스트 필수 항목

UI 스냅샷보다 비즈니스 규칙을 우선합니다.

- 시스템 시간대/local date 경계와 과거 local_date 불변성
- 사용자 A/B 데이터 격리
- 확정 전 메시지 수정/삭제
- 확정 후 메시지 변경 차단
- `content_revision` 증가
- stale AI summary 확정 차단
- AI 실패와 원문 저장 분리
- 진료 준비 confirmed-only 규칙
- 기록 없는 날짜 미표시
- 정정 기록 포함
- 하루/전체 건강 기록/계정 삭제
- Secret의 client bundle 노출 방지

AI 품질 검증은 일반 Jest 테스트와 AI Evaluation을 구분합니다.
## 11. TASKS 및 문서 관리

- Frontend AI: `docs/tasks/FRONTEND_TASKS.md`만 상태 변경
- Backend AI: `docs/tasks/BACKEND_TASKS.md`만 상태 변경
- Integration 담당: `docs/tasks/INTEGRATION_TASKS.md`와 전체 `docs/TASKS.md` 상태 변경

작업 시작:
- 대상 항목 `[ ]` → `[~]`

작업 완료:
- 관련 테스트 실행
- 문서와 구현 일치 확인
- 대상 항목 `[~]` → `[x]`

결정이 필요한 경우:
- 억지로 구현하지 않음
- `[!]`로 표시
- `추가 결정 필요`에 이유와 선택지를 기록

제품 정책은 구현 도중 임의로 변경하지 않습니다.
## 12. 구현 원칙

- MVP 속도를 우선합니다.
- 불필요한 추상화와 미래 확장용 계층을 만들지 않습니다.
- 보안, 데이터 무결성, 권한 제어는 생략하지 않습니다.
- 하나의 Next.js 저장소에서 Frontend/Backend를 논리적으로 분리합니다.
- 새 패키지는 실제 필요할 때만 추가합니다.
- 기존 코드 스타일과 폴더 구조를 우선합니다.
- 현재 TASK와 무관한 대규모 리팩터링을 하지 않습니다.
## 13. 작업 완료 보고

작업 후 다음을 남깁니다.

- 구현 내용
- 주요 수정 파일
- 수행한 테스트와 결과
- 남은 문제 또는 `추가 결정 필요`
- API/DB/Contract 변경 여부

Contract나 제품 정책을 변경했다면 반드시 명시합니다.
