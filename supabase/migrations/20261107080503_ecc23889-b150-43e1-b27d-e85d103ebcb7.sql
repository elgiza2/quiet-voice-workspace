REVOKE EXECUTE ON FUNCTION public.claim_agent_routines() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_agent_routines() TO service_role;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
CREATE POLICY "server only" ON public.provider_api_keys FOR ALL TO authenticated USING (false) WITH CHECK (false);