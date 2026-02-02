"use client";

import { useEffect, useRef, useState } from "react";
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
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTemplates = async () => {
    const response = await fetchWithAuth("/api/templates");
    if (!response.ok) return;
    const payload = await response.json();
    setTemplates(payload.templates ?? []);
  };

  useEffect(() => {
    loadTemplates();
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
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
    if (!response.ok) {
      const text = await response.text();
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
    if (!response.ok) {
      const text = await response.text();
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
    if (!response.ok) {
      const text = await response.text();
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

  const handleCopy = async (template: Template) => {
    try {
      await navigator.clipboard.writeText(template.body);
      setCopiedTemplateId(template.id);
      setErrorMessage("");
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedTemplateId(null);
      }, 1500);
    } catch (error) {
      console.error("Template copy failed", error);
      setErrorMessage("Copy fehlgeschlagen. Bitte erneut versuchen.");
    }
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
        <div className="space-y-3">
          {templates.map((template) => {
            const isExpanded = expandedTemplateId === template.id;
            const isCopied = copiedTemplateId === template.id;
            return (
              <div
                key={template.id}
                className="rounded-lg border border-base-800 bg-base-850 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-base font-semibold">{template.title}</div>
                    {template.is_archived ? (
                      <div className="mt-1 text-xs text-text-muted">Archiviert</div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="min-h-[40px]"
                      onClick={() =>
                        setExpandedTemplateId((current) =>
                          current === template.id ? null : template.id
                        )
                      }
                    >
                      <span className="mr-1 text-base" aria-hidden="true">
                        {isExpanded ? "▴" : "▾"}
                      </span>
                      {isExpanded ? "Zuklappen" : "Aufklappen"}
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-[40px]"
                      onClick={() => handleCopy(template)}
                    >
                      {isCopied ? "Copied" : "Copy"}
                    </Button>
                    <Button
                      variant="secondary"
                      className="min-h-[40px]"
                      onClick={() => handleSelect(template)}
                    >
                      Bearbeiten
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-[40px]"
                      onClick={() => toggleArchive(template.id, !template.is_archived)}
                    >
                      {template.is_archived ? "Reaktivieren" : "Archivieren"}
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-[40px]"
                      onClick={() => handleDelete(template.id)}
                    >
                      Löschen
                    </Button>
                  </div>
                </div>
                {isExpanded ? (
                  <div className="mt-3 rounded-md border border-base-800 bg-base-900/60 p-3 text-sm text-text-muted whitespace-pre-wrap">
                    {template.body}
                  </div>
                ) : null}
              </div>
            );
          })}
          {templates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-base-800 p-6 text-center text-text-muted">
              Noch keine Templates gespeichert.
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
