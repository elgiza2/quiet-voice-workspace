-- Premium day offer: server-enforced, email/user scoped, and reusable for future influencers.
CREATE TABLE IF NOT EXISTS public.premium_day_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'premium',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  video_limit integer NOT NULL DEFAULT 3 CHECK (video_limit > 0 AND video_limit <= 100),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS premium_day_offers_user_active_idx
  ON public.premium_day_offers (user_id, active, expires_at);

ALTER TABLE public.premium_day_offers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_premium_day_offer(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_offer public.premium_day_offers;
BEGIN
  IF p_user_id IS NULL OR (
    COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    AND auth.uid() IS DISTINCT FROM p_user_id
  ) THEN
    RETURN jsonb_build_object('active', false, 'reason', 'unauthorized');
  END IF;
  SELECT * INTO v_offer
  FROM public.premium_day_offers
  WHERE user_id = p_user_id
    AND active = true
    AND starts_at <= now()
    AND expires_at > now()
  ORDER BY expires_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false);
  END IF;
  RETURN jsonb_build_object(
    'active', true,
    'id', v_offer.id,
    'plan', v_offer.plan,
    'starts_at', v_offer.starts_at,
    'expires_at', v_offer.expires_at,
    'video_limit', v_offer.video_limit,
    'video_used', (
      SELECT count(*)::integer FROM public.video_quota_usage q
      WHERE q.user_id = p_user_id
        AND q.created_at >= v_offer.starts_at
        AND q.created_at < v_offer.expires_at
        AND q.period = 'premium_day:' || v_offer.id::text
    ),
    'videos_remaining', greatest(0, v_offer.video_limit - (
      SELECT count(*)::integer FROM public.video_quota_usage q
      WHERE q.user_id = p_user_id
        AND q.created_at >= v_offer.starts_at
        AND q.created_at < v_offer.expires_at
        AND q.period = 'premium_day:' || v_offer.id::text
    ))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_paid_plan(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  v_role := COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'));
  IF v_role IS DISTINCT FROM 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.premium_day_offers o
    WHERE o.user_id = p_user_id AND o.active = true AND o.starts_at <= now() AND o.expires_at > now()
  ) OR EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = p_user_id AND s.status = 'active'
      AND COALESCE(s.amount_cents, 0) >= 2400
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id AND lower(COALESCE(p.plan, 'free')) IN
      ('starter','pro','pro_plus','business','team','elite','enterprise','ultimate','premium')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_video_quota(
  _model text DEFAULT NULL,
  _unlimited boolean DEFAULT false,
  _user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := coalesce(auth.uid(), _user_id);
  offer public.premium_day_offers;
  used integer;
  tier text;
  balance numeric;
  cost integer;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('allowed', false, 'error', 'sign in required'); END IF;
  SELECT * INTO offer FROM public.premium_day_offers
  WHERE user_id = uid AND active = true AND starts_at <= now() AND expires_at > now()
  ORDER BY expires_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    SELECT count(*)::integer INTO used FROM public.video_quota_usage
    WHERE user_id = uid AND period = 'premium_day:' || offer.id::text
      AND created_at >= offer.starts_at AND created_at < offer.expires_at;
    IF used >= offer.video_limit THEN
      RETURN jsonb_build_object('allowed', false, 'error', 'premium_day_video_limit_reached', 'limit', offer.video_limit, 'used', used);
    END IF;
    INSERT INTO public.video_quota_usage (user_id, model, period)
    VALUES (uid, _model, 'premium_day:' || offer.id::text);
    RETURN jsonb_build_object('allowed', true, 'cost', 0, 'tier', offer.plan, 'offer', 'premium_day', 'remaining', offer.video_limit - used - 1);
  END IF;
  SELECT plan, credits INTO tier, balance FROM public.profiles WHERE id = uid;
  IF coalesce(tier, 'free') = 'free' THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'video_requires_paid_plan', 'message', 'Video generation requires a paid plan with credits.');
  END IF;
  SELECT coalesce(credits_per_video, 0) INTO cost FROM public.video_models WHERE slug = _model AND is_active = true;
  cost := greatest(cost, 1);
  IF coalesce(balance, 0) < cost THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'insufficient_credits', 'required', cost, 'balance', coalesce(balance, 0));
  END IF;
  RETURN jsonb_build_object('allowed', true, 'cost', cost, 'tier', tier, 'message', '');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_premium_day_offer(
  target_email text,
  duration_days integer DEFAULT 1,
  video_limit integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid; normalized text := lower(trim(target_email));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin access required';
  END IF;
  SELECT id INTO uid FROM auth.users WHERE lower(email) = normalized LIMIT 1;
  IF uid IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;
  INSERT INTO public.premium_day_offers (email, user_id, starts_at, expires_at, video_limit, created_by, updated_at)
  VALUES (normalized, uid, now(), now() + make_interval(days => greatest(duration_days, 1)), least(greatest(video_limit, 1), 100), auth.uid(), now())
  ON CONFLICT (email) DO UPDATE SET user_id = excluded.user_id, starts_at = excluded.starts_at,
    expires_at = excluded.expires_at, video_limit = excluded.video_limit, active = true,
    updated_at = now(), created_by = auth.uid();
  RETURN jsonb_build_object('ok', true, 'email', normalized, 'expires_at', now() + make_interval(days => greatest(duration_days, 1)));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin access required';
  END IF;
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'users', (SELECT count(*) FROM auth.users),
      'new_users_30d', (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '30 days'),
      'paid_users', (SELECT count(DISTINCT user_id) FROM public.subscriptions WHERE status = 'active' AND (current_period_end IS NULL OR current_period_end > now())),
      'referrals', (SELECT count(*) FROM public.referrals),
      'active_offers', (SELECT count(*) FROM public.premium_day_offers WHERE active = true AND expires_at > now()),
      'video_uses_30d', (SELECT count(*) FROM public.video_quota_usage WHERE created_at >= now() - interval '30 days')
    ),
    'users', COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (
      SELECT u.id, u.email, u.created_at, coalesce(p.plan, 'free') AS plan,
        p.trial_ends_at,
        EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id AND s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > now())) AS subscribed,
        (SELECT count(*) FROM public.referrals r WHERE r.referrer_id = u.id) AS referrals,
        (SELECT max(expires_at) FROM public.premium_day_offers o WHERE o.user_id = u.id AND o.active = true) AS offer_expires_at
      FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
      ORDER BY u.created_at DESC LIMIT 100
    ) x), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_premium_day_offer(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_paid_plan(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_video_quota(text, boolean, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_upsert_premium_day_offer(text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_snapshot() TO authenticated, service_role;

-- The requested first recipient. Duration starts when this migration is applied.
INSERT INTO public.premium_day_offers (email, user_id, starts_at, expires_at, video_limit)
SELECT lower(u.email), u.id, now(), now() + interval '1 day', 3
FROM auth.users u
WHERE lower(u.email) = 'zjra00@gmail.com'
ON CONFLICT (email) DO UPDATE SET user_id = excluded.user_id, starts_at = excluded.starts_at,
  expires_at = excluded.expires_at, video_limit = 3, active = true, updated_at = now();
