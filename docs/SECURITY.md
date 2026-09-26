# SECURITY — 인증, 권한, 개인정보 보호

## 1. 위협 모델의 최소 범위

이 서비스는 건강 관련 자유 텍스트를 저장하므로 다음을 기본 위협으로 봅니다.

- 다른 사용자의 기록 열람
- ID를 조작해 다른 날짜/record 접근
- service role key 노출
- 서버 로그에 건강 원문 노출
- 비로그인 상태에서 사용자가 건강정보를 입력한 뒤 서버로 전송
- 확정 record를 우회 수정
- scheduler/internal API 무단 호출
- AI 입력/응답이 오류 추적 도구에 그대로 남는 문제

## 2. Authentication vs Authorization

### Authentication

'누구인지' 확인.
- Supabase Auth
- Google OAuth

### Authorization

'그 사용자가 이 데이터에 접근할 권한이 있는지' 확인.
- API service의 ownership check
- Supabase RLS

Frontend에서 `user_id`를 숨기는 것은 보안이 아닙니다.

## 3. RLS 필수 정책

- profiles: 본인 row만
- daily_records: `user_id = auth.uid()`
- child tables: 소유 daily_record를 통해 본인만

RLS는 개발 초기에 켜고 마지막에 추가하지 않습니다.

## 4. Service Role Key

- 서버 전용
- `NEXT_PUBLIC_` 접두사 금지
- client component import 금지
- service role 사용 코드는 좁은 모듈로 제한
- RLS가 우회되므로 query마다 대상 user를 명시

주요 사용 후보:
- 계정 삭제
- 내부 scheduled job에서 필요한 관리 작업

가능한 작업은 사용자 세션 + RLS를 우선합니다.

## 5. OpenAI API Key

- Route Handler/Server Service에서만 사용
- 브라우저에서 OpenAI 직접 호출 금지
- raw prompt/response를 일반 application log에 출력 금지

## 6. Logging

### 허용
- request id
- internal record id
- 상태 코드
- latency
- error code

### 금지
- record message content
- AI summary 전문
- medication/symptom text
- access token
- OAuth token

오류 모니터링 도구를 도입한다면 request body 자동 수집을 끄거나 health API path를 scrub합니다.

## 7. Demo Mode

- demo 입력을 실제 API에 전송하지 않음
- 로그인 전 입력창 제출 차단
- 샘플 데이터는 실제 사용자 데이터가 아님

## 8. 데이터 무결성

보안은 접근 제어뿐 아니라 기록 변경 통제도 포함합니다.

- confirmed record 일반 수정 금지
- 수정 우회 API 테스트
- summary source revision 일치 검사
- correction은 append-only
- 날짜 전체 삭제만 명시적 destructive action으로 허용

## 9. CSRF / 세션

Supabase/Next.js의 공식 서버 세션 패턴을 따르고, 쿠키 기반 mutation endpoint는 SameSite/Origin 등 사용 프레임워크의 권장 보호를 검토합니다.

구체 구현은 사용하는 Supabase SSR 방식에 맞춰 확정합니다.

## 10. Rate Limit

MVP에서도 다음은 abuse 방지를 위해 기본 제한을 고려합니다.
- message write
- AI suggestion
- summary retry
- internal endpoint

정확한 수치는 트래픽/배포 환경에 맞춰 정합니다.

### 적용 방식 (2026-09-26 결정, B-613)

- **엣지에서 Vercel Firewall(WAF)으로 적용합니다.** 앱 코드에 rate limit 로직을 넣지 않습니다.
  - 서버리스 인스턴스는 요청마다 새로 올라가므로 IP별 카운트를 앱 메모리나 파일로 유지할 수 없습니다.
  - Vercel Pro 플랜이라 WAF 사용 요건은 충족됩니다(계정 `exifio-4593s-projects`, plan `pro`).
- **적용 상태(2026-09-27):** Vercel `exifio-4593s-projects/health-record`의 rate limit 규칙 12개를 게시했다. 최초 실측에서 프로젝트 `firewallEnabled=false`를 발견해 기존 규칙을 보존한 채 Firewall을 활성화했다. 이후 overview에서 Firewall `Enabled`와 12개 active 규칙을 확인했다. 내부 scheduler GET은 한도 이내 4회가 앱의 무인증 `403`, 5회째가 WAF `429`였다. 다른 11개 경로는 active/valid 설정을 확인했지만 Production에서 한도 초과 부하 테스트는 하지 않았다.
- **한도 범위:** Vercel은 rate limit counter를 region별로 집계한다. 여러 region으로 요청이 분산되면 한 region에 설정한 수보다 전체 허용량이 커질 수 있으므로, 전역 quota로 취급하지 않는다.
- **사용자별 전역 quota가 필요하면 별도 공유 저장소가 필요합니다.** MVP 범위 밖입니다(AGENTS §3).

