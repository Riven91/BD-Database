import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseServiceClient } from "@/lib/supabase/serviceServerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function json(data: any) {
  return new NextResponse(JSON.stringify(data), {
    status: 200, // bewusst immer 200 => Client crasht nie
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function stableResponse(base?: Partial<any>) {
  return {
    ok: true,
    authenticated: false,
    mode: null,
    user: { id: null, email: null },
    stats: {
      totalContacts: 0,
      totalLabels: 0,
      totalLocations: 0,
      missingName: { exact: 0, sampleSize: 0, missingInSample: 0 },
      missingPhone: { exact: 0 },
      byLocation: [] as { id: string; name: string; count: number }[]
    },
    error: null,
    details: null,
    ...base
  };
}

export async function GET(request: Request) {
  try {
    const { user, mode, error } = await requireUser(request);

    if (!user) {
      return json(
        stableResponse({
          authenticated: false,
          mode: mode ?? null,
          error: "not_authenticated",
          details: error?.message ?? null
        })
      );
    }

    let supabase: any;
    try {
      supabase = getSupabaseServiceClient();
    } catch (e: any) {
      return json(
        stableResponse({
          authenticated: true,
          mode: mode ?? null,
          user: { id: user.id ?? null, email: user.email ?? null },
          error: "service_client_unavailable",
          details: e?.message ?? "SUPABASE_SERVICE_ROLE_KEY is missing"
        })
      );
    }

    // 1) Exakte Counts
    const [
      contactsCountRes,
      labelsCountRes,
      locationsCountRes,
      missingNameExactRes,
      missingPhoneExactRes,
      locationsRes
    ] = await Promise.all([
      supabase.from("contacts").select("id", { count: "exact", head: true }),
      supabase.from("labels").select("id", { count: "exact", head: true }),
      supabase.from("locations").select("id", { count: "exact", head: true }),
      // missing name: null ODER leerer string
      supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .or("name.is.null,name.eq."),
      // missing phone: null ODER leerer string
      supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .or("phone_e164.is.null,phone_e164.eq."),
      supabase.from("locations").select("id,name").order("name", { ascending: true })
    ]);

    // Fehler sauber abfangen -> stabile Struktur
    const firstError =
      contactsCountRes?.error ||
      labelsCountRes?.error ||
      locationsCountRes?.error ||
      missingNameExactRes?.error ||
      missingPhoneExactRes?.error ||
      locationsRes?.error;

    if (firstError) {
      return json(
        stableResponse({
          authenticated: true,
          mode: mode ?? null,
          user: { id: user.id ?? null, email: user.email ?? null },
          error: "stats_query_failed",
          details: firstError.message ?? String(firstError)
        })
      );
    }

    const locations = Array.isArray(locationsRes.data) ? locationsRes.data : [];

    // 2) byLocation: pro Standort exakt zählen (wenige Standorte => ok)
    const byLocationRaw = await Promise.all(
      locations.map(async (loc: any) => {
        const locId = String(loc.id);
        const locName = typeof loc.name === "string" ? loc.name : locId;

        const res = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("location_id", locId);

        return {
          id: locId,
          name: locName,
          count: res?.error ? 0 : res.count ?? 0
        };
      })
    );

    // 3) Optionales Sample (wie vorher) – nur fürs Debug, nicht als Hauptzahl
    const sampleRes = await supabase.from("contacts").select("id,name").limit(2000);
    const sample = Array.isArray(sampleRes.data) ? sampleRes.data : [];
    let missingInSample = 0;
    for (const row of sample) {
      const n = typeof row?.name === "string" ? row.name.trim() : "";
      if (!n) missingInSample += 1;
    }

    return json(
      stableResponse({
        authenticated: true,
        mode: mode ?? null,
        user: { id: user.id ?? null, email: user.email ?? null },
        stats: {
          totalContacts: contactsCountRes.count ?? 0,
          totalLabels: labelsCountRes.count ?? 0,
          totalLocations: locationsCountRes.count ?? 0,
          missingName: {
            exact: missingNameExactRes.count ?? 0,
            sampleSize: sample.length,
            missingInSample
          },
          missingPhone: {
            exact: missingPhoneExactRes.count ?? 0
          },
          byLocation: byLocationRaw
        },
        error: null,
        details: null
      })
    );
  } catch (e: any) {
    return json(
      stableResponse({
        error: "server_error",
        details: e?.message ?? "unknown"
      })
    );
  }
}
