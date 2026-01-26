"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/browserClient";
import { AppShell } from "@/components/app-shell";
import { Button, Input, Textarea } from "@/components/ui";

export default function TemplatesPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [templates, setTemplates] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const loadTemplates = async () => {
    const { data } = await supabase
      .from("message_templates")
      .select("id, title, body, is_archived")
      .order("title");
    setTemplates(data ?? []);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) return;
    await supabase.from("message_templates").insert({
      title: title.trim(),
      body: body.trim()
    });
    setTitle("");
    setBody("");
    loadTemplates();
  };

  const toggleArchive = async (templateId: string, nextState: boolean) => {
    await supabase
      .from("message_templates")
      .update({ is_archived: nextState })
      .eq("id", templateId);
    loadTemplates();
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
        <Button variant="primary" onClick={handleCreate}>
          Template anlegen
        </Button>
      </section>

      <div className="space-y-2">
        {templates.map((template) => (
          <div
            key={template.id}
            className="rounded-md border border-base-800 bg-base-850 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{template.title}</h3>
                <p className="text-sm text-text-muted whitespace-pre-line">
                  {template.body}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => toggleArchive(template.id, !template.is_archived)}
              >
                {template.is_archived ? "Reaktivieren" : "Archivieren"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
