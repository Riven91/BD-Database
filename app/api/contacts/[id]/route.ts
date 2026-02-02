import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";
import { normalizePhone } from "@/lib/import-utils";

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

  let body: Record<string, any> = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const updatePayload: Record<string, any> = {};
  if ("status" in body) {
    const status = body.status as string | undefined;
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updatePayload.status = status;
  }

  if ("name" in body) {
    updatePayload.name = typeof body.name === "string" ? body.name.trim() || null : null;
  }

  if ("phone_e164" in body) {
    const rawPhone = typeof body.phone_e164 === "string" ? body.phone_e164 : "";
    const normalizedPhone = normalizePhone(rawPhone);
    if (!normalizedPhone) {
      return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
    }
    updatePayload.phone_e164 = normalizedPhone;
  }

  if ("location_id" in body) {
    updatePayload.location_id = body.location_id ? String(body.location_id) : null;
  }

  if ("notes" in body) {
    updatePayload.notes =
      typeof body.notes === "string" ? body.notes.trim() || null : null;
  }

  if (!Object.keys(updatePayload).length) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }

  const { error } = await supabase
    .from("contacts")
    .update(updatePayload)
    .eq("id", params.id);

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "phone_exists" }, { status: 409 });
    }
    if (
      updatePayload.notes &&
      error.message.toLowerCase().includes("notes") &&
      error.message.toLowerCase().includes("column")
    ) {
      return NextResponse.json(
        { error: "notes_column_missing" },
        { status: 400 }
      );
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
