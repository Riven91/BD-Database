import { NextResponse } from "next/server";
import { getEnvErrorMessage } from "@/lib/env";
import { createRouteClient } from "@/lib/supabase/routeClient";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createRouteClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("contacts")
      .select(
        "id, full_name, phone_e164, status, location:locations(name), labels:contact_labels(labels(id,name,sort_order,is_archived))"
      )
      .order("updated_at", { ascending: false })
      .limit(300);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const contacts = (data ?? []).map((contact: any) => ({
      ...contact,
      labels: (contact.labels ?? [])
        .map((item: any) => item.labels)
        .filter(Boolean)
    }));

    return NextResponse.json({ contacts });
  } catch (error) {
    const envError = getEnvErrorMessage(error);
    if (envError) {
      return NextResponse.json({ error: envError }, { status: 500 });
    }
    throw error;
  }
}
