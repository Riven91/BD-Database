"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/browserClient";
import { AppShell } from "@/components/app-shell";
import { Button, Input } from "@/components/ui";

type Label = {
  id: string;
  name: string;
  sort_order: number;
  is_archived: boolean;
};

export default function LabelsPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [labels, setLabels] = useState<Label[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("1000");
  const [isAdmin, setIsAdmin] = useState(false);

  const loadLabels = async () => {
    const response = await fetch("/api/labels?includeArchived=true");
    if (!response.ok) return;
    const payload = await response.json();
    setLabels(payload.labels ?? []);
  };

  const loadProfile = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    setIsAdmin(data?.role === "admin");
  };

  useEffect(() => {
    loadLabels();
    loadProfile();
  }, []);

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    const sortOrder = Number.isNaN(Number(newSortOrder)) ? 1000 : Number(newSortOrder);
    await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newLabel.trim(), sort_order: sortOrder })
    });
    setNewLabel("");
    setNewSortOrder("1000");
    loadLabels();
  };

  const updateLabel = async (labelId: string, updates: Partial<Label>) => {
    await fetch(`/api/labels/${labelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    loadLabels();
  };

  return (
    <AppShell title="Labels" subtitle="Admin Verwaltung">
      {isAdmin ? (
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
      ) : (
        <p className="mb-6 text-sm text-text-muted">
          Nur Admins können Labels verwalten. Du kannst Labels im Dashboard zuweisen.
        </p>
      )}

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
              disabled={!isAdmin}
              className="max-w-xs"
            />
            <Input
              value={String(label.sort_order)}
              onChange={(event) =>
                setLabels((prev) =>
                  prev.map((item) =>
                    item.id === label.id
                      ? { ...item, sort_order: Number(event.target.value) }
                      : item
                  )
                )
              }
              type="number"
              disabled={!isAdmin}
              className="w-32"
            />
            {isAdmin ? (
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
            ) : null}
            {isAdmin ? (
              <Button
                variant="outline"
                onClick={() => updateLabel(label.id, { is_archived: !label.is_archived })}
              >
                {label.is_archived ? "Reaktivieren" : "Archivieren"}
              </Button>
            ) : (
              <span className="text-xs text-text-muted">
                {label.is_archived ? "Archiviert" : "Aktiv"}
              </span>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
