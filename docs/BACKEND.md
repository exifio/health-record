# BACKEND — 서버 구현 가이드

## 1. 담당 범위

```text
src/app/api
src/server
src/lib/supabase/server*
supabase/migrations
```

Backend AI는 UI를 수정하지 않습니다.

## 2. 서버 모듈 권장 구조

```text
src/server/
  auth/
    require-user.ts
  services/
    daily-record-service.ts
    summary-service.ts
    suggestion-service.ts
    visit-prep-service.ts
    account-service.ts
  repositories/
    daily-record-repository.ts
    summary-repository.ts
    correction-repository.ts
  ai/
    openai-client.ts
    daily-summary.ts
    suggestions.ts
    schemas.ts
    prompts.ts
  time/
    timezone.ts
  errors/
    app-error.ts
```

## 3. Route Handler 원칙

Route Handler는 다음만 담당합니다.

1. 인증
2. path/query/body 파싱
3. runtime validation
4. Service 호출
5. HTTP response 변환

비즈니스 규칙을 Route Handler에 직접 넣지 않습니다.

## 4. 인증/인가

### 인증

모든 사용자 API에서 server-side session을 확인합니다.

### 인가

- 조회/변경 대상이 로그인 사용자 소유인지 Service/DB에서 검증
- RLS를 최종 방어선으로 유지
- service role을 사용하는 코드에서는 RLS 우회를 인식하고 반드시 명시적 user 조건을 사용

## 5. DailyRecordService

책임:
- 날짜 record 생성/조회
- 메시지 추가/수정/삭제
- 확정 여부 검사
- content revision 갱신
- summary stale 처리
- 하루 전체 삭제

### 메시지 변경 알고리즘

1. record가 `confirmed`면 일반 수정 거부
2. message 변경 transaction 시작
3. message 변경
4. `content_revision += 1`
5. 날짜가 이미 종료됐고 summary가 존재하면 `summary_status = stale`
6. commit

## 6. SummaryService

책임:
- 요약 대상 탐색
- 작업 claim
- OpenAI 호출
- source revision 검증
- ready/failed 상태 변경
- retry
- confirm validation

### idempotency

- 같은 record에 여러 scheduler가 동시에 접근해도 한 작업만 `processing`으로 claim
- `UPDATE ... WHERE summary_status IN (...) RETURNING ...` 같은 조건부 update 사용 권장
- AI 결과 저장 전 `content_revision` 재확인

### processing timeout

예상치 못한 종료로 `processing`이 영구 고착되지 않도록 `processing_started_at`을 저장합니다. 일정 시간 이상 지난 processing은 다음 scheduler에서 재시도 대상으로 돌릴 수 있게 설계합니다. 구체 시간은 운영 환경에서 정합니다.

## 7. SuggestionService

- 메시지 저장과 분리
- 최신 원문 일부를 사용해 최대 2~3개 제안
- structured output validation 실패 시 저장하지 않음
- AI 실패를 사용자 기록 실패로 전달하지 않음

## 8. VisitPrepService

OpenAI를 호출하지 않습니다.

입력:
- user id
- from date
- to date

출력:
- confirmed daily summaries
- corrections
- unconfirmed date/count

규칙:
- no-record day 제외
- unconfirmed summary 내용은 반환 목록에서 기본 제외
- raw messages는 사용자가 특정 날짜를 펼칠 때 별도 endpoint로 조회 가능

## 9. AccountService

### 모든 건강 기록 삭제

- 계정 유지
- health-domain rows 삭제
- transaction 또는 DB function으로 원자성 확보 권장

### 계정 삭제

1. 사용자 health-domain data 삭제
2. profile 삭제
3. Supabase Auth user 삭제

Auth user 삭제는 서버 전용 권한이 필요할 수 있으므로 service role key는 서버 모듈 밖에 노출하지 않습니다.

## 10. 날짜 / 시스템 시간대 처리

- 사용자가 timezone을 선택하거나 profile에 timezone 설정값을 저장하지 않습니다.
- Frontend가 브라우저/기기의 IANA timezone을 자동 감지해 메시지 생성 요청에 전달합니다.
- 서버는 전달된 timezone 형식을 검증합니다.
- 새 `daily_record`를 생성할 때 `timezone_at_creation`에 snapshot으로 저장합니다.
- `created_at`은 UTC `timestamptz`로 저장합니다.
- message의 소속 날짜는 `daily_records.local_date`로 고정하고 이후 다시 계산하지 않습니다.
- Scheduler는 `timezone_at_creation`을 사용해 해당 `local_date`가 종료되었는지 판단합니다.
- 기기 timezone이 이후 변경되어도 기존 record를 재분류하지 않습니다.

## 11. Validation

권장:
- API body/query/path 모두 runtime schema validation
- content 빈 문자열 금지
- 과도한 길이 제한 설정
- 날짜 문자열 `YYYY-MM-DD`
- 미래 날짜 기록 생성 금지
- confirmed record mutation 금지

정확한 최대 글자 수는 UX 테스트 후 결정 가능하나 서버 제한은 반드시 존재해야 합니다.

## 12. 에러 모델

예:

```json
{
  "error": {
    "code": "RECORD_CONFIRMED",
    "message": "확정된 기록은 수정할 수 없습니다."
  }
}
```

대표 코드:
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `RECORD_NOT_FOUND`
- `RECORD_CONFIRMED`
- `SUMMARY_NOT_READY`
- `SUMMARY_STALE`
- `AI_SUMMARY_FAILED`
- `INTERNAL_ERROR`

사용자 건강 원문을 error payload에 다시 넣지 않습니다.

