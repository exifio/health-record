-- 결정(Integration I0 후속): 기록이 전혀 없는 과거 날짜에는 새로 기록하지 못하게 한다.
--
-- 이유:
-- - 사용자가 실제로 겪은 증상을 그날 다시 적는 순간, "그날 없었다"는 사실이 지워진다.
--   기록이 없는 날짜를 증상이 없었던 날로 해석하지 않는다는 PRD 원칙과 반대된다.
-- - 오늘 날짜의 첫 기록은 daily record 생성 자체가 기록의 시작이므로 계속 허용한다.
-- - 이미 존재하는 과거 draft record에 메시지를 추가하는 흐름은 그대로 유지한다.
--
-- 규칙: p_local_date가 시스템 timezone 기준 오늘보다 과거이고 record가 없으면 거절한다.

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
