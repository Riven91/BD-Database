import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { notAuth, requireUser } from "@/lib/supabase/routeAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const cookieStore = cookies();
  const cookieNames = cookieStore.getAll().map((cookie) => cookie.name);
  const { user } = await requireUser();
  if (!user) {
    return NextResponse.json(
      { authenticated: false, cookieNames },
      { status: 401 }
    );
  }
  return NextResponse.json({
    authenticated: true,
    cookieNames,
    email: user.email,
    userId: user.id
  });
}
