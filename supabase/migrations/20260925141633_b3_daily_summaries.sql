-- B3: 일일 AI 요약은 원문과 분리해 저장하고, scheduler 전용 DB 함수로 claim/finalize 한다.

create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  daily_record_id uuid not null unique references public.daily_records (id) on delete cascade,
  source_revision integer not null check (source_revision >= 0),
  ai_draft jsonb not null check (jsonb_typeof(ai_draft) = 'object'),
  user_final jsonb,
  model text not null,
  prompt_version text not null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.daily_summaries is '사용자 원문에서 파생된 일일 AI 초안. 원문을 대체하지 않는다.';

grant select on public.daily_summaries to authenticated, service_role;
grant insert, update, delete on public.daily_summaries to service_role;
grant select, update on public.daily_records to service_role;
grant select on public.record_messages to service_role;

alter table public.daily_summaries enable row level security;

create policy daily_summaries_select_own
  on public.daily_summaries for select
  to authenticated
  using (
    exists (
      select 1 from public.daily_records dr
      where dr.id = daily_summaries.daily_record_id
        and dr.user_id = (select auth.uid())
    )
  );

revoke insert, update, delete, truncate, references, trigger
  on public.daily_summaries from anon, authenticated;

create trigger daily_summaries_set_updated_at
  before update on public.daily_summaries
  for each row execute function public.set_updated_at();

-- Preserve the empty-draft cleanup rule when the final message is removed during summary processing.
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

  select count(*) into v_remaining
    from public.record_messages where daily_record_id = v_record.id;

  if v_remaining = 0 and v_record.record_status = 'draft' then
    delete from public.daily_records where id = v_record.id;
    return query select true, v_record.content_revision;
    return;
  end if;

  return query select false, v_record.content_revision;
end;
$fn$;

revoke all on function public.delete_record_message(uuid, date, uuid) from public, anon;
grant execute on function public.delete_record_message(uuid, date, uuid) to authenticated;

-- Claim is one conditional UPDATE, so concurrent scheduler calls can claim a record only once.
create or replace function public.claim_daily_summary(
  p_record_id uuid,
  p_content_revision integer,
  p_processing_timeout_seconds integer
)
returns table (record_id uuid, content_revision integer)
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  if p_processing_timeout_seconds is null or p_processing_timeout_seconds <= 0 then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  return query
  with claimed as (
    update public.daily_records dr
       set summary_status = 'processing',
           processing_started_at = pg_catalog.now()
     where dr.id = p_record_id
       and dr.record_status = 'draft'
       and dr.content_revision = p_content_revision
       and (
         dr.summary_status in ('not_due', 'pending', 'stale', 'failed')
         or (
           dr.summary_status = 'processing'
           and dr.processing_started_at <= pg_catalog.now()
             - pg_catalog.make_interval(secs => p_processing_timeout_seconds::double precision)
         )
       )
    returning dr.id, dr.content_revision
  )
  select claimed.id, claimed.content_revision from claimed;
end;
$fn$;

-- A row lock serializes this revision check with message mutations.
create or replace function public.complete_daily_summary(
  p_record_id uuid,
  p_source_revision integer,
  p_ai_draft jsonb,
  p_model text,
  p_prompt_version text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_record public.daily_records%rowtype;
begin
  if p_source_revision is null or p_source_revision < 0
     or pg_catalog.jsonb_typeof(p_ai_draft) is distinct from 'object'
     or p_model is null or pg_catalog.btrim(p_model) = ''
     or p_prompt_version is null or pg_catalog.btrim(p_prompt_version) = '' then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  select * into v_record
    from public.daily_records
   where id = p_record_id
   for update;

  if not found then
    return 'missing';
  end if;

  if v_record.record_status <> 'draft'
     or v_record.summary_status <> 'processing'
     or v_record.content_revision <> p_source_revision then
    if v_record.record_status = 'draft' and v_record.summary_status = 'processing' then
      update public.daily_records
         set summary_status = 'stale', processing_started_at = null
       where id = p_record_id;
    end if;
    return 'stale';
  end if;

  insert into public.daily_summaries (
    daily_record_id, source_revision, ai_draft, user_final, model, prompt_version, generated_at
  ) values (
    p_record_id, p_source_revision, p_ai_draft, null, p_model, p_prompt_version, pg_catalog.now()
  )
  on conflict (daily_record_id) do update
    set source_revision = excluded.source_revision,
        ai_draft = excluded.ai_draft,
        user_final = null,
        model = excluded.model,
        prompt_version = excluded.prompt_version,
        generated_at = excluded.generated_at;

  update public.daily_records
     set summary_status = 'ready', processing_started_at = null
   where id = p_record_id;

  return 'ready';
end;
$fn$;

create or replace function public.fail_daily_summary(
  p_record_id uuid,
  p_source_revision integer
)
returns text
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_record public.daily_records%rowtype;
  v_status text;
begin
  select * into v_record
    from public.daily_records
   where id = p_record_id
   for update;

  if not found then
    return 'missing';
  end if;

  if v_record.record_status <> 'draft' or v_record.summary_status <> 'processing' then
    return 'stale';
  end if;

  v_status := case when v_record.content_revision = p_source_revision then 'failed' else 'stale' end;

  update public.daily_records
     set summary_status = v_status, processing_started_at = null
   where id = p_record_id;

  return v_status;
end;
$fn$;

revoke all on function public.claim_daily_summary(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.complete_daily_summary(uuid, integer, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.fail_daily_summary(uuid, integer) from public, anon, authenticated;

grant execute on function public.claim_daily_summary(uuid, integer, integer) to service_role;
grant execute on function public.complete_daily_summary(uuid, integer, jsonb, text, text) to service_role;
grant execute on function public.fail_daily_summary(uuid, integer) to service_role;
