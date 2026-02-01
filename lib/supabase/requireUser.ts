import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type AuthMode = "bearer" | "cookie" | "none";

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");

  return { url, anonKey };
}

function getBearerToken(request: Request) {
  const authHeader =
    request.headers.get("authorization") ??
    request.headers.get("Authorization") ??
    "";

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? null;
  return token || null;
}

function looksLikeJwt(token: string) {
  const parts = token.split(".");
  return parts.length === 3 && parts[0].length > 10 && parts[1].length > 10;
}

function createAnonClientWithBearer(token: string): SupabaseClient {
  const { url, anonKey } = getEnv();

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function createCookieClient(): SupabaseClient {
  // IMPORTANT: cast to a single SupabaseClient type (avoid union overload issues)
  return createRouteHandlerClient({ cookies }) as unknown as SupabaseClient;
}

export async function requireUser(request: Request): Promise<{
  user: any | null;
  mode: AuthMode;
  error: any | null;
}> {
  const token = getBearerToken(request);

  if (token && looksLikeJwt(token)) {
    const supabase = createAnonClientWithBearer(token);
    const { data, error } = await supabase.auth.getUser(token);
    return { user: data?.user ?? null, mode: data?.user ? "bearer" : "none", error: error ?? null };
  }

  const supabase = createCookieClient();
  const { data, error } = await supabase.auth.getUser();
  return { user: data?.user ?? null, mode: data?.user ? "cookie" : "none", error: error ?? null };
}

export async function getSupabaseAuthed(
  request: Request
): Promise<{
  supabase: SupabaseClient;
  user: any | null;
  mode: AuthMode;
}> {
  const token = getBearerToken(request);

  if (token && looksLikeJwt(token)) {
    const supabase = createAnonClientWithBearer(token);
    const { data } = await supabase.auth.getUser(token);
    return { supabase, user: data?.user ?? null, mode: data?.user ? "bearer" : "none" };
  }

  const supabase = createCookieClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data?.user ?? null, mode: data?.user ? "cookie" : "none" };
}
