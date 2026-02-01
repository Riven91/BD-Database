import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return "";
  return String(v).trim();
}

/**
 * Supabase relation fields can appear as:
 * - object: { name: "Heilbronn" }
 * - array:  [{ name: "Heilbronn" }]
 * - null/undefined
 */
function extractLocationName(location: any): string {
  if (!location) return "Unbekannt";

  // Array relation
  if (Array.isArray(location)) {
    const first = location[0];
    const name = safeString(first?.name);
    return name || "Unbekannt";
  }

  // Object relation
  const name = safeString(location?.name);
  return name || "Unbekannt";
}

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // Total contacts
  const totalResult = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true });

  if (totalResult.error) {
    return NextResponse.json(
      {
        error: "stats_failed",
        where: "contacts.total",
        message: totalResult.error.message,
        code: (totalResult.error as any).code ?? null
      },
      { status: 500 }
    );
  }

  // Missing name count aligned with dashboard display logic.
  // Missing means all candidate fields are empty or null.
  const missingNameResult = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .or(
      "and(or(name.is.null,name.eq.),or(display_name.is.null,display_name.eq.),or(full_name.is.null,full_name.eq.),or(first_name.is.null,first_name.eq.),or(last_name.is.null,last_name.eq.))"
    );

  // Missing phone count
  const missingPhoneResult = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .is("phone_e164", null);

  // Location breakdown (we fetch location relation + count client-side)
  // This avoids group-by/RPC and is enough for a first stats bar.
  const locationResult = await supabase
    .from("contacts")
    .select("location:locations(name)")
    .limit(5000);

  const locationCounts = new Map<string, number>();
  for (const row of (locationResult.data as any[]) ?? []) {
    const name = extractLocationName(row?.location);
    locationCounts.set(name, (locationCounts.get(name) ?? 0) + 1);
  }

  // Convert map to sorted list (top 20)
  const byLocation = Array.from(locationCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  return NextResponse.json({
    ok: true,
    total: totalResult.count ?? 0,
    missingName: missingNameResult.count ?? 0,
    missingPhone: missingPhoneResult.count ?? 0,
    byLocation,
    sampleLimit: 5000
  });
}
