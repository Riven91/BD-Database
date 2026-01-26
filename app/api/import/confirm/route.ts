import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/routeClient";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedContact } from "@/lib/import-utils";

export const dynamic = "force-dynamic";

async function getLocations(supabase: SupabaseClient) {
  const { data, error } = await supabase
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

async function getLabels(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("labels").select("id, name");
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
  const supabase = createRouteClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = await request.json();
  const contacts: NormalizedContact[] = body.contacts ?? [];
  if (!contacts.length) {
    return NextResponse.json({
      created: 0,
      updated: 0,
      skipped: 0,
      errorCount: 0,
      topErrors: []
    });
  }

  const locationMap = await getLocations(supabase);
  const labelMap = await getLabels(supabase);
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: {
    rowIndex?: number;
    reason: string;
    phoneRaw?: string | null;
    phoneE164?: string;
    location?: string | null;
    details?: string;
  }[] = [];

  for (const contact of contacts) {
    const row = contact.source_row;
    const locationName = contact.location_name?.trim() || "Unbekannt";
    const locationKey = locationName.toLowerCase();
    const existingLocation = locationMap.get(locationKey);
    if (!existingLocation) {
      const { data: newLocation, error } = await supabase
        .from("locations")
        .insert({ name: locationName, is_admin_only: locationName === "Unbekannt" })
        .select("id, name, is_admin_only")
        .single();
      if (error) {
        errors.push({
          rowIndex: row,
          reason: "Standort konnte nicht erstellt werden",
          phoneRaw: contact.phone_raw,
          phoneE164: contact.phone_e164,
          location: locationName,
          details: error.message
        });
        continue;
      }
      locationMap.set(newLocation.name.toLowerCase(), {
        id: newLocation.id,
        is_admin_only: newLocation.is_admin_only
      });
    }

    const resolvedLocation = locationMap.get(locationKey);
    if (!resolvedLocation) {
      errors.push({
        rowIndex: row,
        reason: "Standort nicht gefunden",
        phoneRaw: contact.phone_raw,
        phoneE164: contact.phone_e164,
        location: locationName
      });
      continue;
    }

    const { data: existing, error: existingError } = await supabase
      .from("contacts")
      .select("id, phone_e164")
      .eq("phone_e164", contact.phone_e164)
      .maybeSingle();

    if (existingError) {
      errors.push({
        rowIndex: row,
        reason: "Kontaktprüfung fehlgeschlagen",
        phoneRaw: contact.phone_raw,
        phoneE164: contact.phone_e164,
        location: locationName,
        details: existingError.message
      });
      continue;
    }

    const payload = buildUpdatePayload(contact);
    payload.location_id = resolvedLocation.id;
    payload.phone_e164 = contact.phone_e164;

    const { error: upsertError } = await supabase
      .from("contacts")
      .upsert(payload, { onConflict: "phone_e164" })
      .select("id, phone_e164")
      .single();

    if (upsertError) {
      errors.push({
        rowIndex: row,
        reason: "Kontakt konnte nicht gespeichert werden",
        phoneRaw: contact.phone_raw,
        phoneE164: contact.phone_e164,
        location: locationName,
        details: upsertError.message
      });
      continue;
    }

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }

    if (contact.labels?.length) {
      const { data: contactRow, error: contactError } = await supabase
        .from("contacts")
        .select("id")
        .eq("phone_e164", contact.phone_e164)
        .single();
      if (contactError) {
        errors.push({
          rowIndex: row,
          reason: "Kontakt konnte nicht geladen werden",
          phoneRaw: contact.phone_raw,
          phoneE164: contact.phone_e164,
          location: locationName,
          details: contactError.message
        });
        continue;
      }
      for (const label of contact.labels) {
        const normalized = label.toLowerCase();
        let labelId = labelMap.get(normalized);
        if (!labelId) {
          const { data: createdLabel, error: labelError } = await supabase
            .from("labels")
            .upsert({ name: label }, { onConflict: "name" })
            .select("id, name")
            .single();
          if (labelError || !createdLabel) {
            errors.push({
              rowIndex: row,
              reason: "Label konnte nicht erstellt werden",
              phoneRaw: contact.phone_raw,
              phoneE164: contact.phone_e164,
              location: locationName,
              details: labelError?.message ?? "Unbekannter Fehler"
            });
            continue;
          }
          labelId = createdLabel.id;
          labelMap.set(createdLabel.name.toLowerCase(), createdLabel.id);
        }
        const { error: linkError } = await supabase
          .from("contact_labels")
          .upsert({ contact_id: contactRow.id, label_id: labelId });
        if (linkError) {
          errors.push({
            rowIndex: row,
            reason: "Label konnte nicht zugewiesen werden",
            phoneRaw: contact.phone_raw,
            phoneE164: contact.phone_e164,
            location: locationName,
            details: linkError.message
          });
        }
      }
    }
  }

  return NextResponse.json({
    created,
    updated,
    skipped,
    errorCount: errors.length,
    topErrors: errors.slice(0, 10)
  });
}
