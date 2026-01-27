import { NextResponse } from "next/server";
import type { createRouteClient } from "@/lib/supabase/routeClient";
import { serializeSupabaseError } from "@/lib/supabase/errorUtils";

export async function requireRouteAuth(
  supabase: ReturnType<typeof createRouteClient>
) {
  const { data, error } = await supabase.auth.getUser();
  if (data?.user) {
    return null;
  }
  return NextResponse.json(
    {
      ok: false,
      error: "Not authenticated",
      details: serializeSupabaseError(error ?? null)
    },
    { status: 401 }
  );
}
