import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const cookieNames = cookies().getAll().map((c) => c.name);

  const { user, mode } = await requireUser(request);

  if (!user) {
    return NextResponse.json(
      { authenticated: false, mode, cookieNames },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    mode,
    cookieNames,
    email: user.email,
    userId: user.id,
  });
}
