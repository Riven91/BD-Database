"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browserClient";
import { AppShell } from "@/components/app-shell";
import { Button, Chip, Input, Textarea } from "@/components/ui";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { normalizePhone } from "@/lib/import-utils";

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
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLocationId, setEditLocationId] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
      setEditName(contactData?.name ?? "");
      setEditPhone(contactData?.phone_e164 ?? "");
      setEditLocationId(contactData?.location_id ?? "");
      const { data: templatesData } = await supabase
        .from("message_templates")
        .select("id, title, body")
        .eq("is_archived", false);
      setTemplates(templatesData ?? []);
    };
    load();
  }, [params.id]);

  useEffect(() => {
    const loadLocations = async () => {
      const response = await fetchWithAuth("/api/locations");
      if (!response.ok) return;
      const payload = await response.json();
      setLocations(payload.locations ?? []);
    };
    loadLocations();
  }, []);

  if (!contact) {
    return <div className="p-8 text-text-muted">Lade Kontakt...</div>;
  }

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

  const handleCancelEdit = () => {
    setEditName(contact?.name ?? "");
    setEditPhone(contact?.phone_e164 ?? "");
    setEditLocationId(contact?.location_id ?? "");
    setEditError(null);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    setEditError(null);
    const normalized = normalizePhone(editPhone);
    if (!normalized) {
      setEditError("Bitte eine gültige Telefonnummer eingeben.");
      return;
    }
    if (!editLocationId) {
      setEditError("Bitte einen Standort auswählen.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetchWithAuth(`/api/contacts/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim() || null,
          phone_e164: normalized,
          location_id: editLocationId
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setEditError(payload?.message ?? "Speichern fehlgeschlagen.");
        return;
      }
      const updated = payload?.contact;
      if (updated) {
        setContact((prev: any) => ({
          ...prev,
          ...updated,
          location: updated.location ?? prev?.location
        }));
      }
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell title={displayName} subtitle={contact.location?.name ?? "-"}>
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Kontakt</h2>
              {!isEditing ? (
                <Button
                  variant="outline"
                  className="h-8 px-3 text-sm"
                  onClick={() => setIsEditing(true)}
                >
                  Bearbeiten
                </Button>
              ) : null}
            </div>
            {isEditing ? (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-sm text-text-muted">Name</label>
                  <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-text-muted">Telefon</label>
                  <Input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-text-muted">Standort</label>
                  <select
                    className="mt-1 w-full rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
                    value={editLocationId}
                    onChange={(event) => setEditLocationId(event.target.value)}
                  >
                    <option value="">Standort wählen</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
                {editError ? (
                  <div className="text-sm text-red-400">{editError}</div>
                ) : null}
                <div className="flex gap-2">
                  <Button variant="primary" onClick={handleSaveEdit} disabled={isSaving}>
                    {isSaving ? "Speichern..." : "Speichern"}
                  </Button>
                  <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex flex-col">
                  <span className="text-text-muted">Name</span>
                  <span>{contact.name ?? "—"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-text-muted">Telefon</span>
                  <span>{contact.phone_e164 ?? "—"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-text-muted">Standort</span>
                  <span>{contact.location?.name ?? "-"}</span>
                </div>
              </div>
            )}
          </div>
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
        </section>
      </div>
    </AppShell>
  );
}
