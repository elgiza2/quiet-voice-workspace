-- lovable-cron-fallback-reviewed: reminders are user-chosen times that must arrive within a minute; approved in plan
CREATE TABLE public.cron_secrets (
  name text PRIMARY KEY,
  secret text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cron_secrets TO service_role;
ALTER TABLE public.cron_secrets ENABLE ROW LEVEL SECURITY;
INSERT INTO public.cron_secrets(name) VALUES ('reminders') ON CONFLICT DO NOTHING;

SELECT cron.schedule(
  'megsy-reminders-tick',
  '* * * * *',
  $$ SELECT net.http_post(
       url := 'https://project--3ad89d40-71b8-4d63-bbe2-6a9ffa7a0153.lovable.app/api/public/reminders-tick',
       headers := jsonb_build_object('Content-Type','application/json','x-cron-key',(SELECT secret FROM public.cron_secrets WHERE name='reminders')),
       body := '{}'::jsonb
     ); $$
);