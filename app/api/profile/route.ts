import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { user } = await getSupabaseAuthed(request);
    if (!user) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    return NextResponse.json(
      {
        id: user.id,
        email: user.email ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("PROFILE_FAILED", error);
    return NextResponse.json(
      {
        error: "profile_failed",
        where: "route.catch",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getSupabaseAuthed(request);
    if (!user) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("profiles")
      .select("id, role, location_id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      return NextResponse.json({ profile: existing });
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: user.id, role: "staff", location_id: null })
      .select("id, role, location_id")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error("PROFILE_FAILED", error);
    return NextResponse.json(
      {
        error: "profile_failed",
        where: "route.catch",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
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
      return NextResponse.json(
        { error: "Missing location_id" },
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
      {
        error: "profile_failed",
        where: "route.catch",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
