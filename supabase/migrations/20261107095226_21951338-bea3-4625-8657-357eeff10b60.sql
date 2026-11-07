ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username)) WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_username()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    NEW.username := lower(trim(NEW.username));
    IF NEW.username !~ '^[a-z0-9_]{3,20}$' THEN
      RAISE EXCEPTION 'Username must be 3-20 letters, numbers or underscore';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_validate_username ON public.profiles;
CREATE TRIGGER profiles_validate_username BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_username();

CREATE TABLE public.people_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'direct',
  name text,
  direct_key text UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.people_threads TO authenticated;
GRANT ALL ON public.people_threads TO service_role;
ALTER TABLE public.people_threads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.people_thread_members (
  thread_id uuid NOT NULL REFERENCES public.people_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX people_thread_members_user_idx ON public.people_thread_members(user_id);
GRANT SELECT, UPDATE ON public.people_thread_members TO authenticated;
GRANT ALL ON public.people_thread_members TO service_role;
ALTER TABLE public.people_thread_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.people_thread_bots (
  thread_id uuid NOT NULL REFERENCES public.people_threads(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, bot_id)
);
GRANT SELECT ON public.people_thread_bots TO authenticated;
GRANT ALL ON public.people_thread_bots TO service_role;
ALTER TABLE public.people_thread_bots ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.people_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.people_threads(id) ON DELETE CASCADE,
  sender_id uuid,
  bot_id uuid REFERENCES public.bots(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX people_messages_thread_idx ON public.people_messages(thread_id, created_at);
GRANT SELECT, INSERT ON public.people_messages TO authenticated;
GRANT ALL ON public.people_messages TO service_role;
ALTER TABLE public.people_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_people_member(_thread uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.people_thread_members WHERE thread_id = _thread AND user_id = auth.uid())
$$;

CREATE POLICY "members read threads" ON public.people_threads FOR SELECT TO authenticated USING (public.is_people_member(id));
CREATE POLICY "members read members" ON public.people_thread_members FOR SELECT TO authenticated USING (public.is_people_member(thread_id));
CREATE POLICY "own read marker" ON public.people_thread_members FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "members read bots" ON public.people_thread_bots FOR SELECT TO authenticated USING (public.is_people_member(thread_id));
CREATE POLICY "members read messages" ON public.people_messages FOR SELECT TO authenticated USING (public.is_people_member(thread_id));
CREATE POLICY "members send as self" ON public.people_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND bot_id IS NULL AND public.is_people_member(thread_id) AND length(content) BETWEEN 1 AND 8000);

CREATE OR REPLACE FUNCTION public.touch_people_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.people_threads SET updated_at = NEW.created_at WHERE id = NEW.thread_id; RETURN NEW; END $$;
CREATE TRIGGER people_messages_touch AFTER INSERT ON public.people_messages FOR EACH ROW EXECUTE FUNCTION public.touch_people_thread();

CREATE OR REPLACE FUNCTION public.search_people(p_query text)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.username IS NOT NULL AND p.id <> auth.uid()
    AND length(trim(p_query)) >= 2 AND p.username LIKE lower(trim(leading '@' from trim(p_query))) || '%'
  ORDER BY p.username LIMIT 10
$$;

CREATE OR REPLACE FUNCTION public.open_direct_thread(p_username text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); other uuid; k text; t uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT id INTO other FROM public.profiles WHERE username = lower(trim(leading '@' from trim(p_username)));
  IF other IS NULL THEN RAISE EXCEPTION 'No user with that username'; END IF;
  IF other = me THEN RAISE EXCEPTION 'That is your own username'; END IF;
  k := least(me::text, other::text) || ':' || greatest(me::text, other::text);
  SELECT id INTO t FROM public.people_threads WHERE direct_key = k;
  IF t IS NULL THEN
    INSERT INTO public.people_threads(kind, direct_key, created_by) VALUES ('direct', k, me) RETURNING id INTO t;
    INSERT INTO public.people_thread_members(thread_id, user_id, role) VALUES (t, me, 'owner'), (t, other, 'member');
  END IF;
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.create_people_group(p_name text, p_usernames text[], p_bot_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); t uuid; u text; uid uuid; b uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF length(trim(coalesce(p_name, ''))) = 0 THEN RAISE EXCEPTION 'Group name required'; END IF;
  INSERT INTO public.people_threads(kind, name, created_by) VALUES ('group', left(trim(p_name), 80), me) RETURNING id INTO t;
  INSERT INTO public.people_thread_members(thread_id, user_id, role) VALUES (t, me, 'owner');
  FOREACH u IN ARRAY coalesce(p_usernames, '{}') LOOP
    SELECT id INTO uid FROM public.profiles WHERE username = lower(trim(leading '@' from trim(u)));
    IF uid IS NULL THEN RAISE EXCEPTION 'No user with username %', u; END IF;
    INSERT INTO public.people_thread_members(thread_id, user_id) VALUES (t, uid) ON CONFLICT DO NOTHING;
  END LOOP;
  FOREACH b IN ARRAY coalesce(p_bot_ids, '{}') LOOP
    IF NOT EXISTS (SELECT 1 FROM public.bots WHERE id = b AND owner_id = me) THEN RAISE EXCEPTION 'You can only add your own bots'; END IF;
    INSERT INTO public.people_thread_bots(thread_id, bot_id, added_by) VALUES (t, b, me) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION public.add_people_member(p_thread uuid, p_username text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  IF NOT public.is_people_member(p_thread) THEN RAISE EXCEPTION 'Not a member'; END IF;
  IF (SELECT kind FROM public.people_threads WHERE id = p_thread) <> 'group' THEN RAISE EXCEPTION 'Only groups can add people'; END IF;
  SELECT id INTO uid FROM public.profiles WHERE username = lower(trim(leading '@' from trim(p_username)));
  IF uid IS NULL THEN RAISE EXCEPTION 'No user with that username'; END IF;
  INSERT INTO public.people_thread_members(thread_id, user_id) VALUES (p_thread, uid) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.add_people_bot(p_thread uuid, p_bot uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_people_member(p_thread) THEN RAISE EXCEPTION 'Not a member'; END IF;
  IF (SELECT kind FROM public.people_threads WHERE id = p_thread) <> 'group' THEN RAISE EXCEPTION 'Only groups can add bots'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bots WHERE id = p_bot AND owner_id = auth.uid()) THEN RAISE EXCEPTION 'You can only add your own bots'; END IF;
  INSERT INTO public.people_thread_bots(thread_id, bot_id, added_by) VALUES (p_thread, p_bot, auth.uid()) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.leave_people_thread(p_thread uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.people_thread_members WHERE thread_id = p_thread AND user_id = auth.uid();
  DELETE FROM public.people_thread_bots WHERE thread_id = p_thread AND added_by = auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.people_thread_members WHERE thread_id = p_thread) THEN
    DELETE FROM public.people_threads WHERE id = p_thread;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.people_thread_info(p_thread uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN NOT public.is_people_member(p_thread) THEN NULL ELSE jsonb_build_object(
    'members', coalesce((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'displayName', p.display_name, 'avatarUrl', p.avatar_url))
      FROM public.people_thread_members m JOIN public.profiles p ON p.id = m.user_id WHERE m.thread_id = p_thread), '[]'::jsonb),
    'bots', coalesce((SELECT jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'look', b.look, 'addedBy', tb.added_by))
      FROM public.people_thread_bots tb JOIN public.bots b ON b.id = tb.bot_id WHERE tb.thread_id = p_thread), '[]'::jsonb)
  ) END
