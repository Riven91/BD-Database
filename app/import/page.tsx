"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";
import { mapRow, type CsvRow, type NormalizedContact } from "@/lib/import-utils";

type PreviewStats = {
  newCount: number;
  updateCount: number;
  errors: { row: number; field: string; message: string }[];
};

type PreviewRow = {
  rowNumber: number;
  name: string;
  phone: string;
  phoneE164: string;
  location: string;
  labels: string;
  isValid: boolean;
};

export default function ImportPage() {
  const router = useRouter();
  const [previewContacts, setPreviewContacts] = useState<NormalizedContact[]>([]);
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    errorCount: number;
    topErrors: {
      rowIndex?: number;
      reason: string;
      phoneRaw?: string | null;
      phoneE164?: string;
      location?: string | null;
      details?: string;
    }[];
  } | null>(null);

  const handleFile = async (file: File) => {
    setPreviewStats(null);
    setPreviewContacts([]);
    setPreviewRows([]);
    setImportResult(null);

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
        phoneE164: contact?.phone_e164 ?? "",
        location: row["Standort"] ?? "",
        labels: row["Labels"] ?? "",
        isValid: Boolean(contact)
      });
    });

    const phones = contacts.map((contact) => contact.phone_e164);
    const response = await fetch("/api/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phones })
    });
    const existing = response.ok ? await response.json() : { existing: [] };
    const existingSet = new Set(existing.existing ?? []);

    const newCount = phones.filter((phone) => !existingSet.has(phone)).length;
    const updateCount = phones.filter((phone) => existingSet.has(phone)).length;

    setPreviewContacts(contacts);
    setPreviewStats({ newCount, updateCount, errors: issues });
    setPreviewRows(preview.slice(0, 50));
  };

  const handleConfirm = async () => {
    setIsImporting(true);
    const response = await fetch("/api/import/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: previewContacts })
    });
    if (response.ok) {
      const payload = await response.json();
      setImportResult(payload);
      router.refresh();
    } else {
      setImportResult({
        created: 0,
        updated: 0,
        skipped: previewContacts.length,
        errorCount: 1,
        topErrors: [{ reason: "Import fehlgeschlagen" }]
      });
    }
    setIsImporting(false);
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
              {importResult.errorCount ? (
                <ul className="mt-2 text-red-400">
                  {importResult.topErrors.map((issue, index) => (
                    <li
                      key={`${issue.rowIndex ?? issue.phoneE164 ?? "row"}-${index}`}
                    >
                      {issue.rowIndex ? `Zeile ${issue.rowIndex}: ` : ""}
                      {issue.reason}
                      {issue.phoneRaw ? ` | raw: ${issue.phoneRaw}` : ""}
                      {issue.phoneE164 ? ` | e164: ${issue.phoneE164}` : ""}
                      {issue.location ? ` | Standort: ${issue.location}` : ""}
                      {issue.details ? ` | ${issue.details}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="rounded-md border border-base-800 bg-base-900/60 p-3 text-sm">
            <div className="mb-2 font-semibold">Telefon-Check (erste 20 Zeilen)</div>
            <ul className="space-y-1 text-xs text-text-muted">
              {previewRows.slice(0, 20).map((row) => (
                <li key={`phone-${row.rowNumber}`}>
                  Zeile {row.rowNumber}: {row.phone || "-"} →{" "}
                  {row.phoneE164 || "ungültig"}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
