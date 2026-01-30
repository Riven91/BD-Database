import { NextResponse } from "next/server";
import { notAuth, requireUser } from "@/lib/supabase/routeSupabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await requireUser();
  if (!user) return notAuth();
  return NextResponse.json({ authenticated: true, email: user.email });
}
