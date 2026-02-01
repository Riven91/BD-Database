import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

export type AuthMode = "bearer" | "cookie" | "none";

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");

  return { url, anonKey };
}

function createAnonClient(token?: string) {
  const { url, anonKey } = getEnv();

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

function getBearerToken(request: Request) {
  // be tolerant with header casing
  const authHeader =
    request.headers.get("authorization") ??
    request.headers.get("Authorization") ??
    "";

  // THIS MUST BE "Bearer" without spaces
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  const token = match?.[1]?.trim() ?? null;
  return token || null;
}

// ONLY accept real JWTs as Bearer session tokens
function looksLikeJwt(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  // quick sanity: JWT parts are long-ish
  return parts[0].length > 10 && parts[1].length > 10 && parts[2].length > 10;
}

export async function requireUser(request: Request) {
  const token = getBearerToken(request);

  // 1) Prefer Bearer only if it's a real JWT access token
  if (token && looksLikeJwt(token)) {
    const supabase = createAnonClient();
    const { data, error } = await supabase.auth.getUser(token);

    return {
      user: data?.user ?? null,
      mode: (data?.user ? "bearer" : "none") as AuthMode,
      error,
    };
  }

  // 2) Fallback: Cookie-based user (useful for UI gating, not the main truth)
  const supabase = createRouteHandlerClient({ cookies });
  const { data, error } = await supabase.auth.getUser();

  return {
    user: data?.user ?? null,
    mode: (data?.user ? "cookie" : "none") as AuthMode,
    error,
  };
}

export async function getSupabaseAuthed(
  request: Request
): Promise<{
  supabase: ReturnType<typeof createAnonClient> | ReturnType<typeof createRouteHandlerClient>;
  user: any | null;
  mode: AuthMode;
}> {
  const token = getBearerToken(request);

  // 1) Prefer Bearer only if JWT
  if (token && looksLikeJwt(token)) {
    const supabase = createAnonClient(token);
    const { data } = await supabase.auth.getUser(token);
    return { supabase, user: data?.user ?? null, mode: data?.user ? "bearer" : "none" };
  }

  // 2) Cookie fallback
  const supabase = createRouteHandlerClient({ cookies });
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return { supabase, user: null, mode: "none" };

  return { supabase, user: data.user, mode: "cookie" };
}
