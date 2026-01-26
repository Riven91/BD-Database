import { createClient } from "@supabase/supabase-js";

export function createRouteClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");

  return createRouteHandlerClient({ cookies });
}
