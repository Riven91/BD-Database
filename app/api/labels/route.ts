import { NextResponse } from "next/server";
import { getEnvErrorMessage } from "@/lib/env";
import { createRouteClient } from "@/lib/supabase/routeClient";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
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
  } catch (error) {
    const envError = getEnvErrorMessage(error);
    if (envError) {
      return NextResponse.json({ error: envError }, { status: 500 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("labels")
      .insert({ name })
      .select("id, name, sort_order, is_archived")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ label: data });
  } catch (error) {
    const envError = getEnvErrorMessage(error);
    if (envError) {
      return NextResponse.json({ error: envError }, { status: 500 });
    }
    throw error;
  }
}
