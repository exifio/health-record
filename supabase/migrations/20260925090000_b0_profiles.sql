-- B0: profiles (docs/DATABASE.md 2절)
-- 사용자 timezone 설정값은 저장하지 않는다. 날짜는 기록 생성 시점 metadata로만 다룬다.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '로그인 사용자 1:1 프로필. 건강 정보를 저장하지 않는다.';

-- 레거시 timezone 설정 컬럼은 B0 정책(프로필에 사용자 timezone 미저장)에 맞춰 제거한다.
alter table public.profiles drop column if exists timezone;
-- consent_version / consented_at은 PRD 9.3(동의 고지 방식) 결정 전까지 legacy 값을 보존한다.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- B-006: 최초 로그인 시 profile row 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 기존 사용자: 로그인 전에 만들어진 profile이 없는 경우 onboarding 진행 시 생성된다.

-- B-007: RLS. 클라이언트가 전달한 user_id가 아니라 auth.uid()로만 소유권을 판단한다.
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- insert/delete는 서버(auth trigger, 계정 삭제)만 수행한다.
revoke insert, delete, truncate, references, trigger on public.profiles from anon, authenticated;
