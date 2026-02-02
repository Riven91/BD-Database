import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const allowedStatuses = [
  "neu",
  "in_bearbeitung",
  "tattoo_termin",
  "abgeschlossen",
  "tot"
];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const updatePayload: Record<string, string | null> = {};

  if ("status" in body) {
    const status = body.status as string | undefined;
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updatePayload.status = status;
  }

  if ("name" in body) {
    const name = body.name as string | null;
    if (name === null) {
      updatePayload.name = null;
    } else {
      const trimmed = name.trim();
      if (trimmed.length > 200) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      }
      updatePayload.name = trimmed;
    }
  }

  if ("notes" in body) {
    const notes = body.notes as string | null;
    if (notes === null) {
      updatePayload.notes = null;
    } else if (typeof notes !== "string" || notes.length > 5000) {
      return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
    } else {
      updatePayload.notes = notes;
    }
  }

  if ("location_id" in body) {
    const locationId = body.location_id as string | null;
    if (locationId === null) {
      updatePayload.location_id = null;
    } else if (typeof locationId !== "string" || locationId.length < 10) {
      return NextResponse.json({ error: "Invalid location_id" }, { status: 400 });
    } else {
      updatePayload.location_id = locationId;
    }
  }

  if ("phone_e164" in body) {
    const phone = body.phone_e164 as string | null;
    if (phone === null) {
      updatePayload.phone_e164 = null;
    } else {
      const stripped = phone.replace(/[\s\-()]/g, "");
      let normalized = stripped;
      if (normalized.startsWith("00")) {
        normalized = `+${normalized.slice(2)}`;
      } else if (normalized.startsWith("0")) {
        normalized = `+49${normalized.slice(1)}`;
      } else if (normalized.startsWith("49")) {
        normalized = `+49${normalized.slice(2)}`;
      }

      if (!normalized.startsWith("+")) {
        normalized = `+${normalized}`;
      }

      if (!/^\+[0-9]+$/.test(normalized)) {
        return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
      }
      if (normalized.length < 8) {
        return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
      }
      updatePayload.phone_e164 = normalized;
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("contacts")
    .update(updatePayload)
    .eq("id", params.id);

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "phone_exists" }, { status: 409 });
    }
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

  const { error } = await supabase.from("contacts").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
