import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function profileError(where: string, message: string) {
  return NextResponse.json(
    {
      error: "profile_failed",
      where,
      message,
    },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const supabase = supabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { data: profile, error: profileErrorResponse } = await supabase
      .from("profiles")
      .select("id, role, location_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErrorResponse) {
      return profileError("route.get.profile", profileErrorResponse.message);
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("PROFILE_FAILED", error);
    return profileError(
      "route.catch",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function POST() {
  try {
    const supabase = supabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("profiles")
      .select("id, role, location_id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingError) {
      return profileError("route.post.profile_select", existingError.message);
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
      return profileError("route.post.profile_insert", error.message);
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error("PROFILE_FAILED", error);
    return profileError(
      "route.catch",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = supabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
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
      return profileError("route.patch.profile_update", error.message);
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error("PROFILE_FAILED", error);
    return profileError(
      "route.catch",
      error instanceof Error ? error.message : String(error),
    );
  }
}
