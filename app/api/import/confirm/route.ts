import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedContact } from "@/lib/import-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function serializeSupaError(err: any) {
  if (!err) return null;
  return {
    message: err.message ?? String(err),
    details: err.details ?? null,
    hint: err.hint ?? null,
    code: err.code ?? null,
    status: err.status ?? null
  };
}

async function getLocations(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, is_admin_only");
  if (error) {
    throw new Error(
      JSON.stringify({ where: "getLocations.select", ...serializeSupaError(error) })
    );
  }
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
  if (error) {
    throw new Error(
      JSON.stringify({ where: "getLabels.select", ...serializeSupaError(error) })
    );
  }
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
            ...serializeSupaError(error)
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
          where: "contacts.select_existing",
          ...serializeSupaError(existingError)
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
          ...serializeSupaError(upsertError)
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
            where: "contacts.select_after_upsert",
            ...serializeSupaError(contactError)
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
                  ? serializeSupaError(labelError)
                  : { message: "Label konnte nicht erstellt werden" })
              });
              continue;
            }
            labelId = createdLabel.id;
            labelMap.set(createdLabel.name.toLowerCase(), createdLabel.id);
          }
          const { error: linkError } = await supabase
            .from("contact_labels")
            .upsert(
              { contact_id: contactRow.id, label_id: labelId },
              { onConflict: "contact_id,label_id" }
            );
          if (linkError) {
            errors.push({
              row,
              phone: contact.phone_e164,
              where: "contact_labels.upsert",
              ...serializeSupaError(linkError)
            });
          }
        }
      }
    }

    return NextResponse.json({
      created,
      updated,
      skipped,
      errors: errors.slice(0, 50)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import fehlgeschlagen";
    try {
      const parsed = JSON.parse(message);
      return NextResponse.json({ error: "import_failed", ...parsed }, { status: 500 });
    } catch {
      return NextResponse.json({ error: "import_failed", message }, { status: 500 });
    }
  }
}
