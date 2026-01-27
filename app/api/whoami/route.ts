import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return NextResponse.json({
    authenticated: Boolean(user),
    email: user?.email ?? null
  });
}
