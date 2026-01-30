import { NextResponse } from "next/server";
import { notAuth, requireUser } from "@/lib/supabase/routeSupabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { supabase, user } = await requireUser();
  if (!user) return notAuth();

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.body === "string") updates.body = body.body.trim();
  if (typeof body.is_archived === "boolean") updates.is_archived = body.is_archived;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("message_templates")
    .update(updates)
    .eq("id", params.id)
    .select("id, title, body, is_archived, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { supabase, user } = await requireUser();
  if (!user) return notAuth();

  const { error } = await supabase.from("message_templates").delete().eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
