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

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return json({ error: "not_authenticated" }, 401);
  }

  const url = new URL(request.url);
  const locationId = (url.searchParams.get("location_id") ?? "all").trim();

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

  if (jobIds.length) {
    const { data: paymentsData, error: paymentsError } = await supabase
      .from("payments")
      .select("job_id, paid_cents.sum()")
      .in("job_id", jobIds);

    if (paymentsError) {
      return json(
        { error: "payments_sum_failed", details: paymentsError.message },
        500
      );
    }

    paidByJob = new Map(
      (paymentsData ?? []).map((row: any) => [
        row.job_id,
        Number(row.paid_cents_sum ?? row.paid_cents ?? 0)
      ])
    );
  }

  const enriched = (jobs ?? []).map((job: any) => {
    const paidSum = paidByJob.get(job.id) ?? 0;
    const totalCents = Number(job.total_cents ?? 0);
    return {
      ...job,
      paid_sum: paidSum,
      open_sum: Math.max(0, totalCents - paidSum)
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

  const totalCents = Number(body.total_cents);
  const depositCents =
    body.deposit_cents === null || body.deposit_cents === undefined
      ? null
      : Number(body.deposit_cents);

  if (!body.contact_id || !body.location_id) {
    return json({ error: "missing_required_fields" }, 400);
  }

  if (!Number.isFinite(totalCents) || totalCents < 0) {
    return json({ error: "invalid_total_cents" }, 400);
  }

  if (depositCents !== null && (!Number.isFinite(depositCents) || depositCents < 0)) {
    return json({ error: "invalid_deposit_cents" }, 400);
  }

  const payload = {
    contact_id: body.contact_id,
    location_id: body.location_id,
    artist_free_text: body.artist_free_text?.trim() || null,
    session_date: body.session_date || null,
    total_cents: totalCents,
    deposit_cents: depositCents,
    status: body.status?.trim() || "geplant"
  };

  const { data, error } = await supabase.from("jobs").insert(payload).select("*").single();

  if (error) {
    return json({ error: "job_insert_failed", details: error.message }, 500);
  }

  return json({ job: data });
}