### 경로별 목표 한도

한도는 "정상 사용에서 절대 넘지 않을 값"을 기준으로 잡고, 실제 값은 배포 후 트래픽 관찰에서 조정합니다.

| 대상 | 경로 | 방법 | 목표 한도 | 근거 |
|---|---|---|---|---|
| 메시지 write | `POST /api/daily-records/:date/messages` | IP | 20 회/분 | 하루에 몇십 개 쓰는 사용자도 잘리지 않도록 여유 |
| 메시지 수정/삭제 | `PATCH`/`DELETE .../messages/:messageId` | IP | 30 회/분 | write보다 자주 발생 |
| AI suggestion | `POST .../suggestions` | IP | 5 회/분 | OpenAI 호출이므로 가장 보수적으로 |
| 요약 재시도 | `POST .../summary/retry` | IP | 5 회/분 | 사용자가 반복 클릭해도 AI 비용이 늘지 않도록 |
| 요약 수정 | `PATCH .../summary` | IP | 30 회/분 | 편집 중 저장 반복 허용 |
| 확정/정정 | `POST .../confirm`, `POST .../corrections` | IP | 20 회/분 | 저빈도 |
| 조회 | `GET /api/daily-records*`, `/api/visit-prep`, `/api/profile` | IP | 120 회/분 | 새로고침·탐색 허용 |
| 내부 스케줄러 | `GET`/`POST /api/internal/daily-summary/run` | IP | 4 회/분 | Vercel Cron의 GET과 수동 POST 모두 제한 |

### 초과 시 응답

- WAF가 `429`를 반환해야 합니다. 2026-09-27 내부 scheduler 경로의 실제 응답은 비어 있지 않은 75바이트 `text/plain`이었고, health 관련 내용은 없었다. Vercel 기본 본문이 비어 있다고 가정하지 말고 변경 후 다시 확인한다.
- 앱 코드에 `RATE_LIMITED` 오류 코드는 두지 않습니다. 429는 엣지에서만 발생하므로
  `docs/API.md`의 error code 목록에 추가하지 않습니다.
- 프론트엔드는 429를 일반 저장 실패로 표시합니다. 원인을 사용자에게 설명하지 않습니다.

### 배포 시 검증 순서 (I7)

1. 각 경로의 active/valid 설정과 method/path 조건 확인
2. 낮은 한도의 무인증 내부 scheduler 경로에서 허용 한도 4회와 초과 429를 실측
3. 실제 429 응답 본문에 health 정보가 없는지 확인
4. 위 4개 AI/write 경로의 Vercel 로그에 정상 트래픽 기준치를 확인하고 한도를 조정

고한도(예: 120회/분) 경로는 Production에서 121회 이상 발생시키는 부하를 만들지 않는다. 필요할 때는 Preview/격리 환경에서 별도로 검증한다.

## 11. Internal Scheduler Endpoint

- 공개 secret 없이 호출 가능하게 만들지 않음
- secret 비교는 서버에서 수행
- response에 사용자 데이터 미포함
- batch job 로그에도 raw health text 미포함

## 12. 삭제

### 하루 삭제

관련 row cascade/transaction.

### 전체 health data 삭제

계정 유지, health-domain data 실제 삭제.

### 계정 삭제

health data → profile → auth account 순서.

삭제 처리 중 부분 실패 시 재시도 가능하게 단계별 오류를 기록하되 health content는 로그에 남기지 않습니다.

## 13. 공개 전 별도 확인이 필요한 개인정보 이슈

개발 문서만으로 법적 요건을 확정하지 않습니다. 공개 전에 최소 다음을 실제 서비스 제공 지역의 법률/정책 기준으로 확인해야 합니다.

- 건강 관련 자유 텍스트의 개인정보 분류와 동의 요건
- OpenAI 등 외부 처리자에게 데이터가 전달되는 경우 필요한 고지
- 국외 이전 또는 외부 처리 관련 고지 여부
- 회원 탈퇴/삭제 후 백업 보존 고지
- 개인정보 처리방침과 AI 처리 안내 문구

이 항목은 법률 자문을 대체하지 않습니다.
