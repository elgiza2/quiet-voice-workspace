CREATE TABLE public.agent_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bot_id uuid REFERENCES public.bots(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'voice',
  status text NOT NULL DEFAULT 'ringing',
  ring_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_calls_user_idx ON public.agent_calls(user_id, status, ring_at);
GRANT SELECT, INSERT, UPDATE ON public.agent_calls TO authenticated;
GRANT ALL ON public.agent_calls TO service_role;
ALTER TABLE public.agent_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calls read" ON public.agent_calls FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own calls create" ON public.agent_calls FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status IN ('ringing','scheduled') AND kind IN ('voice','video') AND length(reason) <= 2000
    AND (bot_id IS NULL OR EXISTS (SELECT 1 FROM public.bots b WHERE b.id = bot_id AND b.owner_id = auth.uid())));
CREATE POLICY "own calls update" ON public.agent_calls FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND status IN ('ringing','scheduled','answered','declined','missed','cancelled'));
CREATE TRIGGER agent_calls_updated BEFORE UPDATE ON public.agent_calls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_calls;