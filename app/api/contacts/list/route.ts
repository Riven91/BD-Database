import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseServiceClient } from "@/lib/supabase/serviceServerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function json(data: any) {
  return new NextResponse(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  try {
    const { user, mode, error } = await requireUser(request);

    if (!user) {
      return json({
        ok: false,
        error: "not_authenticated",
        mode: mode ?? null,
        details: error?.message ?? null,
        contacts: [],
        count: 0,
      });
    }

    const url = new URL(request.url);
    const locationId = url.searchParams.get("locationId");
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q");
    const sortKey = url.searchParams.get("sortKey") || "created_at";
    const sortDir = url.searchParams.get("sortDir") || "desc";
    const pageIndex = Number(url.searchParams.get("pageIndex") || "0");
    const pageSize = Number(url.searchParams.get("pageSize") || "100");

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

    if (q && q.trim().length) {
      const s = q.trim();
      query = query.or(
        `phone_e164.ilike.%${s}%,name.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%`
      );
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    query = query.order(sortKey, { ascending: sortDir === "asc" });

    const from = pageIndex * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error: qErr, count } = await query;

    if (qErr) {
      return json({
        ok: false,
        error: "contacts_query_failed",
        details: qErr.message,
        contacts: [],
        count: 0,
      });
    }

    const mappedContacts = (data ?? []).map((contact: any) => ({
      ...contact,
      labels: (contact.labels ?? []).map((x: any) => x.labels).filter(Boolean),
    }));

    return json({
      ok: true,
      authenticated: true,
      mode,
      count: count ?? 0,
      contacts: mappedContacts,
    });
  } catch (e: any) {
    return json({
      ok: false,
      error: "server_error",
      details: e?.message ?? "unknown",
      contacts: [],
      count: 0,
    });
  }
}
