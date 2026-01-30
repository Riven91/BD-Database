import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";

export function getSupabase() {
  return createRouteHandlerClient({ cookies });
}

export async function requireUser() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { supabase, user: null };
  }
  return { supabase, user: data.user };
}

export function notAuth() {
  return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
}
