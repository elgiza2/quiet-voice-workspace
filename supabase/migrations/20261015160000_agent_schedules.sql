-- Scheduled agent tasks: user-owned cron-like jobs the agent runs on its own.
create table if not exists public.agent_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  prompt text not null,
  cron text not null default '0 9 * * *',
  timezone text not null default 'Africa/Cairo',
  active boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.agent_schedules enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'agent_schedules_owner') then
    create policy agent_schedules_owner on public.agent_schedules
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
create index if not exists agent_schedules_next_idx on public.agent_schedules (next_run_at) where active = true;
