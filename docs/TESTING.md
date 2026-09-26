# TESTING — Jest, Integration, AI Evaluation

## 1. 원칙

UI 스냅샷보다 핵심 비즈니스 규칙을 먼저 보호합니다.

테스트 우선순위:
1. 데이터 소유권/RLS
2. 확정 후 불변성
3. 시스템 시간대/날짜 경계
4. summary revision
5. 진료 준비 포함 규칙
6. AI 금지사항
7. 삭제

## 2. Unit Test

### 시스템 시간대 / 날짜 경계

- Asia/Seoul 시스템 시간 23:59 → 같은 `local_date`
- Asia/Seoul 시스템 시간 다음날 00:00 → 다음 `local_date`
- Frontend가 시스템 IANA timezone을 자동 전달
- 서버가 잘못된 timezone 문자열을 거부
- 새 record에 `timezone_at_creation` snapshot 저장
- 기기 timezone이 이후 변경되어도 과거 record `local_date` 불변
- Scheduler가 `timezone_at_creation` 기준으로 날짜 종료를 판정

### 상태 전이

- 새 오늘 record: draft + not_due
- 날짜 종료 대상: pending
- claim: processing
- success: ready
- AI 실패: failed
- ready 후 원문 수정: stale/pending + revision 증가
- confirmed 후 message mutation: 거부
- confirmed 후 correction: 허용

### confirm

- ready + revision 일치: 성공
- pending/processing/failed: 실패
- source revision 불일치: 실패
- already confirmed: idempotent 또는 명시적 conflict 중 한 방식으로 고정

### visit prep

- confirmed만 포함
- draft 제외
- 기록 없는 날짜 미포함
- correction 포함
- 여러 날짜를 AI 패턴 문장으로 변환하지 않음

### deletion

- daily delete가 child data 모두 삭제
- health data delete가 profile/auth는 유지
- account delete가 auth 포함 전체 삭제

## 3. API Integration Test

- unauthenticated write → 401
- User A가 User B record id로 조회 → 404/403
- User A가 User B message id 수정 → 실패
- invalid date → 400
- future date create → 400
- confirmed record patch/delete message → 409
- day delete는 confirmed도 가능
- internal scheduler endpoint secret 없음 → 거부

## 4. RLS Test

테스트용 사용자 A/B를 분리해 실제 Supabase test DB에서 검증합니다.

필수:
- A cannot select B
- A cannot insert child row under B daily_record
- A cannot update B
- A cannot delete B

Service role 테스트와 사용자 세션 테스트를 분리합니다.

## 5. AI Mock Test

OpenAI 실제 호출 없이:
- 정상 structured output parser
- invalid schema
- timeout
- 5xx
- summary save 전에 revision 변경
- retry

중요: AI 응답이 늦는 동안 원문이 수정되면 오래된 summary를 저장하지 않아야 합니다.

## 6. AI Evaluation

실제 모델 특성은 결정적이지 않으므로 Jest pass/fail만으로 품질을 보장하지 않습니다.

### Dataset

최소 20~30개 수동 작성 사례를 권장합니다.

필드 예:

```json
{
  "id": "case-001",
  "messages": [],
  "mustIncludeFacts": [],
  "mustNotIncludeConcepts": ["diagnosis", "cause", "treatment"],
  "expectedMaxSuggestions": 3
}
```

### 평가 기준

- 의미 왜곡 없음
- 새 사실 없음
- 시간 흐름 보존
- 강도 표현 보존
- 복약 사실 보존
- 인과관계 생성 금지
- 진단/원인/치료/약 추천 없음
- suggestions 0~3
- 충분한 경우 0개
- sourceMessageIds 유효

### 실행 방식

- PR마다 실제 모델 eval을 강제하면 비용/변동성이 커질 수 있음
- prompt/model 변경 시 반드시 실행
- 릴리스 전 대표 dataset 실행
- 결과를 JSON/markdown으로 보존

## 7. Frontend Test

핵심 상호작용만:
- 비로그인 submit → 로그인 모달, network write 없음
- confirmed 화면에 edit/delete 버튼 없음
- summary stale면 confirm disabled
- unreviewed banner count
- visit prep에서 no-record day 미표시
- sidebar desktop/mobile toggle

## 8. E2E 권장 시나리오

MVP 완성 후 최소 1개 happy path를 브라우저 자동화 또는 수동 체크리스트로 검증합니다.

```text
Google login
→ 오늘 message 3개 작성
→ 날짜 종료/summary job 시뮬레이션
→ summary 확인/수정
→ confirm
→ correction 추가
→ visit prep에서 표시 확인
```

## 9. 배포 전 체크리스트

- [ ] RLS enabled
- [ ] service role client bundle 미포함
- [ ] health text logging 없음
- [x] demo write 차단 (F-106: 비로그인·둘러보기는 읽기 전용 — `tests/features/auth-and-demo.test.ts`)
- [ ] AI 실패 시 raw data 유지
- [ ] confirmed mutation 차단
- [ ] account delete 검증
- [ ] 시스템 시간대 / 날짜 경계 검증
- [ ] AI eval 실행

