import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseServiceClient } from "@/lib/supabase/serviceServerClient";
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
  (data ?? []).forEach((location: any) => {
    map.set(String(location.name).toLowerCase(), {
      id: String(location.id),
      is_admin_only: Boolean(location.is_admin_only),
    });
  });
  return map;
}

async function getLabels(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("labels").select("id, name");
  if (error) throw new Error(error.message);

  const map = new Map<string, string>();
  (data ?? []).forEach((label: any) =>
    map.set(String(label.name).toLowerCase(), String(label.id))
  );
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

  // ✅ Auth via Cookie (wie /api/whoami)
  const { user, error } = await requireUser(request);
  if (!user) {
    return NextResponse.json(
      {
        finished: false,
        requestId,
        error: "not_authenticated",
        message: error?.message ?? null,
      },
      { status: 401 }
    );
  }

  // ✅ DB-Write per Service Role (unabhängig von Browser-Session)
  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseServiceClient();
  } catch (e: any) {
    return NextResponse.json(
      {
        finished: false,
        requestId,
        error: "service_role_missing",
        message: e?.message ?? "SUPABASE_SERVICE_ROLE_KEY is missing",
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const contacts: NormalizedContact[] = body?.contacts ?? [];

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({
        finished: true,
        requestId,
        created: 0,
        updated: 0,
        skipped: 0,
        processed: 0,
        errorCount: 0,
        errors: [],
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
          errors: errors.length,
        });
      }
    };

    for (const contact of contacts) {
      processed += 1;

      const row = (contact as any)?.source_row as any;
      const rowNum =
        typeof row === "number" ? row : Number(row ?? 0) || undefined;

      const phone = (contact as any)?.phone_e164 as any;
      const phoneStr = typeof phone === "string" ? phone : String(phone ?? "");

      if (!phoneStr) {
        errors.push({
          row: rowNum,
          phone: null as any,
          message: "phone_e164 fehlt",
        });
        skipped += 1;
        logProgress();
        continue;
      }

      const locationName =
        (contact as any)?.location_name?.trim?.() || "Unbekannt";
      const locationKey = String(locationName).toLowerCase();

      const existingLocation = locationMap.get(locationKey);
      if (!existingLocation) {
        const { data: newLocation, error: insErr } = await supabase
          .from("locations")
          .insert({
            name: locationName,
            is_admin_only: locationName === "Unbekannt",
          })
          .select("id, name, is_admin_only")
          .single();

        if (insErr || !newLocation) {
          errors.push({
            row: rowNum,
            phone: phoneStr,
            message: insErr?.message ?? "Standort konnte nicht erstellt werden",
          });
          skipped += 1;
          logProgress();
          continue;
        }

        locationMap.set(String(newLocation.name).toLowerCase(), {
          id: String(newLocation.id),
          is_admin_only: Boolean(newLocation.is_admin_only),
        });
      }

      const resolvedLocation = locationMap.get(locationKey);
      if (!resolvedLocation) {
        errors.push({
          row: rowNum,
          phone: phoneStr,
          message: `Standort ${locationName} nicht gefunden`,
        });
        skipped += 1;
        logProgress();
        continue;
      }

      // exist check
      const { data: existing, error: existingError } = await supabase
        .from("contacts")
        .select("id, phone_e164")
        .eq("phone_e164", phoneStr)
        .maybeSingle();

      if (existingError) {
        errors.push({
          row: rowNum,
          phone: phoneStr,
          message: existingError.message,
        });
        skipped += 1;
        logProgress();
        continue;
      }

      const payload = buildUpdatePayload(contact);
      payload.location_id = resolvedLocation.id;
      payload.phone_e164 = phoneStr;

      const { data: upserted, error: upsertError } = await supabase
        .from("contacts")
        .upsert(payload, { onConflict: "phone_e164" })
        .select("id, phone_e164")
        .single();

      if (upsertError || !upserted) {
        errors.push({
          row: rowNum,
          phone: phoneStr,
          message: upsertError?.message ?? "Upsert fehlgeschlagen",
        });
        skipped += 1;
        logProgress();
        continue;
      }

      if (existing) updated += 1;
      else created += 1;

      const contactId = String(upserted.id);

      // labels
      const labels = Array.isArray((contact as any)?.labels)
        ? ((contact as any).labels as string[])
        : [];

      if (labels.length) {
        for (const label of labels) {
          const labelName = String(label ?? "").trim();
          if (!labelName) continue;

          const normalized = labelName.toLowerCase();
          let labelId = labelMap.get(normalized);

          if (!labelId) {
            const { data: createdLabel, error: labelError } = await supabase
              .from("labels")
              .upsert({ name: labelName }, { onConflict: "name" })
              .select("id, name")
              .single();

            if (labelError || !createdLabel) {
              errors.push({
                row: rowNum,
                phone: phoneStr,
                message: labelError?.message ?? "Label konnte nicht erstellt werden",
              });
              continue;
            }

            labelId = String(createdLabel.id);
            labelMap.set(String(createdLabel.name).toLowerCase(), labelId);
          }

          const { error: linkError } = await supabase
            .from("contact_labels")
            .upsert(
              { contact_id: contactId, label_id: labelId },
              { onConflict: "contact_id,label_id" }
            );

          if (linkError) {
            errors.push({
              row: rowNum,
              phone: phoneStr,
              message: linkError.message,
            });
          }
        }
      }

      logProgress();
    }

    return NextResponse.json({
      finished: true,
      requestId,
      created,
      updated,
      skipped,
      processed,
      errorCount: errors.length,
      errors: errors.slice(0, 50),
    });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Import fehlgeschlagen";
    return NextResponse.json(
      {
        finished: false,
        requestId,
        error: "import_failed",
        message: msg,
      },
      { status: 500 }
    );
  }
}
