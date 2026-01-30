"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export async function fetchWithAuth(
  input: RequestInfo,
  init: RequestInit = {}
) {
  const supabase = createClientComponentClient();
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
