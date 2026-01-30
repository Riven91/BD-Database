import { NextResponse } from "next/server";
import { notAuth, requireUser } from "@/lib/supabase/routeSupabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return notAuth();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, location_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function POST() {
  const { supabase, user } = await requireUser();
  if (!user) return notAuth();

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id, role, location_id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ profile: existing });
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({ id: user.id, role: "staff", location_id: null })
    .select("id, role, location_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return notAuth();

  const body = await request.json();
  const locationId = body.location_id;
  if (!locationId || typeof locationId !== "string") {
    return NextResponse.json({ error: "Missing location_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ location_id: locationId })
    .eq("id", user.id)
    .select("id, role, location_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
