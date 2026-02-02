import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";

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

function serializeErr(err: any) {
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

function firstNonEmptyLine(text: string) {
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t) return t;
  }
  return "";
}

function detectDelimiter(line: string) {
  const c = (line.match(/,/g) ?? []).length;
  const s = (line.match(/;/g) ?? []).length;
  const t = (line.match(/\t/g) ?? []).length;
  if (t >= c && t >= s && t > 0) return "\t";
  if (s >= c && s > 0) return ";";
  return ",";
}

function splitCsvLine(line: string, delimiter: string) {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
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

function normalizeHeader(h: string) {
  return (h ?? "").toString().trim().replace(/\uFEFF/g, "");
}

export async function POST(request: Request) {
  // AUTH immer über requireUser (Cookie-first)
  const { user, mode, error } = await requireUser(request);
  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_authenticated",
        mode: mode ?? null,
        details: error?.message ?? null
      },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const keys = Array.from(formData.keys());

    const file =
      (formData.get("file") as any) ||
      (formData.get("upload") as any) ||
      (formData.get("csv") as any);

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "preview_failed", where: "formData.file_missing", keys },
        { status: 400 }
      );
    }

    const name = String(file?.name ?? "");
    const type = String(file?.type ?? "");
    const meta = { name, type, size: Number(file?.size ?? 0) };

    // CSV only
    const nameLower = name.toLowerCase();
    const isCsv =
      nameLower.endsWith(".csv") ||
      type.includes("csv") ||
      type.includes("text") ||
      type === "";

    if (!isCsv) {
      return NextResponse.json(
        { ok: false, error: "preview_failed", where: "file.type_unsupported", meta, keys },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const headSnippet = buf.subarray(0, 400).toString("utf8");
    const csvText = buf.toString("utf8");

    const headerLine = firstNonEmptyLine(csvText);
    if (!headerLine) {
      return NextResponse.json(
        { ok: false, error: "preview_failed", where: "csv.empty", meta, keys, headSnippet },
        { status: 400 }
      );
    }

    const delimiter = detectDelimiter(headerLine);
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const rawHeaders = splitCsvLine(lines[0], delimiter).map(normalizeHeader);

    if (!rawHeaders.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "preview_failed",
          where: "csv.headers_empty",
          meta,
          keys,
          headSnippet,
          detectedDelimiter: delimiter
        },
        { status: 400 }
      );
    }

    const contacts: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i], delimiter);
      const obj: Record<string, string> = { source_row: String(i + 1) };

      for (let c = 0; c < rawHeaders.length; c++) {
        const k = rawHeaders[c] ?? `col_${c}`;
        obj[k] = String(cols[c] ?? "").trim();
      }
      contacts.push(obj);
    }

    return NextResponse.json({
      ok: true,
      authenticated: true,
      userId: user.id,
      format: "csv",
      meta,
      detectedDelimiter: delimiter,
      headers: rawHeaders,
      count: contacts.length,
      contacts,
      preview: contacts
    });
  } catch (err: any) {
    const payload = {
      ok: false,
      error: "preview_failed",
      where: "route.catch",
      ...serializeErr(err)
    };
    console.error("IMPORT_PREVIEW_ERROR", payload);
    return NextResponse.json(payload, { status: 500 });
  }
}
