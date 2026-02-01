import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { supabase, user } = await getSupabaseAuthed(request);

    if (!user) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const params = context.params;
    if (!params?.id) {
      return NextResponse.json({ error: "missing_contact_id" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const labelId = body?.labelId;

    if (!labelId || typeof labelId !== "string") {
      return NextResponse.json({ error: "missing_label_id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("contact_labels")
      .upsert({ contact_id: params.id, label_id: labelId }, { onConflict: "contact_id,label_id" });

    if (error) {
      console.error("contact_labels upsert failed:", error);
      return NextResponse.json(
        { error: "db_error", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("POST /api/contacts/[id]/labels failed:", e);
    return NextResponse.json(
      { error: "server_error", details: e?.message ?? "unknown" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { supabase, user } = await getSupabaseAuthed(request);

    if (!user) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const params = context.params;
    if (!params?.id) {
      return NextResponse.json({ error: "missing_contact_id" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const labelId = body?.labelId;

    if (!labelId || typeof labelId !== "string") {
      return NextResponse.json({ error: "missing_label_id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("contact_labels")
      .delete()
      .eq("contact_id", params.id)
      .eq("label_id", labelId);

    if (error) {
      console.error("contact_labels delete failed:", error);
      return NextResponse.json(
        { error: "db_error", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("DELETE /api/contacts/[id]/labels failed:", e);
    return NextResponse.json(
      { error: "server_error", details: e?.message ?? "unknown" },
      { status: 500 }
    );
  }
}
