# DATABASE — Supabase PostgreSQL 설계

## 1. 관계 개요

```text
auth.users
  1 ─ 1 profiles
  1 ─ N daily_records
          1 ─ N record_messages
          1 ─ 1 daily_summaries
          1 ─ N record_suggestions
          1 ─ N corrections
```

MVP에서는 `visit_reports`를 별도 저장하지 않는 것을 권장합니다. 진료 준비는 확정된 일일 요약을 기간 조건으로 읽어 실시간 조합할 수 있기 때문입니다. 저장/공유 기능이 생길 때 snapshot table을 추가합니다.

## 2. profiles

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | `auth.users.id`와 동일 |
| onboarding_completed_at | timestamptz null | 온보딩 완료 |
| created_at | timestamptz | 생성 시간 |
| updated_at | timestamptz | 수정 시간 |

주의: 건강 상태나 질병 정보를 profile에 넣지 않습니다.

## 3. daily_records

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | 내부 id |
| user_id | uuid FK | profiles/auth user |
| local_date | date | 이 기록이 속한 사용자 기준 날짜 |
| timezone_at_creation | text | record 최초 생성 당시 자동 감지된 IANA timezone snapshot. 사용자 설정값 아님 |
| record_status | text/enum | draft, confirmed |
| summary_status | text/enum | not_due, pending, processing, ready, stale, failed |
| content_revision | integer | 원문 변경마다 증가 |
| processing_started_at | timestamptz null | stuck job 복구용 |
| confirmed_at | timestamptz null | 사용자 확정 시각 |
| created_at | timestamptz | 생성 |
| updated_at | timestamptz | 수정 |

Constraint:

```text
UNIQUE(user_id, local_date)
content_revision >= 0
```

권장 index:
- `(user_id, local_date desc)`
- `(summary_status, local_date)` scheduled scan 용도

`timezone_at_creation`은 사용자 프로필 설정이 아니라 자동 일일 정리를 위한 내부 snapshot입니다. 한 번 생성된 `local_date`는 이후 기기 timezone이 바뀌어도 재계산하지 않습니다.

## 4. record_messages

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | message id |
| daily_record_id | uuid FK | daily_records |
| content | text | 사용자 원문 |
| created_at | timestamptz | 최초 작성 시간 |
| updated_at | timestamptz | 수정 시간 |

삭제: daily_record 삭제 시 cascade.

Index:
- `(daily_record_id, created_at)`

## 5. daily_summaries

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | summary id |
| daily_record_id | uuid UNIQUE FK | 하루당 최신 summary 1개 |
| source_revision | integer | 어떤 원문 revision 기반인지 |
| ai_draft | jsonb | AI structured output 원본 |
| user_final | jsonb null | 사용자가 수정/확인한 최종 구조 |
| model | text | 실행 모델 기록 |
| prompt_version | text | prompt 버전 |
| generated_at | timestamptz | AI 생성 시간 |
| updated_at | timestamptz | 사용자 수정 포함 |

`user_final`은 confirm 시 비어 있다면 `ai_draft`를 논리적으로 최종본으로 사용합니다. 구현 편의를 위해 confirm 시 복사해도 됩니다.

## 6. record_suggestions

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | suggestion set id |
| daily_record_id | uuid FK | 해당 날짜 |
| source_revision | integer | 어떤 원문 기준인지 |
| suggestions | jsonb | 최대 2~3개 제안 |
| created_at | timestamptz | 생성 |
| dismissed_at | timestamptz null | 사용자가 닫은 경우 |

MVP에서는 제안을 항목별 정규화할 필요가 없습니다.

## 7. corrections

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | correction id |
| daily_record_id | uuid FK | 대상 확정 날짜 |
| content | text | 사용자가 작성한 정정 원문 |
| created_at | timestamptz | 정정 작성 시각 |

Rules:
- 대상 record는 confirmed 상태여야 함
- 기존 message/summary FK를 덮어쓰지 않음

## 8. JSONB 예시

### ai_draft / user_final

