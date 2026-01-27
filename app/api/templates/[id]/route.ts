import { NextResponse } from "next/server";
import { getEnvErrorMessage } from "@/lib/env";
import { createRouteClient } from "@/lib/supabase/routeClient";

export const dynamic = "force-dynamic";

async function requireAuth(supabase: ReturnType<typeof createRouteClient>) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteClient();
    const authError = await requireAuth(supabase);
    if (authError) return authError;

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.title === "string") updates.title = body.title.trim();
    if (typeof body.body === "string") updates.body = body.body.trim();
    if (typeof body.is_archived === "boolean") updates.is_archived = body.is_archived;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("message_templates")
      .update(updates)
      .eq("id", params.id)
      .select("id, title, body, is_archived, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template: data });
  } catch (error) {
    const envError = getEnvErrorMessage(error);
    if (envError) {
      return NextResponse.json({ error: envError }, { status: 500 });
    }
    throw error;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteClient();
    const authError = await requireAuth(supabase);
    if (authError) return authError;

    const { error } = await supabase
      .from("message_templates")
      .delete()
      .eq("id", params.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const envError = getEnvErrorMessage(error);
    if (envError) {
      return NextResponse.json({ error: envError }, { status: 500 });
    }
    throw error;
  }
}
