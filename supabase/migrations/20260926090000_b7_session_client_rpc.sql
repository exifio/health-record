-- I-005: 사용자 write API가 service role이 아니라 실제 사용자 세션 클라이언트로 호출되도록 통일한다.
--
-- 배경: B1/B6 RPC는 auth.uid()로 권한을 검증하지만 서버가 service role 키로 호출해
-- auth.uid()가 NULL이 되어 항상 FORBIDDEN이었다. B4 RPC는 반대로 service role 전용 grant에
-- 의존하고 auth.uid() 검증을 하지 않았다. 두 패턴 모두 서버가 사용자 세션 클라이언트로
-- 호출하도록 통일한다.
--
-- 규칙:
-- 1) 사용자 데이터 write RPC는 첫 줄에서 auth.uid()와 p_user_id를 대조한다.
-- 2) RPC는 security definer + 고정 search_path로만 테이블을 쓰며, 테이블 grant는 열지 않는다.
-- 3) 스케줄러 전용(claim/complete/fail_daily_summary)은 service_role 전용 그대로 둔다.

-- 요약 수정: B4 버전에 auth.uid() 검증을 추가하고 security definer로 전환한다.
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
security definer
set search_path = ''
as $fn$
declare
  v_record public.daily_records%rowtype;
  v_summary public.daily_summaries%rowtype;
begin
  if (select auth.uid()) is distinct from p_user_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

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

-- 확정: auth.uid() 검증 + security definer.
create or replace function public.confirm_daily_record(
  p_user_id uuid,
  p_local_date date
)
returns table (record_status text, confirmed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_record public.daily_records%rowtype;
  v_summary public.daily_summaries%rowtype;
  v_confirmed_at timestamptz;
begin
  if (select auth.uid()) is distinct from p_user_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_record
    from public.daily_records dr
   where dr.user_id = p_user_id and dr.local_date = p_local_date
   for update;

  if not found then
    raise exception 'RECORD_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 이미 확정된 기록에는 같은 결과를 다시 돌려준다(idempotent).
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

-- 정정 추가: auth.uid() 검증 + security definer.
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

-- 요약 재시도 (API.md 9절): AI를 호출하지 않고 pending으로 되돌리기만 한다.
-- 상태 전이는 row lock 안에서 처리해 스케줄러 claim과 직렬화된다.
create or replace function public.retry_daily_summary(
  p_user_id uuid,
  p_local_date date
)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_record public.daily_records%rowtype;
begin
  if (select auth.uid()) is distinct from p_user_id then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_record
    from public.daily_records dr
   where dr.user_id = p_user_id and dr.local_date = p_local_date
   for update;

  if not found then
    return 'missing';
  end if;

  -- 확정 기록, 하루가 아직 안 끝난 경우, 이미 정리 중이거나 완료된 경우는 재시도 대상이 아니다.
  if v_record.record_status = 'confirmed'
     or v_record.summary_status not in ('failed', 'stale', 'pending') then
    return 'not_retryable';
  end if;

  update public.daily_records dr
     set summary_status = 'pending',
         processing_started_at = null
   where dr.id = v_record.id
     and dr.summary_status in ('failed', 'stale', 'pending');

  if not found then
    return 'not_retryable';
  end if;

  return 'pending';
end;
$fn$;

revoke all on function public.update_daily_summary(uuid, date, jsonb) from public, anon;
revoke all on function public.confirm_daily_record(uuid, date) from public, anon;
revoke all on function public.create_record_correction(uuid, date, text) from public, anon;
revoke all on function public.retry_daily_summary(uuid, date) from public, anon;

grant execute on function public.update_daily_summary(uuid, date, jsonb) to authenticated, service_role;
grant execute on function public.confirm_daily_record(uuid, date) to authenticated, service_role;
grant execute on function public.create_record_correction(uuid, date, text) to authenticated, service_role;
grant execute on function public.retry_daily_summary(uuid, date) to authenticated, service_role;
