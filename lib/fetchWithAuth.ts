import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  // Always include cookies (cookie auth must work in inkognito)
  const headers = new Headers(init.headers || {});

  // Optional: attach bearer token if available (not required)
  try {
    const supabase = createClientComponentClient();
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token ?? null;

    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  } catch {
    // ignore: cookie auth may be used without readable session client-side
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}
