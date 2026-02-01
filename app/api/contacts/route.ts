import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseServiceClient } from "@/lib/supabase/serviceServerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function intParam(url: URL, key: string, fallback: number) {
  const v = url.searchParams.get(key);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export async function GET(request: Request) {
  const { user } = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);

  const page = intParam(url, "page", 1);
  const perPage = intParam(url, "perPage", 100);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const q = (url.searchParams.get("q") || "").trim();
  const locationId = (url.searchParams.get("location_id") || "").trim();

  const supabase = getSupabaseServiceClient();

  // Base query
  let query = supabase
    .from("contacts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  // Optional filters (only if your schema has these columns)
  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  // Simple search (best-effort: adjust columns if your schema differs)
  if (q) {
    // tries name OR phone_e164 (common in your project)
    query = query.or(`name.ilike.%${q}%,phone_e164.ilike.%${q}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: "contacts_select_failed", message: error.message, details: (error as any).details ?? null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    page,
    perPage,
    total: count ?? 0,
    contacts: data ?? [],
  });
}
