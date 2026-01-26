import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, location_id")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const body = await request.json();
  const phones: string[] = body.phones ?? [];
  if (!phones.length) {
    return NextResponse.json({ existing: [] });
  }
  const { data } = await supabase
    .from("contacts")
    .select("phone_e164")
    .in("phone_e164", phones);
  const existing = (data ?? []).map((row) => row.phone_e164);
  return NextResponse.json({ existing });
}
