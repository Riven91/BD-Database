import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function GET(request: Request) {
  try {
    const cookieNames = cookies().getAll().map((c) => c.name);

    const bearer = getBearerToken(request);
    const bearerPrefix = bearer ? bearer.slice(0, 12) : null;

    const { user, mode } = await requireUser(request);

    // ABSICHTLICH 200 (nie 401), damit Frontend nie "throw/crash" macht
    if (!user) {
      return NextResponse.json(
        {
          authenticated: false,
          mode: mode ?? null,
          cookieNames,
          hasBearer: !!bearer,
          bearerPrefix,
          email: null,
          userId: null,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        mode: mode ?? null,
        cookieNames,
        hasBearer: !!bearer,
        bearerPrefix,
        email: user.email ?? null,
        userId: user.id ?? null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    // Auch hier: 200, stabiler JSON-Body, damit UI nicht crasht
    return NextResponse.json(
      {
        authenticated: false,
        mode: null,
        cookieNames: [],
        hasBearer: false,
        bearerPrefix: null,
        email: null,
        userId: null,
        error: "server_error",
        details: e?.message || "unknown",
      },
      { status: 200 }
    );
  }
}
