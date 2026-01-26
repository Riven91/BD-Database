"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Input, Textarea } from "@/components/ui";

type Template = {
  id: string;
  title: string;
  body: string;
  is_archived: boolean;
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadTemplates = async () => {
    const response = await fetch("/api/templates");
    if (!response.ok) return;
    const payload = await response.json();
    setTemplates(payload.templates ?? []);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return;
    if (editingId) {
      await fetch(`/api/templates/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() })
      });
    } else {
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() })
      });
    }
    setTitle("");
    setBody("");
    setEditingId(null);
    loadTemplates();
  };

  const toggleArchive = async (templateId: string, nextState: boolean) => {
    await fetch(`/api/templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_archived: nextState })
    });
    loadTemplates();
  };

  const handleDelete = async (templateId: string) => {
    await fetch(`/api/templates/${templateId}`, { method: "DELETE" });
    if (editingId === templateId) {
      setEditingId(null);
      setTitle("");
      setBody("");
    }
    loadTemplates();
  };

  const handleSelect = (template: Template) => {
    setEditingId(template.id);
    setTitle(template.title);
    setBody(template.body);
  };

  return (
    <AppShell title="Templates" subtitle="Copy/Paste Vorlagen">
      <section className="mb-6 space-y-3 rounded-lg border border-base-800 bg-base-850 p-4">
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <Input
          placeholder="Titel"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Textarea
          placeholder="Template Text"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={handleSubmit}>
            {editingId ? "Template speichern" : "Template anlegen"}
          </Button>
          {editingId ? (
            <Button
              variant="secondary"
              onClick={() => {
                setEditingId(null);
                setTitle("");
                setBody("");
              }}
            >
              Abbrechen
            </Button>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Vorhandene Templates</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-text-muted">
              <tr>
                <th className="px-3 py-2">Titel</th>
                <th className="px-3 py-2">Vorschau</th>
                <th className="px-3 py-2">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr
                  key={template.id}
                  className="border-b border-base-800/60 align-top"
                >
                  <td className="px-3 py-2 font-medium">{template.title}</td>
                  <td className="px-3 py-2 text-text-muted">
                    {template.body.slice(0, 120)}
                    {template.body.length > 120 ? "…" : ""}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => handleSelect(template)}>
                        Bearbeiten
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => toggleArchive(template.id, !template.is_archived)}
                      >
                        {template.is_archived ? "Reaktivieren" : "Archivieren"}
                      </Button>
                      <Button variant="outline" onClick={() => handleDelete(template.id)}>
                        Löschen
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-text-muted">
                    Noch keine Templates gespeichert.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
