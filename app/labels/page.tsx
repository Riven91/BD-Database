"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/client";
import { Button, Input } from "@/components/ui";

export default function LabelsPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [labels, setLabels] = useState<any[]>([]);
  const [newLabel, setNewLabel] = useState("");

  const loadLabels = async () => {
    const { data } = await supabase
      .from("labels")
      .select("id, name, is_archived")
      .order("name");
    setLabels(data ?? []);
  };

  useEffect(() => {
    loadLabels();
  }, []);

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    await supabase.from("labels").insert({ name: newLabel.trim() });
    setNewLabel("");
    loadLabels();
  };

  const toggleArchive = async (labelId: string, nextState: boolean) => {
    await supabase
      .from("labels")
      .update({ is_archived: nextState })
      .eq("id", labelId);
    loadLabels();
  };

  return (
    <div className="min-h-screen px-8 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Labels</h1>
          <p className="text-sm text-text-muted">Admin Verwaltung</p>
        </div>
      </header>

      <div className="mb-6 flex gap-2">
        <Input
          placeholder="Neues Label"
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
        />
        <Button variant="primary" onClick={handleCreate}>
          Anlegen
        </Button>
      </div>

      <div className="space-y-2">
        {labels.map((label) => (
          <div
            key={label.id}
            className="flex items-center justify-between rounded-md border border-base-800 bg-base-850 px-4 py-3"
          >
            <span>{label.name}</span>
            <Button
              variant="outline"
              onClick={() => toggleArchive(label.id, !label.is_archived)}
            >
              {label.is_archived ? "Reaktivieren" : "Archivieren"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
