import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseServiceClient } from "@/lib/supabase/serviceServerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function num(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(request: Request) {
  try {
    const { user, mode, error } = await requireUser(request);

    if (!user) {
      return json(
        {
          ok: false,
          error: "not_authenticated",
          mode,
          details: error?.message ?? null
        },
        401
      );
    }

    const url = new URL(request.url);
    const pageIndex = Math.max(0, num(url.searchParams.get("pageIndex"), 0));
    const pageSize = Math.min(500, Math.max(1, num(url.searchParams.get("pageSize"), 100)));

    const search = (url.searchParams.get("search") ?? "").trim();
    const statusFilter = (url.searchParams.get("status") ?? "all").trim();
    const locationId = (url.searchParams.get("locationId") ?? "all").trim();

    const sortKeyRaw = (url.searchParams.get("sortKey") ?? "created_at").trim();
    const sortKey: "created_at" | "name" = sortKeyRaw === "name" ? "name" : "created_at";

    const sortDirRaw = (url.searchParams.get("sortDir") ?? "desc").trim();
    const ascending = sortDirRaw === "asc";

    const from = pageIndex * pageSize;
    const to = from + pageSize - 1;

    // Service Client (umgeht RLS), aber Route ist trotzdem auth-geschützt via cookie
    const supabase = getSupabaseServiceClient();

    let query = supabase
      .from("contacts")
      .select(
        "id, phone_e164, location_id, created_at, name, first_name, last_name, status, location:locations(id,name), labels:contact_labels(labels(id,name,sort_order,is_archived))",
        { count: "exact" }
      );

    if (locationId && locationId !== "all") {
      query = query.eq("location_id", locationId);
    }

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    if (search.length) {
      const s = search.replaceAll("%", "").replaceAll(",", " ").trim();
      // OR-Suche
      query = query.or(
        `phone_e164.ilike.%${s}%,name.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%`
      );
    }

    query = query.order(sortKey, { ascending }).range(from, to);

    const { data, error: qErr, count } = await query;

    if (qErr) {
      return json(
        {
          ok: false,
          error: "contacts_query_failed",
          details: qErr.message
        },
        500
      );
    }

    const contacts = (data ?? []).map((c: any) => ({
      ...c,
      labels: (c.labels ?? []).map((x: any) => x.labels).filter(Boolean)
    }));

    return json({
      ok: true,
      authenticated: true,
      mode,
      user: { id: user.id, email: user.email ?? null },
      contacts,
      totalCount: count ?? 0,
      page: { pageIndex, pageSize }
    });
  } catch (e: any) {
    return json(
      {
        ok: false,
        error: "server_error",
        details: e?.message ?? "unknown"
      },
      500
    );
  }
}
