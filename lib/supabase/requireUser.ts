import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AuthMode = "bearer" | "cookie" | "none";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");

  return { url, anonKey };
}

function createAnonClient(token?: string) {
  const { url, anonKey } = getSupabaseConfig();
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
  });
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function requireUser(request: Request) {
  const token = getBearerToken(request);
  if (token) {
    const supabase = createAnonClient();
    const { data, error } = await supabase.auth.getUser(token);
    return {
      user: data?.user ?? null,
      mode: "bearer" as AuthMode,
      error
    };
  }

  const supabase = createRouteHandlerClient({ cookies });
  const { data, error } = await supabase.auth.getUser();
  return {
    user: data?.user ?? null,
    mode: data?.user ? ("cookie" as AuthMode) : ("none" as AuthMode),
    error
  };
}

export async function getSupabaseAuthed(request: Request): Promise<{
  supabase: SupabaseClient;
  user: Awaited<ReturnType<typeof requireUser>>["user"];
  mode: AuthMode;
}> {
  const token = getBearerToken(request);
  if (token) {
    const supabase = createAnonClient(token);
    const { data } = await supabase.auth.getUser(token);
    return { supabase, user: data?.user ?? null, mode: "bearer" };
  }

  const supabase = createRouteHandlerClient({ cookies });
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    return { supabase, user: null, mode: "none" };
  }
  return { supabase, user: data.user, mode: "cookie" };
}
