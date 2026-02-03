import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_EXPORT = 10000;

function escapeCsv(value: string) {
  if (value.includes("\"") || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/\"/g, "\"\"")}"`;
  }
  return value;
}

function toCsvRow(values: Array<string | null | undefined>) {
  return values
    .map((value) => escapeCsv(String(value ?? "")))
    .join(",");
}

export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim();
  const statusFilter = (url.searchParams.get("status") ?? "all").trim();
  const locationId = (
    url.searchParams.get("location_id") ??
    url.searchParams.get("locationId") ??
    url.searchParams.get("location") ??
    "all"
  ).trim();
  const labelParam = (url.searchParams.get("label") ?? "").trim();
  const labelFilters = labelParam.length
    ? labelParam
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean)
    : [];

  let query = supabase
    .from("contacts")
    .select(
      "id, name, first_name, last_name, phone_e164, status, location:locations(name), labels:contact_labels(labels(id,name)), last_sent_at, last_received_at, date_erstgespraech"
    )
    .order("created_at", { ascending: false })
    .range(0, MAX_EXPORT - 1);

  if (locationId && locationId !== "all") {
    query = query.eq("location_id", locationId);
  }

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (search.length) {
    const s = search.replaceAll("%", "").replaceAll(",", " ").trim();
    query = query.or(
      `phone_e164.ilike.%${s}%,name.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: { message: error.message, code: error.code ?? null } },
      { status: 500 }
    );
  }

  let contacts = (data ?? []).map((contact: any) => ({
    ...contact,
    labels: (contact.labels ?? [])
      .map((item: any) => item.labels)
      .filter(Boolean)
  }));

  if (labelFilters.length) {
    contacts = contacts.filter((contact: any) =>
      labelFilters.every((labelId) =>
        (contact.labels ?? []).some((label: any) => label.id === labelId)
      )
    );
  }

  const header =
    "Name,Telefon,Standort,Status,Labels,Erstkontakt,Letzte_Nachricht_Gesendet,Letzte_Antwort";
  const rows = contacts.map((contact: any) => {
    const name =
      contact.name ??
      [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
    const labelNames = (contact.labels ?? [])
      .map((label: any) => label.name)
      .filter(Boolean)
      .join("; ");
    return toCsvRow([
      name,
      contact.phone_e164 ?? "",
      contact.location?.name ?? "",
      contact.status ?? "",
      labelNames,
      contact.date_erstgespraech ?? "",
      contact.last_sent_at ?? "",
      contact.last_received_at ?? ""
    ]);
  });

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"contacts_export.csv\""
    }
  });
}
