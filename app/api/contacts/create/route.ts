import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";
import { normalizePhone } from "@/lib/import-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: {
    name?: string | null;
    phoneRaw?: string | null;
    locationId?: string | null;
    labels?: string[] | null;
    note?: string | null;
  } = {};

  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const phoneRaw = body.phoneRaw?.trim() ?? "";
  if (!phoneRaw) {
    return NextResponse.json({ error: "missing_phone" }, { status: 400 });
  }

  const locationId = body.locationId?.trim() ?? "";
  if (!locationId) {
    return NextResponse.json({ error: "missing_location" }, { status: 400 });
  }

  const phoneE164 = normalizePhone(phoneRaw);
  if (!phoneE164) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const { data: contact, error } = await supabase
    .from("contacts")
    .upsert(
      {
        phone_e164: phoneE164,
        name: body.name?.trim() || null,
        location_id: locationId
      },
      { onConflict: "phone_e164" }
    )
    .select("id")
    .single();

  if (error || !contact) {
    return NextResponse.json(
      { error: error?.message ?? "create_failed" },
      { status: 500 }
    );
  }

  const contactId = contact.id;
  const labels = (body.labels ?? []).map((label) => label.trim()).filter(Boolean);
  if (labels.length) {
    try {
      const { data: existingLabels, error: labelsError } = await supabase
        .from("labels")
        .select("id, name");
      if (!labelsError) {
        const labelMap = new Map<string, string>();
        (existingLabels ?? []).forEach((label) =>
          labelMap.set(label.name.toLowerCase(), label.id)
        );

        for (const labelName of labels) {
          const normalized = labelName.toLowerCase();
          let labelId = labelMap.get(normalized);
          if (!labelId) {
            const { data: createdLabel, error: createLabelError } = await supabase
              .from("labels")
              .upsert({ name: labelName }, { onConflict: "name" })
              .select("id, name")
              .single();
            if (createLabelError || !createdLabel) continue;
            labelId = createdLabel.id;
            labelMap.set(createdLabel.name.toLowerCase(), createdLabel.id);
          }
          await supabase
            .from("contact_labels")
            .upsert({ contact_id: contactId, label_id: labelId }, { onConflict: "contact_id,label_id" });
        }
      }
    } catch (labelsError) {
      console.warn("CONTACT_CREATE_LABELS_SKIPPED", labelsError);
    }
  }

  if (body.note?.trim()) {
    console.info("CONTACT_CREATE_NOTE_IGNORED");
  }

  return NextResponse.json({ ok: true, id: contactId });
}
