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

  const status = body.status as string | undefined;
  const hasEditPayload =
    typeof body.name !== "undefined" ||
    typeof body.phone_e164 !== "undefined" ||
    typeof body.location_id !== "undefined";

  if (!status && !hasEditPayload) {
    return NextResponse.json({ error: "missing_payload" }, { status: 400 });
  }

  if (status && !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (!hasEditPayload) {
    const { error } = await supabase
      .from("contacts")
      .update({ status })
      .eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  const rawPhone = typeof body.phone_e164 === "string" ? body.phone_e164 : "";
  const normalizedPhone = normalizePhone(rawPhone);
  if (!normalizedPhone) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const locationId = typeof body.location_id === "string" ? body.location_id.trim() : "";
  if (!locationId) {
    return NextResponse.json({ error: "missing_location" }, { status: 400 });
  }

  const updatePayload: Record<string, any> = {
    name: typeof body.name === "string" ? body.name.trim() || null : null,
    phone_e164: normalizedPhone,
    location_id: locationId
  };
  if (status) {
    updatePayload.status = status;
  }

  const { data: updated, error } = await supabase
    .from("contacts")
    .update(updatePayload)
    .eq("id", params.id)
    .select("id, name, phone_e164, location_id, location:locations(id,name)")
    .single();

  if (error || !updated) {
    if (error?.code === "23505") {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("phone_e164", normalizedPhone)
        .limit(1);
      const conflict = Array.isArray(existing) ? existing[0] : null;
      const conflictLabel = conflict?.name?.trim() || conflict?.id || "unbekannt";
      return NextResponse.json(
        {
          error: "phone_exists",
          message: `Diese Telefonnummer existiert bereits bei Kontakt: ${conflictLabel}`
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error?.message ?? "update_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ contact: updated });
}
