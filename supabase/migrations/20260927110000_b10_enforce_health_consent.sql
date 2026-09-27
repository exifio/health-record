-- B10: 건강정보 처리 동의를 서버에서 강제한다 (PRD 9-3, I-714)
--
-- 배경: 동의 게이트를 클라이언트(canWrite, 버튼 비활성화)에만 두면 API 직접 호출로
-- 우회할 수 있다. 건강 기록 원문은 OpenAI로 전송되는 민감정보이므로, **기록을 실제로
-- 추가하는 함수 안에서** 동의 상태를 확인해야 한다.
--
-- 정리 대상: 사용자 원문을 새로 만드는 두 경로
--   - create_record_message   (기록 작성)
--   - create_record_correction (정정 추가)
-- 이미 존재하는 기록의 조회/삭제/수정은 막지 않는다. 삭제는 오히려GDPR/PRD 방향이므로
-- 미동의자에게도 열어 둔다(동의 UI에서 "돌아가기"로 빠져나갈 수 있어야 한다).
--
-- B9가 추가한 profiles.consent_version을 단일 기준으로 쓴다. 이 함수는 security definer
-- 이므로 RLS를 우회하므로, 반드시 명시적으로 확인해야 한다.

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

  -- PRD 9-3: 현재 고지 버전에 동의하지 않은 계정은 건강 기록을 추가할 수 없다.
  -- 버전 문자열은 CURRENT_CONSENT_VERSION(src/contracts)과 반드시 같아야 한다.
  -- 고지 문구를 바꾸면 이 값과 CURRENT_CONSENT_VERSION을 함께 올린다.
  if not exists (
    select 1 from public.profiles
     where id = p_user_id and consent_version = '2026-09-27-v1'
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
    -- 과거 날짜에 기록이 전혀 없다면 새로 만들지 않는다.
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

-- 정정도 사용자가 직접 쓴 건강 원문이라 같은 동의를 요구한다.
-- B7 기반(security definer + auth.uid() 소유권 검증)을 그대로 유지하고 동의 확인만 추가한다.
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

  -- PRD 9-3
  if not exists (
    select 1 from public.profiles
     where id = p_user_id and consent_version = '2026-09-27-v1'
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

-- create_record_correction의 grant는 B7에서 이미 authenticated + service_role로 정리돼 있다.
-- B10은 함수 본문만 바꾸므로 revoke/grant는 건드리지 않는다.
