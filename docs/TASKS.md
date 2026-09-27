# TASKS — MVP 전체 개발 현황

이 문서는 **전체 개발 진행 상황과 공통 선행 작업**만 관리합니다.
세부 구현 작업은 역할별 문서에서 관리합니다.

- 프론트엔드: `docs/tasks/FRONTEND_TASKS.md`
- 백엔드: `docs/tasks/BACKEND_TASKS.md`
- 통합/최종 검증: `docs/tasks/INTEGRATION_TASKS.md`

## 상태 표기

- `[ ]` 대기
- `[~]` 진행 중
- `[x]` 완료
- `[!]` 막힘 / 추가 결정 필요

## 실제 개발 순서

```text
공통 기반/Contract 확정
        ↓
┌──────────────────┬──────────────────┐
│ Frontend 작업     │ Backend 작업      │
│ FRONTEND_TASKS   │ BACKEND_TASKS    │
└──────────────────┴──────────────────┘
        ↓              ↓
      두 작업 완료
            ↓
      Integration 작업
   INTEGRATION_TASKS
            ↓
       최종 QA / 배포
```

프론트엔드와 백엔드는 **같은 API Contract를 기준으로 동시에 진행**합니다.
프론트엔드는 Mock API를 사용하고, 백엔드는 실제 DB/API를 구현합니다.
통합 작업은 두 작업 결과를 합친 뒤 진행합니다.

---

# 0. 공통 선행 작업

이 항목은 프론트엔드/백엔드 분리 작업 전에 한 번 완료합니다.

- [x] **C-001** `PRD.md` 핵심 제품 정책 최종 확인
- [x] **C-002** `API.md` API Contract 확정
- [x] **C-003** `DATABASE.md` DB Schema 확정
- [x] **C-004** `src/contracts/**` TypeScript 타입 및 Runtime Schema 정의
- [x] **C-005** 저장소 기본 폴더 구조 생성
- [x] **C-006** `.env.example` 생성 및 환경변수 명칭 확정
- [x] **C-007** Lint / Jest 기본 설정
- [x] **C-008** Frontend / Backend Git Branch 또는 Worktree 준비
- [x] **C-009** Mock API가 실제 API와 동일한 Contract를 사용하도록 기본 Adapter 구조 정의

## 공통 작업 완료 기준

- Frontend가 Backend 구현 없이 화면과 상호작용을 개발할 수 있음
- Backend가 UI 구현 없이 실제 API를 개발할 수 있음
- 양쪽이 같은 Request / Response 타입을 사용함
- Shared Contract를 프론트엔드/백엔드 AI가 임의로 변경하지 않는 규칙이 준비됨

---

# 1. 역할별 작업 현황

| 영역 | 상태 | 상세 문서 |
|---|---|---|
| 공통 기반 | 완료 | 이 문서의 `0. 공통 선행 작업` |
| 프론트엔드 | 완료 | `docs/tasks/FRONTEND_TASKS.md` |
| 백엔드 | 완료 | `docs/tasks/BACKEND_TASKS.md` |
| 통합 | 진행 (I-718 저장소 자동화 구현, R2/DB 설정 및 운영 복구 리허설 대기) | `docs/tasks/INTEGRATION_TASKS.md` |
| 최종 QA / 배포 | 보류 (동의 페이지 배포됨; 실제 OAuth→동의→기록 저장 smoke, Auth 포함 복구와 운영 정책 결정 대기) | `docs/tasks/INTEGRATION_TASKS.md` |

상태는 각 상세 TASK 문서의 실제 진행 상황에 맞춰 갱신합니다.

---

# 2. 작업 문서 관리 규칙

## Frontend AI

- `FRONTEND_TASKS.md`만 작업 상태를 직접 갱신합니다.
- `BACKEND_TASKS.md`, `INTEGRATION_TASKS.md`는 수정하지 않습니다.
- Backend 구현을 기다리지 않고 Mock API를 사용합니다.

## Backend AI

- `BACKEND_TASKS.md`만 작업 상태를 직접 갱신합니다.
- `FRONTEND_TASKS.md`, `INTEGRATION_TASKS.md`는 수정하지 않습니다.
- UI 구현을 기다리지 않고 API Contract에 맞춰 개발합니다.

## Integration 담당

- Frontend와 Backend 결과가 준비된 뒤 `INTEGRATION_TASKS.md`를 진행합니다.
- Mock API를 실제 API로 교체합니다.
- Contract 불일치가 있으면 한쪽 구현에 맞추지 말고 `API.md`와 `src/contracts/**`를 기준으로 수정합니다.
- 전체 현황이 바뀌면 이 문서의 역할별 상태도 갱신합니다.

---

# 3. 추가 결정 필요

- [x] ~~과거에 기록이 전혀 없는 날짜를 사용자가 새로 작성할 수 있게 할지~~ → **결정: 불가능하도록 막는다(2026-09-26).**
  - `docs/API.md` 5절의 MVP 기본안을 따르고, 실제로는 허용하던 구현(`create_record_message`이 record가 없으면 생성)을 거절로 바꿨습니다.
  - 이유: "그날 아무것도 기록하지 않았다"는 사실이 지워지면 기록이 없는 날짜를 증상이 없었던 날로 해석하게 되어 PRD 원칙에 어긋납니다.
  - 오늘 날짜의 첫 기록과 이미 존재하는 과거 draft record에 대한 추가는 그대로 허용합니다. 확정된 과거 기록에 남기는 정정은 12절 경로를 씁니다.
  - 마이그레이션 `20260926100000_b8_no_backfill_past_dates.sql`, 오류 코드 `RECORD_DATE_NOT_WRITABLE`(400), 원격 DB 적용 및 실제 사용자 세션으로 3개 케이스(오늘 생성 200 / 미기록 과거 400 / 기존 과거 추가 200) 검증 완료.
