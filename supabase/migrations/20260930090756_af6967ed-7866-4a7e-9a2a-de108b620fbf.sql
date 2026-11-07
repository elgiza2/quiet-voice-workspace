REVOKE EXECUTE ON FUNCTION public.spend_credits_auto(uuid,numeric,text,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits_auto(uuid,numeric,text,text) TO service_role;