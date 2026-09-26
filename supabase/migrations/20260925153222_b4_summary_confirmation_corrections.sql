-- B4: user edits and confirms only the latest draft; corrections append beside confirmed records.

create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  daily_record_id uuid not null references public.daily_records (id) on delete cascade,
  content text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now()
);

comment on table public.corrections is '확정된 일일 기록을 덮어쓰지 않고 추가하는 사용자 정정 기록.';

create index corrections_record_created_idx
  on public.corrections (daily_record_id, created_at);

alter table public.corrections enable row level security;

create policy corrections_select_own
  on public.corrections for select
  to authenticated
  using (
    exists (
      select 1 from public.daily_records dr
      where dr.id = corrections.daily_record_id
        and dr.user_id = (select auth.uid())
    )
  );

revoke all on public.corrections from public, anon, authenticated;
grant select on public.corrections to authenticated, service_role;
grant insert on public.corrections to service_role;
revoke update, delete, truncate on public.corrections from public, anon, authenticated, service_role;

-- The server runtime schema validates userFinal. The service-role-only RPC keeps table writes
-- private and serializes them with record mutations by locking the owning daily_record first.
create or replace function public.update_daily_summary(
  p_user_id uuid,
  p_local_date date,
  p_user_final jsonb
)
returns table (
  source_revision integer,
  ai_draft jsonb,
  user_final jsonb,
  generated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_record public.daily_records%rowtype;
  v_summary public.daily_summaries%rowtype;
begin
  if p_user_final is null or pg_catalog.jsonb_typeof(p_user_final) is distinct from 'object' then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select * into v_record
    from public.daily_records dr
   where dr.user_id = p_user_id and dr.local_date = p_local_date
   for update;

  if not found then
    raise exception 'RECORD_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_record.record_status = 'confirmed' then
    raise exception 'RECORD_CONFIRMED' using errcode = 'P0001';
  end if;
  if v_record.summary_status = 'stale' then
    raise exception 'SUMMARY_STALE' using errcode = 'P0001';
  end if;
  if v_record.summary_status <> 'ready' then
    raise exception 'SUMMARY_NOT_READY' using errcode = 'P0001';
  end if;

  select * into v_summary
    from public.daily_summaries ds
   where ds.daily_record_id = v_record.id
   for update;

  if not found or v_summary.source_revision <> v_record.content_revision then
    raise exception 'SUMMARY_STALE' using errcode = 'P0001';
  end if;

  update public.daily_summaries ds
     set user_final = p_user_final
   where ds.id = v_summary.id;

  return query
  select ds.source_revision, ds.ai_draft, ds.user_final, ds.generated_at
    from public.daily_summaries ds
   where ds.id = v_summary.id;
end;
$fn$;

create or replace function public.confirm_daily_record(
  p_user_id uuid,
  p_local_date date
)
returns table (record_status text, confirmed_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_record public.daily_records%rowtype;
  v_summary public.daily_summaries%rowtype;
  v_confirmed_at timestamptz;
begin
  select * into v_record
    from public.daily_records dr
   where dr.user_id = p_user_id and dr.local_date = p_local_date
   for update;

  if not found then
    raise exception 'RECORD_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Confirmation is idempotent once the record has become immutable.
  if v_record.record_status = 'confirmed' then
    return query select v_record.record_status, v_record.confirmed_at;
    return;
  end if;

  if v_record.summary_status = 'stale' then
    raise exception 'SUMMARY_STALE' using errcode = 'P0001';
  end if;
  if v_record.summary_status <> 'ready' then
    raise exception 'SUMMARY_NOT_READY' using errcode = 'P0001';
  end if;

  select * into v_summary
    from public.daily_summaries ds
   where ds.daily_record_id = v_record.id
   for update;

  if not found or v_summary.source_revision <> v_record.content_revision then
    raise exception 'SUMMARY_STALE' using errcode = 'P0001';
  end if;

  update public.daily_summaries ds
     set user_final = coalesce(ds.user_final, ds.ai_draft)
   where ds.id = v_summary.id;

  v_confirmed_at := pg_catalog.now();
  update public.daily_records dr
     set record_status = 'confirmed',
         confirmed_at = v_confirmed_at,
         processing_started_at = null
   where dr.id = v_record.id;

  return query select 'confirmed'::text, v_confirmed_at;
end;
$fn$;

create or replace function public.create_record_correction(
  p_user_id uuid,
  p_local_date date,
  p_content text
)
returns table (id uuid, content text, created_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_record public.daily_records%rowtype;
  v_correction public.corrections%rowtype;
begin
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

revoke all on function public.update_daily_summary(uuid, date, jsonb) from public, anon, authenticated;
revoke all on function public.confirm_daily_record(uuid, date) from public, anon, authenticated;
revoke all on function public.create_record_correction(uuid, date, text) from public, anon, authenticated;
grant execute on function public.update_daily_summary(uuid, date, jsonb) to service_role;
grant execute on function public.confirm_daily_record(uuid, date) to service_role;
grant execute on function public.create_record_correction(uuid, date, text) to service_role;
