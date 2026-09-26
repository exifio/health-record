-- B1: daily_records / record_messages (docs/DATABASE.md 3, 4절)
-- timezone_at_creation은 record 최초 생성 당시의 자동 감지 snapshot이다.
-- 사용자 설정값이 아니며, 생성된 local_date는 이후 재계산하지 않는다.

create table if not exists public.daily_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  timezone_at_creation text not null,
  record_status text not null default 'draft'
    check (record_status in ('draft', 'confirmed')),
  summary_status text not null default 'not_due'
    check (summary_status in ('not_due', 'pending', 'processing', 'ready', 'stale', 'failed')),
  content_revision integer not null default 0 check (content_revision >= 0),
  processing_started_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_records_user_date_key unique (user_id, local_date),
  -- confirmed면 confirmed_at이 반드시 존재해야 한다.
  constraint daily_records_confirmed_at_check
    check (record_status <> 'confirmed' or confirmed_at is not null)
);

create table if not exists public.record_messages (
  id uuid primary key default gen_random_uuid(),
  daily_record_id uuid not null references public.daily_records (id) on delete cascade,
  content text not null check (length(content) > 0 and length(content) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.daily_records is '사용자 하루 기록. local_date는 최초 생성 시 확정되며 재분류하지 않는다.';
comment on table public.record_messages is '사용자 원문. AI 결과로 덮어쓰지 않는다.';

grant select on table public.daily_records, public.record_messages to authenticated;

create index if not exists daily_records_user_date_idx
  on public.daily_records (user_id, local_date desc);

create index if not exists daily_records_summary_status_idx
  on public.daily_records (summary_status, local_date);

create index if not exists record_messages_record_created_idx
  on public.record_messages (daily_record_id, created_at);

drop trigger if exists daily_records_set_updated_at on public.daily_records;
create trigger daily_records_set_updated_at
  before update on public.daily_records
  for each row execute function public.set_updated_at();

drop trigger if exists record_messages_set_updated_at on public.record_messages;
create trigger record_messages_set_updated_at
  before update on public.record_messages
  for each row execute function public.set_updated_at();

-- B-105: RLS. 소유권은 항상 auth.uid()로 판단한다.
alter table public.daily_records enable row level security;
alter table public.record_messages enable row level security;

drop policy if exists daily_records_select_own on public.daily_records;
create policy daily_records_select_own
  on public.daily_records for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists daily_records_insert_own on public.daily_records;
create policy daily_records_insert_own
  on public.daily_records for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists daily_records_update_own on public.daily_records;
create policy daily_records_update_own
  on public.daily_records for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists daily_records_delete_own on public.daily_records;
create policy daily_records_delete_own
  on public.daily_records for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- child table은 소유 daily_record를 경유해 판단한다.
drop policy if exists record_messages_select_own on public.record_messages;
create policy record_messages_select_own
  on public.record_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.daily_records dr
      where dr.id = record_messages.daily_record_id
        and dr.user_id = (select auth.uid())
    )
  );

drop policy if exists record_messages_insert_own on public.record_messages;
create policy record_messages_insert_own
  on public.record_messages for insert
  to authenticated
  with check (
    exists (
      select 1 from public.daily_records dr
      where dr.id = record_messages.daily_record_id
        and dr.user_id = (select auth.uid())
    )
  );

drop policy if exists record_messages_update_own on public.record_messages;
create policy record_messages_update_own
  on public.record_messages for update
  to authenticated
  using (
    exists (
      select 1 from public.daily_records dr
      where dr.id = record_messages.daily_record_id
        and dr.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.daily_records dr
      where dr.id = record_messages.daily_record_id
        and dr.user_id = (select auth.uid())
    )
  );

drop policy if exists record_messages_delete_own on public.record_messages;
create policy record_messages_delete_own
  on public.record_messages for delete
  to authenticated
  using (
    exists (
      select 1 from public.daily_records dr
      where dr.id = record_messages.daily_record_id
      and dr.user_id = (select auth.uid())
    )
  );

-- B-111: 확정 기록 우회 방지를 위해 mutation은 전용 RPC만 허용한다.
revoke insert, update, delete, truncate, references, trigger on public.daily_records from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.record_messages from anon, authenticated;
