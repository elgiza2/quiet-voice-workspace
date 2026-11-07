grant all on public.agentsky_keys to service_role;
grant all on public.telegram_key_admins to service_role;
create policy "service only" on public.agentsky_keys for all to service_role using (true) with check (true);
create policy "service only" on public.telegram_key_admins for all to service_role using (true) with check (true);