-- B11: 고지 문구가 바뀌었으므로 동의 버전을 올린다 (PRD 9-3, I-714)
--
-- 배경: OpenAI 공식 문서(https://developers.openai.com/api/docs/guides/your-data)로 사실이
-- 확인됐다 — API 데이터는 모델 학습에 쓰이지 않으며, 악용 모니터링 로그가 최대 30일
-- 보관된다. 기존 문구는 이를 "일정 기간"이라고만 적어 검증된 숫자를 놓치고 있었다.
-- 문구가 바뀌면 CURRENT_CONSENT_VERSION도 함께 올려야, 이전 문구에 동의한 계정이
-- 새 문구에 동의했다고 잘못 처리되지 않는다.
--
-- 주의: 이미 적용된 마이그레이션(b10)은 고치지 않는다. 여기서 함수를 다시 정의해
-- 요구 버전을 교체한다. B10에서引入한 '2026-09-27-v1'은 여기서 '2026-09-27-v2'가 된다.
--
-- 두 함수 모두 security definer + auth.uid() 소유권 검증(B7) + 동의 검증(B10)을 유지한다.

create or replace function public.create_record_message(
  p_user_id uuid,
  p_local_date date,
  p_timezone text,
  p_content text
)
returns table (record_id uuid, message_id uuid, content_revision integer)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_record public.daily_records;
  v_message public.record_messages;
  v_today date;
begin
  if (select auth.uid()) is distinct from p_user_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
     where id = p_user_id and consent_version = '2026-09-27-v2'
  ) then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;

  if p_content is null or btrim(p_content) = '' or length(p_content) > 5000 then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  v_today := (now() at time zone p_timezone)::date;

  if p_local_date > v_today then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select * into v_record
    from public.daily_records
   where user_id = p_user_id and local_date = p_local_date
   for update;

  if found and v_record.record_status = 'confirmed' then
    raise exception 'RECORD_CONFIRMED' using errcode = 'P0001';
  end if;

  if not found then
    if p_local_date < v_today then
      raise exception 'RECORD_DATE_NOT_WRITABLE' using errcode = 'P0001';
    end if;

    insert into public.daily_records (user_id, local_date, timezone_at_creation)
    values (p_user_id, p_local_date, p_timezone)
    returning * into v_record;
  end if;

  insert into public.record_messages (daily_record_id, content)
  values (v_record.id, p_content)
  returning * into v_message;

  update public.daily_records
     set content_revision = v_record.content_revision + 1,
         summary_status = case when v_record.summary_status = 'ready' then 'stale' else v_record.summary_status end
   where id = v_record.id
  returning public.daily_records.content_revision into v_record.content_revision;

  return query select v_record.id, v_message.id, v_record.content_revision;
end;
$fn$;

create or replace function public.create_record_correction(
  p_user_id uuid,
  p_local_date date,
  p_content text
)
returns table (id uuid, content text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_record public.daily_records%rowtype;
  v_correction public.corrections%rowtype;
begin
  if (select auth.uid()) is distinct from p_user_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
     where id = p_user_id and consent_version = '2026-09-27-v2'
  ) then
    raise exception 'CONSENT_REQUIRED' using errcode = '42501';
  end if;

  if p_content is null or pg_catalog.btrim(p_content) = '' then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select * into v_record
    from public.daily_records dr
   where dr.user_id = p_user_id and dr.local_date = p_local_date
   for update;

  if not found then
    raise exception 'RECORD_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_record.record_status <> 'confirmed' then
    raise exception 'RECORD_NOT_CONFIRMED' using errcode = 'P0001';
  end if;

  insert into public.corrections as c (daily_record_id, content)
  values (v_record.id, p_content)
  returning c.* into v_correction;

  return query select v_correction.id, v_correction.content, v_correction.created_at;
end;
$fn$;
