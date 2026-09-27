-- B9: 민감정보(건강정보) 처리 동의 이력 (PRD 9-3, I-714 결정 A)
--
-- 배경: 앱은 건강 기록 원문을 OpenAI API로 전송한다. 건강 기록은 개인정보 보호법상
-- 민감정보라 별도 동의 대상인데, B0 시점에는 동의 UI가 없었다. 첫 로그인 온보딩에서
-- 동의를 받고 그 사실을 서버에 남긴다.
--
-- consent_version은 "동의한 문구 버전"이다. 문구를 고치면 버전을 올리고, 이미
-- 동의한 사용자에게 새 버전 동의를 다시 받는다(값이 달라졌는지 비교만 하면 된다).
-- 보존일 숫자는 넣지 않는다. 실제 백업 정책은 아직 확정되지 않았다(I-714).

alter table public.profiles add column if not exists consent_version text null;
alter table public.profiles add column if not exists consented_at timestamptz null;

comment on column public.profiles.consent_version is
  '사용자가 동의한 개인정보/AI 처리 고지 버전. null이면 미동의. PRD 9-3';
comment on column public.profiles.consented_at is
  '위 버전에 동의한 시각. 철회 시 null로 되돌린다';

-- RLS/grant는 B0 policies를 그대로 쓴다(신규 컬럼이므로 정책 변경 없음).
-- insert/delete가 서버 전용인 것도 동일하다.
