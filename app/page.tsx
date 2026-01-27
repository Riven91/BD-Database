"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Chip, Input } from "@/components/ui";

const statusOptions = [
  { value: "neu", label: "Neu" },
  { value: "in_bearbeitung", label: "In Bearbeitung" },
  { value: "tattoo_termin", label: "Tattoo-Termin" },
  { value: "abgeschlossen", label: "Abgeschlossen" },
  { value: "tot", label: "Tot" }
];

type Label = {
  id: string;
  name: string;
  is_archived: boolean;
};

type Contact = {
  id: string;
  full_name: string | null;
  phone_e164: string;
  status: string;
  location: { name: string } | null;
  labels: { id: string; name: string }[];
};

function sortLabels(labels: Label[]) {
  return [...labels].sort((a, b) => {
    return a.name.localeCompare(b.name);
  });
}

export default function DashboardPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [labelFilters, setLabelFilters] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [labelSearch, setLabelSearch] = useState("");
  const [labelSelections, setLabelSelections] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [healthResult, setHealthResult] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    const [contactsResponse, labelsResponse] = await Promise.all([
      fetch("/api/contacts"),
      fetch("/api/labels")
    ]);
    if (contactsResponse.ok) {
      const payload = await contactsResponse.json();
      setContacts(payload.contacts ?? []);
    }
    if (labelsResponse.ok) {
      const payload = await labelsResponse.json();
      setLabels(payload.labels ?? []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const runHealthCheck = async () => {
    setHealthError(null);
    setHealthResult(null);
    const response = await fetch("/api/health");
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setHealthError(payload?.error ?? "Health check fehlgeschlagen.");
      setHealthResult(payload ? JSON.stringify(payload, null, 2) : null);
      return;
    }
    setHealthResult(JSON.stringify(payload, null, 2));
  };

  useEffect(() => {
    setLabelSearch("");
  }, [expandedId]);

  const locations = useMemo(() => {
    const unique = new Set<string>();
    contacts.forEach((contact) => {
      if (contact.location?.name) unique.add(contact.location.name);
    });
    return Array.from(unique).sort();
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesQuery = query
        ? [contact.full_name, contact.phone_e164]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase())
        : true;
      const matchesStatus = statusFilter === "all" || contact.status === statusFilter;
      const matchesLocation =
        locationFilter === "all" || contact.location?.name === locationFilter;
      const matchesLabels = labelFilters.length
        ? labelFilters.every((labelId) =>
            contact.labels.some((label) => label.id === labelId)
          )
        : true;
      return matchesQuery && matchesStatus && matchesLocation && matchesLabels;
    });
  }, [contacts, labelFilters, locationFilter, query, statusFilter]);

  const handleStatusChange = async (contactId: string, status: string) => {
    setSavingId(contactId);
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId ? { ...contact, status } : contact
      )
    );
    const response = await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      await loadData();
    }
    setSavingId(null);
  };

  const handleAssignLabel = async (contactId: string, label: Label) => {
    setContacts((prev) =>
      prev.map((contact) => {
        if (contact.id !== contactId) return contact;
        if (contact.labels.some((item) => item.id === label.id)) return contact;
        return {
          ...contact,
          labels: [...contact.labels, { id: label.id, name: label.name }]
        };
      })
    );
    const response = await fetch(`/api/contacts/${contactId}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labelId: label.id })
    });
    if (!response.ok) {
      await loadData();
    }
  };

  const handleRemoveLabel = async (contactId: string, labelId: string) => {
    setContacts((prev) =>
      prev.map((contact) => {
        if (contact.id !== contactId) return contact;
        return {
          ...contact,
          labels: contact.labels.filter((label) => label.id !== labelId)
        };
      })
    );
    const response = await fetch(`/api/contacts/${contactId}/labels?labelId=${labelId}`,
      { method: "DELETE" }
    );
    if (!response.ok) {
      await loadData();
    }
  };

  return (
    <AppShell title="Kontakte" subtitle="Mini-CRM Übersicht">
      {process.env.NODE_ENV === "development" ? (
        <section className="mb-6 rounded-lg border border-base-800 bg-base-850 p-4">
          <h2 className="text-base font-semibold">Debug</h2>
          <p className="text-sm text-text-muted">
            Health Check schreibt in die Datenbank und liest zurück.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={runHealthCheck}>
              Run Health Check
            </Button>
          </div>
          {healthError ? (
            <p className="mt-2 text-sm text-red-400">{healthError}</p>
          ) : null}
          {healthResult ? (
            <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-base-900/70 p-3 text-xs text-text-muted">
              {healthResult}
            </pre>
          ) : null}
        </section>
      ) : null}
      <section className="mb-6 grid gap-4 rounded-lg border border-base-800 bg-base-850 p-4 md:grid-cols-4">
        <Input
          placeholder="Suche nach Name oder Telefon"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">Alle Status</option>
          {statusOptions.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
          value={locationFilter}
          onChange={(event) => setLocationFilter(event.target.value)}
        >
          <option value="all">Alle Standorte</option>
          {locations.map((location) => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {sortLabels(labels.filter((label) => !label.is_archived)).map((label) => (
            <button
              key={label.id}
              type="button"
              onClick={() =>
                setLabelFilters((prev) =>
                  prev.includes(label.id)
                    ? prev.filter((item) => item !== label.id)
                    : [...prev, label.id]
                )
              }
            >
              <Chip label={label.name} selected={labelFilters.includes(label.id)} />
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-base-800 bg-base-850">
        <div className="grid grid-cols-5 gap-4 border-b border-base-800 px-4 py-3 text-xs uppercase text-text-muted">
          <span>Name</span>
          <span>Telefon</span>
          <span>Standort</span>
          <span>Status</span>
          <span>Labels</span>
        </div>
        {isLoading ? (
          <div className="px-4 py-6 text-sm text-text-muted">Lade Daten...</div>
        ) : (
          filteredContacts.map((contact) => {
          const assignedLabelIds = contact.labels.map((label) => label.id);
          const availableLabels = sortLabels(
            labels.filter(
              (label) => !label.is_archived && !assignedLabelIds.includes(label.id)
            )
          );
          const filteredAvailable = labelSearch
            ? availableLabels.filter((label) =>
                label.name.toLowerCase().includes(labelSearch.toLowerCase())
              )
            : availableLabels;

          return (
            <div key={contact.id} className="border-b border-base-800">
              <button
                type="button"
                onClick={() =>
                  setExpandedId((prev) => (prev === contact.id ? null : contact.id))
                }
                className="grid w-full grid-cols-5 gap-4 px-4 py-3 text-left text-sm hover:bg-base-900/60"
              >
                <span>{contact.full_name || "Unbekannt"}</span>
                <span>{contact.phone_e164}</span>
                <span>{contact.location?.name ?? "-"}</span>
                <span className="capitalize">
                  {contact.status.replaceAll("_", " ")}
                </span>
                <span className="flex flex-wrap gap-2">
                  {contact.labels.length ? (
                    contact.labels.map((label) => (
                      <Chip key={label.id} label={label.name} />
                    ))
                  ) : (
                    <span className="text-xs text-text-muted">Keine Labels</span>
                  )}
                </span>
              </button>
              {expandedId === contact.id ? (
                <div className="border-t border-base-800 bg-base-900/40 px-4 py-4">
                  <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                    <div className="space-y-3">
                      <label className="text-xs uppercase text-text-muted">Status</label>
                      <select
                        className="w-full rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
                        value={contact.status}
                        onChange={(event) =>
                          handleStatusChange(contact.id, event.target.value)
                        }
                      >
                        {statusOptions.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        onClick={() =>
                          navigator.clipboard.writeText(contact.phone_e164)
                        }
                      >
                        Nummer kopieren
                      </Button>
                      {savingId === contact.id ? (
                        <p className="text-xs text-text-muted">Speichern...</p>
                      ) : null}
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs uppercase text-text-muted">
                          Label suchen
                        </label>
                        <Input
                          placeholder="Label suchen..."
                          value={labelSearch}
                          onChange={(event) => setLabelSearch(event.target.value)}
                        />
                      </div>
                      <div>
                        <div className="mb-2 text-xs uppercase text-text-muted">
                          Zugewiesene Labels
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {contact.labels.length ? (
                            contact.labels.map((label) => (
                              <span
                                key={label.id}
                                className="inline-flex items-center gap-2 rounded-full border border-base-800 bg-base-900 px-3 py-1 text-xs"
                              >
                                {label.name}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLabel(contact.id, label.id)}
                                  className="text-text-muted hover:text-text-base"
                                  aria-label={`Label ${label.name} entfernen`}
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-text-muted">
                              Noch keine Labels zugewiesen
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs uppercase text-text-muted">
                          Label hinzufügen
                        </label>
                        <select
                          className="mt-2 w-full rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
                          value={labelSelections[contact.id] ?? ""}
                          onChange={(event) => {
                            const selected = event.target.value;
                            if (!selected) return;
                            const label = labels.find((item) => item.id === selected);
                            if (label) {
                              handleAssignLabel(contact.id, label);
                            }
                            setLabelSelections((prev) => ({
                              ...prev,
                              [contact.id]: ""
                            }));
                          }}
                        >
                          <option value="">Label auswählen...</option>
                          {filteredAvailable.map((label) => (
                            <option key={label.id} value={label.id}>
                              {label.name}
                            </option>
                          ))}
                        </select>
                        {filteredAvailable.length === 0 ? (
                          <p className="mt-2 text-xs text-text-muted">
                            Keine Labels verfügbar
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })
        )}
      </section>
    </AppShell>
  );
}
