import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedContact } from "@/lib/import-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

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
  const requestId = crypto.randomUUID?.() ?? String(Date.now());
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const contacts: NormalizedContact[] = body.contacts ?? [];
    if (!contacts.length) {
      const processed = 0;
      const errorCount = 0;
      return NextResponse.json({
        finished: true,
        requestId,
        created: 0,
        updated: 0,
        skipped: 0,
        processed,
        errorCount,
        errors: []
      });
    }

    const locationMap = await getLocations(supabase);
    const labelMap = await getLabels(supabase);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let processed = 0;
    const errors: { row?: number; phone?: string; message: string }[] = [];

    const logProgress = () => {
      if (processed % 50 === 0) {
        console.log("IMPORT_CONFIRM_PROGRESS", {
          requestId,
          processed,
          created,
          updated,
          skipped,
          errors: errors.length
        });
      }
    };

    for (const contact of contacts) {
      processed += 1;
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
          errors.push({ row, phone: contact.phone_e164, message: error.message });
          skipped += 1;
          logProgress();
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
          row,
          phone: contact.phone_e164,
          message: `Standort ${locationName} nicht gefunden`
        });
        skipped += 1;
        logProgress();
        continue;
      }

      const { data: existing, error: existingError } = await supabase
        .from("contacts")
        .select("id, phone_e164")
        .eq("phone_e164", contact.phone_e164)
        .maybeSingle();

      if (existingError) {
        errors.push({ row, phone: contact.phone_e164, message: existingError.message });
        skipped += 1;
        logProgress();
        continue;
      }

      const payload = buildUpdatePayload(contact);
      payload.location_id = resolvedLocation.id;
      payload.phone_e164 = contact.phone_e164;

      const { data: upserted, error: upsertError } = await supabase
        .from("contacts")
        .upsert(payload, { onConflict: "phone_e164" })
        .select("id, phone_e164")
        .single();

      if (upsertError) {
        errors.push({ row, phone: contact.phone_e164, message: upsertError.message });
        skipped += 1;
        logProgress();
        continue;
      }

      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }

      const contactId = upserted?.id;
      if (contact.labels?.length && contactId) {
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
                row,
                phone: contact.phone_e164,
                message: labelError?.message ?? "Label konnte nicht erstellt werden"
              });
              continue;
            }
            labelId = createdLabel.id;
            labelMap.set(createdLabel.name.toLowerCase(), createdLabel.id);
          }
          const { error: linkError } = await supabase
            .from("contact_labels")
            .upsert({ contact_id: contactId, label_id: labelId }, { onConflict: "contact_id,label_id" });
          if (linkError) {
            errors.push({
              row,
              phone: contact.phone_e164,
              message: linkError.message
            });
          }
        }
      }

      logProgress();
    }

    const errorCount = errors.length;
    return NextResponse.json({
      finished: true,
      requestId,
      created,
      updated,
      skipped,
      processed,
      errorCount,
      errors: errors.slice(0, 50)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import fehlgeschlagen";
    const parsed = error instanceof Error ? undefined : error;
    return NextResponse.json(
      {
        finished: false,
        requestId,
        error: "import_failed",
        message,
        ...(parsed === undefined ? {} : { parsed })
      },
      { status: 500 }
    );
  }
}
