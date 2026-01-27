import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/routeClient";
import { requireRouteAuth } from "@/lib/supabase/routeAuth";
import { serializeSupabaseError } from "@/lib/supabase/errorUtils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createRouteClient();

  const authResponse = await requireRouteAuth(supabase);
  if (authResponse) return authResponse;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", details: null },
      { status: 400 }
    );
  }
  const phones: string[] = body.phones ?? [];
  if (!phones.length) {
    return NextResponse.json({ existing: [] });
  }
  const { data, error } = await supabase
    .from("contacts")
    .select("phone_e164")
    .in("phone_e164", phones);
  if (error) {
    console.error("IMPORT_PREVIEW_ERROR", error);
    return NextResponse.json(
      { ok: false, error: error.message, details: serializeSupabaseError(error) },
      { status: 500 }
    );
  }
  const existing = (data ?? []).map((row) => row.phone_e164);
  return NextResponse.json({ existing });
}
