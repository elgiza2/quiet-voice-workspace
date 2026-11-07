ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS user_type text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_bot_id uuid REFERENCES public.bots(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.validate_profile() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.age IS NOT NULL AND (NEW.age < 13 OR NEW.age > 120) THEN RAISE EXCEPTION 'invalid age'; END IF;
  IF NEW.user_type IS NOT NULL AND NEW.user_type NOT IN ('developer','designer','student','business','creator','other') THEN RAISE EXCEPTION 'invalid user_type'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_validate ON public.profiles;
CREATE TRIGGER profiles_validate BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_profile();

CREATE POLICY "avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars own insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars own update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars own delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);