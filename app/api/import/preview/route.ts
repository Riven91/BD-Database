import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json();
  const phones: string[] = body.phones ?? [];
  if (!phones.length) {
    return NextResponse.json({ existing: [] });
  }
  const { data } = await supabaseAdmin
    .from("contacts")
    .select("phone_e164")
    .in("phone_e164", phones);
  const existing = (data ?? []).map((row) => row.phone_e164);
  return NextResponse.json({ existing });
}
