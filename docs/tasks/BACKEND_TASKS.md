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

- [ ] **B-001** Supabase 프로젝트 연결
- [ ] **B-002** 서버용 Supabase Client 구성
- [ ] **B-003** Google OAuth 연결
- [ ] **B-004** 서버 세션 Helper 구현
- [ ] **B-005** `profiles` Migration 작성
- [ ] **B-006** 최초 로그인 profile 생성 흐름 구현
- [ ] **B-007** `profiles` RLS 적용
- [ ] **B-008** 서버 공통 Error Model 구현
- [ ] **B-009** API Runtime Validation 기본 구조 구현

`profiles`에는 사용자 timezone 설정값을 저장하지 않습니다.

---

# B1. 일일 기록 / 메시지 API

- [ ] **B-101** `daily_records` Migration 작성
- [ ] **B-102** `record_messages` Migration 작성
- [ ] **B-103** `UNIQUE(user_id, local_date)` 적용
- [ ] **B-104** 필요한 Index 적용
- [ ] **B-105** 기록 관련 RLS 적용
- [ ] **B-106** 기록 조회 API 구현
- [ ] **B-107** 메시지 생성 API 구현
- [ ] **B-108** 메시지 수정 API 구현
- [ ] **B-109** 메시지 삭제 API 구현
- [ ] **B-110** 원문 변경 시 `content_revision` 증가 처리
- [ ] **B-111** 확정된 기록의 메시지 변경 차단
- [ ] **B-112** 빈 draft 정리 정책 구현
- [ ] **B-113** 시스템 시간대 metadata IANA timezone 검증
- [ ] **B-114** 새 daily record 생성 시 `timezone_at_creation` snapshot 저장
- [ ] **B-115** `local_date`를 생성 이후 재계산하지 않는 규칙 구현
- [ ] **B-116** 사용자 간 RLS 격리 테스트
- [ ] **B-117** 기록 API Unit / Integration Test 작성

시간대 원칙:
- 사용자가 timezone을 설정하지 않음
- 클라이언트가 기기/브라우저에서 자동 감지한 IANA timezone을 전달
- 서버는 값을 검증하고 daily record 생성 시 내부 snapshot으로만 저장
- 기존 기록의 날짜를 현재 timezone에 맞춰 재분류하지 않음

---

# B2. 추가 기록 제안 AI

- [ ] **B-201** OpenAI 서버 전용 Client 구현
- [ ] **B-202** 모델명 환경설정 분리
- [ ] **B-203** Structured Output Schema 구현
- [ ] **B-204** 추가 기록 제안 Prompt 작성
- [ ] **B-205** 최대 2~3개 제안 규칙 적용
- [ ] **B-206** 충분한 기록에는 제안을 생성하지 않는 규칙 적용
- [ ] **B-207** 제안 API 구현
- [ ] **B-208** AI 실패가 원문 저장에 영향을 주지 않는지 테스트

---

# B3. 자동 일일 요약

- [ ] **B-301** `daily_summaries` Migration 작성
- [ ] **B-302** `record_suggestions` Migration 작성
- [ ] **B-303** 요약 상태 필드 적용
- [ ] **B-304** `processing_started_at` 적용
- [ ] **B-305** 자동 정리용 내부 Endpoint 구현
- [ ] **B-306** Scheduler 인증 구현
- [ ] **B-307** `timezone_at_creation` 기준으로 local day 종료 여부 판정
- [ ] **B-308** 동일 기록 중복 처리 방지 Atomic Claim 구현
- [ ] **B-309** 실패/중단 작업 Retry 및 Recovery 처리
- [ ] **B-310** `summarizeDailyRecord()` 구현
- [ ] **B-311** 결과에 `sourceMessageIds` 연결
- [ ] **B-312** 진단/원인 추정/치료 추천 금지 Prompt 적용
- [ ] **B-313** Structured Output Runtime Validation 적용
- [ ] **B-314** `prompt_version` 저장
- [ ] **B-315** 사용 모델 정보 저장
- [ ] **B-316** AI 호출 전후 Source Revision 재검사
- [ ] **B-317** 오래된 Revision 결과 `stale` 처리
- [ ] **B-318** AI 실패 상태 저장

