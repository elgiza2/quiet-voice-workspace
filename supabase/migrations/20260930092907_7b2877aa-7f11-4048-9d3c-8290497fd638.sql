CREATE OR REPLACE FUNCTION public.charge_credits_once(p_user_id uuid,p_amount numeric,p_action_type text,p_description text,p_operation_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.credit_wallets%rowtype; v_left numeric; d numeric; p numeric; b numeric; u numeric; v_total numeric; v_existing public.credit_operations%rowtype;
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount<=0 OR coalesce(p_operation_key,'')='' THEN
    RETURN jsonb_build_object('success',false,'error','invalid_charge');
  END IF;
  PERFORM public.ensure_credit_wallet(p_user_id);
  SELECT * INTO w FROM public.credit_wallets WHERE user_id=p_user_id FOR UPDATE;
  SELECT * INTO v_existing FROM public.credit_operations WHERE operation_key='charge:'||p_operation_key;
  IF FOUND THEN
    RETURN jsonb_build_object('success',true,'duplicate',true,'credits',w.daily_credits+w.bonus_credits+w.plan_credits+w.purchased_credits);
  END IF;
  IF w.daily_credits+w.bonus_credits+w.plan_credits+w.purchased_credits<p_amount THEN
    RETURN jsonb_build_object('success',false,'error','Insufficient credits','credits',w.daily_credits+w.bonus_credits+w.plan_credits+w.purchased_credits);
  END IF;
  v_left:=p_amount;
  d:=least(v_left,w.daily_credits); v_left:=v_left-d;
  p:=least(v_left,w.plan_credits); v_left:=v_left-p;
  b:=least(v_left,w.bonus_credits); v_left:=v_left-b;
  u:=least(v_left,w.purchased_credits);
  UPDATE public.credit_wallets SET daily_credits=daily_credits-d,plan_credits=plan_credits-p,bonus_credits=bonus_credits-b,purchased_credits=purchased_credits-u,updated_at=now() WHERE user_id=p_user_id;
  INSERT INTO public.credit_operations(user_id,operation_key,kind,amount,action_type,description,metadata)
  VALUES(p_user_id,'charge:'||p_operation_key,'spend',p_amount,p_action_type,p_description,jsonb_build_object('daily',d,'plan',p,'bonus',b,'purchased',u));
  INSERT INTO public.credit_transactions(user_id,amount,action_type,description) VALUES(p_user_id,p_amount,p_action_type,p_description);
  v_total:=public.sync_credit_total(p_user_id);
  PERFORM public.maybe_grant_referral_credit(p_user_id);
  RETURN jsonb_build_object('success',true,'credits',v_total);
END $$;
REVOKE ALL ON FUNCTION public.charge_credits_once(uuid,numeric,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_credits_once(uuid,numeric,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.refund_credits_once(p_operation_key text,p_reason text DEFAULT 'Refund')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.credit_operations%rowtype; v_total numeric;
BEGIN
  SELECT * INTO c FROM public.credit_operations WHERE operation_key='charge:'||p_operation_key FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','charge_not_found'); END IF;
  INSERT INTO public.credit_operations(user_id,operation_key,kind,amount,action_type,description,metadata)
  VALUES(c.user_id,'refund:'||p_operation_key,'refund',c.amount,'credit_refund',p_reason,c.metadata)
  ON CONFLICT(operation_key) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',true,'duplicate',true); END IF;
  UPDATE public.credit_wallets SET
    daily_credits=daily_credits+coalesce((c.metadata->>'daily')::numeric,0),
    plan_credits=plan_credits+coalesce((c.metadata->>'plan')::numeric,0),
    bonus_credits=bonus_credits+coalesce((c.metadata->>'bonus')::numeric,0),
    purchased_credits=purchased_credits+coalesce((c.metadata->>'purchased')::numeric,0),
    updated_at=now()
  WHERE user_id=c.user_id;
  INSERT INTO public.credit_transactions(user_id,amount,action_type,description) VALUES(c.user_id,-c.amount,'credit_refund',p_reason);
  v_total:=public.sync_credit_total(c.user_id);
  RETURN jsonb_build_object('success',true,'refunded',c.amount,'credits',v_total);
END $$;
REVOKE ALL ON FUNCTION public.refund_credits_once(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits_once(text,text) TO service_role;