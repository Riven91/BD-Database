import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireRouteAuth } from "@/lib/supabase/routeAuth";
import { serializeSupabaseError } from "@/lib/supabase/errorUtils";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = supabaseServer();
  const authResponse = await requireRouteAuth(supabase);
  if (authResponse) return authResponse;

  const { data, error } = await supabase
    .from("message_templates")
    .select("id, title, body, is_archived, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("TEMPLATES_GET_ERROR", error);
    return NextResponse.json(
      { ok: false, error: error.message, details: serializeSupabaseError(error) },
      { status: 500 }
    );
  }

  return NextResponse.json({ templates: data ?? [] });
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
  const title = body.title?.trim();
  const templateBody = body.body?.trim();
  if (!title || !templateBody) {
    return NextResponse.json(
      { ok: false, error: "Missing fields", details: null },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("message_templates")
    .insert({ title, body: templateBody })
    .select("id, title, body, is_archived, created_at, updated_at")
    .single();

  if (error) {
    console.error("TEMPLATES_POST_ERROR", error);
    return NextResponse.json(
      { ok: false, error: error.message, details: serializeSupabaseError(error) },
      { status: 500 }
    );
  }

  return NextResponse.json({ template: data });
}