- [x] ~~공개 전 개인정보 / AI 처리 안내 최종 문구~~ → **종결(2026-09-27).** 문구 승인 + OpenAI 정책 근거 확인 완료 — **결정(2026-09-26): 구현 작업이 모두 끝난 뒤 최종 확인한다. 확인 시점은 I7(최종 QA) 이후 공개 직전이며, 대상은 `src/components/settings`의 안내 UI와 PRD 9.x 대조다.**
  - **상태 갱신(2026-09-27, 종결):** 결락 고지 2건(외부 AI 처리자로 기록이 전송된다는 사실, 삭제 후 백업 보존)을 `/settings/privacy` 상세 페이지로 옮겨 반영했고, PRD 9-3 동의는 로그인 뒤 첫 기록 시작 시 전용 페이지(`/onboarding/health-consent`)에서 받도록 구현해 실사용자 세션으로 검증했다. B9/B10/B11 마이그레이션(`profiles.consent_version`/`consented_at`, RPC 서버 측 강제)과 `reason: "consent"` 규칙을 적용했다. **"학습에 사용되지 않습니다"는 OpenAI 공식 문서로 확인**해 악용 모니터링 보관 "최대 30일"과 출처 링크를 넣었고, 문구가 바뀐 만큼 동의 버전을 v1→v2로 올려 재동의까지 실사용자로 검증했다. 상세는 `docs/tasks/INTEGRATION_TASKS.md`의 I-714 진행 기록.
  - **사람의 결정이 남았다:** ① email/password 회원가입 유지 여부 ② 실제 백업 보존 정책(I-718은 구현 중이나 운영 복구 리허설 대기) ③ R2 데이터 위치·국외 이전 고지. **I-714 자체의 결락 사유 2건(문구 승인·OpenAI 정책 근거)은 2026-09-27에 모두 해결**했다. 미동의 계정의 기록 작성 차단은 B10/B11로 **구현 완료**했다(조회·삭제는 열어 둠).
  - **사용자 결정(2026-09-27): Supabase Free를 유지한다.** 현재 공식 문서상 Free에는 포함된 자동 백업과 대시보드에서 내려받을 수 있는 백업이 없다. 별도 FAQ는 현재 Free 프로젝트에도 최대 7개의 일일 백업이 만들어져 유료 플랜으로 올린 뒤 제공될 수 있지만 향후 중단될 수 있다고 설명한다. Supabase는 Free 프로젝트에 정기 `db dump`와 off-site 백업을 권한다. 프로젝트에 실제 백업이 있는지/얼마나 보존되는지 확인하지 않았으므로 기간 숫자를 고지에 넣지 않는다([백업 안내](https://supabase.com/docs/guides/platform/backups), [FAQ](https://supabase.com/docs/guides/troubleshooting/will-backups-be-accessible-from-the-dashboard-immediately-after-upgrading-to-a-paid-plan-hXY4rs)). email/Google Auth는 켜져 있고 signup도 허용되어 있다. Free에서는 유출 비밀번호 보호를 사용할 수 없으므로, email signup을 유지할지 공개 전 결정한다([공식 문서](https://supabase.com/docs/guides/auth/password-security)).
- [x] ~~운영 오류 모니터링 / Analytics 도구~~ → **결정(2026-09-26): MVP에서 도입하지 않는다.**
  - 현재 의존성·SDK가 없고, 코드 로깅은 실패 단계 코드 1곳뿐이며 본문 전송이 없다. 공개 전까지 외부 도구를 붙이지 않으면 안전하게 닫힌다.
  - 나중에 도입할 때의 조건은 `docs/SECURITY.md` 6절(허용/금지 로그 항목, request body 자동 수집 차단)에 이미 적혀 있다.
- [x] ~~B-613 Vercel rate limit~~ → **결정(2026-09-26): Vercel Firewall로 적용하고, 규칙은 문서로 확정.**
  - 경로별 목표 한도·429 정책·검증 순서를 `docs/SECURITY.md` 10절에 확정했다. 앱 코드에는 넣지 않는다.
  - **실계정 갱신(2026-09-27):** 처음에는 규칙 12개만 저장되고 Firewall 자체는 꺼져 있어 이를 켰다. 12개 규칙을 active/valid로 확인했고, 내부 스케줄러 경로의 4회 허용/5회째 429 및 75바이트 비어 있지 않은 무-건강정보 본문을 I-717에서 확인했다.
- [x] ~~DB 함수의 `auth.uid()` 검증과 서버의 service role 호출 경로 불일치~~ → Integration I0에서 해결(세션 클라이언트 전환 + B7 마이그레이션 적용 + 원격 실사용자 검증). 상세는 `docs/tasks/INTEGRATION_TASKS.md`.
- [x] ~~원격 DB에 B2~B6 마이그레이션 미적용~~ → Integration I0에서 SQL Editor로 B2~B7 적용 및 검증 완료.
- [x] ~~레거시 테이블(`conversations`/`messages`/`daily_health_records`) 관련 보안 advisor 경고~~ → **2026-09-27 실측: 세 테이블 모두 원격 `health` 프로젝트에 존재하지 않는다**(`PGRST205`). 마이그레이션에도 생성 코드가 없어 drop 마이그레이션은 불필요하다. 배포 전 Dashboard → Advisors로 실제 경고 항목을 재확인한다.

시간대는 추가 사용자 설정 항목으로 두지 않습니다. 기록 시점의 **기기/브라우저 시스템 시간대**를 자동 사용합니다.
