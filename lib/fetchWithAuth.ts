"use client";

import { getPlainSupabaseBrowser } from "@/lib/supabase/plainBrowserClient";

export async function fetchWithAuth(
  input: RequestInfo,
  init: RequestInit = {}
) {
  const supabase = getPlainSupabaseBrowser();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (
    !headers.has("Content-Type") &&
    init.body &&
    !(init.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, { ...init, headers });
}
