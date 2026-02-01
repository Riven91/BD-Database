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

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getSupabaseAuthed(request);
    if (!user) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("location_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json(
          { profile: { location_id: null } },
          { status: 200 },
        );
      }

      return NextResponse.json(errorPayload("profiles.select", error), {
        status: 500,
      });
    }

    return NextResponse.json(
      {
        profile: { location_id: data?.location_id ?? null },
      },
      { status: 401 },
    );
  } catch (error) {
    console.error("PROFILE_FAILED", error);
    return NextResponse.json(errorPayload("route.catch", error), {
      status: 500,
    });
  }

  const authResponse = await fetch(`${url}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
    },
  });

    const { data, error } = await supabase
      .from("profiles")
      .select("location_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json(
          { profile: { location_id: null } },
          { status: 200 },
        );
      }

      return NextResponse.json(errorPayload("profiles.select", error), {
        status: 500,
      });
    }

    return NextResponse.json(
      { profile: { location_id: data?.location_id ?? null } },
      { status: 200 },
    );
  } catch (error) {
    console.error("PROFILE_FAILED", error);
    return NextResponse.json(errorPayload("route.catch", error), {
      status: 500,
    });
  }

  const profileData = JSON.parse(profileBodyText) as Array<{
    location_id?: string | null;
  }>;
  const locationId = profileData?.[0]?.location_id ?? null;
  return NextResponse.json(
    { profile: { location_id: locationId } },
    { status: 200 },
  );
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function PATCH(request: Request) {
  const requestId = createRequestId();
  const authHeader =
    request.headers.get("authorization") ??
    request.headers.get("Authorization") ??
    "";
  const tokenPrefix = authHeader.replace(/^Bearer\s+/i, "").slice(0, 8);

  try {
    const { supabase, user } = await getSupabaseAuthed(request);
    if (!user) {
      return NextResponse.json(
        {
          error: "not_authenticated",
          requestId,
          tokenPrefix,
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const locationId = body.location_id;
    if (!locationId || typeof locationId !== "string") {
      return NextResponse.json(
        { error: "Missing location_id", requestId, tokenPrefix },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ location_id: locationId })
      .eq("id", user.id)
      .select("id, role, location_id")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error("PROFILE_FAILED", error);
    return NextResponse.json(errorPayload("route.catch", error), {
      status: 500,
    });
  }
}
