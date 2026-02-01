import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ErrorContext = {
  requestId: string;
  tokenPrefix: string;
  status?: number;
  bodySnippet?: string;
};

function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return String(Date.now());
}

function errorPayload(where: string, error: unknown, context: ErrorContext) {
  const message = error instanceof Error ? error.message : String(error);
  const maybeError = error as { code?: string | null; details?: string | null };
  return {
    error: "profile_failed",
    where,
    message,
    code: maybeError?.code ?? null,
    details: maybeError?.details ?? null,
    ...context,
  };
}

async function handle(request: Request) {
  const auth =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");
  const requestId = createRequestId();

  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json(
      {
        error: "not_authenticated",
        where: "missing_bearer",
        requestId,
        tokenPrefix: "",
      },
      { status: 401 },
    );
  }

  const token = auth.slice(7).trim();
  const tokenPrefix = token.slice(0, 8);
  if (token.length < 20) {
    return NextResponse.json(
      {
        error: "not_authenticated",
        where: "bad_token_length",
        requestId,
        tokenPrefix,
      },
      { status: 401 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json(
      errorPayload("env", "Missing Supabase env", {
        requestId,
        tokenPrefix,
      }),
      { status: 500 },
    );
  }

  const authResponse = await fetch(`${url}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
    },
  });

  if (authResponse.status === 401 || authResponse.status === 403) {
    return NextResponse.json(
      {
        error: "not_authenticated",
        where: "auth_user",
        status: authResponse.status,
        requestId,
        tokenPrefix,
      },
      { status: 401 },
    );
  }

  if (!authResponse.ok) {
    const bodySnippet = (await authResponse.text()).slice(0, 200);
    return NextResponse.json(
      errorPayload("auth_user", "Supabase auth failed", {
        status: authResponse.status,
        bodySnippet,
        requestId,
        tokenPrefix,
      }),
      { status: 500 },
    );
  }

  const authData = (await authResponse.json()) as { id?: string };
  const userId = authData?.id;
  if (!userId) {
    return NextResponse.json(
      {
        error: "not_authenticated",
        where: "auth_user",
        status: authResponse.status,
        requestId,
        tokenPrefix,
      },
      { status: 401 },
    );
  }

  const profileResponse = await fetch(
    `${url}/rest/v1/profiles?select=location_id&id=eq.${userId}&limit=1`,
    {
      method: "GET",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );

  if (profileResponse.status === 404) {
    return NextResponse.json(
      { profile: { location_id: null } },
      { status: 200 },
    );
  }

  const profileBodyText = await profileResponse.text();
  if (
    profileBodyText.includes("relation") &&
    profileBodyText.includes("does not exist")
  ) {
    return NextResponse.json(
      { profile: { location_id: null } },
      { status: 200 },
    );
  }

  if (profileResponse.status === 401 || profileResponse.status === 403) {
    return NextResponse.json(
      { profile: { location_id: null }, rls: "blocked" },
      { status: 200 },
    );
  }

  if (!profileResponse.ok) {
    return NextResponse.json(
      errorPayload("profiles_select", "Supabase profiles query failed", {
        status: profileResponse.status,
        bodySnippet: profileBodyText.slice(0, 200),
        requestId,
        tokenPrefix,
      }),
      { status: 500 },
    );
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
    return NextResponse.json(
      errorPayload("route.catch", error, {
        requestId,
        tokenPrefix,
      }),
      { status: 500 },
    );
  }
}
