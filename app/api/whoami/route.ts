import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return NextResponse.json({
        authenticated: false,
        email: null,
        userId: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      email: data.user.email,
      userId: data.user.id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { authenticated: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
