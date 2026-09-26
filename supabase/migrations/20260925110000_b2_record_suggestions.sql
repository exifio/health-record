-- B2: 추가 기록 제안은 AI가 생성한 일시적 데이터이며 원문 저장과 분리된다.

create table if not exists public.record_suggestions (
  id uuid primary key default gen_random_uuid(),
  daily_record_id uuid not null references public.daily_records (id) on delete cascade,
  source_revision integer not null check (source_revision >= 0),
  suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  dismissed_at timestamptz
);

comment on table public.record_suggestions is 'AI가 생성한 추가 기록 제안. 원문 저장과 분리되어 있음.';

create index if not exists record_suggestions_record_idx
  on public.record_suggestions (daily_record_id);

grant select on public.record_suggestions to authenticated;

alter table public.record_suggestions enable row level security;

drop policy if exists record_suggestions_select_own on public.record_suggestions;
create policy record_suggestions_select_own
  on public.record_suggestions for select
  to authenticated
  using (
    exists (
      select 1 from public.daily_records dr
      where dr.id = record_suggestions.daily_record_id
        and dr.user_id = (select auth.uid())
    )
  );

revoke insert, update, delete, truncate, references, trigger on public.record_suggestions from anon, authenticated;
