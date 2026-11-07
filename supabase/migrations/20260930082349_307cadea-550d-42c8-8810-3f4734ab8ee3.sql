CREATE TABLE public.device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'android',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_push_tokens TO authenticated;
GRANT ALL ON public.device_push_tokens TO service_role;
ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tokens" ON public.device_push_tokens FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.life_settings (
  user_id uuid PRIMARY KEY,
  morning_enabled boolean NOT NULL DEFAULT false,
  morning_time text NOT NULL DEFAULT '08:00',
  tz text NOT NULL DEFAULT 'Africa/Cairo',
  last_morning_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.life_settings TO authenticated;
GRANT ALL ON public.life_settings TO service_role;
ALTER TABLE public.life_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own life settings" ON public.life_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER life_settings_touch BEFORE UPDATE ON public.life_settings FOR EACH ROW EXECUTE FUNCTION public.life_touch_updated_at();

ALTER TABLE public.scheduled_nudges ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;
UPDATE public.scheduled_nudges SET push_sent_at = now() WHERE run_at < now();
CREATE INDEX IF NOT EXISTS scheduled_nudges_push_due ON public.scheduled_nudges (run_at) WHERE push_sent_at IS NULL;