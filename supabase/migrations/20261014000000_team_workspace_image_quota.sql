-- Daily Wan image quota (5/day free) + Team Workspace (paid-only 24/7 agents).
-- Applies cleanly on re-run (IF NOT EXISTS guards).

-- 1) Daily image generations log (one row per generated image).
create table if not exists public.image_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null default 'wan2.7-image',
  created_at timestamptz not null default now()
);
create index if not exists image_generations_user_day_idx
  on public.image_generations (user_id, created_at desc);
alter table public.image_generations
  add column if not exists status text not null default 'pending';
alter table public.image_generations enable row level security;
drop policy if exists "service only" on public.image_generations;
create policy "service only" on public.image_generations
  for all to service_role using (true) with check (true);

-- Reserve one Wan image slot atomically before calling the provider. The caller
-- removes the reservation if generation fails, so only successful images count.
create or replace function public.consume_free_wan_image(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
  v_generation_id uuid;
  v_day_start timestamptz := date_trunc('day', timezone('UTC', now())) at time zone 'UTC';
begin
  if auth.role() is distinct from 'service_role'
     and auth.uid() is distinct from p_user_id then
    return jsonb_build_object('allowed', false, 'reason', 'forbidden');
  end if;

  if p_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_user');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  delete from public.image_generations
  where user_id = p_user_id
    and status = 'pending'
    and created_at < now() - interval '15 minutes';

  select count(*)::integer into v_used
  from public.image_generations
  where user_id = p_user_id
    and created_at >= v_day_start
    and status in ('pending', 'completed');

  if v_used >= 5 then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'remaining', 0);
  end if;

  insert into public.image_generations (user_id, model)
  values (p_user_id, 'wan2.7-image')
  returning id into v_generation_id;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(0, 4 - v_used),
    'generation_id', v_generation_id
  );
end;
$$;
revoke all on function public.consume_free_wan_image(uuid) from public;
grant execute on function public.consume_free_wan_image(uuid) to service_role;

-- 2) Team workspaces (one per user, paid-only).
create table if not exists public.team_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  goal text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.team_workspaces enable row level security;
drop policy if exists "service only" on public.team_workspaces;
create policy "service only" on public.team_workspaces
  for all to service_role using (true) with check (true);

-- 3) Team agents (persistent 24/7 workers inside a workspace).
create table if not exists public.team_agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.team_workspaces(id) on delete cascade,
  name text not null,
  role text not null,
  task text not null default '',
  status text not null default 'running',
  last_result text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_agents_workspace_idx
  on public.team_agents (workspace_id, updated_at desc);
alter table public.team_agents
  add column if not exists next_run_at timestamptz not null default now(),
  add column if not exists cycles integer not null default 0;
alter table public.team_agents enable row level security;
drop policy if exists "service only" on public.team_agents;
create policy "service only" on public.team_agents
  for all to service_role using (true) with check (true);

-- Internal runner secret shared only by this database job and the Edge Function.
create table if not exists public.team_runner_secrets (
  singleton boolean primary key default true check (singleton),
  token text not null
);
alter table public.team_runner_secrets enable row level security;
drop policy if exists "service only" on public.team_runner_secrets;
create policy "service only" on public.team_runner_secrets
  for all to service_role using (true) with check (true);
insert into public.team_runner_secrets (singleton, token)
values (true, gen_random_uuid()::text || gen_random_uuid()::text)
on conflict (singleton) do nothing;

create table if not exists public.team_agent_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.team_workspaces(id) on delete cascade,
  agent_id uuid not null references public.team_agents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  content text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists team_agent_events_workspace_idx
  on public.team_agent_events (workspace_id, created_at desc);
alter table public.team_agent_events enable row level security;
drop policy if exists "service only" on public.team_agent_events;
create policy "service only" on public.team_agent_events
  for all to service_role using (true) with check (true);

-- Claim exactly one due paid-user agent per call. SKIP LOCKED prevents duplicate
-- work when cron invocations overlap; the 5-minute delay bounds model spend.
create or replace function public.claim_team_agent()
returns table (
  agent_id uuid,
  workspace_id uuid,
  user_id uuid,
  goal text,
  agent_name text,
  agent_role text,
  task text,
  last_result text,
  cycles integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent public.team_agents%rowtype;
  v_workspace public.team_workspaces%rowtype;
begin
  select ta.* into v_agent
  from public.team_agents ta
  join public.team_workspaces tw on tw.id = ta.workspace_id
  where ta.status = 'running'
    and ta.next_run_at <= now()
    and tw.status = 'active'
    and public.has_paid_plan(tw.user_id) = true
  order by ta.next_run_at, ta.updated_at
  for update of ta skip locked
  limit 1;

  if not found then return; end if;

  update public.team_agents ta
  set next_run_at = now() + interval '5 minutes', updated_at = now()
  where ta.id = v_agent.id;

  select * into v_workspace from public.team_workspaces tw where tw.id = v_agent.workspace_id;
  return query select
    v_agent.id,
    v_agent.workspace_id,
    v_workspace.user_id,
    v_workspace.goal,
    v_agent.name,
    v_agent.role,
    v_agent.task,
    v_agent.last_result,
    v_agent.cycles;
end;
$$;
revoke all on function public.claim_team_agent() from public;
grant execute on function public.claim_team_agent() to service_role;

-- One lightweight scheduler checks for due work. It makes no model call while
-- there are no active paid workspaces and never touches unrelated cron jobs.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'megsy-team-workspace-tick' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'megsy-team-workspace-tick',
    '* * * * *',
    $cron$
      select net.http_post(
        url := 'https://qdnqxjzjecaieuavagvq.supabase.co/functions/v1/team-tick',
        body := '{}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-team-cron-token', (select token from public.team_runner_secrets where singleton = true)
        )
      );
    $cron$
  );
end;
$$;
