import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  let phones: string[] = [];
  if (contentType.includes("application/json")) {
    const body = await request.json();
    phones = body.phones ?? [];
  } else if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const phonesValue = formData.get("phones");
    if (typeof phonesValue === "string") {
      try {
        const parsed = JSON.parse(phonesValue);
        if (Array.isArray(parsed)) {
          phones = parsed;
        }
      } catch (error) {
        return NextResponse.json(
          { error: "bad_request", message: "invalid phones payload", details: String(error) },
          { status: 400 }
        );
      }
    }
  } else {
    return NextResponse.json(
      { error: "bad_request", message: "preview expects JSON or multipart form data" },
      { status: 400 }
    );
  }
  if (!phones.length) {
    return NextResponse.json({ existing: [] });
  }
  const { data, error } = await supabase
    .from("contacts")
    .select("phone_e164")
    .in("phone_e164", phones);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const existing = (data ?? []).map((row) => row.phone_e164);
  return NextResponse.json({ existing });
}
