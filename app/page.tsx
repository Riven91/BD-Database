"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
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
import LogoutButton from "@/components/LogoutButton";
import { Button, Chip, Input, Textarea } from "@/components/ui";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

const statusOptions = [
  { value: "neu", label: "Neu" },
  { value: "in_bearbeitung", label: "In Bearbeitung" },
  { value: "tattoo_termin", label: "Tattoo-Termin" },
  { value: "abgeschlossen", label: "Abgeschlossen" },
  { value: "tot", label: "Tot" }
];

const DEBUG_DND = process.env.NEXT_PUBLIC_DEBUG_DND === "true";
const debugDndLog = (...args: unknown[]) => {
  if (DEBUG_DND) {
    console.info("[Labels DnD]", ...args);
  }
};

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
  notes?: string | null;
  location_id: string | null;
  created_at: string;
  follow_up_at?: string | null;
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

type FileItem = {
  id: string;
  file_type: string;
  file_name: string;
  file_path: string;
  created_at: string;
  note?: string | null;
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
  className,
  ...rest
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "rounded-md border border-base-800 bg-base-900/40 p-3 transition",
        isOver && "border-emerald-600 bg-base-900",
        className
      )}
      {...rest}
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      onClick={onClick}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/label-id", String(id));
        event.dataTransfer.effectAllowed = "move";
        debugDndLog("drag start", { labelId: id });
      }}
      className={clsx("touch-none", isDragging && "opacity-60")}
      {...attributes}
      {...listeners}
    >
      <Chip label={label} />
    </button>
  );
}

function normalizeStats(input: any): ContactStats | null {
  const raw =
    input?.stats && typeof input.stats === "object" ? input.stats : input;

  if (!raw || typeof raw !== "object") return null;

  const total =
    typeof raw.total === "number"
      ? raw.total
      : Number(raw.totalContacts ?? raw.total ?? 0) || 0;

  const missingName =
    typeof raw.missingName === "number"
      ? raw.missingName
      : Number(raw.missingName?.missingInSample ?? raw.missingName?.exact ?? 0) ||
        0;

  const missingPhone =
    typeof raw.missingPhone === "number"
      ? raw.missingPhone
      : Number(raw.missingPhone?.exact ?? 0) || 0;

  const byLocationArr: Array<{ name: string; count: number }> = Array.isArray(
    raw.byLocation
  )
    ? raw.byLocation
        .filter(Boolean)
        .map((x: any) => ({
          name: typeof x?.name === "string" ? x.name : "—",
          count:
            typeof x?.count === "number" ? x.count : Number(x?.count ?? 0) || 0
        }))
    : [];

  byLocationArr.sort(
    (a: { name: string; count: number }, b: { name: string; count: number }) =>
      b.count - a.count
  );

  return {
    total,
    missingName,
    missingPhone,
    byLocation: byLocationArr
  };
}

function formatFileDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  });
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
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLocationId, setFormLocationId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createLocationId, setCreateLocationId] = useState("");
  const [createLabels, setCreateLabels] = useState("");
  const [createNote, setCreateNote] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [filesByContact, setFilesByContact] = useState<Record<string, FileItem[]>>(
    {}
  );
  const [uploadType, setUploadType] = useState<
    "consent" | "stencil" | "photo" | "other" | null
  >(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const loadFilesForContact = async (contactId: string) => {
    try {
      const response = await fetchWithAuth(`/api/contacts/${contactId}/files`);
      const text = await response.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {}

      if (!response.ok || !parsed?.ok) {
        setFilesByContact((prev) => ({ ...prev, [contactId]: [] }));
        return;
      }

      const files = Array.isArray(parsed.files) ? parsed.files : [];
      setFilesByContact((prev) => ({ ...prev, [contactId]: files }));
    } catch {
      setFilesByContact((prev) => ({ ...prev, [contactId]: [] }));
    }
  };

  const loadContacts = async (overridePageIndex?: number) => {
    setLoading(true);
    setErrorText(null);

    const activePageIndex = overridePageIndex ?? pageIndex;

    const qs = new URLSearchParams({
      pageIndex: String(activePageIndex),
      pageSize: String(pageSize),
      search: search.trim(),
      status: statusFilter,
      locationId: selectedLocationId,
      sortKey,
      sortDir
    });

    try {
      const response = await fetchWithAuth(`/api/contacts/list?${qs.toString()}`);
      const text = await response.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {}

      if (!response.ok) {
        setErrorText(
          JSON.stringify(parsed ?? { raw: text, status: response.status }, null, 2)
        );
        setContacts([]);
        setTotalCount(0);
        return;
      }

      const payload = parsed ?? {};
      const list = Array.isArray(payload.contacts) ? payload.contacts : [];
      const count = typeof payload.totalCount === "number" ? payload.totalCount : 0;

      setContacts(list);
      setTotalCount(count);
    } catch (e: any) {
      setErrorText(e?.message ?? "unknown error");
      setContacts([]);
      setTotalCount(0);
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
        setStatsError(JSON.stringify(parsed ?? { raw: text }, null, 2));
        setStats(null);
        return;
      }

      const normalized = normalizeStats(parsed);
      if (!normalized) {
        setStats(null);
        setStatsError("Stats payload invalid (missing fields).");
        return;
      }

      setStats(normalized);
      setStatsError(null);
    } catch {
      setStats(null);
      setStatsError("Failed to load stats.");
    }
  };

  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    if (!expandedId) {
      setIsEditing(false);
      setEditError(null);
      return;
    }
    if (!(expandedId in filesByContact)) {
      loadFilesForContact(expandedId);
    }
    if (isEditing) return;
    const active = contacts.find((contact) => contact.id === expandedId);
    if (!active) return;
    setFormName(active.name ?? "");
    setFormPhone(active.phone_e164 ?? "");
    setFormLocationId(active.location_id ?? active.location?.id ?? "");
    setFormNotes(active.notes ?? "");
    setEditError(null);
  }, [contacts, expandedId, filesByContact, isEditing]);


  const filteredContacts = useMemo(() => {
    if (!labelFilters.length) return contacts;
    return contacts.filter((contact) =>
      labelFilters.every((labelId) =>
        (contact.labels ?? []).some((label) => label.id === labelId)
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
        if ((contact.labels ?? []).some((item) => item.id === label.id)) return contact;
        return {
          ...contact,
          labels: [...(contact.labels ?? []), { id: label.id, name: label.name }]
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
          labels: (contact.labels ?? []).filter((label) => label.id !== labelId)
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
        JSON.stringify(
          { error: error instanceof Error ? error.message : error },
          null,
          2
        )
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditContact = async (contact: Contact) => {
    setEditSaving(true);
    setEditError(null);

    const payload = {
      name: formName.trim() || null,
      phone_e164: formPhone.trim(),
      location_id: formLocationId || null
    };

    try {
      const response = await fetchWithAuth(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {}

      if (!response.ok) {
        if (response.status === 409 && parsed?.error === "phone_exists") {
          setEditError("Diese Telefonnummer existiert bereits.");
        } else {
          setEditError(
            typeof parsed?.error === "string"
              ? parsed.error
              : JSON.stringify(parsed ?? { raw: text, status: response.status }, null, 2)
          );
        }
        return;
      }

      const updatedLocation =
        locations.find((location) => location.id === payload.location_id) ?? null;

      setContacts((prev) =>
        prev.map((item) =>
          item.id === contact.id
            ? {
                ...item,
                name: payload.name,
                phone_e164: payload.phone_e164,
                location_id: payload.location_id,
                location: payload.location_id ? updatedLocation : null,
                notes: item.notes
              }
            : item
        )
      );
      setIsEditing(false);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteContact = async (contact: Contact) => {
    const confirmed = window.confirm(
      "Kontakt wirklich löschen? Dies kann nicht rückgängig gemacht werden."
    );
    if (!confirmed) return;
    setDeleteSaving(true);
    setEditError(null);

    try {
      const response = await fetchWithAuth(`/api/contacts/${contact.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const text = await response.text();
        setEditError(text || "Löschen fehlgeschlagen.");
        return;
      }

      setContacts((prev) => prev.filter((item) => item.id !== contact.id));
      setExpandedId(null);
    } finally {
      setDeleteSaving(false);
    }
  };

  return (
    <AppShell title="Kontakte" subtitle="Mini-CRM Übersicht" action={<LogoutButton />}>
      <div className="min-w-0 overflow-x-hidden">
        <section className="mb-6 rounded-lg border border-base-800 bg-base-850 px-4 py-3 text-sm">
        <div className="text-xs uppercase text-text-muted">Stats</div>

        {statsError ? (
          <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            <div className="font-medium text-amber-200">Fehler beim Laden der Statistiken</div>
            <pre className="mt-2 whitespace-pre-wrap break-words overflow-hidden text-xs text-amber-100">
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
              Fehlender Name: <span className="text-text-primary">{stats.missingName}</span>
            </span>
            <span>
              Fehlende Nummer: <span className="text-text-primary">{stats.missingPhone}</span>
            </span>
            <span className="flex flex-wrap gap-2">
              Standorte:
              {(stats.byLocation ?? []).length ? (
                (stats.byLocation ?? []).map((location) => (
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

      <div className="sticky top-0 z-30 min-w-0 space-y-3 bg-base-950/95 pb-3 pt-3 backdrop-blur md:static md:bg-transparent md:pb-0 md:pt-0">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-800 bg-base-850 px-4 py-3 text-sm">
          <div className="text-text-muted">Manuelle Kontakte hinzufügen und verwalten.</div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const qs = new URLSearchParams();
                if (search.trim()) qs.set("search", search.trim());
                if (statusFilter) qs.set("status", statusFilter);
                if (selectedLocationId) qs.set("locationId", selectedLocationId);
                if (labelFilters.length) qs.set("label", labelFilters.join(","));
                const exportUrl = `/api/contacts/export?${qs.toString()}`;
                window.location.href = exportUrl;
              }}
            >
              Export CSV
            </Button>
            <Button
              onClick={() => {
                setCreateError(null);
                setShowCreateModal(true);
              }}
            >
              Kontakt hinzufügen
            </Button>
          </div>
        </section>

        <section className="grid gap-4 rounded-lg border border-base-800 bg-base-850 p-4 md:grid-cols-6">
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
      </div>

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

      <section className="min-w-0 rounded-lg border border-base-800 bg-base-850">
        <div className="hidden grid-cols-5 gap-4 border-b border-base-800 px-4 py-3 text-xs uppercase text-text-muted md:grid">
          <span>Name</span>
          <span>Telefon</span>
          <span>Standort</span>
          <span>Status</span>
          <span>Labels</span>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-text-muted">Lade Kontakte …</div>
        ) : filteredContacts.length === 0 ? (
          <div className="px-4 py-6 text-sm text-text-muted">Keine Kontakte für diesen Filter.</div>
        ) : (
          filteredContacts.map((contact) => {
            const assignedLabelIds = (contact.labels ?? []).map((label) => label.id);
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
            const files = filesByContact[contact.id] ?? [];
            const fileGroups = [
              { key: "consent", label: "Einwilligung" },
              { key: "stencil", label: "Stencil" },
              { key: "photo", label: "Foto" },
              { key: "other", label: "Other" }
            ];
            const fileCounts = files.reduce<Record<string, number>>((acc, file) => {
              acc[file.file_type] = (acc[file.file_type] ?? 0) + 1;
              return acc;
            }, {});

            const handleRemoveDrop = (event: React.DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              const labelId = event.dataTransfer.getData("text/label-id");
              debugDndLog("drop remove zone", { labelId, contactId: contact.id });
              if (!labelId || !assignedLabelIds.includes(labelId)) return;
              handleRemoveLabel(contact.id, labelId);
            };

            const handleDragEnd = (event: DragEndEvent) => {
              const { active, over } = event;
              if (!over) return;

              const labelId = String(active.id);
              const overId = String(over.id);

              const isOverAssigned = overId === "assigned" || assignedLabelIds.includes(overId);
              const isOverAvailable = overId === "available" || availableLabelIds.includes(overId);

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
              <div
                key={contact.id}
                className={clsx(
                  "md:border-b md:border-base-800",
                  "mb-3 rounded-lg border border-base-800 bg-base-900/40 md:mb-0 md:rounded-none md:border-0 md:bg-transparent"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditError(null);
                    setExpandedId((prev) => (prev === contact.id ? null : contact.id));
                  }}
                  className="grid w-full min-w-0 gap-2 px-4 py-3 text-left text-sm hover:bg-base-900/60 md:grid-cols-5 md:gap-4"
                >
                  <div className="md:hidden min-w-0">
                    <div className="truncate text-base font-semibold text-text-base">
                      {displayName}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 min-w-0 overflow-hidden text-xs text-text-muted">
                      <span className="truncate">{contact.phone_e164 ?? "—"}</span>
                      <span className="truncate">•</span>
                      <span className="truncate">{contact.location?.name ?? "-"}</span>
                      <span className="truncate">•</span>
                      <span className="truncate capitalize">
                        {contact.status.replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>
                  <span className="hidden md:inline">{displayName}</span>
                  <span className="hidden md:inline">{contact.phone_e164 ?? "—"}</span>
                  <span className="hidden md:inline">{contact.location?.name ?? "-"}</span>
                  <span className="hidden capitalize md:inline">
                    {contact.status.replaceAll("_", " ")}
                  </span>
                  <span className="hidden flex-wrap gap-2 md:flex">
                    {(contact.labels ?? []).length ? (
                      (contact.labels ?? []).map((label) => <Chip key={label.id} label={label.name} />)
                    ) : (
                      <span className="text-xs text-text-muted">Keine Labels</span>
                    )}
                  </span>
                </button>

                {expandedId === contact.id ? (
                  <div className="border-t border-base-800 bg-base-900/40 px-4 py-4">
                    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                      <div className="space-y-3">
                        {isEditing ? (
                          <>
                            <div>
                              <label className="text-xs uppercase text-text-muted">Name</label>
                              <Input
                                placeholder="Kontaktname"
                                value={formName}
                                onChange={(event) => setFormName(event.target.value)}
                              />
                            </div>

                            <div>
                              <label className="text-xs uppercase text-text-muted">Telefon</label>
                              <Input
                                placeholder="+49..."
                                value={formPhone}
                                onChange={(event) => setFormPhone(event.target.value)}
                              />
                            </div>

                            <div>
                              <label className="text-xs uppercase text-text-muted">Standort</label>
                              <select
                                className="w-full rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
                                value={formLocationId}
                                onChange={(event) => setFormLocationId(event.target.value)}
                              >
                                <option value="">Kein Standort</option>
                                {locations.map((location) => (
                                  <option key={location.id} value={location.id}>
                                    {location.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </>
                        ) : null}

                        <label className="text-xs uppercase text-text-muted">Status</label>
                        <select
                          className="w-full rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
                          value={contact.status}
                          onChange={(event) => handleStatusChange(contact.id, event.target.value)}
                        >
                          {statusOptions.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>

                        <div className="flex flex-wrap gap-2">
                          {!isEditing ? (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setIsEditing(true);
                                setEditError(null);
                                setFormName(contact.name ?? "");
                                setFormPhone(contact.phone_e164 ?? "");
                                setFormLocationId(contact.location_id ?? contact.location?.id ?? "");
                                setFormNotes(contact.notes ?? "");
                              }}
                            >
                              Bearbeiten
                            </Button>
                          ) : (
                            <>
                              <Button
                                onClick={() => handleEditContact(contact)}
                                disabled={editSaving}
                              >
                                Speichern
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setIsEditing(false);
                                  setEditError(null);
                                  setFormName(contact.name ?? "");
                                  setFormPhone(contact.phone_e164 ?? "");
                                  setFormLocationId(
                                    contact.location_id ?? contact.location?.id ?? ""
                                  );
                                  setFormNotes(contact.notes ?? "");
                                }}
                                disabled={editSaving}
                              >
                                Abbrechen
                              </Button>
                            </>
                          )}

                          <Button
                            variant="outline"
                            className="border-red-600 text-red-400 hover:bg-red-950"
                            onClick={() => handleDeleteContact(contact)}
                            disabled={deleteSaving}
                          >
                            Kontakt löschen
                          </Button>
                        </div>

                        <Button
                          variant="outline"
                          onClick={() => navigator.clipboard.writeText(contact.phone_e164 ?? "")}
                        >
                          Nummer kopieren
                        </Button>

                        {savingId === contact.id ? (
                          <p className="text-xs text-text-muted">Speichern...</p>
                        ) : null}

                        {editSaving ? (
                          <p className="text-xs text-text-muted">Bearbeitung speichern...</p>
                        ) : null}

                        {editError ? (
                          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                            <div className="font-medium text-amber-200">
                              Fehler beim Speichern
                            </div>
                            <pre className="mt-2 whitespace-pre-wrap break-words overflow-hidden text-xs text-amber-100">
                              {editError}
                            </pre>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-xs uppercase text-text-muted">Label suchen</label>
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
                                        onClick={() => handleAssignLabel(contact.id, label)}
                                      />
                                    ))
                                  ) : (
                                    <span className="text-xs text-text-muted">Keine Labels verfügbar</span>
                                  )}
                                </div>
                              </SortableContext>
                            </DroppableZone>

                            <DroppableZone id="assigned">
                              <div className="mb-2 text-xs uppercase text-text-muted">
                                Labels dieses Kontakts
                              </div>
                              <SortableContext items={assignedLabelIds} strategy={verticalListSortingStrategy}>
                                <div className="flex flex-wrap gap-2">
                                  {(contact.labels ?? []).length ? (
                                    (contact.labels ?? []).map((label) => (
                                      <SortableLabel
                                        key={label.id}
                                        id={label.id}
                                        label={label.name}
                                        onClick={() => handleRemoveLabel(contact.id, label.id)}
                                      />
                                    ))
                                  ) : (
                                    <span className="text-xs text-text-muted">Noch keine Labels zugewiesen</span>
                                  )}
                                </div>
                              </SortableContext>
                            </DroppableZone>
                          </div>

                          <DroppableZone
                            id="remove"
                            className="mt-4 border-dashed text-xs text-text-muted pointer-events-auto relative z-10"
                            onDragOver={(event) => {
                              event.preventDefault();
                              debugDndLog("drag over remove zone", { contactId: contact.id });
                            }}
                            onDrop={handleRemoveDrop}
                          >
                            Label hierhin ziehen zum Entfernen
                          </DroppableZone>
                        </DndContext>

                        <div className="rounded-lg border border-base-800 bg-base-900/40 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs uppercase text-text-muted">Akte</div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setUploadType("consent");
                                  fileInputRef.current?.click();
                                }}
                              >
                                Einwilligung hochladen
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setUploadType("stencil");
                                  fileInputRef.current?.click();
                                }}
                              >
                                Stencil hochladen
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setUploadType("photo");
                                  fileInputRef.current?.click();
                                }}
                              >
                                Foto hochladen
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setUploadType("other");
                                  fileInputRef.current?.click();
                                }}
                              >
                                Sonstiges hochladen
                              </Button>
                            </div>
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={async (event) => {
                              const input = event.target as HTMLInputElement;
                              if (!input.files?.[0] || !uploadType || !expandedId) return;

                              const fd = new FormData();
                              fd.append("file", input.files[0]);
                              fd.append("file_type", uploadType);

                              const res = await fetchWithAuth(
                                `/api/contacts/${expandedId}/files`,
                                { method: "POST", body: fd }
                              );

                              if (res.ok) {
                                alert("Upload folgt als nächster Schritt.");
                                await loadFilesForContact(expandedId);
                              }

                              setUploadType(null);
                              input.value = "";
                            }}
                          />

                          <div className="mt-3 grid gap-2 text-xs text-text-muted sm:grid-cols-2 lg:grid-cols-4">
                            {fileGroups.map((group) => (
                              <div
                                key={group.key}
                                className="rounded-md border border-base-800 bg-base-900/60 px-3 py-2"
                              >
                                <div className="text-[11px] uppercase text-text-muted">
                                  {group.label}
                                </div>
                                <div className="text-sm font-semibold text-text-primary">
                                  {fileCounts[group.key] ?? 0}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 space-y-2 text-sm">
                            {files.length ? (
                              <ul className="space-y-2">
                                {files.map((file) => (
                                  <li
                                    key={file.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-base-800 bg-base-900/60 px-3 py-2"
                                  >
                                    <span className="text-xs uppercase text-text-muted">
                                      {file.file_type}
                                    </span>
                                    <span className="flex-1 text-sm text-text-primary">
                                      {file.file_name}
                                    </span>
                                    <span className="text-xs text-text-muted">
                                      {formatFileDate(file.created_at)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-text-muted">
                                Keine Dateien vorhanden.
                              </p>
                            )}
                          </div>
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

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-base-800 bg-base-850 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Kontakt hinzufügen</h2>
                <p className="text-sm text-text-muted">Lege einen neuen Kontakt manuell an.</p>
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
                  <label className="text-xs uppercase text-text-muted">Telefon *</label>
                  <Input
                    required
                    placeholder="+49..."
                    value={createPhone}
                    onChange={(event) => setCreatePhone(event.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs uppercase text-text-muted">Standort *</label>
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
                  <p className="mt-1 text-xs text-text-muted">Kommagetrennte Labels eingeben.</p>
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
                  <div className="font-medium text-amber-200">Fehler beim Speichern</div>
                  <pre className="mt-2 whitespace-pre-wrap break-words overflow-hidden text-xs text-amber-100">
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
      </div>
    </AppShell>
  );
}
