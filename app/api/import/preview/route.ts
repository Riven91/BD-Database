import { NextResponse } from "next/server";
import { getSupabaseAuthed } from "@/lib/supabase/requireUser";

// Wichtig: Node Runtime (File/Buffer/XLSX Parsing)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function serializeAnyError(err: any) {
  if (!err) return null;
  const message = err?.message ?? String(err);
  const parsed = typeof message === "string" ? safeJsonParse(message) : null;

  return {
    name: err?.name ?? null,
    message,
    stack: err?.stack ?? null,
    details: err?.details ?? null,
    hint: err?.hint ?? null,
    code: err?.code ?? null,
    status: err?.status ?? null,
    parsed
  };
}

function detectDelimiterFromHeaderLine(line: string) {
  const comma = (line.match(/,/g) ?? []).length;
  const semi = (line.match(/;/g) ?? []).length;
  const tab = (line.match(/\t/g) ?? []).length;

  if (tab >= comma && tab >= semi && tab > 0) return "\t";
  if (semi >= comma && semi > 0) return ";";
  return ",";
}

function getFirstNonEmptyLine(text: string) {
  const lines = text.split(/\r?\n/);
  for (const l of lines) {
    const t = l.trim();
    if (t.length > 0) return t;
  }
  return "";
}

function normalizeHeader(h: string) {
  return (h ?? "")
    .toString()
    .trim()
    .replace(/\uFEFF/g, ""); // BOM entfernen
}

function toStringSafe(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function parseCSVToObjects(csvText: string) {
  // CSV robust: delimiter autodetect + quotes + CRLF
  const headerLine = getFirstNonEmptyLine(csvText);
  const delimiter = detectDelimiterFromHeaderLine(headerLine);

  const rows = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rows.length === 0) {
    return { delimiter, headers: [], objects: [] as Record<string, string>[] };
  }

  // Minimaler CSV-Splitter (ohne heavy deps): berücksichtigt einfache Quotes
  // Hinweis: Wenn ihr PapaParse nutzt, kann Codex das später ersetzen – das hier ist “safe enough” für Preview.
  function splitLine(line: string) {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        // doppelte Quotes innerhalb quotes -> ein Quote
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && ch === delimiter) {
        out.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }

  const rawHeaders = splitLine(rows[0]).map(normalizeHeader);
  const headers = rawHeaders;

  const objects: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = splitLine(rows[r]);
    if (cols.every((c) => c.trim().length === 0)) continue;

    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] ?? `col_${c}`;
      obj[key] = toStringSafe(cols[c] ?? "");
    }
    objects.push(obj);
  }

  return { delimiter, headers, objects };
}

async function parseXLSXToObjects(buffer: Buffer) {
  // XLSX Parsing via "xlsx" package
  // Wenn xlsx nicht installiert ist, kommt ein sauberer Fehler zurück.
  let XLSX: any;
  try {
    XLSX = await import("xlsx");
  } catch (e) {
    throw new Error(
      JSON.stringify({
        where: "xlsx.import",
        message: "xlsx package not available. Install dependency 'xlsx'."
      })
    );
  }

  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) {
    return { sheetName: null, headers: [], objects: [] as Record<string, string>[] };
  }

  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(ws, {
    defval: "",
    raw: false
  });

  const objects: Record<string, string>[] = (json as any[]).map((row) => {
    const obj: Record<string, string> = {};
    for (const [k, v] of Object.entries(row ?? {})) {
      obj[normalizeHeader(k)] = toStringSafe(v);
    }
    return obj;
  });

  const headers = objects.length ? Object.keys(objects[0]) : [];
  return { sheetName, headers, objects };
}

export async function POST(request: Request) {
  // Auth – wenn Preview bei euch ohne Login erlaubt sein soll, diesen Block entfernen.
  const { user } = await getSupabaseAuthed(request);
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const keys = Array.from(formData.keys());

    const file =
      (formData.get("file") as File) ||
      (formData.get("upload") as File) ||
      (formData.get("csv") as File) ||
      (formData.get("xlsx") as File);

    if (!file) {
      return NextResponse.json(
        { error: "preview_failed", where: "formData.file_missing", keys },
        { status: 400 }
      );
    }

    const meta = { name: file.name, type: file.type, size: file.size };
    const buf = Buffer.from(await file.arrayBuffer());
    const headSnippet = buf.subarray(0, 400).toString("utf8");

    const nameLower = (file.name || "").toLowerCase();
    const isXlsx =
      nameLower.endsWith(".xlsx") ||
      meta.type.includes("spreadsheet") ||
      meta.type.includes("excel");

    const isCsv =
      nameLower.endsWith(".csv") ||
      meta.type.includes("csv") ||
      (!isXlsx && (meta.type === "" || meta.type.includes("text")));

    if (!isXlsx && !isCsv) {
      return NextResponse.json(
        {
          error: "preview_failed",
          where: "file.type_unsupported",
          meta,
          keys,
          headSnippet
        },
        { status: 400 }
      );
    }

    if (isXlsx) {
      let parsed;
      try {
        parsed = await parseXLSXToObjects(buf);
      } catch (err: any) {
        return NextResponse.json(
          {
            error: "preview_failed",
            where: "xlsx.parse",
            meta,
            keys,
            headSnippet,
            ...serializeAnyError(err)
          },
          { status: 500 }
        );
      }

      const contacts = parsed.objects.map((o, idx) => ({
        source_row: idx + 2, // XLSX: header ist typischerweise Zeile 1
        ...o
      }));

      return NextResponse.json({
        ok: true,
        format: "xlsx",
        meta,
        sheetName: parsed.sheetName,
        headers: parsed.headers,
        count: contacts.length,
        contacts, // <-- wichtig fürs Confirm
        preview: contacts // <-- Alias, falls Frontend "preview" erwartet
      });
    }

    // CSV
    const csvText = buf.toString("utf8");
    let csvParsed;
    try {
      csvParsed = parseCSVToObjects(csvText);
    } catch (err: any) {
      return NextResponse.json(
        {
          error: "preview_failed",
          where: "csv.parse",
          meta,
          keys,
          headSnippet,
          ...serializeAnyError(err)
        },
        { status: 500 }
      );
    }

    // Basic header validation (optional, aber hilfreich)
    if (!csvParsed.headers.length) {
      return NextResponse.json(
        {
          error: "preview_failed",
          where: "csv.headers_empty",
          meta,
          keys,
          headSnippet,
          detectedDelimiter: csvParsed.delimiter
        },
        { status: 400 }
      );
    }

    const contacts = csvParsed.objects.map((o, idx) => ({
      source_row: idx + 2, // CSV: header ist Zeile 1
      ...o
    }));

    return NextResponse.json({
      ok: true,
      format: "csv",
      meta,
      detectedDelimiter: csvParsed.delimiter,
      headers: csvParsed.headers,
      count: contacts.length,
      contacts, // <-- wichtig fürs Confirm
      preview: contacts // <-- Alias
    });
  } catch (err: any) {
    // NIE mehr "internal_error" + "Bad Request" pauschal
    const payload = {
      error: "preview_failed",
      where: "route.catch",
      ...serializeAnyError(err)
    };

    console.error("IMPORT_PREVIEW_ERROR", payload);

    // Falls err.message JSON ist, sauber mergen
    const message = payload.message ?? "";
    if (typeof message === "string") {
      const parsed = safeJsonParse(message);
      if (parsed && typeof parsed === "object") {
        return NextResponse.json({ error: "preview_failed", ...parsed }, { status: 500 });
      }
    }

    return NextResponse.json(payload, { status: 500 });
  }
}

  }
}
