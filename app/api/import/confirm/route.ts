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
      JSON.stringify({
        where: "getLocations.select",
        ...serializeSupaError(error)
      })
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
      JSON.stringify({
        where: "getLabels.select",
        ...serializeSupaError(error)
      })
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
      return NextResponse.json({
        created: 0,
        updated: 0,
        skipped: 0,
        errorCount: 0,
        errors: []
      });
    }

    const locationMap = await getLocations(supabase);
    const labelMap = await getLabels(supabase);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    const errors: Array<{
      row?: number;
      phone?: string;
      where: string;
      message: string;
      details?: any;
      hint?: any;
      code?: any;
      status?: any;
    }> = [];

    for (const contact of contacts) {
      const row = contact.source_row;
      const phone = contact.phone_e164;
      const locationName = contact.location_name?.trim() || "Unbekannt";
      const locationKey = locationName.toLowerCase();

      // 1) Standort sicherstellen
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
            phone,
            where: "locations.insert",
            ...serializeSupaError(error)!
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
          phone,
          where: "locations.insert",
          message: `Standort ${locationName} nicht gefunden`,
          details: null,
          hint: null,
          code: null,
          status: null
        });
        skipped += 1;
        continue;
      }

      // 2) Existing check
      const { data: existing, error: existingError } = await supabase
        .from("contacts")
        .select("id, phone_e164")
        .eq("phone_e164", phone)
        .maybeSingle();

      if (existingError) {
        errors.push({
          row,
          phone,
          where: "contacts.select_existing",
          ...serializeSupaError(existingError)!
        });
        skipped += 1;
        continue;
      }

      // 3) Upsert contact
      const payload = buildUpdatePayload(contact);
      payload.location_id = resolvedLocation.id;
      payload.phone_e164 = phone;

      const { error: upsertError } = await supabase
        .from("contacts")
        .upsert(payload, { onConflict: "phone_e164" })
        .select("id, phone_e164")
        .single();

      if (upsertError) {
        errors.push({
          row,
          phone,
          where: "contacts.upsert",
          ...serializeSupaError(upsertError)!
        });
        skipped += 1;
        continue;
      }

      if (existing) updated += 1;
      else created += 1;

      // 4) Labels
      if (contact.labels?.length) {
        const { data: contactRow, error: contactError } = await supabase
          .from("contacts")
          .select("id")
          .eq("phone_e164", phone)
          .single();

        if (contactError || !contactRow) {
          errors.push({
            row,
            phone,
            where: "contacts.select_after_upsert",
            ...serializeSupaError(contactError ?? { message: "contactRow_null_after_upsert" })!
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
                phone,
                where: "labels.upsert",
                ...serializeSupaError(labelError ?? { message: "label_create_failed" })!
              });
              continue;
            }

            labelId = createdLabel.id;
            labelMap.set(createdLabel.name.toLowerCase(), createdLabel.id);
          }

          // 5) Junction upsert FIX (Bad Request Klassiker)
          const { error: linkError } = await supabase
            .from("contact_labels")
            .upsert(
              { contact_id: contactRow.id, label_id: labelId },
              { onConflict: "contact_id,label_id" }
            );

          if (linkError) {
            errors.push({
              row,
              phone,
              where: "contact_labels.upsert",
              ...serializeSupaError(linkError)!
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
      errors: errors.slice(0, 50)
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error ?? "Import fehlgeschlagen");

    // Wenn error.message JSON ist (wie bei getLocations/getLabels), sauber zurückgeben
    try {
      const parsed = JSON.parse(message);
      return NextResponse.json({ error: "import_failed", ...parsed }, { status: 500 });
    } catch {
      return NextResponse.json({ error: "import_failed", message }, { status: 500 });
    }
  }
}
