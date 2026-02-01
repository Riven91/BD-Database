import { createClient } from "@supabase/supabase-js";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
  return { url, anonKey };
}

let _browserClient: ReturnType<typeof createClient> | null = null;

function getBrowserSupabase() {
  if (_browserClient) return _browserClient;
  const { url, anonKey } = getSupabaseConfig();
  _browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return _browserClient;
}

export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token ?? null;

  const headers = new Headers(init.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}
