UPDATE public.reward_tasks SET active=false, updated_at=now()
WHERE task_key IN ('trustpilot_review','X','x_like_repost');

UPDATE public.reward_tasks
SET active=true, title='Connect Telegram', description='Open Orange AI inside Telegram once to link your account', reward_credits=25, action_type='open_url', action_url='https://t.me/Noveaibot?startapp=login', target_count=1, icon='telegram', updated_at=now()
WHERE task_key='telegram_join';

INSERT INTO public.reward_tasks (task_key,title,description,reward_credits,action_type,action_url,target_count,icon,active,sort_order)
SELECT 'telegram_join','Connect Telegram','Open Orange AI inside Telegram once to link your account',25,'open_url','https://t.me/Noveaibot?startapp=login',1,'telegram',true,60
WHERE NOT EXISTS (SELECT 1 FROM public.reward_tasks WHERE task_key='telegram_join');

UPDATE public.reward_tasks
SET active=true, title='Daily check-in', description='Come back every day for free points', reward_credits=5, action_type='daily', action_url=NULL, target_count=1, icon='calendar', updated_at=now()
WHERE task_key='daily_checkin';

INSERT INTO public.reward_tasks (task_key,title,description,reward_credits,action_type,action_url,target_count,icon,active,sort_order)
SELECT 'daily_checkin','Daily check-in','Come back every day for free points',5,'daily',NULL,1,'calendar',true,70
WHERE NOT EXISTS (SELECT 1 FROM public.reward_tasks WHERE task_key='daily_checkin');

CREATE OR REPLACE FUNCTION public.referral_required_task_keys()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ SELECT ARRAY['first_chat','first_image','complete_profile','first_subscription','telegram_join','daily_checkin','invite_friend']::text[] $function$;