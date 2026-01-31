import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { mapRow, type CsvRow } from "@/lib/import-utils";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

class PreviewError extends Error {
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.details = details;
  }
}

function parseRowsFromBuffer(buffer: Buffer, name: string): CsvRow[] {
  const isCsv = name.endsWith(".csv");
  try {
    const data = isCsv ? buffer.toString("utf-8") : buffer;
    const workbook = XLSX.read(data, { type: isCsv ? "string" : "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new PreviewError("no sheets found in file");
    }
    const sheet = workbook.Sheets[sheetName];
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
    return rawRows.map(normalizeRow) as CsvRow[];
  } catch (error) {
    if (error instanceof PreviewError) {
      throw error;
    }
    throw new PreviewError("failed to parse file", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseRowsFromBuffer(buffer, name);
    const contacts = rows
      .map((row, index) => mapRow(row, index + 2).contact)
      .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact));
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
        { error: "internal_error", message: error.message },
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
    if (error instanceof PreviewError) {
      return NextResponse.json(
        {
          error: "bad_request",
          message: error.message,
          details: error.details
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: "internal_error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
