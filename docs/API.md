# API — Frontend/Backend Contract

## 1. 공통 규칙

- Base: `/api`
- JSON request/response
- 인증 필요 API는 로그인 세션 기준
- 날짜: `YYYY-MM-DD`
- timestamp: ISO 8601 UTC
- API는 클라이언트가 전달한 `user_id`를 신뢰하지 않음
- 모든 응답 field는 TypeScript contract와 동기화

### Error response

모든 JSON 오류 응답은 아래 형태를 사용합니다. `204` 응답에는 body가 없습니다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청을 확인해주세요."
  }
}
```

대표 status/code: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 RECORD_NOT_FOUND | MESSAGE_NOT_FOUND`, `409 RECORD_CONFIRMED | RECORD_NOT_CONFIRMED | SUMMARY_NOT_READY | SUMMARY_STALE | SUMMARY_NOT_RETRYABLE`, `500 INTERNAL_ERROR`, `503 AI_SUGGESTION_FAILED | AI_SUMMARY_FAILED`.

## 2. 공통 타입

```ts
type RecordStatus = 'draft' | 'confirmed';

type SummaryStatus =
  | 'not_due'
  | 'pending'
  | 'processing'
  | 'ready'
  | 'stale'
  | 'failed';
```

### DailyRecordListItem

```ts
interface DailyRecordListItem {
  date: string;
  recordStatus: RecordStatus;
  summaryStatus: SummaryStatus;
  messageCount: number;
  confirmedAt: string | null;
}
```

## 3. 오늘/날짜 기록 조회

### GET `/api/daily-records/:date`

Response 200:

```json
{
  "record": {
    "date": "2026-09-25",
    "recordStatus": "draft",
    "summaryStatus": "not_due",
    "contentRevision": 4,
    "messages": [
      {
        "id": "uuid",
        "content": "오늘 아침부터 머리가 조금 아팠어요.",
        "createdAt": "2026-09-25T00:20:00Z",
        "updatedAt": "2026-09-25T00:20:00Z"
      }
    ],
    "summary": null,
    "corrections": []
  }
}
```

없는 날짜는 `404 RECORD_NOT_FOUND`를 반환하며 빈 record를 임의 생성하지 않습니다. 오늘 첫 메시지 작성 시 생성합니다.

## 4. 기록 목록

### GET `/api/daily-records?from=YYYY-MM-DD&to=YYYY-MM-DD`

Response 200:

```json
{
  "items": [],
  "unreviewedCount": 0
}
```

기록이 없는 날짜는 items에 포함하지 않습니다.

## 5. 메시지 추가

### POST `/api/daily-records/:date/messages`

Request:

```json
{
  "content": "오늘 아침부터 머리가 조금 아팠어요.",
  "systemTimeZone": "Asia/Seoul"
}
```

`systemTimeZone`은 사용자가 입력하는 설정값이 아닙니다. Frontend가 브라우저/기기의 시스템 timezone을 자동 감지하여 전달합니다. 새 daily record를 생성할 때만 내부 `timezone_at_creation` snapshot으로 사용하며, 기존 record의 날짜를 다시 계산하는 데 사용하지 않습니다.

Response 201:

```json
{
  "message": {
    "id": "uuid",
    "content": "오늘 아침부터 머리가 조금 아팠어요.",
    "createdAt": "2026-09-25T00:20:00Z",
    "updatedAt": "2026-09-25T00:20:00Z"
  },
  "record": {
    "date": "2026-09-25",
    "recordStatus": "draft",
    "summaryStatus": "not_due",
    "contentRevision": 1
  }
}
```

Rules:
- confirmed record → 409
- future date → 400
- past date는 기존 draft record가 있을 때만 추가 허용하는 것을 MVP 기본안으로 함
- 과거에 record가 전혀 없던 날짜를 새로 만드는 기능은 추가 결정 필요

## 6. 메시지 수정

### PATCH `/api/daily-records/:date/messages/:messageId`

Request:

```json
{ "content": "수정된 내용" }
```

Response 200:

```json
{
  "message": {
    "id": "uuid",
    "content": "수정된 내용",
    "createdAt": "2026-09-25T00:20:00Z",
    "updatedAt": "2026-09-25T01:20:00Z"
  },
  "record": {
    "date": "2026-09-25",
    "recordStatus": "draft",
    "summaryStatus": "stale",
    "contentRevision": 5
  }
}
```

Rules:
- confirmed → 409
- summary ready 상태였다면 response에서 `summaryStatus`가 `stale` 또는 `pending`으로 바뀔 수 있음

## 7. 메시지 삭제

### DELETE `/api/daily-records/:date/messages/:messageId`

Response 204

confirmed record → 409 `RECORD_CONFIRMED`.

마지막 메시지를 삭제해 record가 비면 빈 draft `daily_record`도 함께 삭제합니다.

## 8. 보완 제안 생성

### POST `/api/daily-records/:date/suggestions`

Response 200:

```json
{
  "suggestions": [
    {
      "id": "uuid",
      "field": "onset_time",
      "text": "언제쯤 시작되었는지 기록할 수 있어요."
    }
  ]
}
```

AI 실패:
- 503 가능
- 기존 메시지 저장 상태에는 영향 없음

## 9. 요약 재시도

### POST `/api/daily-records/:date/summary/retry`

Request body 없음

