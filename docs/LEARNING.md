# LEARNING — 개발하면서 알아야 할 핵심 개념

목표는 모든 기술을 깊게 공부하는 것이 아니라, 이 프로젝트에서 잘못 이해하면 설계/보안 문제가 생기는 개념을 작업 시점에 짧게 익히는 것입니다.

## 공통 기반 작업 — 관계형 DB / API Contract

### SQL Table

1. 무엇인가: 같은 종류의 데이터를 행(row)과 열(column)로 저장하는 구조입니다.
2. 여기서는: 사용자, 하루 기록, 메시지, 요약을 각각 table로 저장합니다.
3. 왜 필요한가: 데이터 역할과 관계를 명확히 분리할 수 있습니다.

### Primary Key

1. 각 row를 유일하게 식별하는 값입니다.
2. `daily_records.id`, `record_messages.id` 등에 사용합니다.
3. URL이나 관계 연결에서 정확한 한 row를 가리키기 위해 필요합니다.

### Foreign Key

1. 한 table이 다른 table을 참조하는 규칙입니다.
2. message가 어떤 daily_record에 속하는지 연결합니다.
3. 존재하지 않는 부모를 참조하는 잘못된 데이터를 막습니다.

### 관계형 DB

1. 서로 연관된 데이터를 관계로 연결하는 DB 방식입니다.
2. `user → daily_record → messages/summary` 구조에 적합합니다.
3. 소유권, 삭제, 조회 조건을 일관되게 관리하기 좋습니다.

### JSONB

1. PostgreSQL에서 JSON 구조를 저장하면서 검색/인덱싱도 할 수 있는 타입입니다.
2. AI structured output처럼 항목 구조가 약간 유동적인 데이터에 사용합니다.
3. 매번 table column을 늘리지 않으면서도 AI 결과를 구조적으로 저장할 수 있습니다.

### API Contract

1. Frontend와 Backend가 주고받는 요청/응답 약속입니다.
2. `/api/daily-records/:date/messages`의 body/response를 정의합니다.
3. 두 AI가 서로 내부 구현을 몰라도 병렬 개발할 수 있게 합니다.

## Backend 초반 — 인증/권한

### Authentication

1. 사용자가 누구인지 확인하는 것입니다.
2. Google 로그인 + Supabase Auth에 사용합니다.
3. 익명 사용자가 실제 건강 데이터를 저장하지 않도록 합니다.

### Authorization

1. 로그인한 사용자가 어떤 데이터에 접근할 수 있는지 결정합니다.
2. User A가 User B 기록을 못 보게 합니다.
3. 로그인만 했다고 모든 데이터에 접근할 수 있는 것은 아니기 때문입니다.

### RLS

1. PostgreSQL row 단위 접근 규칙입니다.
2. `user_id = auth.uid()`처럼 본인 row만 조회하도록 합니다.
3. Frontend 버그나 API 실수가 있어도 DB가 마지막 방어선이 됩니다.

### Environment Variable

1. 코드 밖에서 secret/config를 주입하는 값입니다.
2. OpenAI key, Supabase service role key, model명에 사용합니다.
3. secret을 Git이나 브라우저 bundle에 넣지 않기 위해 필요합니다.

## Frontend/Backend 경계 — Next.js

### Server Component

1. 서버에서 렌더링되는 React component입니다.
2. 읽기 중심 페이지와 초기 데이터 로드에 적합합니다.
3. 불필요한 client JavaScript를 줄이고 server-only 접근을 분리할 수 있습니다.

### Client Component

1. 브라우저에서 상호작용이 필요한 component입니다.
2. 메시지 입력, 사이드바 토글, 편집 UI에 사용합니다.
3. `useState`, event handler가 필요하기 때문입니다.

### Route Handler

1. Next.js App Router에서 HTTP API endpoint를 만드는 방법입니다.
2. `/api/*` 구현에 사용합니다.
3. 별도 Node backend repository 없이 API boundary를 만들 수 있습니다.

## Backend AI 작업 — AI / 비동기

### Async 작업

1. 요청과 별개로 시간이 걸리는 처리를 수행하는 방식입니다.
2. OpenAI 요약/제안에 사용합니다.
3. AI가 느리거나 실패해도 원문 저장을 막지 않기 위해 필요합니다.

### Cron / Scheduled Job

1. 정해진 주기로 서버 작업을 실행하는 방식입니다.
2. 하루가 끝난 record를 찾아 자동 요약합니다.
3. 사용자가 버튼을 누르지 않아도 정리가 진행되게 합니다.

### Structured Output

1. AI에게 자유 문장 대신 미리 정한 JSON 구조로 응답하게 하는 방식입니다.
2. timeline, medication, missingInformation에 사용합니다.
3. 저장/검증/UI 렌더링을 더 안정적으로 만듭니다.

## Backend 핵심 — 데이터 무결성

### Transaction

1. 여러 DB 변경을 하나의 작업처럼 성공/실패시키는 기능입니다.
2. message 수정 + revision 증가 + summary stale 처리를 묶습니다.
3. 중간만 성공한 이상한 상태를 막습니다.

### Revision

1. 원문이 몇 번째 버전인지 나타내는 숫자입니다.
2. `content_revision`으로 AI가 어떤 원문을 보고 요약했는지 확인합니다.
3. AI 처리 중 사용자가 원문을 수정했을 때 오래된 결과 저장을 막습니다.

### Idempotency

1. 같은 요청/작업이 반복돼도 결과가 중복되지 않게 하는 성질입니다.
2. scheduler, summary retry에 중요합니다.
3. cron이 겹치거나 네트워크 재시도가 있어도 summary가 중복 생성되는 문제를 줄입니다.

### Index

1. DB가 특정 조건의 row를 빠르게 찾도록 돕는 자료구조입니다.
2. `(user_id, local_date)`, summary job scan 등에 사용합니다.
3. 사용자가 많아져도 전체 table을 매번 훑지 않게 합니다.

## 통합 전 확인 — 파생 데이터

### Source of Truth

1. 최종적으로 사실의 기준이 되는 데이터입니다.
2. 이 프로젝트에서는 사용자 원문이 source of truth입니다.
3. AI 요약이 틀려도 원문으로 돌아갈 수 있어야 합니다.

### Derived Data

1. 원본으로부터 계산/생성한 데이터입니다.
2. AI summary, suggestions, visit prep view입니다.
3. 원본을 지우거나 대체하지 않고 다시 만들 수 있어야 합니다.

## Backend/Integration — 삭제/보안

### Cascade Delete

1. 부모 row 삭제 시 연결된 자식 row도 삭제하는 DB 규칙입니다.
2. 하루 전체 삭제에서 messages/summaries 등을 함께 제거합니다.
3. 관련 데이터가 남는 orphan 문제를 막습니다.

### Least Privilege

1. 필요한 최소 권한만 주는 보안 원칙입니다.
2. 일반 사용자 요청은 service role 대신 사용자 세션+RLS로 처리합니다.
3. service role이 유출되거나 코드가 잘못되어도 피해 범위를 줄입니다.

## 학습 방식

각 관련 작업 묶음을 시작하기 전에 해당 개념만 10~20분 정도 이해하고 바로 구현에 적용합니다. 별도 장기 이론 학습 때문에 MVP 진행을 멈추지 않습니다.

