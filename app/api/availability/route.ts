import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const locationId = url.searchParams.get("location_id") ?? "all";
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "Missing start or end date" },
      { status: 400 }
    );
  }

  let query = supabase
    .from("artist_availability")
    .select(
      "id, start_at, end_at, note, artist:artists(id, name, is_active), location:locations(id, name)"
    )
    .lt("start_at", end)
    .gt("end_at", start);

  if (locationId !== "all") {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query.order("start_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slots: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const artistId = body.artist_id;
  const locationId = body.location_id;
  const startAt = body.start_at;
  const endAt = body.end_at;
  const note = body.note?.trim() || null;

  if (!artistId || !locationId || !startAt || !endAt) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (new Date(endAt) <= new Date(startAt)) {
    return NextResponse.json(
      { error: "End must be after start" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("artist_availability").insert({
    artist_id: artistId,
    location_id: locationId,
    start_at: startAt,
    end_at: endAt,
    note
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
