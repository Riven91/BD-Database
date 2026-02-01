import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // Total contacts
  const totalResult = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true });

  if (totalResult.error) {
    return NextResponse.json(
      {
        error: "stats_failed",
        where: "contacts.total",
        message: totalResult.error.message,
        code: (totalResult.error as any).code ?? null
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

  // Missing phone count
  const missingPhoneResult = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .is("phone_e164", null);

  const { data: byLocationCounts, error: rpcError } = await supabase.rpc(
    "contacts_counts_by_location"
  );

  if (rpcError) {
    return NextResponse.json(
      {
        error: "stats_failed",
        where: "contacts.by_location",
        message: rpcError.message,
        code: (rpcError as any).code ?? null
      },
      { status: 500 }
    );
  }

  const byLocation =
    (byLocationCounts ?? []).map((row) => ({
      name: row.location_name ?? "Unbekannt",
      count: row.count ?? 0
    })) ?? [];

  return NextResponse.json({
    ok: true,
    total: totalResult.count ?? 0,
    missingName: missingNameResult.count ?? 0,
    missingPhone: missingPhoneResult.count ?? 0,
    byLocation
  });
}
