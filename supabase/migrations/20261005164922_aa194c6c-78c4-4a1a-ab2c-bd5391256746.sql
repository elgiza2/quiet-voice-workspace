create table if not exists public.agentsky_keys (
  id uuid primary key default gen_random_uuid(),
  key_value text not null unique,
  label text,
  active boolean not null default true,
  last_used_at timestamptz,
  fail_count int not null default 0,
  last_error text,
  added_by_telegram bigint,
  created_at timestamptz not null default now()
);
alter table public.agentsky_keys enable row level security;
revoke all on public.agentsky_keys from anon, authenticated;

create table if not exists public.telegram_key_admins (
  telegram_user_id bigint primary key,
  created_at timestamptz not null default now()
);
alter table public.telegram_key_admins enable row level security;
revoke all on public.telegram_key_admins from anon, authenticated;

create or replace function public.take_agentsky_key()
returns table(id uuid, key_value text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.agentsky_keys k set last_used_at = now()
  where k.id = (
    select x.id from public.agentsky_keys x where x.active
    order by x.last_used_at nulls first limit 1 for update skip locked
  )
  returning k.id, k.key_value;
end $$;
revoke execute on function public.take_agentsky_key() from public, anon, authenticated;
grant execute on function public.take_agentsky_key() to service_role;