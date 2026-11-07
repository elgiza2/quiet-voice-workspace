/** @doc Public Supabase config for the serverless API routes.
 *
 *  The project URL and the publishable (anon) key are public values that already
 *  ship inside the browser bundle, so hardcoding them here is safe and removes
 *  the need to configure any environment variable on the hosting platform.
 *  Env vars still win when they are present (e.g. a staging project).
 *
 *  The service-role key is NEVER hardcoded — routes fall back to the caller's
 *  JWT plus RLS instead.
 */
const FALLBACK_URL = "https://kcrssdgsefhpzoidlhhm.supabase.co";
const FALLBACK_PUBLISHABLE_KEY =
  "sb_publishable_qoVkpETZyG-dHOq_XYnFPw_vrxR_aJC";

export const SUPABASE_URL: string =
  FALLBACK_URL;

export const SUPABASE_PUBLISHABLE_KEY: string = FALLBACK_PUBLISHABLE_KEY;

/** Optional — present only when the deployment configured it. */
export const SUPABASE_SERVICE_ROLE_KEY: string | undefined =
  process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
