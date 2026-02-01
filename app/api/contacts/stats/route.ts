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
        ...serializeSupaError(totalResult.error)
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

  if (missingNameResult.error) {
    return NextResponse.json(
      {
        error: "stats_failed",
        where: "contacts.missingName",
        ...serializeSupaError(missingNameResult.error)
      },
      { status: 500 }
    );
  }

  // Missing phone count
  const missingPhoneRes = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .is("phone_e164", null);

  if (missingPhoneResult.error) {
    return NextResponse.json(
      {
        error: "stats_failed",
        where: "contacts.missingPhone",
        ...serializeSupaError(missingPhoneResult.error)
      },
      { status: 500 }
    );
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "contacts_counts_by_location"
  );

  if (rpcError) {
    return NextResponse.json(
      {
        error: "stats_failed",
        where: "rpc.contacts_counts_by_location",
        function: "contacts_counts_by_location",
        ...serializeSupaError(rpcError)
      },
      { status: 500 }
    );
  }

  const byLocationCounts = (rpcData as LocationCountRow[] | null) ?? [];
  const byLocation =
    byLocationCounts.map((row: LocationCountRow) => ({
      name: row.location_name ?? "Unbekannt",
      count: typeof row.count === "string" ? Number(row.count) : (row.count ?? 0)
    }));

  return NextResponse.json({
    ok: true,
    total: totalResult.count ?? 0,
    missingName: missingNameResult.count ?? 0,
    missingPhone: missingPhoneResult.count ?? 0,
    byLocation
  });
}
