import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/routeClient";

export async function GET() {
  const supabase = createRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return NextResponse.json({
    authenticated: Boolean(user),
    email: user?.email ?? null
  });
}
