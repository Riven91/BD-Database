import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseServiceClient } from "@/lib/supabase/serviceServerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function json(data: any) {
  return new NextResponse(JSON.stringify(data), {
    status: 200, // IMMER 200, damit Client nie crasht
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function stableResponse(base?: Partial<any>) {
  // IMMER gleiche Struktur, egal ob Fehler oder Erfolg
  return {
    ok: false,
    authenticated: false,
    mode: null,
    user: { id: null, email: null },
    stats: {
      totalContacts: 0,
      totalLabels: 0,
      totalLocations: 0,
      missingName: { sampleSize: 0, missingInSample: 0 },
    },
    error: null,
    details: null,
    ...base,
  };
}

export async function GET(request: Request) {
  try {
    const { user, mode, error } = await requireUser(request);

    if (!user) {
      return json(
        stableResponse({
          ok: true, // Route antwortet technisch OK, Auth ist nur false
          authenticated: false,
          mode: mode ?? null,
          error: "not_authenticated",
          details: error?.message ?? null,
        })
      );
    }

    let supabase: any;
    try {
      // Kann werfen, wenn SUPABASE_SERVICE_ROLE_KEY fehlt
      supabase = getSupabaseServiceClient();
    } catch (e: any) {
      return json(
        stableResponse({
          ok: true,
          authenticated: true,
          mode: mode ?? null,
          user: { id: user.id ?? null, email: user.email ?? null },
          error: "service_client_unavailable",
          details: e?.message ?? "SUPABASE_SERVICE_ROLE_KEY is missing",
        })
      );
    }

    const [contactsCountRes, labelsCountRes, locationsCountRes, sampleRes] =
      await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("labels").select("id", { count: "exact", head: true }),
        supabase.from("locations").select("id", { count: "exact", head: true }),
        supabase.from("contacts").select("id,name").limit(2000),
      ]);

    // Wenn irgendein Query fehlschlägt: trotzdem stabile Struktur zurückgeben
    if (contactsCountRes?.error) {
      return json(
        stableResponse({
          ok: true,
          authenticated: true,
          mode: mode ?? null,
          user: { id: user.id ?? null, email: user.email ?? null },
          error: "contacts_stats_failed",
          details: contactsCountRes.error.message,
        })
      );
    }

    if (labelsCountRes?.error) {
      return json(
        stableResponse({
          ok: true,
          authenticated: true,
          mode: mode ?? null,
          user: { id: user.id ?? null, email: user.email ?? null },
          error: "labels_stats_failed",
          details: labelsCountRes.error.message,
        })
      );
    }

    if (locationsCountRes?.error) {
      return json(
        stableResponse({
          ok: true,
          authenticated: true,
          mode: mode ?? null,
          user: { id: user.id ?? null, email: user.email ?? null },
          error: "locations_stats_failed",
          details: locationsCountRes.error.message,
        })
      );
    }

    if (sampleRes?.error) {
      return json(
        stableResponse({
          ok: true,
          authenticated: true,
          mode: mode ?? null,
          user: { id: user.id ?? null, email: user.email ?? null },
          error: "missing_name_sample_failed",
          details: sampleRes.error.message,
        })
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
      mode: mode ?? null,
      user: { id: user.id ?? null, email: user.email ?? null },
      stats: {
        totalContacts: contactsCountRes.count ?? 0,
        totalLabels: labelsCountRes.count ?? 0,
        totalLocations: locationsCountRes.count ?? 0,
        missingName: {
          sampleSize: sample.length,
          missingInSample,
        },
      },
      error: null,
      details: null,
    });
  } catch (e: any) {
    return json(
      stableResponse({
        ok: true,
        error: "server_error",
        details: e?.message ?? "unknown",
      })
    );
  }
}