---

# B4. 요약 수정 / 확정 / 정정

- [ ] **B-401** 요약 수정 API 구현
- [ ] **B-402** 기록 확정 API 구현
- [ ] **B-403** 확정 시 최신 `content_revision` 검증
- [ ] **B-404** stale summary 확정 차단
- [ ] **B-405** `corrections` Migration 작성
- [ ] **B-406** 정정 기록 RLS 적용
- [ ] **B-407** 정정 기록 추가 API 구현
- [ ] **B-408** 확정된 날짜에만 정정 기록 허용
- [ ] **B-409** 확정 후 원문 불변성 테스트

---

# B5. 기록 목록 / 진료 준비

- [ ] **B-501** 기록 목록 조회 API 구현
- [ ] **B-502** 미확인 기록 개수 조회 구현
- [ ] **B-503** 진료 준비 Service/API 구현
- [ ] **B-504** 확정된 기록만 기본 포함
- [ ] **B-505** 선택 기간 미확인 기록 개수/날짜 반환
- [ ] **B-506** 기록이 없는 날짜 결과에서 제외
- [ ] **B-507** 정정 기록 포함
- [ ] **B-508** 날짜별 원문 조회 지원
- [ ] **B-509** 진료 준비에서 다일 OpenAI 분석을 호출하지 않는지 테스트

---

# B6. 삭제 / 보안 강화

- [ ] **B-601** 하루 기록 전체 삭제 API 및 Cascade 처리
- [ ] **B-602** 전체 건강 기록 삭제 Service/API 구현
- [ ] **B-603** 계정 삭제 Service/API 구현
- [ ] **B-604** Supabase Auth 사용자 삭제 처리
- [ ] **B-605** 삭제 후 Session 정리
- [ ] **B-606** 모든 사용자 데이터 테이블 RLS 재검토
- [ ] **B-607** 사용자 A/B 격리 테스트
- [ ] **B-608** Service Role Key 서버 전용 검증
- [ ] **B-609** OpenAI API Key 서버 전용 검증
- [ ] **B-610** 건강 원문 로그 노출 여부 점검
- [ ] **B-611** 오류 모니터링 Health Text 제거 전략 적용
- [ ] **B-612** Scheduler Secret 적용
- [ ] **B-613** 최소 Rate Limit 적용 여부 결정 및 구현
- [ ] **B-614** 파괴적 작업 Transaction / 실패 복구 테스트

---

# B7. 백엔드 테스트 / AI Evaluation 준비

- [ ] **B-701** 시스템 시간대 23:59 → 같은 `local_date` 검증
- [ ] **B-702** 시스템 시간대 다음날 00:00 → 다음 `local_date` 검증
- [ ] **B-703** 기존 record의 `local_date` 불변성 검증
- [ ] **B-704** summary revision race condition 테스트
- [ ] **B-705** confirmed mutation 차단 테스트
- [ ] **B-706** visit prep confirmed-only 테스트
- [ ] **B-707** 삭제 기능 테스트
- [ ] **B-708** API Integration Test 전체 실행
- [ ] **B-709** AI Evaluation Dataset 20개 이상 작성
- [ ] **B-710** Prompt Injection Case 포함
- [ ] **B-711** 진단/원인 추정/치료 추천 금지 Case 검증

---

# 백엔드 완료 기준

- Frontend 없이 API와 DB 규칙을 테스트할 수 있음
- 모든 사용자 데이터에 RLS가 적용됨
- 원문 저장과 AI 실패가 분리됨
- 시간대는 사용자 설정이 아닌 자동 전달 metadata로만 처리됨
- 자동 일일 요약이 record 생성 당시 시스템 시간대를 기준으로 날짜 종료를 판정함
- 담당 테스트 통과
- 완료 후 `docs/TASKS.md`의 백엔드 상태를 갱신