```json
{
  "timeline": [
    {
      "text": "오전에 두통을 기록함",
      "sourceMessageIds": ["message-uuid"]
    }
  ],
  "medications": [
    {
      "name": null,
      "timeText": "점심 식사 후",
      "effectText": "오후에는 조금 괜찮아졌다고 기록함",
      "sourceMessageIds": ["message-uuid-2", "message-uuid-3"]
    }
  ],
  "missingInformation": [
    {
      "field": "medication_name",
      "text": "복용한 약 이름을 기록할 수 있어요."
    }
  ]
}
```

주의: `effectText`도 사용자가 직접 기록한 변화만 담습니다. 약이 원인이었다고 표현하지 않습니다.

## 9. Transaction이 필요한 작업

### message mutation

한 transaction에서:
- message 변경
- daily_record.content_revision 증가
- summary stale/pending 처리

### 날짜 전체 삭제

한 transaction 또는 cascade FK로:
- corrections
- suggestions
- summaries
- messages
- daily_record

### 건강 기록 전체 삭제

사용자 health-domain data 전체 삭제가 부분 성공 상태로 남지 않도록 DB function/transaction을 권장합니다.

## 10. RLS 개요

### profiles

`id = auth.uid()`

### daily_records

`user_id = auth.uid()`

### child tables

예:

```sql
exists (
  select 1
  from daily_records dr
  where dr.id = record_messages.daily_record_id
    and dr.user_id = auth.uid()
)
```

summary/suggestions/corrections도 같은 소유권 경로를 사용합니다.

### write RPC 호출 주체

사용자 데이터 write RPC는 **service role이 아니라 사용자 세션 클라이언트**로 호출해야 합니다.
service role로 호출하면 JWT에 `sub`가 없어 `auth.uid()`가 NULL이 되고, `auth.uid()`로 권한을
검증하는 RPC는 항상 FORBIDDEN이 됩니다.

| RPC | 호출 주체 | 권한 검증 |
|---|---|---|
| `create_record_message`, `update_record_message`, `delete_record_message` | 세션 클라이언트 | `auth.uid()` 대조 |
| `update_daily_summary`, `confirm_daily_record`, `create_record_correction` | 세션 클라이언트 | `auth.uid()` 대조 |
| `retry_daily_summary` | 세션 클라이언트 | `auth.uid()` 대조 |
| `delete_daily_record`, `delete_health_data`, `delete_account_data` | 세션 클라이언트 | `auth.uid()` 기반 |
| `claim_daily_summary`, `complete_daily_summary`, `fail_daily_summary` | service role (스케줄러) | 서버 간 인증 + record 단위 claim |
| Supabase Auth 사용자 삭제 | service role (Auth Admin API) | 서버 전용 |

write RPC는 모두 `security definer` + `set search_path = ''`로 선언하고, 함수 안에서만
테이블을 씁니다. `authenticated`에 테이블 `insert/update/delete` grant를 열지 않으므로
RLS와 함수 검증이 함께 사용자의 경로가 됩니다.

### 기록하지 않은 과거 날짜를 새로 만들지 않는 규칙

`create_record_message`는 `systemTimeZone` 기준 오늘 날짜에만 daily record를 새로 만듭니다.
과거 날짜에 record가 없으면 `RECORD_DATE_NOT_WRITABLE`(400)로 거절하고, 이미 존재하는
과거 draft record에는 계속 메시지를 추가할 수 있습니다.

"그날 아무것도 기록하지 않았다"는 사실을 보존해, 기록이 없는 날짜를 증상이 없었던 날로
해석하지 않게 하는 규칙입니다(PRD 원칙).

## 11. 삭제 정책

애플리케이션 DB에서는 사용자가 요청한 삭제를 실제 row 삭제로 처리합니다.

별도 감사 로그에 건강 원문을 복제하지 않습니다. 운영상 audit가 필요하더라도 `record id`, `action`, `timestamp` 같은 메타데이터만 별도 검토합니다.

## 12. 향후 확장 시에만 고려

- visit_reports snapshot
- file attachments
- device/session table
- notification preferences
- family sharing

현재 migration에는 넣지 않습니다.

