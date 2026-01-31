import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedContact } from "@/lib/import-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getLocations(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, is_admin_only");
  if (error) throw new Error(`getLocations:${JSON.stringify(supaErr(error))}`);
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
  if (error) throw new Error(`getLabels:${JSON.stringify(supaErr(error))}`);
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

function supaErr(error: any) {
  if (!error) return null;
  return {
    message: error.message ?? String(error),
    details: error.details ?? null,
    hint: error.hint ?? null,
    code: error.code ?? null,
    status: error.status ?? null
  };
}

export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const contacts: NormalizedContact[] = body.contacts ?? [];
    if (!contacts.length) {
      return NextResponse.json({ created: 0, updated: 0, skipped: 0, errors: [] });
    }

    const locationMap = await getLocations(supabase);
    const labelMap = await getLabels(supabase);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: {
      row?: number;
      phone?: string;
      where?: string;
      message?: string;
      details?: string | null;
      hint?: string | null;
      code?: string | null;
      status?: number | null;
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
            row,
            phone: contact.phone_e164,
            where: "locations.insert",
            ...supaErr(error)
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
          row,
          phone: contact.phone_e164,
          where: "locations.lookup",
          message: `Standort ${locationName} nicht gefunden`
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
          row,
          phone: contact.phone_e164,
          where: "contacts.select",
          ...supaErr(existingError)
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
          row,
          phone: contact.phone_e164,
          where: "contacts.upsert",
          ...supaErr(upsertError)
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
            row,
            phone: contact.phone_e164,
            where: "contacts.select_for_labels",
            ...supaErr(contactError)
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
                row,
                phone: contact.phone_e164,
                where: "labels.upsert",
                ...(labelError
                  ? supaErr(labelError)
                  : { message: "Label konnte nicht erstellt werden" })
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
              row,
              phone: contact.phone_e164,
              where: "contact_labels.upsert",
              ...supaErr(linkError)
            });
          }
        }
      }
    }

    return NextResponse.json({
      created,
      updated,
      skipped,
      errors: errors.slice(0, 20)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import fehlgeschlagen";
    return NextResponse.json(
      { error: "import_failed", message, stack: (error as Error).stack ?? null },
      { status: 500 }
    );
  }
}
