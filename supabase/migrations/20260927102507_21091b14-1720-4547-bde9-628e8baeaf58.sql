CREATE TABLE public.test_agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message_id text NOT NULL,
  role text NOT NULL,
  message jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_agent_messages TO authenticated;
GRANT ALL ON public.test_agent_messages TO service_role;
ALTER TABLE public.test_agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own test agent messages" ON public.test_agent_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX test_agent_messages_user_created ON public.test_agent_messages (user_id, created_at);

CREATE TABLE public.test_agent_sandboxes (
  user_id uuid PRIMARY KEY,
  sandbox_id text NOT NULL,
  stream_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_agent_sandboxes TO authenticated;
GRANT ALL ON public.test_agent_sandboxes TO service_role;
ALTER TABLE public.test_agent_sandboxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own test agent sandbox" ON public.test_agent_sandboxes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);