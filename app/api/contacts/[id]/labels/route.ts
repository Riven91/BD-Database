import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = supabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const labelId = body.labelId as string | undefined;
  if (!labelId) {
    return NextResponse.json({ error: "Missing labelId" }, { status: 400 });
  }

  const { error } = await supabase
    .from("contact_labels")
    .upsert({ contact_id: params.id, label_id: labelId });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = supabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const labelId = url.searchParams.get("labelId");
  if (!labelId) {
    return NextResponse.json({ error: "Missing labelId" }, { status: 400 });
  }

  const { error } = await supabase
    .from("contact_labels")
    .delete()
    .eq("contact_id", params.id)
    .eq("label_id", labelId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
