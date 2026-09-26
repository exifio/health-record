-- B6 destructive operations remain callable only by an authenticated owner.
-- Child rows are removed by the existing daily_record_id ON DELETE CASCADE foreign keys.

create or replace function public.delete_daily_record(p_local_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_local_date is null then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  delete from public.daily_records
   where user_id = v_user_id and local_date = p_local_date;
end;
$fn$;

create or replace function public.delete_health_data()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  delete from public.daily_records where user_id = v_user_id;
end;
$fn$;

create or replace function public.delete_account_data()
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  delete from public.daily_records where user_id = v_user_id;
  delete from public.profiles where id = v_user_id;
end;
$fn$;

revoke all on function public.delete_daily_record(date) from public, anon, service_role;
revoke all on function public.delete_health_data() from public, anon, service_role;
revoke all on function public.delete_account_data() from public, anon, service_role;
grant execute on function public.delete_daily_record(date) to authenticated;
grant execute on function public.delete_health_data() to authenticated;
grant execute on function public.delete_account_data() to authenticated;
