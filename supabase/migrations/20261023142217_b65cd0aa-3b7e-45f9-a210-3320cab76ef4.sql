CREATE TABLE IF NOT EXISTS public.bot_admin_state (
  telegram_id BIGINT PRIMARY KEY,
  action TEXT NOT NULL,
  task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.bot_admin_state TO service_role;
ALTER TABLE public.bot_admin_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages bot admin state"
  ON public.bot_admin_state FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);