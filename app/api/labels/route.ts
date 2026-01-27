import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireRouteAuth } from "@/lib/supabase/routeAuth";
import { serializeSupabaseError } from "@/lib/supabase/errorUtils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = supabaseServer();
  const authResponse = await requireRouteAuth(supabase);
  if (authResponse) return authResponse;

  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "true";

  let query = supabase.from("labels").select("id, name, is_archived");
  if (!includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    console.error("LABELS_GET_ERROR", error);
    return NextResponse.json(
      { ok: false, error: error.message, details: serializeSupabaseError(error) },
      { status: 500 }
    );
  }

  return NextResponse.json({ labels: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = supabaseServer();
  const authResponse = await requireRouteAuth(supabase);
  if (authResponse) return authResponse;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", details: null },
      { status: 400 }
    );
  }
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Missing name", details: null },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("labels")
    .insert({ name })
    .select("id, name, is_archived")
    .single();

  if (error) {
    console.error("LABELS_POST_ERROR", error);
    return NextResponse.json(
      { ok: false, error: error.message, details: serializeSupabaseError(error) },
      { status: 500 }
    );
  }

  return NextResponse.json({ label: data });
}
