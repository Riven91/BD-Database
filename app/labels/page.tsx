"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Input } from "@/components/ui";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

type Label = {
  id: string;
  name: string;
  sort_order: number;
  is_archived: boolean;
};

export default function LabelsPage() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadLabels = async () => {
    const response = await fetchWithAuth("/api/labels?includeArchived=true");
    const text = await response.text();
    if (!response.ok) {
      console.error(`Labels load failed (HTTP ${response.status})`, text);
      setErrorMessage(`HTTP ${response.status}: ${text}`);
      return;
    }
    const payload = text ? JSON.parse(text) : {};
    setLabels(payload.labels ?? []);
    setErrorMessage("");
  };

  useEffect(() => {
    loadLabels();
  }, []);

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    const response = await fetchWithAuth("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newLabel.trim() })
    });
    const text = await response.text();
    if (!response.ok) {
      console.error(`Label creation failed (HTTP ${response.status})`, text);
      setErrorMessage(`HTTP ${response.status}: ${text}`);
      return;
    }
    setNewLabel("");
    setErrorMessage("");
    loadLabels();
  };

  const updateLabel = async (labelId: string, updates: Partial<Label>) => {
    const response = await fetchWithAuth(`/api/labels/${labelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    const text = await response.text();
    if (!response.ok) {
      console.error(`Label update failed (HTTP ${response.status})`, text);
      setErrorMessage(`HTTP ${response.status}: ${text}`);
      return;
    }
    setErrorMessage("");
    loadLabels();
  };

  return (
    <AppShell title="Labels" subtitle="Labelverwaltung">
      <div className="mb-6 flex flex-wrap gap-2">
        <Input
          placeholder="Neues Label"
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
        />
        <Button variant="primary" onClick={handleCreate}>
          Anlegen
        </Button>
      </div>
      {errorMessage ? (
        <div className="mb-4 rounded-md border border-red-500/60 bg-red-500/10 p-3 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="space-y-2">
        {labels.map((label) => (
          <div
            key={label.id}
            className="flex flex-wrap items-center gap-3 rounded-md border border-base-800 bg-base-850 px-4 py-3"
          >
            <Input
              value={label.name}
              onChange={(event) =>
                setLabels((prev) =>
                  prev.map((item) =>
                    item.id === label.id
                      ? { ...item, name: event.target.value }
                      : item
                  )
                )
              }
              className="max-w-xs"
            />
            <Button
              variant="outline"
              onClick={() =>
                updateLabel(label.id, {
                  name: label.name.trim()
                })
              }
            >
              Speichern
            </Button>
            <Button
              variant="outline"
              onClick={() => updateLabel(label.id, { is_archived: !label.is_archived })}
            >
              {label.is_archived ? "Reaktivieren" : "Archivieren"}
            </Button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
