import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AvailabilityUpdates = {
  artist_id?: string;
  location_id?: string;
  start_at?: string;
  end_at?: string;
  note?: string | null;
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const updates: AvailabilityUpdates = {};

  if (Object.prototype.hasOwnProperty.call(body, "artist_id")) {
    updates.artist_id = body.artist_id || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "location_id")) {
    updates.location_id = body.location_id || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "start_at")) {
    updates.start_at = body.start_at || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "end_at")) {
    updates.end_at = body.end_at || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "note")) {
    updates.note = body.note?.trim() || null;
  }

  if (updates.start_at && updates.end_at) {
    if (new Date(updates.end_at) <= new Date(updates.start_at)) {
      return NextResponse.json(
        { error: "End must be after start" },
        { status: 400 }
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const { error } = await supabase
    .from("artist_availability")
    .update(updates)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { error } = await supabase
    .from("artist_availability")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
