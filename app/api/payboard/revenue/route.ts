import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

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

function getCurrentMonthValue() {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), 1);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return json({ error: "not_authenticated" }, 401);
  }

  const url = new URL(request.url);
  const month = (url.searchParams.get("month") ?? getCurrentMonthValue()).trim();
  const locationId = (url.searchParams.get("location_id") ?? "all").trim();

  let query = supabase
    .from("v_monthly_revenue")
    .select("month, location_id, revenue_cents, jobs_count, payments_count")
    .eq("month", month);

  if (locationId && locationId !== "all") {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;

  if (error) {
    return json({ error: "revenue_query_failed", details: error.message }, 500);
  }

  const rows = data ?? [];
  const totals = rows.reduce(
    (acc: any, row: any) => {
      acc.revenue_cents += Number(row.revenue_cents ?? 0);
      acc.jobs_count += Number(row.jobs_count ?? 0);
      acc.payments_count += Number(row.payments_count ?? 0);
      return acc;
    },
    { revenue_cents: 0, jobs_count: 0, payments_count: 0 }
  );

  return json(totals);
}
