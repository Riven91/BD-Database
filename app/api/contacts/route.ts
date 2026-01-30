import { NextResponse } from "next/server";
import { notAuth, requireUser } from "@/lib/supabase/routeSupabase";

export const dynamic = "force-dynamic";

const locationMap = new Map<string, string>([
  ["heilbronn", "Heilbronn"],
  ["hb", "Heilbronn"],
  ["pforzheim", "Pforzheim"],
  ["pf", "Pforzheim"],
  ["boeblingen", "Böblingen"],
  ["böblingen", "Böblingen"],
  ["bb", "Böblingen"]
]);

function normalizeLocationParam(value: string | null) {
  if (!value) return null;
  const key = value.toLowerCase();
  if (key === "all") return null;
  return locationMap.get(key) ?? null;
}

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return notAuth();

  const url = new URL(request.url);
  const locationFilter = normalizeLocationParam(url.searchParams.get("location"));
  if (url.searchParams.has("location") && !locationFilter) {
    return NextResponse.json({ error: "Invalid location filter" }, { status: 400 });
  }

  let query = supabase
    .from("contacts")
    .select(
      "id, full_name, phone_e164, status, location:locations(name), labels:contact_labels(labels(id,name,sort_order,is_archived))"
    )
    .order("updated_at", { ascending: false })
    .limit(300);

  if (locationFilter) {
    query = query.eq("locations.name", locationFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const contacts = (data ?? []).map((contact: any) => ({
    ...contact,
    labels: (contact.labels ?? [])
      .map((item: any) => item.labels)
      .filter(Boolean)
  }));

  return NextResponse.json({ contacts });
}
