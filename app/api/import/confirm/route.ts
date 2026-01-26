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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, location_id")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const body = await request.json();
  const contacts: NormalizedContact[] = body.contacts ?? [];
  if (!contacts.length) {
    return NextResponse.json({ imported: 0 });
  }

  const locationMap = await getLocations(supabase);
  const labelMap = await getLabels(supabase);

  for (const contact of contacts) {
    const locationName = contact.location_name?.trim() || "Unbekannt";
    const location = locationMap.get(locationName.toLowerCase());
    if (!location) {
      const { data: newLocation, error } = await supabase
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

    const { data: existing } = await supabase
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
        await supabase
          .from("contacts")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
    } else {
      const payload = buildUpdatePayload(contact);
      await supabase.from("contacts").insert({
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
          const { data: created } = await supabase
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
          const { data: contactRow } = await supabase
            .from("contacts")
            .select("id")
            .eq("phone_e164", contact.phone_e164)
            .single();
          if (contactRow) {
            await supabase
              .from("contact_labels")
              .upsert({ contact_id: contactRow.id, label_id: labelId });
          }
        }
      }
    }
  }

  return NextResponse.json({ imported: contacts.length });
}
