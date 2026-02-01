"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { AppShell } from "@/components/app-shell";
import AuthDebugPanel from "@/components/AuthDebugPanel";
import LogoutButton from "@/components/LogoutButton";
import { Button, Chip, Input, Textarea } from "@/components/ui";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { supabaseBrowser } from "@/lib/supabase/browserClient";

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
  sort_order: number;
  is_archived: boolean;
};

type Contact = {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_e164: string | null;
  location_id: string | null;
  created_at: string;
  status: string;
  location: { id: string; name: string } | null;
  labels: { id: string; name: string }[];
};

type ContactStats = {
  total: number;
  missingName: number;
  missingPhone: number;
  byLocation: { name: string; count: number }[];
};

type LocationOption = {
  id: string;
  name: string;
};

function sortLabels(labels: Label[]) {
  return [...labels].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });
}

function getContactDisplayName(contact: Contact) {
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

function DroppableZone({
  id,
  children,
  className
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "rounded-md border border-base-800 bg-base-900/40 p-3 transition",
        isOver && "border-emerald-600 bg-base-900",
        className
      )}
    >
      {children}
    </div>
  );
}

function SortableLabel({
  id,
  label,
  onClick
}: {
  id: string;
  label: string;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      onClick={onClick}
      className={clsx("touch-none", isDragging && "opacity-60")}
      {...attributes}
      {...listeners}
    >
      <Chip label={label} />
    </button>
  );
}

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLocationId, setSelectedLocationId] = useState("all");
  const [labelFilters, setLabelFilters] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<"created_at" | "name">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 100;
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [labelSearch, setLabelSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createLocationId, setCreateLocationId] = useState("");
  const [createLabels, setCreateLabels] = useState("");
  const [createNote, setCreateNote] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const loadContacts = async (overridePageIndex?: number) => {
    setLoading(true);
    setErrorText(null);
    const supabase = supabaseBrowser();
    let query = supabase
      .from("contacts")
      .select(
        "id, phone_e164, location_id, created_at, name, first_name, last_name, status, location:locations(id,name), labels:contact_labels(labels(id,name,sort_order,is_archived))",
        { count: "exact" }
      );

    if (selectedLocationId && selectedLocationId !== "all") {
      query = query.eq("location_id", selectedLocationId);
    }

    if (search.trim().length) {
      const s = search.trim();
      query = query.or(
        `phone_e164.ilike.%${s}%,name.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%`
      );
    }

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    query = query.order(sortKey, { ascending: sortDir === "asc" });

    const activePageIndex = overridePageIndex ?? pageIndex;
    const from = activePageIndex * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    try {
      const { data, error, count } = await query;
      if (error) {
        console.error("DASHBOARD_CONTACTS_ERROR", error);
        setErrorText(`${error.message} (${error.code ?? ""})`);
        return;
      }
      const mappedContacts = (data ?? []).map((contact: any) => ({
        ...contact,
        labels: (contact.labels ?? [])
          .map((item: any) => item.labels)
          .filter(Boolean)
      }));
      setContacts(mappedContacts);
      setTotalCount(count ?? 0);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetchWithAuth("/api/contacts/stats");
      const text = await response.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {}
      if (!response.ok) {
        console.error("STATS_FETCH_ERROR_RAW", { status: response.status, text });
        setStatsError(JSON.stringify(parsed ?? { raw: text }, null, 2));
        return;
      }
      const payload = parsed ?? null;
      setStats(payload ?? null);
      setStatsError(null);
    } catch (error) {
      console.error("DASHBOARD_STATS_ERROR", error);
      setStatsError("Failed to load stats.");
    }
  };

  useEffect(() => {
    loadContacts();
  }, [selectedLocationId, search, sortKey, sortDir, pageIndex, statusFilter]);

  useEffect(() => {
    const loadLabels = async () => {
      const response = await fetchWithAuth("/api/labels");
      if (!response.ok) return;
      const payload = await response.json();
      setLabels(payload.labels ?? []);
    };
    loadLabels();
  }, []);

  useEffect(() => {
    const loadLocations = async () => {
      const response = await fetchWithAuth("/api/locations");
      if (!response.ok) return;
      const payload = await response.json();
      setLocations(payload.locations ?? []);
    };
    loadLocations();
  }, []);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    setLabelSearch("");
  }, [expandedId]);

  useEffect(() => {
    if (!createLocationId && locations.length) {
      setCreateLocationId(locations[0].id);
    }
  }, [createLocationId, locations]);

  const filteredContacts = useMemo(() => {
    if (!labelFilters.length) return contacts;
    return contacts.filter((contact) =>
      labelFilters.every((labelId) =>
        contact.labels.some((label) => label.id === labelId)
      )
    );
  }, [contacts, labelFilters]);

  const pageFrom = pageIndex * pageSize;
  const pageTo = pageFrom + pageSize - 1;
  const displayFrom = totalCount === 0 ? 0 : pageFrom + 1;
  const displayTo = totalCount === 0 ? 0 : Math.min(pageTo + 1, totalCount);

  const handleStatusChange = async (contactId: string, status: string) => {
    setSavingId(contactId);
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId ? { ...contact, status } : contact
      )
    );
    const response = await fetchWithAuth(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      await loadContacts();
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
    const response = await fetchWithAuth(`/api/contacts/${contactId}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labelId: label.id })
    });
    if (!response.ok) {
      await loadContacts();
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
    const response = await fetchWithAuth(
      `/api/contacts/${contactId}/labels?labelId=${labelId}`,
      { method: "DELETE" }
    );
    if (!response.ok) {
      await loadContacts();
    }
  };

  const handleCreateContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    try {
      const response = await fetchWithAuth("/api/contacts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim() || null,
          phoneRaw: createPhone,
          locationId: createLocationId,
          labels: createLabels
            .split(",")
            .map((label) => label.trim())
            .filter(Boolean),
          note: createNote.trim() || null
        })
      });
      const text = await response.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {}
      if (!response.ok) {
        setCreateError(JSON.stringify(parsed ?? { raw: text }, null, 2));
        return;
      }
      setShowCreateModal(false);
      setCreateName("");
      setCreatePhone("");
      setCreateLabels("");
      setCreateNote("");
      setCreateError(null);
      setPageIndex(0);
      await loadContacts(0);
      await loadStats();
    } catch (error) {
      setCreateError(
        JSON.stringify({ error: error instanceof Error ? error.message : error }, null, 2)
      );
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <AppShell
      title="Kontakte"
      subtitle="Mini-CRM Übersicht"
      action={<LogoutButton />}
    >
      <div className="mb-6">
        <AuthDebugPanel />
      </div>
      <section className="mb-6 rounded-lg border border-base-800 bg-base-850 px-4 py-3 text-sm">
        <div className="text-xs uppercase text-text-muted">Stats</div>
        {statsError ? (
          <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            <div className="font-medium text-amber-200">
              Fehler beim Laden der Statistiken
            </div>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-amber-100">
              {statsError}
            </pre>
          </div>
        ) : stats ? (
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-text-muted">
            <span>
              Gesamt: <span className="text-text-primary">{stats.total}</span>
            </span>
            <span>
              Gefiltert: <span className="text-text-primary">{filteredContacts.length}</span>
              <span className="text-text-muted"> / {contacts.length} geladen</span>
            </span>
            <span>
              Fehlender Name: {" "}
              <span className="text-text-primary">{stats.missingName}</span>
            </span>
            <span>
              Fehlende Nummer: {" "}
              <span className="text-text-primary">{stats.missingPhone}</span>
            </span>
            <span className="flex flex-wrap gap-2">
              Standorte:
              {stats.byLocation.length ? (
                stats.byLocation.map((location) => (
                  <span key={location.name} className="text-text-primary">
                    {location.name} ({location.count})
                  </span>
                ))
              ) : (
                <span className="text-text-primary">—</span>
              )}
            </span>
          </div>
        ) : (
          <div className="mt-2 text-xs text-text-muted">Lade Statistiken...</div>
        )}
      </section>
      <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-800 bg-base-850 px-4 py-3 text-sm">
        <div className="text-text-muted">
          Manuelle Kontakte hinzufügen und verwalten.
        </div>
        <Button
          onClick={() => {
            setCreateError(null);
            setShowCreateModal(true);
          }}
        >
          Kontakt hinzufügen
        </Button>
      </section>
      <section className="mb-6 grid gap-4 rounded-lg border border-base-800 bg-base-850 p-4 md:grid-cols-6">
        <Input
          placeholder="Suche nach Name oder Telefon"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPageIndex(0);
          }}
          className="md:col-span-2"
        />
        <select
          className="rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPageIndex(0);
          }}
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
          value={selectedLocationId}
          onChange={(event) => {
            setSelectedLocationId(event.target.value);
            setPageIndex(0);
          }}
        >
          <option value="all">Alle Standorte</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
          value={sortKey}
          onChange={(event) => {
            setSortKey(event.target.value as "created_at" | "name");
            setPageIndex(0);
          }}
        >
          <option value="created_at">Sortiert nach Datum</option>
          <option value="name">Sortiert nach Name</option>
        </select>
        <select
          className="rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
          value={sortDir}
          onChange={(event) => {
            setSortDir(event.target.value as "asc" | "desc");
            setPageIndex(0);
          }}
        >
          <option value="desc">Absteigend</option>
          <option value="asc">Aufsteigend</option>
        </select>
        <div className="flex flex-wrap gap-2 md:col-span-6">
          {sortLabels(labels.filter((label) => !label.is_archived)).map((label) => (
            <button
              key={label.id}
              type="button"
              onClick={() => {
                setPageIndex(0);
                setLabelFilters((prev) =>
                  prev.includes(label.id)
                    ? prev.filter((item) => item !== label.id)
                    : [...prev, label.id]
                );
              }}
            >
              <Chip label={label.name} selected={labelFilters.includes(label.id)} />
            </button>
          ))}
        </div>
      </section>

      {errorText ? (
        <div className="mb-4 rounded-lg border border-amber-500/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Fehler beim Laden der Kontakte: {errorText}
        </div>
      ) : null}

      <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-800 bg-base-850 px-4 py-3 text-sm">
        <div className="text-text-muted">
          Zeige {displayFrom}–{displayTo} von {totalCount}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
            disabled={pageIndex === 0}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            onClick={() => setPageIndex((prev) => prev + 1)}
            disabled={(pageIndex + 1) * pageSize >= totalCount}
          >
            Next
          </Button>
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
        {loading ? (
          <div className="px-4 py-6 text-sm text-text-muted">Lade Kontakte …</div>
        ) : filteredContacts.length === 0 ? (
          <div className="px-4 py-6 text-sm text-text-muted">
            Keine Kontakte für diesen Filter.
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const assignedLabelIds = contact.labels.map((label) => label.id);
            const availableLabels = sortLabels(
              labels.filter(
                (label) => !label.is_archived && !assignedLabelIds.includes(label.id)
              )
            );
            const availableLabelIds = availableLabels.map((label) => label.id);
            const filteredAvailable = labelSearch
              ? availableLabels.filter((label) =>
                  label.name.toLowerCase().includes(labelSearch.toLowerCase())
                )
              : availableLabels;
            const displayName = getContactDisplayName(contact);

            const handleDragEnd = (event: DragEndEvent) => {
              const { active, over } = event;
              if (!over) return;
              const labelId = String(active.id);
              const overId = String(over.id);
              const isOverAssigned =
                overId === "assigned" || assignedLabelIds.includes(overId);
              const isOverAvailable =
                overId === "available" || availableLabelIds.includes(overId);

              if (isOverAssigned) {
                if (assignedLabelIds.includes(labelId)) return;
                const label = labels.find((item) => item.id === labelId);
                if (label) handleAssignLabel(contact.id, label);
                return;
              }
              if (isOverAvailable || overId === "remove") {
                if (!assignedLabelIds.includes(labelId)) return;
                handleRemoveLabel(contact.id, labelId);
              }
            };

            return (
              <div key={contact.id} className="border-b border-base-800">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((prev) => (prev === contact.id ? null : contact.id))
                  }
                  className="grid w-full grid-cols-5 gap-4 px-4 py-3 text-left text-sm hover:bg-base-900/60"
                >
                  <span>{displayName}</span>
                  <span>{contact.phone_e164 ?? "—"}</span>
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
                        <label className="text-xs uppercase text-text-muted">
                          Status
                        </label>
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
                            navigator.clipboard.writeText(contact.phone_e164 ?? "")
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
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <div className="grid gap-4 lg:grid-cols-2">
                            <DroppableZone id="available">
                              <div className="mb-2 text-xs uppercase text-text-muted">
                                Verfügbare Labels
                              </div>
                              <SortableContext
                                items={filteredAvailable.map((label) => label.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                <div className="flex flex-wrap gap-2">
                                  {filteredAvailable.length ? (
                                    filteredAvailable.map((label) => (
                                      <SortableLabel
                                        key={label.id}
                                        id={label.id}
                                        label={label.name}
                                        onClick={() =>
                                          handleAssignLabel(contact.id, label)
                                        }
                                      />
                                    ))
                                  ) : (
                                    <span className="text-xs text-text-muted">
                                      Keine Labels verfügbar
                                    </span>
                                  )}
                                </div>
                              </SortableContext>
                            </DroppableZone>
                            <DroppableZone id="assigned">
                              <div className="mb-2 text-xs uppercase text-text-muted">
                                Labels dieses Kontakts
                              </div>
                              <SortableContext
                                items={assignedLabelIds}
                                strategy={verticalListSortingStrategy}
                              >
                                <div className="flex flex-wrap gap-2">
                                  {contact.labels.length ? (
                                    contact.labels.map((label) => (
                                      <SortableLabel
                                        key={label.id}
                                        id={label.id}
                                        label={label.name}
                                        onClick={() =>
                                          handleRemoveLabel(contact.id, label.id)
                                        }
                                      />
                                    ))
                                  ) : (
                                    <span className="text-xs text-text-muted">
                                      Noch keine Labels zugewiesen
                                    </span>
                                  )}
                                </div>
                              </SortableContext>
                            </DroppableZone>
                          </div>
                          <DroppableZone
                            id="remove"
                            className="mt-4 border-dashed text-xs text-text-muted"
                          >
                            Label hierhin ziehen zum Entfernen
                          </DroppableZone>
                        </DndContext>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </section>
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-base-800 bg-base-850 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Kontakt hinzufügen
                </h2>
                <p className="text-sm text-text-muted">
                  Lege einen neuen Kontakt manuell an.
                </p>
              </div>
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={createLoading}
              >
                Schließen
              </Button>
            </div>
            <form className="space-y-4" onSubmit={handleCreateContact}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs uppercase text-text-muted">Name</label>
                  <Input
                    placeholder="Optionaler Name"
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-text-muted">
                    Telefon *
                  </label>
                  <Input
                    required
                    placeholder="+49..."
                    value={createPhone}
                    onChange={(event) => setCreatePhone(event.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-text-muted">
                    Standort *
                  </label>
                  <select
                    className="w-full rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
                    value={createLocationId}
                    onChange={(event) => setCreateLocationId(event.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Standort wählen
                    </option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase text-text-muted">Labels</label>
                  <Input
                    placeholder="z.B. Stammkunde, VIP"
                    value={createLabels}
                    onChange={(event) => setCreateLabels(event.target.value)}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Kommagetrennte Labels eingeben.
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs uppercase text-text-muted">Notiz</label>
                <Textarea
                  rows={4}
                  placeholder="Optionaler Hinweis"
                  value={createNote}
                  onChange={(event) => setCreateNote(event.target.value)}
                />
              </div>
              {createError ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                  <div className="font-medium text-amber-200">
                    Fehler beim Speichern
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-amber-100">
                    {createError}
                  </pre>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-text-muted">
                  {createLoading ? "Speichern..." : "Felder mit * sind Pflicht."}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    disabled={createLoading}
                  >
                    Abbrechen
                  </Button>
                  <Button type="submit" disabled={createLoading}>
                    {createLoading ? "Speichern..." : "Kontakt speichern"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
