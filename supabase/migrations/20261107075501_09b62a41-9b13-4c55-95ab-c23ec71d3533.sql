CREATE TABLE IF NOT EXISTS public.provider_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  api_key text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  failure_count int NOT NULL DEFAULT 0,
  last_error text,
  last_used_at timestamptz,
  cooldown_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, api_key)
);
GRANT ALL ON public.provider_api_keys TO service_role;
ALTER TABLE public.provider_api_keys ENABLE ROW LEVEL SECURITY;