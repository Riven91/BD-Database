import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/routeClient";
import { serializeSupabaseError } from "@/lib/supabase/errorUtils";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createRouteClient();
  const note = `health-check ${new Date().toISOString()}`;

  const insertResult = await supabase
    .from("debug_health")
    .insert({ note })
    .select("id, created_at, note")
    .single();

  const insertOk = !insertResult.error;
  let selectOk = false;
  let selectError = null;
  let row = insertResult.data ?? null;

  if (insertResult.data?.id) {
    const selectResult = await supabase
      .from("debug_health")
      .select("id, created_at, note")
      .eq("id", insertResult.data.id)
      .single();
    selectOk = !selectResult.error;
    selectError = selectResult.error;
    row = selectResult.data ?? row;
  }

  return NextResponse.json({
    ok: insertOk && selectOk,
    insertOk,
    selectOk,
    row,
    errorDetails: {
      insert: serializeSupabaseError(insertResult.error),
      select: serializeSupabaseError(selectError)
    }
  });
}
