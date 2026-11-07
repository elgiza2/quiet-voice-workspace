CREATE OR REPLACE FUNCTION public.claim_orange_task(p_user uuid, p_task uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.reward_tasks%ROWTYPE;
  done_at timestamptz;
  g jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_task::text, 0));
  SELECT * INTO t FROM public.reward_tasks WHERE id = p_task AND active = true;
  IF NOT FOUND OR t.task_key NOT IN ('join_channel', 'follow_x', 'buy_orange', 'first_subscription', 'daily_checkin') THEN
    RAISE EXCEPTION 'unknown_task';
  END IF;

  SELECT completed_at INTO done_at
  FROM public.user_reward_tasks
  WHERE user_id = p_user AND task_id = p_task;

  IF t.task_key = 'daily_checkin' AND done_at > now() - interval '24 hours' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed_today');
  END IF;
  IF t.task_key <> 'daily_checkin' AND done_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'credits', 0, 'already', true);
  END IF;

  g := public.grant_credit_bucket(
    p_user,
    'bonus',
    t.reward_credits,
    'reward_task',
    'Task: ' || t.title,
    'task:' || p_user::text || ':' || t.task_key || CASE WHEN t.task_key = 'daily_checkin' THEN ':' || coalesce(done_at::text, 'first') ELSE '' END
  );
  IF NOT coalesce((g->>'success')::boolean, false) THEN RAISE EXCEPTION 'grant_failed'; END IF;

  INSERT INTO public.user_reward_tasks(user_id, task_id, progress, completed_at, awarded_credits)
  VALUES (p_user, p_task, greatest(1, coalesce(t.target_count, 1)), now(), t.reward_credits)
  ON CONFLICT(user_id, task_id) DO UPDATE
  SET progress = excluded.progress, completed_at = excluded.completed_at, awarded_credits = excluded.awarded_credits;

  RETURN jsonb_build_object('ok', true, 'credits', t.reward_credits, 'total', g->'credits');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_orange_task(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_orange_task(uuid, uuid) TO service_role;
