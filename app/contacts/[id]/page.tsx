"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browserClient";
import { AppShell } from "@/components/app-shell";
import { Button, Chip, Input, Textarea } from "@/components/ui";

function getContactDisplayName(contact: {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone_e164?: string | null;
}) {
  const combinedName = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return (
    contact.name ??
    (combinedName.length > 0 ? combinedName : null) ??
    contact.phone_e164 ??
    "—"
  );
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const [contact, setContact] = useState<any | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLocationId, setFormLocationId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const supabase = supabaseBrowser();
      const { data } = await supabase
        .from("contacts")
        .select(
          "*, location:locations(name), labels:contact_labels(labels(id,name)), tasks:tasks(*)"
        )
        .eq("id", params.id)
        .single();
      const contactData = data as any;
      setContact(contactData);
      setNotes(contactData?.notes ?? "");
      setFormName(contactData?.name ?? "");
      setFormPhone(contactData?.phone_e164 ?? "");
      setFormLocationId(contactData?.location_id ?? "");
      const { data: templatesData } = await supabase
        .from("message_templates")
        .select("id, title, body")
        .eq("is_archived", false);
      setTemplates(templatesData ?? []);
      const { data: locationsData } = await supabase
        .from("locations")
        .select("id, name")
        .order("name");
      setLocations(locationsData ?? []);
    };
    load();
  }, [params.id]);

  if (!contact) {
    return <div className="p-8 text-text-muted">Lade Kontakt...</div>;
  }

  const handleCancel = () => {
    setIsEditing(false);
    setFormName(contact?.name ?? "");
    setFormPhone(contact?.phone_e164 ?? "");
    setFormLocationId(contact?.location_id ?? "");
    setNotes(contact?.notes ?? "");
    setErrorMsg("");
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg("");

    const response = await fetch(`/api/contacts/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName,
        phone_e164: formPhone,
        location_id: formLocationId || null,
        notes
      })
    });

    if (response.ok) {
      const nextLocation =
        locations.find((location) => location.id === (formLocationId || null)) ?? null;
      setContact({
        ...contact,
        name: formName,
        phone_e164: formPhone,
        location_id: formLocationId || null,
        notes,
        location: nextLocation ? { name: nextLocation.name } : null
      });
      setIsEditing(false);
      setSaving(false);
      return;
    }

    if (response.status === 409) {
      setErrorMsg("Diese Telefonnummer existiert bereits.");
    } else {
      setErrorMsg("Kontakt konnte nicht gespeichert werden.");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Kontakt wirklich löschen?\n\nDie Daten werden DSGVO-konform vollständig entfernt und können nicht wiederhergestellt werden."
    );
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/contacts/${params.id}`, { method: "DELETE" });
    if (response.ok) {
      window.location.href = "/contacts";
      return;
    }

    alert("Kontakt konnte nicht gelöscht werden");
    setErrorMsg("Kontakt konnte nicht gelöscht werden.");
  };

  const labels = (contact.labels || [])
    .map((item: any) => item.labels)
    .filter(Boolean);

  const selectedTemplateBody =
    templates.find((template) => template.id === selectedTemplate)?.body ?? "";
  const personalizedTemplate = selectedTemplateBody
    .replaceAll("{vorname}", contact.first_name ?? "")
    .replaceAll("{standort}", contact.location?.name ?? "")
    .replaceAll("{telefon}", contact.phone_e164 ?? "");
  const displayName = getContactDisplayName(contact);

  return (
    <AppShell title={displayName} subtitle={contact.location?.name ?? "-"}>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 rounded-lg border border-base-800 bg-base-850 p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Details</h2>
            <div className="flex flex-wrap gap-2">
              {isEditing ? (
                <>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    Speichern
                  </Button>
                  <Button variant="outline" onClick={handleCancel} disabled={saving}>
                    Abbrechen
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Bearbeiten
                </Button>
              )}
            </div>
          </div>
          {errorMsg ? (
            <p className="text-sm text-red-400">{errorMsg}</p>
          ) : null}
          {isEditing ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                placeholder="Name"
              />
              <Input
                value={formPhone}
                onChange={(event) => setFormPhone(event.target.value)}
                placeholder="Telefon"
              />
              <select
                className="w-full rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
                value={formLocationId}
                onChange={(event) => setFormLocationId(event.target.value)}
              >
                <option value="">Standort wählen</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
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
            <h2 className="text-lg font-semibold">Labels</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {labels.length ? (
                labels.map((label: { id: string; name: string }) => (
                  <Chip key={label.id} label={label.name} />
                ))
              ) : (
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
          <Button
            variant="outline"
            className="border-red-500 text-red-400 hover:bg-red-900/20"
            onClick={handleDelete}
          >
            Kontakt löschen
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
