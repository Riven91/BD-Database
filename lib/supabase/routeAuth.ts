import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";

export function supabaseRoute() {
  return createRouteHandlerClient({ cookies });
}

export async function requireUser() {
  const supabase = supabaseRoute();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;
  return { supabase, user, error };
}

export function notAuth() {
  return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
}
