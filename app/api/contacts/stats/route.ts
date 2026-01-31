import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getLocationName(value?: string | null) {
  return value?.trim() ? value.trim() : "Unbekannt";
}

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const totalQuery = supabase.from("contacts").select("id", {
    count: "exact",
    head: true
  });

  const missingNameQuery = supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .or("name.is.null,name.eq.''");

  const missingPhoneQuery = supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .is("phone_e164", null);

  const locationQuery = supabase
    .from("contacts")
    .select("location:locations(name)")
    .order("created_at", { ascending: false })
    .limit(1000);

  const [totalResult, missingNameResult, missingPhoneResult, locationResult] =
    await Promise.all([totalQuery, missingNameQuery, missingPhoneQuery, locationQuery]);

  const errors = [
    totalResult.error,
    missingNameResult.error,
    missingPhoneResult.error,
    locationResult.error
  ].filter(Boolean);

  if (errors.length) {
    const message = errors.map((error) => error?.message).join(", ");
    return NextResponse.json({ error: { message } }, { status: 500 });
  }

  const locationCounts = new Map<string, number>();
  (locationResult.data ?? []).forEach((row: { location?: { name?: string } }) => {
    const name = getLocationName(row.location?.name);
    locationCounts.set(name, (locationCounts.get(name) ?? 0) + 1);
  });

  const locationStats = Array.from(locationCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    totalCount: totalResult.count ?? 0,
    missingNameCount: missingNameResult.count ?? 0,
    missingPhoneCount: missingPhoneResult.count ?? 0,
    locationCounts: locationStats
  });
}
