"use client";

import { useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

type PreviewResult =
  | {
      ok: true;
      format: "csv";
      meta: { name: string; type: string; size: number };
      detectedDelimiter: string;
      headers: string[];
      count: number;
      contacts: Record<string, string>[];
      preview: Record<string, string>[];
    }
  | {
      error: string;
      where?: string;
      details?: any;
      keys?: string[];
      meta?: any;
      detectedDelimiter?: string;
      headSnippet?: string;
      name?: string;
      message?: string;
    };

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [rawStatus, setRawStatus] = useState<number | null>(null);
  const [rawText, setRawText] = useState<string>("");
  const [parsed, setParsed] = useState<PreviewResult | null>(null);

  const canRun = useMemo(() => Boolean(file) && !loading, [file, loading]);

  async function runPreview() {
    if (!file) return;

    setLoading(true);
    setRawStatus(null);
    setRawText("");
    setParsed(null);

    try {
      const form = new FormData();
      form.set("file", file);

      // WICHTIG:
      // - POST auf /api/import/preview (nicht /import)
      // - credentials: include (Cookie-Auth)
      // - KEIN manual Content-Type bei FormData
      const res = await fetchWithAuth("/api/import/preview", {
        method: "POST",
        body: form
      });

      const text = await res.text();
      setRawStatus(res.status);
      setRawText(text);

      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!res.ok) {
        // Wir lassen es stehen, damit du den echten Fehler siehst
        setParsed((json ?? { error: "non_json_error", message: text }) as PreviewResult);
        return;
      }

      setParsed((json ?? null) as PreviewResult);
    } catch (e: any) {
      setRawStatus(-1);
      setRawText(String(e?.message ?? e ?? "unknown error"));
      setParsed({ error: "client_fetch_failed", details: String(e?.message ?? e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <h1 className="text-xl font-semibold">Import</h1>
      <p className="mt-2 text-sm text-text-muted">
        CSV auswählen → Preview ausführen. Ergebnis (Status + Body) wird unten angezeigt.
      </p>

      <div className="mt-6 rounded-lg border border-base-800 bg-base-850 p-4">
        <label className="block text-xs uppercase text-text-muted">CSV Datei</label>
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-2 block w-full text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm hover:bg-base-900/70 disabled:opacity-60"
            disabled={!canRun}
            onClick={runPreview}
          >
            {loading ? "Preview läuft…" : "Preview starten"}
          </button>

          <button
            type="button"
            className="rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm hover:bg-base-900/70"
            onClick={() => {
              setFile(null);
              setRawStatus(null);
              setRawText("");
              setParsed(null);
            }}
            disabled={loading}
          >
            Reset
          </button>
        </div>

        <div className="mt-4 text-xs text-text-muted">
          Aktuelle Datei:{" "}
          <span className="text-text-primary">
            {file ? `${file.name} (${file.size} bytes)` : "—"}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-base-800 bg-base-850 p-4">
          <div className="text-xs uppercase text-text-muted">Response Status</div>
          <div className="mt-2 text-sm text-text-primary">
            {rawStatus === null ? "—" : String(rawStatus)}
          </div>

          <div className="mt-4 text-xs uppercase text-text-muted">Raw Body</div>
          <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md border border-base-800 bg-base-900 p-3 text-xs text-text-primary">
            {rawText || "—"}
          </pre>
        </div>

        <div className="rounded-lg border border-base-800 bg-base-850 p-4">
          <div className="text-xs uppercase text-text-muted">Parsed JSON</div>
          <pre className="mt-2 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-base-800 bg-base-900 p-3 text-xs text-text-primary">
            {parsed ? JSON.stringify(parsed, null, 2) : "—"}
          </pre>

          {parsed && (parsed as any).ok === true ? (
            <div className="mt-4 text-sm text-text-muted">
              Preview ok:{" "}
              <span className="text-text-primary">
                {(parsed as any).count ?? 0} Zeilen
              </span>{" "}
              / Header:{" "}
              <span className="text-text-primary">
                {Array.isArray((parsed as any).headers) ? (parsed as any).headers.length : 0}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
