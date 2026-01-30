import { NextResponse } from "next/server";
import { notAuth, requireUser } from "@/lib/supabase/routeAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return notAuth();

  const body = await request.json();
  const phones: string[] = body.phones ?? [];
  if (!phones.length) {
    return NextResponse.json({ existing: [] });
  }
  const { data, error } = await supabase
    .from("contacts")
    .select("phone_e164")
    .in("phone_e164", phones);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const existing = (data ?? []).map((row) => row.phone_e164);
  return NextResponse.json({ existing });
}
