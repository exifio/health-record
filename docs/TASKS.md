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
| 백엔드 | 완료 (B-613 이월) | `docs/tasks/BACKEND_TASKS.md` |
| 통합 | 진행 중 (I0 완료, 신규 차단 1건 — write API `auth.uid()`) | `docs/tasks/INTEGRATION_TASKS.md` |
| 최종 QA / 배포 | 대기 | `docs/tasks/INTEGRATION_TASKS.md` |

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

- [!] 과거에 기록이 전혀 없는 날짜를 사용자가 새로 작성할 수 있게 할지
- [!] 공개 전 개인정보 / AI 처리 안내 최종 문구
- [!] 운영 오류 모니터링 / Analytics 도구를 사용할 경우 건강 원문 제거 설정
- [!] DB 함수의 `auth.uid()` 검증과 서버의 service role 호출 경로 불일치 (Integration I0에서 실측). 메시지 작성/수정/삭제, 요약 수정, 확정, 정정, 삭제 API가 전부 403으로 실패한다. 상세와 선택지는 `docs/tasks/INTEGRATION_TASKS.md` I0 진행 기록 참조.

시간대는 추가 사용자 설정 항목으로 두지 않습니다. 기록 시점의 **기기/브라우저 시스템 시간대**를 자동 사용합니다.
