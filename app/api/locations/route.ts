import { NextResponse } from "next/server";
import { getEnvErrorMessage } from "@/lib/env";
import { createRouteClient } from "@/lib/supabase/routeClient";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createRouteClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("locations")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ locations: data ?? [] });
  } catch (error) {
    const envError = getEnvErrorMessage(error);
    if (envError) {
      return NextResponse.json({ error: envError }, { status: 500 });
    }
    throw error;
  }
}
