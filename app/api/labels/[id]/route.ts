import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireRouteAuth } from "@/lib/supabase/routeAuth";
import { serializeSupabaseError } from "@/lib/supabase/errorUtils";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = supabaseServer();
  const authResponse = await requireRouteAuth(supabase);
  if (authResponse) return authResponse;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", details: null },
      { status: 400 }
    );
  }
  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    updates.name = body.name.trim();
  }
  if (typeof body.is_archived === "boolean") {
    updates.is_archived = body.is_archived;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { ok: false, error: "No updates", details: null },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("labels")
    .update(updates)
    .eq("id", params.id)
    .select("id, name, is_archived")
    .single();
  if (error) {
    console.error("LABELS_PATCH_ERROR", error);
    return NextResponse.json(
      { ok: false, error: error.message, details: serializeSupabaseError(error) },
      { status: 500 }
    );
  }

  return NextResponse.json({ label: data });
}
