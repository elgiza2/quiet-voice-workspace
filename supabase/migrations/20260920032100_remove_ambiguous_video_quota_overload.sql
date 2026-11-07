-- Keep only the user-aware overload. Its default _user_id preserves two-argument callers
-- while avoiding PostgREST ambiguity with the legacy consume_video_quota(text, boolean).
DROP FUNCTION IF EXISTS public.consume_video_quota(text, boolean);
