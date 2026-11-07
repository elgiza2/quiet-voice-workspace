UPDATE public.reward_tasks SET active=false WHERE task_key NOT IN ('join_channel','follow_x','buy_orange','first_subscription','daily_checkin');
UPDATE public.reward_tasks SET active=true, title='Join the community', description='Orange AI on Telegram', action_type='telegram_channel', action_url='https://t.me/oraien' WHERE task_key='join_channel';
UPDATE public.reward_tasks SET active=true, title='Follow ORANGE on X', description='@oraicoin', action_url='https://x.com/oraicoin' WHERE task_key='follow_x';
UPDATE public.reward_tasks SET active=true, title='Buy ORANGE', description='ORANGE on STON.fi' WHERE task_key='buy_orange';
UPDATE public.reward_tasks SET active=true, title='Monthly subscription', description='Activate your monthly plan', action_url='/checkout?tier=pro&interval=monthly' WHERE task_key='first_subscription';
UPDATE public.reward_tasks SET active=true WHERE task_key='daily_checkin';
REVOKE INSERT, UPDATE, DELETE ON public.crypto_payments FROM authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS crypto_payments_unique_tx ON public.crypto_payments(network,tx_hash) WHERE tx_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crypto_payments_unique_memo ON public.crypto_payments(memo);
CREATE OR REPLACE FUNCTION public.confirm_crypto_payment(p_invoice uuid,p_tx text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.crypto_payments%ROWTYPE; g jsonb; sid uuid; end_at timestamptz;
BEGIN
 SELECT * INTO v FROM public.crypto_payments WHERE id=p_invoice FOR UPDATE;
 IF NOT FOUND OR p_tx IS NULL OR length(p_tx)<32 THEN RAISE EXCEPTION 'invalid_payment'; END IF;
 IF v.status='paid' THEN RETURN jsonb_build_object('ok',true,'status','paid'); END IF;
 IF v.status<>'pending' OR v.expires_at<now() THEN RAISE EXCEPTION 'invoice_expired'; END IF;
 IF EXISTS(SELECT 1 FROM public.crypto_payments WHERE network=v.network AND tx_hash=p_tx AND id<>v.id) THEN RAISE EXCEPTION 'transaction_already_used'; END IF;
 UPDATE public.crypto_payments SET tx_hash=p_tx WHERE id=v.id;
 IF coalesce(v.credits,0)>0 THEN
 g:=public.grant_credit_bucket(v.user_id,CASE WHEN v.tier='credits' THEN 'purchased' ELSE 'plan' END,v.credits,'crypto_purchase','crypto:'||v.memo,'crypto:'||v.id::text);
 IF NOT coalesce((g->>'success')::boolean,false) THEN RAISE EXCEPTION 'credit_grant_failed'; END IF;
 END IF;
 IF v.tier<>'credits' THEN
 end_at:=now()+CASE WHEN v.interval='yearly' THEN interval '365 days' ELSE interval '30 days' END;
 PERFORM public.ensure_credit_wallet(v.user_id);
 UPDATE public.credit_wallets SET plan_credits=coalesce(v.credits,0),plan_period_end=end_at,updated_at=now() WHERE user_id=v.user_id;
 PERFORM public.sync_credit_total(v.user_id);
 UPDATE public.profiles SET plan='pro',updated_at=now() WHERE id=v.user_id;
 SELECT id INTO sid FROM public.subscriptions WHERE user_id=v.user_id ORDER BY updated_at DESC LIMIT 1;
 IF sid IS NULL THEN INSERT INTO public.subscriptions(user_id,plan,status,currency,amount_cents,current_period_end,updated_at) VALUES(v.user_id,'pro','active','USD',round(v.amount_usd*100)::integer,end_at,now());
 ELSE UPDATE public.subscriptions SET plan='pro',status='active',currency='USD',amount_cents=round(v.amount_usd*100)::integer,current_period_end=end_at,updated_at=now() WHERE id=sid; END IF;
 END IF;
 UPDATE public.crypto_payments SET status='paid',paid_at=now() WHERE id=v.id;
 RETURN jsonb_build_object('ok',true,'status','paid');
END $$;
REVOKE ALL ON FUNCTION public.confirm_crypto_payment(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_crypto_payment(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.claim_orange_task(p_user uuid,p_task uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.reward_tasks%ROWTYPE; done_at timestamptz; g jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_task::text,0));
 SELECT * INTO t FROM public.reward_tasks WHERE id=p_task AND active=true;
 IF NOT FOUND OR t.task_key NOT IN ('join_channel','follow_x','buy_orange','first_subscription','daily_checkin') THEN RAISE EXCEPTION 'unknown_task'; END IF;
 SELECT completed_at INTO done_at FROM public.user_reward_tasks WHERE user_id=p_user AND task_id=p_task;
 IF t.task_key='daily_checkin' AND done_at>now()-interval '24 hours' THEN RETURN jsonb_build_object('ok',false,'error','already_claimed_today'); END IF;
 IF t.task_key<>'daily_checkin' AND done_at IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'credits',0,'already',true); END IF;
 g:=public.grant_credit_bucket(p_user,'bonus',t.reward_credits,'reward_task','Task: '||t.title,'task:'||p_user::text||':'||t.task_key||CASE WHEN t.task_key='daily_checkin' THEN ':'||coalesce(done_at::text,'first') ELSE '' END);
 IF NOT coalesce((g->>'success')::boolean,false) THEN RAISE EXCEPTION 'grant_failed'; END IF;
 INSERT INTO public.user_reward_tasks(user_id,task_id,progress,completed_at,awarded_credits) VALUES(p_user,p_task,greatest(1,coalesce(t.target_count,1)),now(),t.reward_credits) ON CONFLICT(user_id,task_id) DO UPDATE SET progress=excluded.progress,completed_at=excluded.completed_at,awarded_credits=excluded.awarded_credits;
 RETURN jsonb_build_object('ok',true,'credits',t.reward_credits,'total',g->'credits');
END $$;
REVOKE ALL ON FUNCTION public.claim_orange_task(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_orange_task(uuid,uuid) TO service_role;