$$;

CREATE OR REPLACE FUNCTION public.my_people_threads()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(row ORDER BY (row->>'updatedAt') DESC), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'id', t.id, 'kind', t.kind, 'name', t.name, 'updatedAt', t.updated_at, 'lastReadAt', me.last_read_at,
      'members', (SELECT jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'displayName', p.display_name, 'avatarUrl', p.avatar_url))
        FROM public.people_thread_members m JOIN public.profiles p ON p.id = m.user_id WHERE m.thread_id = t.id),
      'last', (SELECT jsonb_build_object('content', left(pm.content, 140), 'senderId', pm.sender_id, 'botId', pm.bot_id, 'createdAt', pm.created_at)
        FROM public.people_messages pm WHERE pm.thread_id = t.id ORDER BY pm.created_at DESC LIMIT 1)
    ) AS row
    FROM public.people_thread_members me JOIN public.people_threads t ON t.id = me.thread_id
    WHERE me.user_id = auth.uid()
  ) s
$$;

REVOKE EXECUTE ON FUNCTION public.search_people(text), public.open_direct_thread(text), public.create_people_group(text, text[], uuid[]),
  public.add_people_member(uuid, text), public.add_people_bot(uuid, uuid), public.leave_people_thread(uuid),
  public.people_thread_info(uuid), public.my_people_threads(), public.is_people_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.search_people(text), public.open_direct_thread(text), public.create_people_group(text, text[], uuid[]),
  public.add_people_member(uuid, text), public.add_people_bot(uuid, uuid), public.leave_people_thread(uuid),
  public.people_thread_info(uuid), public.my_people_threads(), public.is_people_member(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.people_messages;