import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/routeClient";
import { requireRouteAuth } from "@/lib/supabase/routeAuth";
import { serializeSupabaseError } from "@/lib/supabase/errorUtils";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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
  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.body === "string") updates.body = body.body.trim();
  if (typeof body.is_archived === "boolean") updates.is_archived = body.is_archived;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { ok: false, error: "No updates", details: null },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("message_templates")
    .update(updates)
    .eq("id", params.id)
    .select("id, title, body, is_archived, created_at, updated_at")
    .single();

  if (error) {
    console.error("TEMPLATES_PATCH_ERROR", error);
    return NextResponse.json(
      { ok: false, error: error.message, details: serializeSupabaseError(error) },
      { status: 500 }
    );
  }

  return NextResponse.json({ template: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteClient();
  const authResponse = await requireRouteAuth(supabase);
  if (authResponse) return authResponse;

  const { error } = await supabase.from("message_templates").delete().eq("id", params.id);
  if (error) {
    console.error("TEMPLATES_DELETE_ERROR", error);
    return NextResponse.json(
      { ok: false, error: error.message, details: serializeSupabaseError(error) },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
