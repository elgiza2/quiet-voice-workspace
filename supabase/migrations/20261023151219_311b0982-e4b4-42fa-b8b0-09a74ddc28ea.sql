CREATE TABLE public.task_starts (
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.reward_tasks(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, task_id)
);
GRANT ALL ON public.task_starts TO service_role;
ALTER TABLE public.task_starts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_wallet_claims (
  wallet text PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.task_wallet_claims TO service_role;
ALTER TABLE public.task_wallet_claims ENABLE ROW LEVEL SECURITY;

UPDATE public.reward_tasks SET active = false WHERE task_key IN ('trustpilot_review','X','x_like_repost');

INSERT INTO public.reward_tasks (task_key, title, description, reward_credits, action_type, action_url, icon, sort_order, active)
VALUES
 ('join_channel', 'Join our Telegram channel', 'Subscribe to the Orange AI channel', 50, 'telegram_channel', 'https://t.me/oraien', 'telegram', 6, true),
 ('buy_orange', 'Buy ORANGE coin', 'Buy ORANGE on STON.fi and verify with your TON wallet', 200, 'buy_jetton', 'https://app.ston.fi/swap?chartVisible=false&ft=GRAM&tt=EQCY5dx1kTGT-r1RPXA-LTRyv73_LtfcaTl0g1E_WBlRdUyI', 'coins', 7, true),
 ('follow_x', 'Follow us on X', 'Follow @oraicoin on X', 30, 'link', 'https://x.com/oraicoin', 'x', 8, true)
ON CONFLICT DO NOTHING;