CREATE TABLE public.crypto_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tier TEXT,
  "interval" TEXT,
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  amount_usd NUMERIC NOT NULL,
  pay_amount NUMERIC NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 6,
  expected_nano NUMERIC NOT NULL,
  memo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  tx_from TEXT,
  credits INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '2 hours'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crypto_payments TO authenticated;
GRANT ALL ON public.crypto_payments TO service_role;

ALTER TABLE public.crypto_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own crypto payments"
  ON public.crypto_payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_crypto_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_crypto_payments_updated_at
BEFORE UPDATE ON public.crypto_payments
FOR EACH ROW EXECUTE FUNCTION public.set_crypto_payments_updated_at();

CREATE INDEX crypto_payments_memo_idx ON public.crypto_payments (memo);
CREATE INDEX crypto_payments_status_idx ON public.crypto_payments (status, expires_at);
CREATE INDEX crypto_payments_user_idx ON public.crypto_payments (user_id, created_at);