import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const rawLocationParam = url.searchParams.get("location");
  const locationFilter = normalizeLocationParam(rawLocationParam);
  if (
    url.searchParams.has("location") &&
    !locationFilter &&
    rawLocationParam?.toLowerCase() !== "all"
  ) {
    return NextResponse.json({ error: "Invalid location filter" }, { status: 400 });
  }

  let query = supabase
    .from("contacts")
    .select(
      "id, name, first_name, last_name, phone_e164, status, location:locations(name), labels:contact_labels(labels(id,name,sort_order,is_archived))"
    )
    .order("created_at", { ascending: false })
    .range(0, 199);

  if (locationFilter) {
    query = query.eq("locations.name", locationFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: { message: error.message, code: error.code ?? null } },
      { status: 500 }
    );
  }

  const contacts = (data ?? []).map((contact: any) => ({
    ...contact,
    labels: (contact.labels ?? [])
      .map((item: any) => item.labels)
      .filter(Boolean)
  }));

  return NextResponse.json({ contacts });
}
