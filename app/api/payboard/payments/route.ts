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

  const paidCents = Number(body.paid_cents);
  if (!body.job_id) {
    return json({ error: "missing_job_id" }, 400);
  }

  if (!Number.isFinite(paidCents) || paidCents <= 0) {
    return json({ error: "invalid_paid_cents" }, 400);
  }

  const payload = {
    job_id: body.job_id,
    paid_cents: paidCents,
    paid_at: body.paid_at || null,
    method: body.method || null
  };

  const { data, error } = await supabase
    .from("payments")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return json({ error: "payment_insert_failed", details: error.message }, 500);
  }

  return json({ payment: data });
}
