"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Button, Chip, Input } from "@/components/ui";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

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
  status: string;
  location: { name: string } | null;
  labels: { id: string; name: string }[];
};

type ContactStats = {
  total: number;
  missingName: number;
  missingPhone: number;
  byLocation: { name: string; count: number }[];
};

const locationOptions = [
  { value: "all", label: "Alle" },
  { value: "heilbronn", label: "Heilbronn" },
  { value: "pforzheim", label: "Pforzheim" },
  { value: "boeblingen", label: "Böblingen" }
];

function normalizeLocationName(value?: string | null) {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue");
}

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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [labelFilters, setLabelFilters] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 100;
  const [totalCount, setTotalCount] = useState(0);
  const [contactsError, setContactsError] = useState<{
    message: string;
    code?: string | null;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [labelSearch, setLabelSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const previousLocationRef = useRef(locationFilter);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const loadData = async (locationValue: string, currentPageIndex: number) => {
    setIsLoading(true);
    const locationParam =
      !locationValue || locationValue === "all"
        ? ""
        : `?location=${encodeURIComponent(locationValue)}`;
    const paginationParam = `${locationParam ? "&" : "?"}page=${currentPageIndex}&pageSize=${pageSize}`;
    try {
      const [contactsResponse, labelsResponse] = await Promise.all([
        fetchWithAuth(`/api/contacts${locationParam}${paginationParam}`),
        fetchWithAuth("/api/labels")
      ]);
      if (contactsResponse.ok) {
        const payload = await contactsResponse.json();
        setContacts(payload.contacts ?? []);
        setTotalCount(payload.count ?? 0);
        setContactsError(null);
      } else {
        const payload = await contactsResponse
          .json()
          .catch(() => ({ error: { message: "Failed to load contacts." } }));
        const error =
          typeof payload?.error === "string"
            ? { message: payload.error }
            : payload?.error ?? { message: "Failed to load contacts." };
        console.error("DASHBOARD_CONTACTS_ERROR", error);
        setContactsError({ message: error.message, code: error.code ?? null });
      }
      if (labelsResponse.ok) {
        const payload = await labelsResponse.json();
        setLabels(payload.labels ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const locationChanged = locationFilter !== previousLocationRef.current;
    if (locationChanged) {
      console.log("FILTER_CHANGE", { selectedLocation: locationFilter, pageIndex });
      setContacts([]);
      setIsLoading(true);
      if (pageIndex !== 0) {
        setPageIndex(0);
        return;
      }
    }
    previousLocationRef.current = locationFilter;
    loadData(locationFilter, pageIndex);
  }, [locationFilter, pageIndex]);

  useEffect(() => {
    setPageIndex(0);
  }, [query, statusFilter, labelFilters]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetchWithAuth("/api/contacts/stats");
        if (!response.ok) {
          const payload = await response
            .json()
            .catch(() => ({ error: "Failed to load stats." }));
          const message =
            typeof payload?.error === "string"
              ? payload.error
              : payload?.error?.message ?? "Failed to load stats.";
          setStatsError(message);
          return;
        }
        const payload = await response.json();
        setStats(payload ?? null);
        setStatsError(null);
      } catch (error) {
        console.error("DASHBOARD_STATS_ERROR", error);
        setStatsError("Failed to load stats.");
      }
    };
    loadStats();
  }, []);

  useEffect(() => {
    setLabelSearch("");
  }, [expandedId]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const combinedName = [contact.first_name, contact.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      const nameValue =
        contact.name ?? (combinedName.length > 0 ? combinedName : null);
      const matchesQuery = query
        ? [nameValue, contact.phone_e164]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase())
        : true;
      const matchesStatus = statusFilter === "all" || contact.status === statusFilter;
      const matchesLocation =
        locationFilter === "all" ||
        normalizeLocationName(contact.location?.name) === locationFilter;
      const matchesLabels = labelFilters.length
        ? labelFilters.every((labelId) =>
            contact.labels.some((label) => label.id === labelId)
          )
        : true;
      return matchesQuery && matchesStatus && matchesLocation && matchesLabels;
    });
  }, [contacts, labelFilters, locationFilter, query, statusFilter]);

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
      await loadData(locationFilter, pageIndex);
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
      await loadData(locationFilter, pageIndex);
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
      await loadData(locationFilter, pageIndex);
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
          <div className="mt-2 text-xs text-amber-200">
            Fehler beim Laden der Statistiken: {statsError}
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
          {locationOptions.map((location) => (
            <option key={location.value} value={location.value}>
              {location.label}
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

      {contactsError ? (
        <div className="mb-4 rounded-lg border border-amber-500/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Fehler beim Laden der Kontakte: {contactsError.message}
          {contactsError.code ? ` (${contactsError.code})` : null}
        </div>
      ) : null}

      <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-800 bg-base-850 px-4 py-3 text-sm">
        <div className="text-text-muted">
          Seite {pageIndex + 1} | Kontakte: {totalCount} | angezeigt: {displayFrom}–
          {displayTo}
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
    </AppShell>
  );
}
