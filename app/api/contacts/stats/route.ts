import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type LocationCountRow = {
  location_id: string | null;
  location_name: string | null;
  count: number | string | null;
};

function serializeSupaError(err: any) {
  if (!err) return null;
  return {
    message: err.message ?? String(err),
    details: err.details ?? null,
    hint: err.hint ?? null,
    code: err.code ?? null,
    status: err.status ?? null
  };
}

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // Total contacts
  const totalRes = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true });

  if (totalRes.error) {
    return NextResponse.json(
      {
        error: "stats_failed",
        where: "contacts.total",
        ...serializeSupaError(totalRes.error)
      },
      { status: 500 }
    );
  }

  const sampleLimit = 5000;
  const sampleRes = await supabase
    .from("contacts")
    .select("name, created_at")
    .order("created_at", { ascending: false })
    .limit(sampleLimit);

  if (sampleRes.error) {
    return NextResponse.json(
      {
        error: "stats_failed",
        where: "contacts.sample",
        ...serializeSupaError(sampleRes.error)
      },
      { status: 500 }
    );
  }

  const rows = sampleRes.data ?? [];
  const missingNameSample = rows.reduce((acc, row) => {
    const name = (row.name ?? "").trim();
    return acc + (name ? 0 : 1);
  }, 0);

  // Missing phone count
  const missingPhoneRes = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .is("phone_e164", null);

  if (missingPhoneRes.error) {
    return NextResponse.json(
      {
        error: "stats_failed",
        where: "contacts.missingPhone",
        ...serializeSupaError(missingPhoneRes.error)
      },
      { status: 500 }
    );
  }

  const rpcRes = await supabase.rpc("contacts_counts_by_location");

  if (rpcRes.error) {
    return NextResponse.json(
      {
        error: "stats_failed",
        where: "rpc.contacts_counts_by_location",
        function: "contacts_counts_by_location",
        ...serializeSupaError(rpcRes.error)
      },
      { status: 500 }
    );
  }

  const byLocationCounts = (rpcRes.data as LocationCountRow[] | null) ?? [];
  const byLocation =
    byLocationCounts.map((row: LocationCountRow) => ({
      name: row.location_name ?? "Unbekannt",
      count: typeof row.count === "string" ? Number(row.count) : (row.count ?? 0)
    }));

  return NextResponse.json({
    ok: true,
    total: totalRes.count ?? 0,
    missingNameSample,
    sampleLimit,
    missingNameIsSample: true,
    missingPhone: missingPhoneRes.count ?? 0,
    byLocation
  });
}
