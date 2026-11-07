/** Untyped view of the shared client for code that still reads tables from the
 *  previous backend which are not part of the new schema. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as typed } from "./client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = typed as unknown as SupabaseClient<any, "public", any>;
