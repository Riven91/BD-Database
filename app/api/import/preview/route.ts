import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/routeClient";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createRouteClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
