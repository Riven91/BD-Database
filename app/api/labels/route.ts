import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/routeClient";

export const dynamic = "force-dynamic";

async function requireAdmin(supabase: ReturnType<typeof createRouteClient>) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) };
  }
  return { error: null };
}

export async function GET(request: Request) {
  const supabase = createRouteClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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
  const supabase = createRouteClient();
  const adminCheck = await requireAdmin(supabase);
  if (adminCheck.error) return adminCheck.error;

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
