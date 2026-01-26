"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui";
import { mapRow, type CsvRow, type NormalizedContact } from "@/lib/import-utils";

type PreviewStats = {
  newCount: number;
  updateCount: number;
  errors: { row: number; field: string; message: string }[];
};

export default function ImportPage() {
  const [previewContacts, setPreviewContacts] = useState<NormalizedContact[]>([]);
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFile = async (file: File) => {
    setPreviewStats(null);
    setPreviewContacts([]);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const issues: PreviewStats["errors"] = [];
        const contacts: NormalizedContact[] = [];
        results.data.forEach((row, index) => {
          const { contact, issues: rowIssues } = mapRow(row, index + 2);
          if (rowIssues.length) issues.push(...rowIssues);
          if (contact) contacts.push(contact);
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
      }
    });
  };

  const handleConfirm = async () => {
    setIsImporting(true);
    await fetch("/api/import/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: previewContacts })
    });
    setIsImporting(false);
  };

  return (
    <div className="min-h-screen px-8 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">CSV Import</h1>
        <p className="text-sm text-text-muted">
          Upload die deduplizierte Datei für den Standortimport.
        </p>
      </header>

      <section className="rounded-lg border border-base-800 bg-base-850 p-4">
        <input
          type="file"
          accept=".csv"
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
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={isImporting || previewStats.errors.length > 0}
          >
            {isImporting ? "Import läuft..." : "Import bestätigen"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
