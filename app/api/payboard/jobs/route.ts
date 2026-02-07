import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const allowedStatuses = new Set(["geplant", "in_arbeit", "abgeschlossen"]);

function normalizeStatus(status?: string | null) {
  const trimmed = status?.trim().toLowerCase() ?? "";
  if (!trimmed) return "geplant";
  if (trimmed === "in arbeit") return "in_arbeit";
  if (trimmed === "fertig") return "abgeschlossen";
  if (allowedStatuses.has(trimmed)) return trimmed;
  return "geplant";
}

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return json({ error: "not_authenticated" }, 401);
  }

  const url = new URL(request.url);
  const monthParam = (url.searchParams.get("month") ?? "").trim();
  const locationId = (url.searchParams.get("location_id") ?? "all").trim();
  const monthStart = monthParam ? new Date(monthParam) : null;
  const monthEnd = monthStart
    ? new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
    : null;

  let query = supabase
    .from("jobs")
    .select(
      "id, contact_id, location_id, artist_free_text, session_date, total_cents, deposit_cents, status, created_at, contact:contacts(id,name,phone_e164), location:locations(id,name)"
    )
    .order("created_at", { ascending: false });

  if (locationId && locationId !== "all") {
    query = query.eq("location_id", locationId);
  }

  const { data: jobs, error } = await query;

  if (error) {
    return json({ error: "jobs_query_failed", details: error.message }, 500);
  }

  const jobIds = (jobs ?? []).map((job: any) => job.id).filter(Boolean);
  let paidByJob = new Map<string, number>();
  let paidInMonthByJob = new Map<string, number>();

  if (jobIds.length) {
    const { data: paidSums, error: paymentsError } = await supabase.rpc(
      "payments_sum_for_jobs",
      { p_job_ids: jobIds }
    );

    if (paymentsError) {
      return json(
        { error: "payments_sum_failed", details: paymentsError.message },
        500
      );
    }

    const paidMap = new Map<string, number>();
    for (const row of paidSums ?? []) {
      const jobId = String(row.job_id);
      paidMap.set(jobId, Number(row.sum_cents ?? 0));
    }
    paidByJob = paidMap;

    if (monthStart && monthEnd) {
      const { data: paymentsMonthData, error: paymentsMonthError } = await supabase
        .from("payments")
        .select("job_id, paid_cents, paid_at")
        .in("job_id", jobIds)
        .gte("paid_at", monthStart.toISOString())
        .lt("paid_at", monthEnd.toISOString());

      if (paymentsMonthError) {
        return json(
          { error: "payments_month_sum_failed", details: paymentsMonthError.message },
          500
        );
      }

      const monthMap = new Map<string, number>();
      for (const row of paymentsMonthData ?? []) {
        const jobId = String(row.job_id);
        const paidCents = Number(row.paid_cents ?? 0);
        monthMap.set(jobId, (monthMap.get(jobId) ?? 0) + paidCents);
      }
      paidInMonthByJob = monthMap;
    }
  }

  const enriched = (jobs ?? []).map((job: any) => {
    const paidTotalCents = paidByJob.get(job.id) ?? 0;
    const paidInMonthCents = paidInMonthByJob.get(job.id) ?? 0;
    const totalCents = Number(job.total_cents ?? 0);
    return {
      ...job,
      paid_total_cents: paidTotalCents,
      paid_in_month_cents: paidInMonthCents,
      open_cents: Math.max(0, totalCents - paidTotalCents)
    };
  });

  return json({ jobs: enriched });
}

export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return json({ error: "not_authenticated" }, 401);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const totalCents = Math.round(Number(body.total_cents));
  const depositCentsRaw =
    body.deposit_cents === null || body.deposit_cents === undefined || body.deposit_cents === ""
      ? 0
      : Math.round(Number(body.deposit_cents));

  if (!body.contact_id || !body.location_id) {
    return json({ error: "missing_required_fields" }, 400);
  }

  if (!Number.isFinite(totalCents) || totalCents < 0) {
    return json({ error: "invalid_total_cents" }, 400);
  }

  if (!Number.isFinite(depositCentsRaw) || depositCentsRaw < 0) {
    return json({ error: "invalid_deposit_cents" }, 400);
  }

  const payload = {
    contact_id: body.contact_id,
    location_id: body.location_id,
    artist_free_text: body.artist_free_text?.trim() || null,
    session_date: body.session_date || null,
    total_cents: totalCents,
    deposit_cents: depositCentsRaw,
    status: normalizeStatus(body.status)
  };

  const { data, error } = await supabase.from("jobs").insert(payload).select("*").single();

  if (error) {
    return json({ error: "job_insert_failed", details: error.message }, 500);
  }

  return json({ job: data });
}
