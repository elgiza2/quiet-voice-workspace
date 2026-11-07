-- Harden paid-only features and keep same-day image reservations fail-closed.

-- A stale `profiles.plan` value must never keep an expired/cancelled account
-- eligible. Paid access comes only from a currently valid paid subscription or
-- an explicitly active, time-bounded premium offer.
CREATE OR REPLACE FUNCTION public.has_paid_plan(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  );
  IF v_role IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.premium_day_offers o
    WHERE o.user_id = p_user_id
      AND o.active = true
      AND o.starts_at <= now()
      AND o.expires_at > now()
  ) OR EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
      AND s.status = 'active'
      AND COALESCE(s.amount_cents, 0) >= 2400
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
END;
$$;

-- Same-day pending reservations remain charged until UTC reset. Failed
-- provider attempts are explicitly deleted by the Edge Function; stale
-- reservations from prior UTC days can be cleaned safely here.
CREATE OR REPLACE FUNCTION public.consume_free_wan_image(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used integer;
  v_generation_id uuid;
  v_day_start timestamptz := date_trunc('day', timezone('UTC', now())) at time zone 'UTC';
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'forbidden');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_user');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  DELETE FROM public.image_generations
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND created_at < v_day_start;

  SELECT count(*)::integer INTO v_used
  FROM public.image_generations
  WHERE user_id = p_user_id
    AND created_at >= v_day_start
    AND status IN ('pending', 'completed');

  IF v_used >= 5 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'daily_limit', 'remaining', 0);
  END IF;

  INSERT INTO public.image_generations (user_id, model)
  VALUES (p_user_id, 'wan2.7-image')
  RETURNING id INTO v_generation_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', greatest(0, 4 - v_used),
    'generation_id', v_generation_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_free_wan_image(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_free_wan_image(uuid) TO service_role;
