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
      "Cache-Control": "no-store",
    },
  });
}

function toInt(v: string | null, fallback: number) {
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(v: string | null, fallback = false) {
  if (v === null) return fallback;
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return fallback;
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  try {
    // 1) Auth Gate (Cookie reicht)
    const { user, mode, error } = await requireUser(request);
    if (!user) {
      return json(
        {
          ok: false,
          error: "not_authenticated",
          mode,
          details: error?.message ?? null,
        },
        401
      );
    }

    // 2) Query Params
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const locationId = (url.searchParams.get("locationId") ?? "").trim();
    const status = (url.searchParams.get("status") ?? "").trim();
    const labelId = (url.searchParams.get("labelId") ?? "").trim();

    const page = Math.max(1, toInt(url.searchParams.get("page"), 1));
    const pageSize = Math.min(200, Math.max(1, toInt(url.searchParams.get("pageSize"), 50)));
    const includeLabels = toBool(url.searchParams.get("includeLabels"), true);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 3) Use Service Client to guarantee visibility once authenticated
    const supabase = getSupabaseServiceClient();

    // Build base query
    // Select only what UI needs; add more later if required
    let query = supabase
      .from("contacts")
      .select(
        includeLabels
          ? "id,name,phone_e164,location_id,status,created_at,updated_at,contact_labels(label_id)"
          : "id,name,phone_e164,location_id,status,created_at,updated_at",
        { count: "exact" }
      );

    // Filters (only apply if provided)
    if (locationId) query = query.eq("location_id", locationId);
    if (status) query = query.eq("status", status);

    // Search (simple, robust)
    if (q) {
      // tries name or phone
      // note: ilike can be slow; ok for now
      const like = `%${q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
      query = query.or(`name.ilike.${like},phone_e164.ilike.${like}`);
    }

    // Label filter (if provided) — do it with a second step to avoid fancy joins breaking types
    if (labelId) {
      const linkRes = await supabase
        .from("contact_labels")
        .select("contact_id")
        .eq("label_id", labelId)
        .limit(5000);

      if (linkRes.error) {
        return json(
          {
            ok: false,
            error: "label_filter_failed",
            details: linkRes.error.message,
          },
          500
        );
      }

      const ids = (linkRes.data ?? []).map((r: any) => r.contact_id).filter(Boolean);

      if (ids.length === 0) {
        return json({
          ok: true,
          authenticated: true,
          mode,
          data: [],
          count: 0,
          page,
          pageSize,
          ms: Date.now() - startedAt,
        });
      }

      query = query.in("id", ids);
    }

    // Pagination + ordering
    const res = await query.order("updated_at", { ascending: false }).range(from, to);

    if (res.error) {
      return json(
        {
          ok: false,
          error: "contacts_query_failed",
          details: res.error.message,
        },
        500
      );
    }

    return json({
      ok: true,
      authenticated: true,
      mode,
      user: { id: user.id, email: user.email ?? null },
      data: res.data ?? [],
      count: res.count ?? 0,
      page,
      pageSize,
      ms: Date.now() - startedAt,
    });
  } catch (e: any) {
    // This makes sure you NEVER get “raw: ''” without clues
    return json(
      {
        ok: false,
        error: "server_crash",
        details: e?.message ?? String(e),
        stack: e?.stack ?? null,
      },
      500
    );
  }
}
