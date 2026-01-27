import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/routeClient";
import { requireRouteAuth } from "@/lib/supabase/routeAuth";
import { serializeSupabaseError } from "@/lib/supabase/errorUtils";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createRouteClient();
  const authResponse = await requireRouteAuth(supabase);
  if (authResponse) return authResponse;

  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, full_name, phone_e164, status, location:locations(name), labels:contact_labels(labels(id,name,is_archived))"
    )
    .order("updated_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("CONTACTS_GET_ERROR", error);
    return NextResponse.json(
      { ok: false, error: error.message, details: serializeSupabaseError(error) },
      { status: 500 }
    );
  }

  const contacts = (data ?? []).map((contact: any) => ({
    ...contact,
    labels: (contact.labels ?? [])
      .map((item: any) => item.labels)
      .filter(Boolean)
  }));

  return NextResponse.json({ contacts });
}
