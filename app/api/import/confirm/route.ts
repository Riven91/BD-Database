import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { NormalizedContact } from "@/lib/import-utils";

async function getLocations() {
  const { data, error } = await supabaseAdmin
    .from("locations")
    .select("id, name, is_admin_only");
  if (error) throw new Error(error.message);
  const map = new Map<string, { id: string; is_admin_only: boolean }>();
  (data ?? []).forEach((location) => {
    map.set(location.name.toLowerCase(), {
      id: location.id,
      is_admin_only: location.is_admin_only
    });
  });
  return map;
}

async function getLabels() {
  const { data, error } = await supabaseAdmin.from("labels").select("id, name");
  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  (data ?? []).forEach((label) => map.set(label.name.toLowerCase(), label.id));
  return map;
}

function buildUpdatePayload(contact: NormalizedContact) {
  const payload: Record<string, unknown> = {};
  Object.entries(contact).forEach(([key, value]) => {
    if (key === "labels" || key === "location_name") return;
    if (value === null || value === undefined || value === "") return;
    payload[key] = value;
  });
  return payload;
}

export async function POST(request: Request) {
  const body = await request.json();
  const contacts: NormalizedContact[] = body.contacts ?? [];
  if (!contacts.length) {
    return NextResponse.json({ imported: 0 });
  }

  const locationMap = await getLocations();
  const labelMap = await getLabels();

  for (const contact of contacts) {
    const locationName = contact.location_name?.trim() || "Unbekannt";
    const location = locationMap.get(locationName.toLowerCase());
    if (!location) {
      const { data: newLocation, error } = await supabaseAdmin
        .from("locations")
        .insert({ name: locationName, is_admin_only: locationName === "Unbekannt" })
        .select("id, name, is_admin_only")
        .single();
      if (error) throw new Error(error.message);
      locationMap.set(newLocation.name.toLowerCase(), {
        id: newLocation.id,
        is_admin_only: newLocation.is_admin_only
      });
    }

    const resolvedLocation = locationMap.get(locationName.toLowerCase());
    if (!resolvedLocation) continue;

    const { data: existing } = await supabaseAdmin
      .from("contacts")
      .select("id, phone_e164, location_id")
      .eq("phone_e164", contact.phone_e164)
      .maybeSingle();

    if (existing) {
      const payload = buildUpdatePayload(contact);
      if (locationName && locationName !== "Unbekannt") {
        payload.location_id = resolvedLocation.id;
      }
      if (Object.keys(payload).length > 0) {
        await supabaseAdmin
          .from("contacts")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
    } else {
      const payload = buildUpdatePayload(contact);
      await supabaseAdmin.from("contacts").insert({
        ...payload,
        phone_e164: contact.phone_e164,
        location_id: resolvedLocation.id
      });
    }

    if (contact.labels?.length) {
      for (const label of contact.labels) {
        const normalized = label.toLowerCase();
        let labelId = labelMap.get(normalized);
        if (!labelId) {
          const { data: created } = await supabaseAdmin
            .from("labels")
            .insert({ name: label })
            .select("id, name")
            .single();
          if (created) {
            labelId = created.id;
            labelMap.set(created.name.toLowerCase(), created.id);
          }
        }
        if (labelId) {
          const { data: contactRow } = await supabaseAdmin
            .from("contacts")
            .select("id")
            .eq("phone_e164", contact.phone_e164)
            .single();
          if (contactRow) {
            await supabaseAdmin
              .from("contact_labels")
              .upsert({ contact_id: contactRow.id, label_id: labelId });
          }
        }
      }
    }
  }

  return NextResponse.json({ imported: contacts.length });
}
