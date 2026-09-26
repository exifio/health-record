-- B1: 메시지 mutation을 하나의 transaction으로 처리한다.
-- content_revision 증가, 확정 차단, 빈 draft 정리를 DB에서 atomic하게 보장한다.
-- 함수 안에서 auth.uid()를 직접 검증하고, 테이블 직접 mutation은 막아 확정 기록을 API 우회하지 못하게 한다.

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

  if p_local_date > (now() at time zone p_timezone)::date then
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

create or replace function public.update_record_message(
  p_user_id uuid,
  p_local_date date,
  p_message_id uuid,
  p_content text
)
returns table (record_id uuid, message_id uuid, content_revision integer, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_record public.daily_records;
  v_message public.record_messages;
begin
  if (select auth.uid()) is distinct from p_user_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_content is null or btrim(p_content) = '' or length(p_content) > 5000 then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select * into v_record
    from public.daily_records
   where user_id = p_user_id and local_date = p_local_date
   for update;

  if not found then
    raise exception 'RECORD_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_record.record_status = 'confirmed' then
    raise exception 'RECORD_CONFIRMED' using errcode = 'P0001';
  end if;

  update public.record_messages
     set content = p_content
   where id = p_message_id and daily_record_id = v_record.id
  returning * into v_message;

  if not found then
    raise exception 'MESSAGE_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.daily_records
     set content_revision = v_record.content_revision + 1,
         summary_status = case when v_record.summary_status = 'ready' then 'stale' else v_record.summary_status end
   where id = v_record.id
  returning public.daily_records.content_revision into v_record.content_revision;

  return query select v_record.id, v_message.id, v_record.content_revision, v_message.updated_at;
end;
$fn$;

create or replace function public.delete_record_message(
  p_user_id uuid,
  p_local_date date,
  p_message_id uuid
)
returns table (record_deleted boolean, content_revision integer)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_record public.daily_records;
  v_remaining bigint;
begin
  if (select auth.uid()) is distinct from p_user_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_record
    from public.daily_records
   where user_id = p_user_id and local_date = p_local_date
   for update;

  if not found then
    raise exception 'RECORD_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_record.record_status = 'confirmed' then
    raise exception 'RECORD_CONFIRMED' using errcode = 'P0001';
  end if;

  delete from public.record_messages
   where id = p_message_id and daily_record_id = v_record.id;

  if not found then
    raise exception 'MESSAGE_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.daily_records
     set content_revision = v_record.content_revision + 1,
         summary_status = case when v_record.summary_status = 'ready' then 'stale' else v_record.summary_status end
   where id = v_record.id
  returning public.daily_records.content_revision into v_record.content_revision;

  -- B-112: 마지막 메시지가 사라지면 빈 draft record도 정리한다.
  select count(*) into v_remaining
    from public.record_messages where daily_record_id = v_record.id;

  if v_remaining = 0 and v_record.record_status = 'draft'
    and v_record.summary_status in ('not_due', 'stale', 'failed') then
    delete from public.daily_records where id = v_record.id;
    return query select true, v_record.content_revision;
    return;
  end if;

  return query select false, v_record.content_revision;
end;
$fn$;

revoke all on function public.create_record_message(uuid, date, text, text) from public, anon;
revoke all on function public.update_record_message(uuid, date, uuid, text) from public, anon;
revoke all on function public.delete_record_message(uuid, date, uuid) from public, anon;

grant execute on function public.create_record_message(uuid, date, text, text) to authenticated;
grant execute on function public.update_record_message(uuid, date, uuid, text) to authenticated;
grant execute on function public.delete_record_message(uuid, date, uuid) to authenticated;
