"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Input } from "@/components/ui";

type Label = {
  id: string;
  name: string;
  is_archived: boolean;
};

export default function LabelsPage() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("1000");

  const loadLabels = async () => {
    setError(null);
    const response = await fetch("/api/labels?includeArchived=true");
    if (!response.ok) {
      setError("Labels konnten nicht geladen werden.");
      return;
    }
    const payload = await response.json();
    setLabels(payload.labels ?? []);
  };

  useEffect(() => {
    loadLabels();
  }, []);

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    setError(null);
    const response = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newLabel.trim() })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Label konnte nicht angelegt werden." }));
      setError(payload.error ?? "Label konnte nicht angelegt werden.");
      return;
    }
    setNewLabel("");
    loadLabels();
  };

  const updateLabel = async (labelId: string, updates: Partial<Label>) => {
    setError(null);
    const response = await fetch(`/api/labels/${labelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Label konnte nicht gespeichert werden." }));
      setError(payload.error ?? "Label konnte nicht gespeichert werden.");
      return;
    }
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
        <Input
          placeholder="Sortierung"
          value={newSortOrder}
          onChange={(event) => setNewSortOrder(event.target.value)}
          type="number"
        />
        <Button variant="primary" onClick={handleCreate}>
          Anlegen
        </Button>
      </div>

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
                  name: label.name.trim(),
                  is_archived: label.is_archived
                })
              }
              type="number"
              className="w-32"
            />
            <Button
              variant="outline"
              onClick={() =>
                updateLabel(label.id, {
                  name: label.name.trim(),
                  sort_order: label.sort_order,
                  is_archived: label.is_archived
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
        {labels.length === 0 ? (
          <p className="text-sm text-text-muted">Noch keine Labels vorhanden.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
