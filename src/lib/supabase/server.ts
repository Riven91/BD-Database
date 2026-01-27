import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export function createSupabaseServerClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient(url, anon);
}
