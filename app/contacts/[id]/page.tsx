"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browserClient";
import { Button, Chip, Input, Textarea } from "@/components/ui";
import { computeSystemLabels } from "@/lib/import-utils";

export default function ContactDetailPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const params = useParams<{ id: string }>();
  const [contact, setContact] = useState<any | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("contacts")
        .select(
          "*, location:locations(name), labels:contact_labels(labels(name)), tasks:tasks(*)"
        )
        .eq("id", params.id)
        .single();
      setContact(data);
      setNotes(data?.notes ?? "");
      const { data: templatesData } = await supabase
        .from("message_templates")
        .select("id, title, body")
        .eq("is_archived", false);
      setTemplates(templatesData ?? []);
    };
    load();
  }, [params.id]);

  if (!contact) {
    return <div className="p-8 text-text-muted">Lade Kontakt...</div>;
  }

  const labels = (contact.labels || []).map((item: any) => item.labels?.name).filter(Boolean);
  const hasDueTask = (contact.tasks || []).some(
    (task: any) => task.status === "offen" && new Date(task.due_at) <= new Date()
  );
  const systemLabels = computeSystemLabels({
    date_erstgespraech: contact.date_erstgespraech,
    date_tattoo_termin: contact.date_tattoo_termin,
    price_deposit_cents: contact.price_deposit_cents,
    price_total_cents: contact.price_total_cents,
    has_due_task: hasDueTask,
    last_activity_at: contact.last_received_at || contact.last_sent_at || contact.updated_at
  });

  const selectedTemplateBody =
    templates.find((template) => template.id === selectedTemplate)?.body ?? "";
  const personalizedTemplate = selectedTemplateBody
    .replaceAll("{vorname}", contact.first_name ?? "")
    .replaceAll("{standort}", contact.location?.name ?? "")
    .replaceAll("{telefon}", contact.phone_e164 ?? "");

  return (
    <div className="min-h-screen px-8 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{contact.full_name || "Kontakt"}</h1>
          <p className="text-sm text-text-muted">{contact.location?.name ?? "-"}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(contact.phone_e164)}
          >
            Nummer kopieren
          </Button>
          {contact.email ? (
            <Button
              variant="outline"
              onClick={() => navigator.clipboard.writeText(contact.email)}
            >
              E-Mail kopieren
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 rounded-lg border border-base-800 bg-base-850 p-4 lg:col-span-2">
          <h2 className="text-lg font-semibold">Details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Input value={contact.date_erstgespraech ?? ""} readOnly />
            <Input value={contact.date_tattoo_termin ?? ""} readOnly />
            <Input value={contact.artist_booking ?? ""} readOnly />
            <Input value={contact.form_size ?? ""} readOnly />
            <Input value={contact.source_origin ?? ""} readOnly />
            <Input value={contact.price_deposit_cents ?? ""} readOnly />
            <Input value={contact.price_total_cents ?? ""} readOnly />
            <Input value={contact.last_sent_at ?? ""} readOnly />
            <Input value={contact.last_received_at ?? ""} readOnly />
          </div>
          <div>
            <label className="text-sm text-text-muted">Notizen</label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-base-800 bg-base-850 p-4">
          <div>
            <h2 className="text-lg font-semibold">Systemlabels</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {systemLabels.map((label) => (
                <Chip key={label} label={label} selected />
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Freie Labels</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {labels.length ? labels.map((label: string) => <Chip key={label} label={label} />) : (
                <span className="text-sm text-text-muted">Keine Labels</span>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Template kopieren</h2>
            <select
              className="mt-2 w-full rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
              value={selectedTemplate}
              onChange={(event) => setSelectedTemplate(event.target.value)}
            >
              <option value="">Template wählen</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              className="mt-3 w-full"
              onClick={() => navigator.clipboard.writeText(personalizedTemplate)}
              disabled={!selectedTemplate}
            >
              Text kopieren
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
