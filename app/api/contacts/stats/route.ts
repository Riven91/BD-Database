import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseServiceClient } from "@/lib/supabase/serviceServerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { user } = await requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();

  const { count, error } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true });

  if (error) {
    return NextResponse.json(
      { error: "contacts_stats_failed", message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ totalContacts: count ?? 0 });
}
