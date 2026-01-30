import { NextResponse } from "next/server";
import { notAuth, requireUser } from "@/lib/supabase/routeAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return notAuth();

  const { data, error } = await supabase
    .from("locations")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ locations: data ?? [] });
}
