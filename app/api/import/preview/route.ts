import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { mapRow, type CsvRow, type NormalizedContact } from "@/lib/import-utils";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: "preview expects multipart/form-data",
        contentType
      },
      { status: 400 }
    );
  }

  try {
    const form = await request.formData();
    const keys = Array.from(form.keys());
    let file =
      (form.get("file") as File | null) ??
      (form.get("files") as File | null) ??
      (form.get("upload") as File | null);

    if (!file) {
      for (const value of form.values()) {
        if (value instanceof File) {
          file = value;
          break;
        }
      }
    }

    if (!file || file.size === 0) {
      return NextResponse.json(
        {
          error: "bad_request",
          message: "no file in form-data",
          contentType,
          keys
        },
        { status: 400 }
      );
    }

    const name = (file.name || "").toLowerCase();
    const isCsv = name.endsWith(".csv");
    const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls");
    if (!isCsv && !isXlsx) {
      return NextResponse.json(
        {
          error: "bad_request",
          message: "unsupported file type",
          name
        },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    let rows: CsvRow[] = [];
    try {
      const workbook = XLSX.read(isCsv ? buf.toString("utf-8") : buf, {
        type: isCsv ? "string" : "array"
      });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return NextResponse.json(
          {
            error: "bad_request",
            message: "no sheets found in file",
            name
          },
          { status: 400 }
        );
      }
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        return NextResponse.json(
          {
            error: "bad_request",
            message: "missing first worksheet",
            name
          },
          { status: 400 }
        );
      }

      const normalizeRow = (row: Record<string, any>) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            value == null ? "" : String(value)
          ])
        );
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: "",
        raw: false
      });
      rows = rawRows.map(normalizeRow) as CsvRow[];
    } catch (error) {
      return NextResponse.json(
        {
          error: "bad_request",
          message: "failed to parse file",
          details: error instanceof Error ? error.message : "unknown error"
        },
        { status: 400 }
      );
    }

    const contacts: NormalizedContact[] = [];
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const { contact } = mapRow(row, rowNumber);
      if (contact) {
        contacts.push(contact);
      }
    });

    const phones = contacts.map((contact) => contact.phone_e164);
    if (!phones.length) {
      return NextResponse.json({
        existing: [],
        debug: {
          fileName: file.name,
          size: file.size,
          contentType,
          keys
        }
      });
    }

    const { data, error } = await supabase
      .from("contacts")
      .select("phone_e164")
      .in("phone_e164", phones);
    if (error) {
      return NextResponse.json(
        {
          error: "server_error",
          message: "failed to look up existing contacts",
          details: error.message
        },
        { status: 500 }
      );
    }
    const existing = (data ?? []).map((row) => row.phone_e164);
    return NextResponse.json({
      existing,
      debug: {
        fileName: file.name,
        size: file.size,
        contentType,
        keys
      }
    });
  } catch (error) {
    const details =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { message: "unknown error", stack: undefined };
    return NextResponse.json(
      { error: "server_error", message: "preview failed", ...details },
      { status: 500 }
    );
  }
}
