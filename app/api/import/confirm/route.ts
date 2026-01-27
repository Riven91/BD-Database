import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedContact } from "@/lib/import-utils";
import { requireRouteAuth } from "@/lib/supabase/routeAuth";
import { serializeSupabaseError } from "@/lib/supabase/errorUtils";

export const dynamic = "force-dynamic";

async function getLocations(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, is_admin_only");
  if (error) {
    return { map: null, error };
  }
  const map = new Map<string, { id: string; is_admin_only: boolean }>();
  (data ?? []).forEach((location) => {
    map.set(location.name.toLowerCase(), {
      id: location.id,
      is_admin_only: location.is_admin_only
    });
  });
  return { map, error: null };
}

async function getLabels(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("labels").select("id, name");
  if (error) {
    return { map: null, error };
  }
  const map = new Map<string, string>();
  (data ?? []).forEach((label) => map.set(label.name.toLowerCase(), label.id));
  return { map, error: null };
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
  const supabase = supabaseServer();

  const authResponse = await requireRouteAuth(supabase);
  if (authResponse) return authResponse;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", details: null },
      { status: 400 }
    );
  }
  const contacts: NormalizedContact[] = body.contacts ?? [];
  if (!contacts.length) {
    return NextResponse.json({
      ok: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      reason: "Keine Kontakte zum Importieren."
    });
  }

  const { map: locationMap, error: locationsError } = await getLocations(supabase);
  if (!locationMap || locationsError) {
    console.error("IMPORT_LOCATIONS_ERROR", locationsError);
    return NextResponse.json(
      {
        ok: false,
        error: locationsError?.message ?? "Locations lookup failed",
        details: serializeSupabaseError(locationsError ?? null)
      },
      { status: 500 }
    );
  }
  const { map: labelMap, error: labelsError } = await getLabels(supabase);
  if (!labelMap || labelsError) {
    console.error("IMPORT_LABELS_ERROR", labelsError);
    return NextResponse.json(
      {
        ok: false,
        error: labelsError?.message ?? "Labels lookup failed",
        details: serializeSupabaseError(labelsError ?? null)
      },
      { status: 500 }
    );
  }
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { rowIndex?: number; phoneRaw?: string; reason: string }[] = [];

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
          phoneRaw: contact.phone_raw ?? contact.phone_e164,
          reason: error.message
        });
        skipped += 1;
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
        phoneRaw: contact.phone_raw ?? contact.phone_e164,
        reason: `Standort ${locationName} nicht gefunden`
      });
      skipped += 1;
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
        phoneRaw: contact.phone_raw ?? contact.phone_e164,
        reason: existingError.message
      });
      skipped += 1;
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
        phoneRaw: contact.phone_raw ?? contact.phone_e164,
        reason: upsertError.message
      });
      skipped += 1;
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
          phoneRaw: contact.phone_raw ?? contact.phone_e164,
          reason: contactError.message
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
              phoneRaw: contact.phone_raw ?? contact.phone_e164,
              reason: labelError?.message ?? "Label konnte nicht erstellt werden"
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
            phoneRaw: contact.phone_raw ?? contact.phone_e164,
            reason: linkError.message
          });
        }
      }
    }
  }

  let reason: string | undefined;
  if (created + updated === 0) {
    reason = errors.length
      ? `Keine Datensätze importiert: ${errors[0].reason}`
      : "Keine Datensätze importiert.";
  }

  return NextResponse.json({
    ok: true,
    created,
    updated,
    skipped,
    errors,
    reason
  });
}
