import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ArtistUpdates = {
  name?: string;
  is_active?: boolean;
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
  const updates: ArtistUpdates = {};

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    const name = body.name?.trim();
    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters long" },
        { status: 400 }
      );
    }
    updates.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(body, "is_active")) {
    updates.is_active = Boolean(body.is_active);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const { error } = await supabase
    .from("artists")
    .update(updates)
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
