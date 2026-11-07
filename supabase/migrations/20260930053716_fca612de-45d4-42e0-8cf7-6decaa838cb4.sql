CREATE OR REPLACE FUNCTION public.consume_daily_video(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tier text; paid boolean; lim integer; used integer;
  day_key text := 'daily:' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('allowed', false, 'error', 'sign in required'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_user_id::text || day_key));
  SELECT plan INTO tier FROM public.profiles WHERE id = _user_id;
  paid := coalesce(tier, 'free') <> 'free';
  lim := CASE WHEN paid THEN 5 ELSE 1 END;
  SELECT count(*)::integer INTO used FROM public.video_quota_usage WHERE user_id = _user_id AND period = day_key;
  IF used >= lim THEN
    RETURN jsonb_build_object('allowed', false, 'paid', paid, 'limit', lim, 'used', used, 'error', 'daily_video_limit_reached');
  END IF;
  INSERT INTO public.video_quota_usage (user_id, model, period)
  VALUES (_user_id, CASE WHEN paid THEN 'seedance-2.5' ELSE 'minimax' END, day_key);
  RETURN jsonb_build_object('allowed', true, 'paid', paid, 'limit', lim, 'remaining', lim - used - 1, 'period', day_key);
END; $$;

CREATE OR REPLACE FUNCTION public.refund_daily_video(_user_id uuid, _period text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.video_quota_usage WHERE id = (
    SELECT id FROM public.video_quota_usage WHERE user_id = _user_id AND period = _period
    ORDER BY created_at DESC LIMIT 1);
$$;

REVOKE ALL ON FUNCTION public.consume_daily_video(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_daily_video(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_daily_video(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_daily_video(uuid, text) TO service_role;