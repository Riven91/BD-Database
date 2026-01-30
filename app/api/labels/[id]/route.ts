import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    updates.name = body.name.trim();
  }
  if (body.sort_order !== undefined) {
    const sortOrder = Number(body.sort_order);
    if (!Number.isNaN(sortOrder)) {
      updates.sort_order = sortOrder;
    }
  }
  if (typeof body.is_archived === "boolean") {
    updates.is_archived = body.is_archived;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const { error } = await supabase.from("labels").update(updates).eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
