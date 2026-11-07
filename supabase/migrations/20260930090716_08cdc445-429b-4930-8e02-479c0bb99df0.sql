CREATE TABLE public.credit_wallets (
  user_id uuid PRIMARY KEY,
  daily_credits numeric NOT NULL DEFAULT 0,
  bonus_credits numeric NOT NULL DEFAULT 0,
  plan_credits numeric NOT NULL DEFAULT 0,
  purchased_credits numeric NOT NULL DEFAULT 0,
  daily_grant_date date,
  plan_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_wallets TO authenticated;
GRANT ALL ON public.credit_wallets TO service_role;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own credit wallet" ON public.credit_wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.credit_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  operation_key text NOT NULL UNIQUE,
  kind text NOT NULL,
  amount numeric NOT NULL,
  action_type text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_operations TO authenticated;
GRANT ALL ON public.credit_operations TO service_role;
ALTER TABLE public.credit_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own credit operations" ON public.credit_operations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX credit_operations_user_created_idx ON public.credit_operations(user_id, created_at DESC);

CREATE TABLE public.credit_pricing (
  feature text PRIMARY KEY,
  credits numeric NOT NULL,
  min_credits numeric,
  max_credits numeric,
  free boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_pricing TO anon, authenticated;
GRANT ALL ON public.credit_pricing TO service_role;
ALTER TABLE public.credit_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active credit pricing" ON public.credit_pricing FOR SELECT TO anon, authenticated USING (active = true);

CREATE OR REPLACE FUNCTION public.sync_credit_total(p_user_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_total numeric;
BEGIN
  SELECT daily_credits + bonus_credits + plan_credits + purchased_credits INTO v_total
  FROM public.credit_wallets WHERE user_id=p_user_id;
  UPDATE public.profiles SET credits=coalesce(v_total,0), updated_at=now() WHERE id=p_user_id;
  RETURN coalesce(v_total,0);
END $$;
REVOKE ALL ON FUNCTION public.sync_credit_total(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_credit_total(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_credit_wallet(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.credit_wallets(user_id, daily_credits, bonus_credits, daily_grant_date)
  VALUES (p_user_id, 5, 10, current_date)
  ON CONFLICT (user_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.ensure_credit_wallet(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_credit_wallet(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.grant_credit_bucket(
  p_user_id uuid, p_bucket text, p_amount numeric, p_action_type text,
  p_description text DEFAULT NULL, p_operation_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_key text := coalesce(nullif(p_operation_key,''), gen_random_uuid()::text); v_total numeric;
BEGIN
  IF p_user_id IS NULL OR p_amount <= 0 OR p_bucket NOT IN ('daily','bonus','plan','purchased') THEN
    RETURN jsonb_build_object('success',false,'error','invalid_grant');
  END IF;
  PERFORM public.ensure_credit_wallet(p_user_id);
  INSERT INTO public.credit_operations(user_id,operation_key,kind,amount,action_type,description)
  VALUES(p_user_id,v_key,'grant',p_amount,p_action_type,p_description)
  ON CONFLICT(operation_key) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',true,'duplicate',true,'credits',(SELECT credits FROM public.profiles WHERE id=p_user_id)); END IF;
  UPDATE public.credit_wallets SET
    daily_credits=daily_credits + CASE WHEN p_bucket='daily' THEN p_amount ELSE 0 END,
    bonus_credits=bonus_credits + CASE WHEN p_bucket='bonus' THEN p_amount ELSE 0 END,
    plan_credits=plan_credits + CASE WHEN p_bucket='plan' THEN p_amount ELSE 0 END,
    purchased_credits=purchased_credits + CASE WHEN p_bucket='purchased' THEN p_amount ELSE 0 END,
    updated_at=now()
  WHERE user_id=p_user_id;
  v_total := public.sync_credit_total(p_user_id);
  INSERT INTO public.credit_transactions(user_id,amount,action_type,description) VALUES(p_user_id,-p_amount,p_action_type,p_description);
  RETURN jsonb_build_object('success',true,'credits',v_total);
END $$;
REVOKE ALL ON FUNCTION public.grant_credit_bucket(uuid,text,numeric,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_credit_bucket(uuid,text,numeric,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.maybe_grant_referral_credit(p_referred_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_referrer uuid; v_referral uuid;
BEGIN
  SELECT id,referrer_id INTO v_referral,v_referrer FROM public.referrals
  WHERE referred_id=p_referred_id AND status='pending' AND referrer_id<>p_referred_id
  ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF v_referral IS NULL THEN RETURN; END IF;
  PERFORM public.grant_credit_bucket(v_referrer,'bonus',10,'referral_reward','Referral completed','referral:'||v_referral::text);
  UPDATE public.referrals SET status='active' WHERE id=v_referral;
END $$;
REVOKE ALL ON FUNCTION public.maybe_grant_referral_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_grant_referral_credit(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.spend_credits_auto(p_user_id uuid,p_amount numeric,p_action_type text,p_description text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_role text; v_wallet public.credit_wallets%rowtype; v_left numeric; v_take numeric; v_total numeric;
BEGIN
  v_role:=coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif((current_setting('request.jwt.claims',true)::jsonb->>'role'),''),current_user);
  IF v_role IS DISTINCT FROM 'service_role' AND (auth.uid() IS NULL OR auth.uid()<>p_user_id) THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount<=0 THEN RETURN jsonb_build_object('success',false,'error','invalid_amount'); END IF;
  PERFORM public.ensure_credit_wallet(p_user_id);
  SELECT * INTO v_wallet FROM public.credit_wallets WHERE user_id=p_user_id FOR UPDATE;
  IF v_wallet.daily_credits+v_wallet.bonus_credits+v_wallet.plan_credits+v_wallet.purchased_credits<p_amount THEN
    RETURN jsonb_build_object('success',false,'error','Insufficient credits','credits',v_wallet.daily_credits+v_wallet.bonus_credits+v_wallet.plan_credits+v_wallet.purchased_credits);
  END IF;
  v_left:=p_amount;
  v_take:=least(v_left,v_wallet.daily_credits); v_wallet.daily_credits:=v_wallet.daily_credits-v_take; v_left:=v_left-v_take;
  v_take:=least(v_left,v_wallet.plan_credits); v_wallet.plan_credits:=v_wallet.plan_credits-v_take; v_left:=v_left-v_take;
  v_take:=least(v_left,v_wallet.bonus_credits); v_wallet.bonus_credits:=v_wallet.bonus_credits-v_take; v_left:=v_left-v_take;
  v_take:=least(v_left,v_wallet.purchased_credits); v_wallet.purchased_credits:=v_wallet.purchased_credits-v_take;
  UPDATE public.credit_wallets SET daily_credits=v_wallet.daily_credits,bonus_credits=v_wallet.bonus_credits,plan_credits=v_wallet.plan_credits,purchased_credits=v_wallet.purchased_credits,updated_at=now() WHERE user_id=p_user_id;
  INSERT INTO public.credit_operations(user_id,operation_key,kind,amount,action_type,description) VALUES(p_user_id,gen_random_uuid()::text,'spend',p_amount,p_action_type,p_description);
  INSERT INTO public.credit_transactions(user_id,amount,action_type,description) VALUES(p_user_id,p_amount,p_action_type,p_description);
  v_total:=public.sync_credit_total(p_user_id);
  PERFORM public.maybe_grant_referral_credit(p_user_id);
  RETURN jsonb_build_object('success',true,'source','personal','credits',v_total);
END $$;
REVOKE ALL ON FUNCTION public.spend_credits_auto(uuid,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_credits_auto(uuid,numeric,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.deduct_credits(p_user_id uuid,p_amount numeric,p_action_type text,p_description text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.spend_credits_auto(p_user_id,p_amount,p_action_type,p_description) $$;

CREATE OR REPLACE FUNCTION public.add_credits(p_user_id uuid,p_amount numeric,p_description text DEFAULT 'Credit refund')
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.grant_credit_bucket(p_user_id,'bonus',p_amount,'credit_refund',p_description,NULL) $$;

CREATE OR REPLACE FUNCTION public.grant_user_credits(p_user_id uuid,p_amount numeric,p_action_type text,p_description text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN v:=public.grant_credit_bucket(p_user_id,'bonus',p_amount,p_action_type,p_description,NULL); RETURN coalesce((v->>'credits')::numeric,0); END $$;

CREATE OR REPLACE FUNCTION public.daily_credit_allowance(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT 5 $$;

CREATE OR REPLACE FUNCTION public.claim_daily_credits()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid:=auth.uid(); v_before numeric; v_granted numeric:=0; v_total numeric;
BEGIN
 IF v_user IS NULL THEN RETURN jsonb_build_object('success',false,'error','Not authenticated'); END IF;
 PERFORM public.ensure_credit_wallet(v_user);
 SELECT daily_credits INTO v_before FROM public.credit_wallets WHERE user_id=v_user FOR UPDATE;
 UPDATE public.credit_wallets SET daily_credits=5,daily_grant_date=current_date,updated_at=now()
 WHERE user_id=v_user AND daily_grant_date IS DISTINCT FROM current_date;
 IF FOUND THEN v_granted:=greatest(0,5-v_before); END IF;
 v_total:=public.sync_credit_total(v_user);
 INSERT INTO public.daily_credit_grants(user_id,grant_date,amount) VALUES(v_user,current_date,greatest(v_granted,0.0001)) ON CONFLICT(user_id,grant_date) DO NOTHING;
 IF v_granted>0 THEN INSERT INTO public.credit_transactions(user_id,amount,action_type,description) VALUES(v_user,-v_granted,'daily_refresh','Daily credit refresh'); END IF;
 RETURN jsonb_build_object('success',true,'granted',v_granted,'credits',v_total,'allowance',5,'already_claimed',v_granted=0);
END $$;

CREATE OR REPLACE FUNCTION public.get_credit_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid:=auth.uid(); w public.credit_wallets%rowtype; v_plan text; v_spent_today numeric; v_tasks integer; v_spent_month numeric; v_next timestamptz;
BEGIN
 IF v_user IS NULL THEN RETURN jsonb_build_object('success',false,'error','Not authenticated'); END IF;
 SELECT * INTO w FROM public.credit_wallets WHERE user_id=v_user;
 SELECT coalesce(plan,'free') INTO v_plan FROM public.profiles WHERE id=v_user;
 SELECT current_period_end INTO v_next FROM public.subscriptions WHERE user_id=v_user AND status IN('active','trialing') ORDER BY updated_at DESC LIMIT 1;
 SELECT coalesce(sum(amount),0),count(*) INTO v_spent_today,v_tasks FROM public.credit_transactions WHERE user_id=v_user AND amount>0 AND created_at>=date_trunc('day',now());
 SELECT coalesce(sum(amount),0) INTO v_spent_month FROM public.credit_transactions WHERE user_id=v_user AND amount>0 AND created_at>=date_trunc('month',now());
 RETURN jsonb_build_object('success',true,'credits',coalesce(w.daily_credits+w.bonus_credits+w.plan_credits+w.purchased_credits,0),'plan',coalesce(v_plan,'free'),'daily_allowance',5,'daily_credits',coalesce(w.daily_credits,0),'bonus_credits',coalesce(w.bonus_credits,0),'plan_credits',coalesce(w.plan_credits,0),'purchased_credits',coalesce(w.purchased_credits,0),'claimed_today',w.daily_grant_date=current_date,'granted_today',coalesce(w.daily_credits,0),'next_refresh',date_trunc('day',now())+interval '1 day','plan_renews_at',v_next,'spent_today',v_spent_today,'tasks_today',v_tasks,'spent_this_month',v_spent_month,'free_today','{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.profiles(id,display_name,avatar_url,credits) VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name',split_part(NEW.email,'@',1)),NEW.raw_user_meta_data->>'avatar_url',15);
 INSERT INTO public.credit_wallets(user_id,daily_credits,bonus_credits,daily_grant_date) VALUES(NEW.id,5,10,current_date);
 INSERT INTO public.credit_operations(user_id,operation_key,kind,amount,action_type,description) VALUES(NEW.id,'signup:'||NEW.id::text,'grant',10,'signup_bonus','Welcome credits');
 INSERT INTO public.credit_transactions(user_id,amount,action_type,description) VALUES(NEW.id,-10,'signup_bonus','Welcome credits');
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.claim_referral_signup(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid:=auth.uid(); v_referrer uuid; v_code text:=upper(trim(coalesce(p_code,'')));
BEGIN
 IF v_user IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_authenticated'); END IF;
 IF EXISTS(SELECT 1 FROM public.referrals WHERE referred_id=v_user) THEN RETURN jsonb_build_object('ok',true,'already',true); END IF;
 SELECT user_id INTO v_referrer FROM public.referral_codes WHERE upper(code)=v_code LIMIT 1;
 IF v_referrer IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_code'); END IF;
 IF v_referrer=v_user THEN RETURN jsonb_build_object('ok',false,'error','self_referral'); END IF;
 INSERT INTO public.referrals(referrer_id,referred_id,referral_code,status) VALUES(v_referrer,v_user,v_code,'pending');
 RETURN jsonb_build_object('ok',true,'pending_first_use',true,'credits_granted',0);
END $$;

CREATE OR REPLACE FUNCTION public.fulfill_kashier_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sid uuid; period_days integer:=30; is_plan boolean;
BEGIN
 IF NEW.status='paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
  is_plan:=NEW.plan IS NOT NULL AND btrim(NEW.plan)<>'';
  IF coalesce(NEW.raw->>'interval','monthly')='yearly' THEN period_days:=365; END IF;
  IF NEW.credits>0 THEN
   PERFORM public.grant_credit_bucket(NEW.user_id,CASE WHEN is_plan THEN 'plan' ELSE 'purchased' END,NEW.credits,CASE WHEN is_plan THEN 'subscription_purchase' ELSE 'credit_purchase' END,'kashier:payment:'||NEW.order_id,'payment:'||NEW.order_id);
  END IF;
  IF is_plan THEN
   UPDATE public.credit_wallets SET plan_credits=NEW.credits,plan_period_end=now()+(period_days||' days')::interval,updated_at=now() WHERE user_id=NEW.user_id;
   PERFORM public.sync_credit_total(NEW.user_id);
   UPDATE public.profiles SET plan='pro',updated_at=now() WHERE id=NEW.user_id;
   SELECT id INTO sid FROM public.subscriptions WHERE user_id=NEW.user_id ORDER BY updated_at DESC LIMIT 1;
   IF sid IS NULL THEN INSERT INTO public.subscriptions(user_id,plan,status,currency,amount_cents,current_period_end,updated_at) VALUES(NEW.user_id,'pro','active',NEW.currency,round(NEW.amount*100)::integer,now()+(period_days||' days')::interval,now());
   ELSE UPDATE public.subscriptions SET plan='pro',status='active',currency=NEW.currency,amount_cents=round(NEW.amount*100)::integer,current_period_end=now()+(period_days||' days')::interval,updated_at=now() WHERE id=sid; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;