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
