import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL missing");
  if (!anon) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY missing");

  return createBrowserClient(url, anon);
}
