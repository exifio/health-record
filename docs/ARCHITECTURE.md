# ARCHITECTURE — 시스템 구조

## 1. 목표

- 하나의 Next.js 저장소 안에서 Frontend/Backend를 논리적으로 분리
- API Contract를 기준으로 병렬 개발
- 원문 저장을 AI 처리보다 먼저 보장
- 사용자별 데이터 격리
- 날짜/상태 전이를 서버에서 일관되게 처리
- AI 호출을 별도 Service Layer에 격리

## 2. 전체 구성

```text
Browser
  │
  ├─ Next.js UI
  │    └─ Demo Mode: local static fixture
  │
  └─ /api/*
       │
       ├─ Auth Guard
       ├─ Request Validation
       ├─ Application Service
       │    ├─ DailyRecordService
       │    ├─ SummaryService
       │    ├─ VisitPrepService
       │    └─ AccountService
       │
       ├─ Repository
       │    └─ Supabase PostgreSQL
       │
       └─ AI Service
            └─ OpenAI API

Scheduled Job
  └─ authenticated internal endpoint
       └─ SummaryService
```

## 3. 레이어

### UI Layer

- 페이지와 컴포넌트
- 비즈니스 규칙을 직접 구현하지 않음
- 상태 전이 가능 여부는 API 응답을 기준으로 표시

### API Layer

- Route Handler
- 인증 확인
- 요청 schema validation
- HTTP status/response shape 통일
- 실제 비즈니스 규칙은 Service로 위임

### Service Layer

핵심 규칙 위치:
- 어떤 날짜에 기록할 수 있는가
- 확정 후 수정 금지
- 원문 수정 시 summary stale 처리
- confirm 조건
- visit prep 포함 조건
- 삭제 범위

### Repository Layer

- SQL/Supabase query 격리
- UI나 API route가 직접 여러 테이블을 조합하지 않음

### AI Service Layer

- OpenAI client와 prompt/structured output schema 격리
- 앱 전체에서 모델명을 직접 사용하지 않음
- 사용자 원문을 '명령'이 아니라 '분석 대상 데이터'로 처리

## 4. 주요 데이터 흐름

### 4.1 메시지 작성

```text
Client
→ POST message
→ Auth
→ Validate
→ DB transaction
   - daily_record 생성/조회
   - message 저장
   - content_revision +1
   - 필요 시 기존 summary stale
→ 201 Response
→ 이후 별도 suggestion 요청 가능
```

AI 호출은 메시지 저장 transaction 안에 넣지 않습니다.

### 4.2 보완 제안

```text
Client/Server trigger
→ message already saved
→ AI Suggestion Service
→ structured output validation
→ suggestion 저장
→ UI에 optional hint 표시
```

실패해도 message는 이미 저장된 상태입니다.

### 4.3 날짜 종료 후 요약

```text
Scheduler
→ 내부 endpoint 인증
→ 요약 대상 daily_record 조회
→ atomic claim: pending/stale → processing
→ 원문 + content_revision 읽기
→ OpenAI structured output
→ 저장 직전 source revision 재검증
   ├─ 같음: summary 저장, ready
   └─ 다름: 결과 폐기, stale/pending 유지
```

이 revision 검증으로 사용자가 요약 생성 중 원문을 수정해도 오래된 AI 결과가 최신 요약을 덮어쓰지 않게 합니다.

### 4.4 확정

```text
Client confirm
→ record_status=draft 확인
→ summary_status=ready 확인
→ summary.source_revision == daily_record.content_revision 확인
→ user_final_summary 존재 시 사용, 없으면 ai_draft 사용
→ confirmed_at 저장
→ record_status=confirmed
```

### 4.5 확정 후 정정

```text
Client
→ correction 추가
→ 기존 message/summary 변경 없음
→ correction row 추가
```

### 4.6 진료 준비

MVP에서는 다일 AI 호출을 하지 않습니다.

```text
Client period
→ VisitPrepService
→ 기간 내 confirmed records 조회
→ confirmed summary + corrections 조합
→ unconfirmed count/date 계산
→ chronological response
```

## 5. 중요한 설계 결정

### 다일 AI 분석을 하지 않는 이유

기획에는 `createVisitReport()`가 AI 예시로 제시되어 있지만, 더 강한 제품 정책은 '확정된 날짜별 기록을 시간순으로 보여주고 패턴 분석은 하지 않는다'입니다. 따라서 MVP에서는 진료 준비를 일반 Application Service로 구현하고 OpenAI를 호출하지 않습니다.

### 요약 상태와 기록 상태를 분리하는 이유

`작성 중`, `정리 중`, `확인 필요`, `확정`을 하나의 enum으로 두면 원문 상태와 비동기 AI 작업 상태가 섞입니다. `record_status`와 `summary_status`를 분리하면 실패·재시도·stale 처리가 단순해집니다.

### 시스템 시간대 자동 사용과 과거 날짜 불변

사용자는 timezone을 설정하지 않습니다. Client가 기록 시점의 기기/브라우저 시스템 timezone을 자동 전달하고, 서버는 새 daily record의 `timezone_at_creation` snapshot과 `local_date`를 저장합니다. 이후 기기 timezone이 바뀌어도 이미 저장된 `local_date`를 다시 계산하지 않습니다. 그렇지 않으면 과거 하루 요약의 경계가 바뀔 수 있습니다.

## 6. 비동기 작업

MVP에서는 별도 큐 시스템을 필수로 두지 않습니다.

필요한 최소 기능:
- scheduled trigger
- idempotent 처리
- processing lock/claim
- retry
- timeout된 processing 상태 복구

트래픽이 커지면 이후 queue/worker로 분리할 수 있습니다.

## 7. 장애 격리

| 장애 | 영향 |
|---|---|
| OpenAI 실패 | 원문 유지, summary 실패 상태 |
| suggestion 실패 | 원문 유지, 제안 미표시 |
| summary 저장 실패 | 원문 유지, 재시도 가능 |
| DB 원문 저장 실패 | 사용자에게 저장 실패 표시, AI 호출 금지 |
| scheduler 지연 | summary pending, 원문 유지 |

## 8. 관찰 가능성

로그에 남겨도 되는 것:
- request id
- user의 비식별 내부 UUID 일부 또는 hash
- daily_record id
- 상태 전이
- 오류 코드
- AI latency/token metadata(가능한 범위)

로그에 남기지 않는 것:
- 건강 원문
- AI가 생성한 건강 요약 전문
- 약 이름/증상 텍스트
- OAuth token

