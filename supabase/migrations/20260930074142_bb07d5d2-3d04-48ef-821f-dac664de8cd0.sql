CREATE TABLE public.life_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.life_goals TO authenticated;
GRANT ALL ON public.life_goals TO service_role;
ALTER TABLE public.life_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.life_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.life_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  goal_id uuid REFERENCES public.life_goals(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text,
  kind text NOT NULL DEFAULT 'task',
  due_at timestamptz,
  remind_at timestamptz,
  repeat_rule text,
  status text NOT NULL DEFAULT 'todo',
  source text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.life_tasks TO authenticated;
GRANT ALL ON public.life_tasks TO service_role;
ALTER TABLE public.life_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks" ON public.life_tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX life_tasks_remind_idx ON public.life_tasks (remind_at) WHERE status = 'todo';

CREATE TABLE public.life_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  emoji text NOT NULL DEFAULT '✨',
  title text NOT NULL,
  body text,
  prompt text NOT NULL,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.life_ideas TO authenticated;
GRANT ALL ON public.life_ideas TO service_role;
ALTER TABLE public.life_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ideas" ON public.life_ideas FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.scheduled_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  task_id uuid REFERENCES public.life_tasks(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'reminder',
  title text NOT NULL,
  body text,
  run_at timestamptz NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_nudges TO authenticated;
GRANT ALL ON public.scheduled_nudges TO service_role;
ALTER TABLE public.scheduled_nudges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own nudges" ON public.scheduled_nudges FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX scheduled_nudges_due_idx ON public.scheduled_nudges (run_at) WHERE sent_at IS NULL;

CREATE OR REPLACE FUNCTION public.life_touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER life_goals_touch BEFORE UPDATE ON public.life_goals FOR EACH ROW EXECUTE FUNCTION public.life_touch_updated_at();
CREATE TRIGGER life_tasks_touch BEFORE UPDATE ON public.life_tasks FOR EACH ROW EXECUTE FUNCTION public.life_touch_updated_at();

-- keep a reminder nudge in sync with each task's remind_at
CREATE OR REPLACE FUNCTION public.life_task_sync_nudge() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.scheduled_nudges WHERE task_id = NEW.id AND sent_at IS NULL;
  IF NEW.remind_at IS NOT NULL AND NEW.status = 'todo' THEN
    INSERT INTO public.scheduled_nudges (user_id, task_id, kind, title, body, run_at)
    VALUES (NEW.user_id, NEW.id, CASE WHEN NEW.kind = 'alarm' THEN 'alarm' ELSE 'reminder' END, NEW.title, NEW.notes, NEW.remind_at);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER life_tasks_nudge AFTER INSERT OR UPDATE OF remind_at, status, title ON public.life_tasks FOR EACH ROW EXECUTE FUNCTION public.life_task_sync_nudge();