"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Input, Textarea } from "@/components/ui";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

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
  const [errorMessage, setErrorMessage] = useState("");

  const loadTemplates = async () => {
    const response = await fetchWithAuth("/api/templates");
    const text = await response.text();
    if (!response.ok) {
      console.error(`Templates load failed (HTTP ${response.status})`, text);
      setErrorMessage(`HTTP ${response.status}: ${text}`);
      return;
    }
    const payload = text ? JSON.parse(text) : {};
    setTemplates(payload.templates ?? []);
    setErrorMessage("");
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return;
    let response: Response;
    if (editingId) {
      response = await fetchWithAuth(`/api/templates/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() })
      });
    } else {
      response = await fetchWithAuth("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() })
      });
    }
    const text = await response.text();
    if (!response.ok) {
      console.error(`Template save failed (HTTP ${response.status})`, text);
      setErrorMessage(`HTTP ${response.status}: ${text}`);
      return;
    }
    setTitle("");
    setBody("");
    setEditingId(null);
    setErrorMessage("");
    loadTemplates();
  };

  const toggleArchive = async (templateId: string, nextState: boolean) => {
    const response = await fetchWithAuth(`/api/templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_archived: nextState })
    });
    const text = await response.text();
    if (!response.ok) {
      console.error(`Template update failed (HTTP ${response.status})`, text);
      setErrorMessage(`HTTP ${response.status}: ${text}`);
      return;
    }
    setErrorMessage("");
    loadTemplates();
  };

  const handleDelete = async (templateId: string) => {
    const response = await fetchWithAuth(`/api/templates/${templateId}`, {
      method: "DELETE"
    });
    const text = await response.text();
    if (!response.ok) {
      console.error(`Template delete failed (HTTP ${response.status})`, text);
      setErrorMessage(`HTTP ${response.status}: ${text}`);
      return;
    }
    if (editingId === templateId) {
      setEditingId(null);
      setTitle("");
      setBody("");
    }
    setErrorMessage("");
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
        {errorMessage ? (
          <div className="rounded-md border border-red-500/60 bg-red-500/10 p-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}
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
