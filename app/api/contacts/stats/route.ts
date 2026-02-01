import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseServiceClient } from "@/lib/supabase/serviceServerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  try {
    const { user, mode, error } = await requireUser(request);

    if (!user) {
      return json(
        {
          ok: false,
          error: "not_authenticated",
          mode,
          details: error?.message ?? null,
        },
        401
      );
    }

    // Service Client: zählt unabhängig von RLS (dafür ist er da)
    const supabase = getSupabaseServiceClient();

    const contactsCountRes = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true });

    if (contactsCountRes.error) {
      return json(
        {
          ok: false,
          error: "contacts_stats_failed",
          details: contactsCountRes.error.message,
        },
        500
      );
    }

    const labelsCountRes = await supabase
      .from("labels")
      .select("id", { count: "exact", head: true });

    if (labelsCountRes.error) {
      return json(
        {
          ok: false,
          error: "labels_stats_failed",
          details: labelsCountRes.error.message,
        },
        500
      );
    }

    const locationsCountRes = await supabase
      .from("locations")
      .select("id", { count: "exact", head: true });

    if (locationsCountRes.error) {
      return json(
        {
          ok: false,
          error: "locations_stats_failed",
          details: locationsCountRes.error.message,
        },
        500
      );
    }

    // Missing-name Sample (robust, keine komplizierten OR-Filter)
    const sampleRes = await supabase
      .from("contacts")
      .select("id,name")
      .limit(2000);

    if (sampleRes.error) {
      return json(
        {
          ok: false,
          error: "missing_name_sample_failed",
          details: sampleRes.error.message,
        },
        500
      );
    }

    const sample = Array.isArray(sampleRes.data) ? sampleRes.data : [];
    let missingInSample = 0;

    for (const row of sample) {
      const n = typeof row?.name === "string" ? row.name.trim() : "";
      if (!n) missingInSample += 1;
    }

    return json({
      ok: true,
      authenticated: true,
      mode,
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      stats: {
        totalContacts: contactsCountRes.count ?? 0,
        totalLabels: labelsCountRes.count ?? 0,
        totalLocations: locationsCountRes.count ?? 0,
        missingName: {
          sampleSize: sample.length,
          missingInSample,
        },
      },
    });
  } catch (e: any) {
    return json(
      {
        ok: false,
        error: "server_error",
        details: e?.message ?? "unknown",
      },
      500
    );
  }
}

