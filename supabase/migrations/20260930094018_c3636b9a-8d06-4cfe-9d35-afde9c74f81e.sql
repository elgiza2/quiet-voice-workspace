UPDATE public.billing_catalog SET credits=1000, updated_at=now() WHERE tier='pro' AND interval IN ('monthly','monthly_intro');
UPDATE public.billing_catalog SET credits=12000, updated_at=now() WHERE tier='pro' AND interval='yearly';
UPDATE public.billing_catalog SET active=false, updated_at=now() WHERE tier='credits';
INSERT INTO public.billing_catalog(tier,interval,base_interval,credits,usd_price,egp_price,kashier_sku,sort,trial_days,active)
VALUES ('credits','pack_500','once',500,9,449,'pack_500',33,0,true),
       ('credits','pack_1200','once',1200,19,949,'pack_1200',34,0,true),
       ('credits','pack_3000','once',3000,39,1949,'pack_3000',35,0,true);

UPDATE public.reward_tasks SET reward_credits=10 WHERE task_key IN ('trustpilot_review','X','x_like_repost');

CREATE OR REPLACE FUNCTION public.maybe_grant_referral_credit(p_referred_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_referrer uuid; v_referral uuid;
BEGIN
  SELECT id,referrer_id INTO v_referral,v_referrer FROM public.referrals
  WHERE referred_id=p_referred_id AND status='pending' AND referrer_id<>p_referred_id
  ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF v_referral IS NULL THEN RETURN; END IF;
  PERFORM public.grant_credit_bucket(v_referrer,'bonus',20,'referral_reward','Referral completed','referral:'||v_referral::text);
  UPDATE public.referrals SET status='active' WHERE id=v_referral;
END $function$;

CREATE OR REPLACE FUNCTION public.complete_referral_task(p_task_key text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user uuid := auth.uid(); v_task record; v_prev timestamptz; v_amt integer;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated'); END IF;
  IF NOT (p_task_key = ANY (public.referral_required_task_keys())) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'task_not_allowed'); END IF;
  SELECT * INTO v_task FROM public.reward_tasks WHERE task_key = p_task_key AND active = true;
  IF v_task.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'task_not_found'); END IF;
  SELECT completed_at INTO v_prev FROM public.user_reward_tasks WHERE user_id=v_user AND task_id=v_task.id;
  v_amt := coalesce(v_task.reward_credits,0);
  INSERT INTO public.user_reward_tasks (user_id, task_id, progress, completed_at, awarded_credits)
  VALUES (v_user, v_task.id, greatest(1, coalesce(v_task.target_count, 1)), now(), v_amt)
  ON CONFLICT (user_id, task_id) DO UPDATE
    SET completed_at = coalesce(public.user_reward_tasks.completed_at, now()),
        awarded_credits = CASE WHEN public.user_reward_tasks.completed_at IS NULL THEN v_amt ELSE public.user_reward_tasks.awarded_credits END,
        updated_at = now();
  IF v_prev IS NULL AND v_amt > 0 THEN
    PERFORM public.grant_credit_bucket(v_user,'bonus',v_amt,'referral_task','Task: '||v_task.title,'task:'||v_user::text||':'||p_task_key);
  END IF;
  RETURN jsonb_build_object('ok', true, 'task_key', p_task_key, 'completed', true, 'credits', CASE WHEN v_prev IS NULL THEN v_amt ELSE 0 END);
END $function$;