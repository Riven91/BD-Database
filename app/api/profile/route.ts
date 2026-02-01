import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorPayload(where: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const maybeError = error as { code?: string | null; details?: string | null };
  return {
    error: "profile_failed",
    where,
    message,
    code: maybeError?.code ?? null,
    details: maybeError?.details ?? null,
  };
}

async function safeReadProfile(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("location_id")
    .eq("id", userId)
    .maybeSingle();

  // Table missing → treat as "no profile"
  if (error?.code === "42P01") {
    return { location_id: null, warning: null };
  }

  // IMPORTANT: Any other error (RLS, permission, etc.) must NOT brick login.
  if (error) {
    return { location_id: null, warning: errorPayload("profiles.select", error) };
  }

  return { location_id: data?.location_id ?? null, warning: null };
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getSupabaseAuthed(request);

    if (!user) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { location_id, warning } = await safeReadProfile(supabase, user.id);

    return NextResponse.json(
      warning
        ? { profile: { location_id }, warning }
        : { profile: { location_id } },
      { status: 200 },
    );
  } catch (error) {
    console.error("PROFILE_FAILED", error);

    // IMPORTANT: do NOT hard-fail login UX because of profile route
    return NextResponse.json(
      { profile: { location_id: null }, warning: errorPayload("route.catch", error) },
      { status: 200 },
    );
  }
}

export async function POST(request: Request) {
  // keep behavior identical to GET (no surprises)
  return GET(request);
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await getSupabaseAuthed(request);
    if (!user) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const locationId = body.location_id;

    if (!locationId || typeof locationId !== "string") {
      return NextResponse.json({ error: "Missing location_id" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ location_id: locationId })
      .eq("id", user.id)
      .select("id, role, location_id")
      .single();

    if (error) {
      // update errors should be explicit but not "server exploded"
      return NextResponse.json(errorPayload("profiles.update", error), { status: 400 });
    }

    return NextResponse.json({ profile: data }, { status: 200 });
  } catch (error) {
    console.error("PROFILE_FAILED", error);
    return NextResponse.json(errorPayload("route.catch", error), { status: 500 });
  }
}
