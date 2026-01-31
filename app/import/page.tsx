"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { mapRow, type CsvRow, type NormalizedContact } from "@/lib/import-utils";
import { getPlainSupabaseBrowser } from "@/lib/supabase/plainBrowserClient";

type PreviewStats = {
  newCount: number;
  updateCount: number;
  errors: { row: number; field: string; message: string }[];
};

type PreviewRow = {
  rowNumber: number;
  name: string;
  phone: string;
  location: string;
  labels: string;
  isValid: boolean;
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function ImportPage() {
  const router = useRouter();
  const [previewContacts, setPreviewContacts] = useState<NormalizedContact[]>([]);
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    errors: { row?: number; phone?: string; message: string }[];
  } | null>(null);
  const [importResultText, setImportResultText] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setPreviewStats(null);
    setPreviewContacts([]);
    setPreviewRows([]);
    setImportResult(null);
    setImportResultText(null);
    setErrorMessage("");

    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const data = isCsv ? await file.text() : await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: isCsv ? "string" : "array" });
    const sheetName = workbook.SheetNames[0];
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
    const rows = rawRows.map(normalizeRow) as CsvRow[];

    const issues: PreviewStats["errors"] = [];
    const contacts: NormalizedContact[] = [];
    const preview: PreviewRow[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const { contact, issues: rowIssues } = mapRow(row, rowNumber);
      if (rowIssues.length) issues.push(...rowIssues);
      if (contact) contacts.push(contact);
      preview.push({
        rowNumber,
        name: [row["Vorname"], row["Nachname"]].filter(Boolean).join(" ").trim(),
        phone: row["Telefon"] ?? "",
        location: row["Standort"] ?? "",
        labels: row["Labels"] ?? "",
        isValid: Boolean(contact)
      });
    });

    const phones = contacts.map((contact) => contact.phone_e164);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const supabase = getPlainSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("not_authenticated");
      const response = await fetch("/api/import/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` }
      });
      const existing = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(existing));
      }
      const existingSet = new Set(existing.existing ?? []);

      const newCount = phones.filter((phone) => !existingSet.has(phone)).length;
      const updateCount = phones.filter((phone) => existingSet.has(phone)).length;

      setPreviewContacts(contacts);
      setPreviewStats({ newCount, updateCount, errors: issues });
      setPreviewRows(preview.slice(0, 50));
    } catch (error) {
      console.error("Import preview failed", error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const handleConfirm = async () => {
    setIsImporting(true);
    setErrorMessage("");
    setImportResult(null);
    setImportResultText(null);
    try {
      console.log("CONFIRM:start", { count: previewContacts?.length });
      const supabase = getPlainSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("not_authenticated");
      const batches = chunk(previewContacts, 200);
      const totals = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [] as { row?: number; phone?: string; message: string }[]
      };
      for (let i = 0; i < batches.length; i += 1) {
        const batch = batches[i];
        console.log(`CONFIRM:batch ${i + 1}/${batches.length}`, { count: batch.length });
        const total = batches.length;
        console.log("CONFIRM:before fetch", {
          batch: i + 1,
          total,
          count: batch.length
        });
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 55000);
        try {
          const res = await fetch("/api/import/confirm", {
            method: "POST",
            body: JSON.stringify({ contacts: batch }),
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            signal: controller.signal
          });
          console.log("CONFIRM:after fetch", { batch: i + 1, status: res.status });
          const data = await res.json().catch(() => null);
          console.log("CONFIRM:after json", { batch: i + 1, data });
          if (!res.ok) {
            throw new Error(JSON.stringify({ status: res.status, data }));
          }
          totals.created += data?.created ?? 0;
          totals.updated += data?.updated ?? 0;
          totals.skipped += data?.skipped ?? 0;
          totals.errors = totals.errors.concat(data?.errors ?? []);
          setImportResult({ ...totals });
          setImportResultText(`Batch ${i + 1}/${batches.length} abgeschlossen`);
        } finally {
          clearTimeout(t);
        }
      }
      setImportResult({ ...totals });
      setImportResultText("Import abgeschlossen");
      router.refresh();
    } catch (error) {
      console.error("Import confirm failed", error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setImportResultText(
        `Import bestätigen fehlgeschlagen\n${JSON.stringify(error, null, 2)}`
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AppShell title="Import" subtitle="XLSX/CSV Upload mit Preview">
      <section className="rounded-lg border border-base-800 bg-base-850 p-4">
        <input
          type="file"
          multiple={false}
          accept=".csv,.xlsx,.xls"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </section>
      {errorMessage ? (
        <div className="mt-4 rounded-md border border-red-500/60 bg-red-500/10 p-3 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {previewStats ? (
        <section className="mt-6 space-y-4 rounded-lg border border-base-800 bg-base-850 p-4">
          <h2 className="text-lg font-semibold">Preview</h2>
          <div className="grid gap-2 text-sm">
            <div>Neue Kontakte: {previewStats.newCount}</div>
            <div>Updates: {previewStats.updateCount}</div>
            <div>Fehler: {previewStats.errors.length}</div>
          </div>
          {previewStats.errors.length ? (
            <ul className="text-sm text-red-400">
              {previewStats.errors.slice(0, 10).map((issue) => (
                <li key={`${issue.row}-${issue.field}`}>
                  Zeile {issue.row}: {issue.field} - {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-3 py-2">Zeile</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Telefon</th>
                  <th className="px-3 py-2">Standort</th>
                  <th className="px-3 py-2">Labels</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={row.isValid ? "" : "text-red-400"}
                  >
                    <td className="px-3 py-2">{row.rowNumber}</td>
                    <td className="px-3 py-2">{row.name || "-"}</td>
                    <td className="px-3 py-2">{row.phone || "-"}</td>
                    <td className="px-3 py-2">{row.location || "-"}</td>
                    <td className="px-3 py-2">{row.labels || "-"}</td>
                    <td className="px-3 py-2">
                      {row.isValid ? "OK" : "Ungültige Nummer"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={isImporting || previewContacts.length === 0}
          >
            {isImporting ? "Import läuft..." : "Import bestätigen"}
          </Button>
          {importResult ? (
            <div className="rounded-md border border-base-800 bg-base-900/60 p-3 text-sm">
              <div>
                Import fertig: {importResult.created} neu, {importResult.updated}{" "}
                aktualisiert, {importResult.skipped} übersprungen
              </div>
              {importResult.errors?.length ? (
                <ul className="mt-2 text-red-400">
                  {importResult.errors.slice(0, 10).map((issue, index) => (
                    <li key={`${issue.row ?? issue.phone ?? "row"}-${index}`}>
                      {issue.row ? `Zeile ${issue.row}: ` : ""}
                      {issue.phone ? `${issue.phone} - ` : ""}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {importResultText ? (
            <div className="rounded-md border border-base-800 bg-base-900/60 p-3 text-sm">
              <div className="text-text-muted">Import Antwort</div>
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-red-200">
                {importResultText}
              </pre>
            </div>
          ) : null}
        </section>
      ) : null}
    </AppShell>
  );
}