Rules:
- `failed`, `stale`에서 `pending`으로 되돌려 스케줄러가 다시 정리하도록 합니다.
- `pending`에서 중복 호출은 상태를 바꾸지 않고 같은 202를 반환합니다.
- `not_due`(아직 하루가 끝나지 않음), `processing`(이미 정리 중), `ready`(정리 완료), 확정된 record는 409 `SUMMARY_NOT_RETRYABLE`로 거절합니다.
- 기록이 없으면 404 `RECORD_NOT_FOUND`.
- 재시도는 원문(`content_revision`)을 바꾸지 않고, `processing_started_at`만 비웁니다.
- 재시도 자체는 AI를 호출하지 않습니다. 실제 AI 호출은 스케줄러(18절)가 담당하며, 사용자는 `pending` 상태를 새로고침해 확인합니다.

Response 202:

```json
{ "summaryStatus": "pending" }
```

## 10. 요약 조회/수정

GET detail 응답의 summary 예:

```json
{
  "summary": {
    "sourceRevision": 4,
    "aiDraft": {
      "timeline": [
        {
          "text": "오전에 두통을 기록함",
          "sourceMessageIds": ["uuid"]
        }
      ],
      "medications": [],
      "missingInformation": []
    },
    "userFinal": null,
    "generatedAt": "2026-09-26T00:10:00Z"
  }
}
```

### PATCH `/api/daily-records/:date/summary`

Request:

```json
{
  "timeline": [
    {
      "text": "오전에 가벼운 두통이 있었음",
      "sourceMessageIds": ["uuid"]
    }
  ],
  "medications": [],
  "missingInformation": []
}
```

- confirmed record는 수정 불가
- source revision이 최신이 아니면 409 `SUMMARY_STALE`

Response 200은 GET detail과 같은 `summary` object를 반환합니다. `userFinal`에는 저장한 내용을 담습니다.

## 11. 확정

### POST `/api/daily-records/:date/confirm`

Request body 없음

Preconditions:
- record_status=draft
- summary_status=ready
- summary.source_revision == record.content_revision

Response:

```json
{
  "recordStatus": "confirmed",
  "confirmedAt": "2026-09-26T02:00:00Z"
}
```

## 12. 확정 후 정정

### POST `/api/daily-records/:date/corrections`

Request:

```json
{
  "content": "이전 기록을 확인해보니 당시 복용한 약은 A가 아니라 B였습니다."
}
```

Rules:
- target daily record가 confirmed여야 함
- 원본 message/summary는 수정하지 않음

Response 201:

```json
{
  "correction": {
    "id": "uuid",
    "content": "이전 기록을 확인해보니 당시 복용한 약은 A가 아니라 B였습니다.",
    "createdAt": "2026-09-26T02:00:00Z"
  }
}
```

## 13. 날짜 전체 삭제

### DELETE `/api/daily-records/:date`

Response 204

- confirmed 여부와 관계없이 사용자 본인이 삭제 가능
- 연결 데이터 cascade/transaction 처리

## 14. 진료 준비

### GET `/api/visit-prep?from=2026-09-01&to=2026-09-25`

Response:

```json
{
  "range": {
    "from": "2026-09-01",
    "to": "2026-09-25"
  },
  "unreviewed": {
    "count": 2,
    "dates": ["2026-09-21", "2026-09-23"]
  },
  "confirmedRecords": [
    {
      "date": "2026-09-02",
      "summary": {
        "timeline": []
      },
      "corrections": []
    }
  ]
}
```

MVP에서 이 endpoint는 OpenAI를 호출하지 않습니다.

## 15. 프로필

### GET `/api/profile`

```json
{
  "onboardingCompleted": true
}
```

### PATCH `/api/profile`

Request:

```json
{ "onboardingCompleted": true }
```

Response 200은 GET `/api/profile`과 같은 shape입니다. MVP에서는 온보딩 완료 상태처럼 실제 사용자 프로필에 필요한 최소 필드만 갱신합니다. timezone 설정 API는 제공하지 않습니다.

## 16. 전체 건강 기록 삭제

### DELETE `/api/health-data`

- 계정 유지
- 모든 health-domain data 삭제
- 성공 시 `204 No Content`

## 17. 계정 삭제

### DELETE `/api/account`

- health data 삭제
- profile 삭제
- auth account 삭제
- 성공 시 `204 No Content`

성공 후 세션 무효화.

## 18. 내부 Scheduler API

### POST `/api/internal/daily-summary/run`

- 일반 사용자 호출 금지
- `CRON_SECRET` 등 서버 간 인증
- 대상 record batch 처리
- raw health text를 response에 포함하지 않음

Response 예:

```json
{
  "claimed": 10,
  "completed": 9,
  "failed": 1
}
```

## 19. 인증

인증 endpoint는 MVP 범위 안의 Contract이며, 프론트/백엔드가 함께 사용하는 경로입니다.
MVP는 Google 로그인만 제공하며 Kakao 로그인은 구현하지 않습니다.

### GET `/api/auth/google`

- Request body 없음
- Supabase OAuth 인가 URL로 302 리다이렉트합니다.
- redirect target은 `/api/auth/callback`입니다.
- 인증 실패 시 `500 INTERNAL_ERROR`

### GET `/api/auth/callback`

Query:

```text
?code=<authorization code>
```

- `code`가 없으면 `400 VALIDATION_ERROR`
- 세션 교환에 성공하면 `/`로 307 리다이렉트합니다.
- code 교환 실패 시 `400 VALIDATION_ERROR`

### POST `/api/auth/logout`

- Request body 없음
- 현재 브라우저 세션만 종료합니다(`scope: "local"`).
- Response 204
- 세션이 이미 없는 경우에도 204를 반환합니다.
