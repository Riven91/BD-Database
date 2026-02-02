"use client";

import { getPlainSupabaseBrowser } from "@/lib/supabase/plainBrowserClient";

export async function fetchWithAuth(
  input: RequestInfo,
  init: RequestInit = {}
) {
  // Cookie-Auth ist bei dir die Wahrheit.
  // Bearer ist optional (Preview/Edge/Special cases), aber nicht zwingend.
  let token: string | undefined;

  try {
    const supabase = getPlainSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  } catch {
    // Wenn supabase/session mal knallt: trotzdem Request nicht zerstören.
    token = undefined;
  }

  const headers = new Headers(init.headers || {});

  // Optionaler Bearer (falls vorhanden)
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Content-Type nur setzen, wenn Body kein FormData ist
  if (
    !headers.has("Content-Type") &&
    init.body &&
    !(init.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  // WICHTIG: Cookies mitsenden, sonst sieht der Server deine Supabase-Cookies nicht.
  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}
