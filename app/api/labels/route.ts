import { NextResponse } from "next/server";
import { notAuth, requireUser } from "@/lib/supabase/routeSupabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return notAuth();

  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "true";

  let query = supabase.from("labels").select("id, name, sort_order, is_archived");
  if (!includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ labels: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return notAuth();

  const body = await request.json();
  const name = body.name?.trim();
  const sortOrder = Number(body.sort_order ?? 1000);
  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const { error } = await supabase
    .from("labels")
    .insert({ name, sort_order: sortOrder });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
