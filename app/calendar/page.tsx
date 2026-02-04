"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Input, Textarea } from "@/components/ui";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

type Location = {
  id: string;
  name: string;
};

type Artist = {
  id: string;
  name: string;
  is_active: boolean;
};

type Slot = {
  id: string;
  start_at: string;
  end_at: string;
  note: string | null;
  artist: Artist | null;
  location: Location | null;
};

type SlotFormState = {
  artistId: string;
  locationId: string;
  startAt: string;
  endAt: string;
  note: string;
};

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfWeek = (date: Date) => {
  const current = new Date(date);
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + diff);
  current.setHours(0, 0, 0, 0);
  return current;
};

const startOfMonth = (date: Date) => {
  const current = new Date(date);
  current.setDate(1);
  current.setHours(0, 0, 0, 0);
  return current;
};

const formatDateTimeLocal = (value: string) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit"
  });

export default function CalendarPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [locationFilter, setLocationFilter] = useState("all");
  const [rangeType, setRangeType] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [formState, setFormState] = useState<SlotFormState>({
    artistId: "",
    locationId: "",
    startAt: "",
    endAt: "",
    note: ""
  });

  const activeArtists = useMemo(
    () => artists.filter((artist) => artist.is_active),
    [artists]
  );

  const { rangeStart, rangeEnd } = useMemo(() => {
    const baseDate = new Date(`${selectedDate}T00:00:00`);
    if (rangeType === "month") {
      const start = startOfMonth(baseDate);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      return { rangeStart: start, rangeEnd: end };
    }
    const start = startOfWeek(baseDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { rangeStart: start, rangeEnd: end };
  }, [rangeType, selectedDate]);

  const loadFilters = async () => {
    const [locationsResponse, artistsResponse] = await Promise.all([
      fetchWithAuth("/api/locations"),
      fetchWithAuth("/api/artists")
    ]);

    if (locationsResponse.ok) {
      const payload = await locationsResponse.json();
      setLocations(payload.locations ?? []);
    }

    if (artistsResponse.ok) {
      const payload = await artistsResponse.json();
      setArtists(payload.artists ?? []);
    }
  };

  const loadSlots = async () => {
    setIsLoading(true);
    const params = new URLSearchParams({
      location_id: locationFilter,
      start: toISODate(rangeStart),
      end: toISODate(rangeEnd)
    });

    const response = await fetchWithAuth(`/api/availability?${params.toString()}`);
    if (!response.ok) {
      const text = await response.text();
      setErrorMessage(text || "Slots konnten nicht geladen werden.");
      setIsLoading(false);
      return;
    }

    const payload = await response.json();
    setSlots(payload.slots ?? []);
    setErrorMessage("");
    setIsLoading(false);
  };

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadSlots();
  }, [locationFilter, rangeStart, rangeEnd]);

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    slots.forEach((slot) => {
      const slotStart = new Date(slot.start_at);
      const groupDate = slotStart < rangeStart ? rangeStart : slotStart;
      const key = toISODate(groupDate);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(slot);
    });
    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      items
    }));
  }, [slots]);

  const openCreate = () => {
    const now = new Date();
    const later = new Date(now);
    later.setHours(later.getHours() + 1);
    setEditingSlot(null);
    setFormState({
      artistId: activeArtists[0]?.id ?? "",
      locationId: locations[0]?.id ?? "",
      startAt: formatDateTimeLocal(now.toISOString()),
      endAt: formatDateTimeLocal(later.toISOString()),
      note: ""
    });
    setErrorMessage("");
    setShowForm(true);
  };

  const openEdit = (slot: Slot) => {
    setEditingSlot(slot);
    setFormState({
      artistId: slot.artist?.id ?? "",
      locationId: slot.location?.id ?? "",
      startAt: formatDateTimeLocal(slot.start_at),
      endAt: formatDateTimeLocal(slot.end_at),
      note: slot.note ?? ""
    });
    setErrorMessage("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingSlot(null);
  };

  const handleSave = async () => {
    if (
      !formState.artistId ||
      !formState.locationId ||
      !formState.startAt ||
      !formState.endAt
    ) {
      setErrorMessage("Bitte fülle alle Pflichtfelder aus.");
      return;
    }

    if (new Date(formState.endAt) <= new Date(formState.startAt)) {
      setErrorMessage("Ende muss nach dem Start liegen.");
      return;
    }

    const payload = {
      artist_id: formState.artistId,
      location_id: formState.locationId,
      start_at: formState.startAt,
      end_at: formState.endAt,
      note: formState.note?.trim() || null
    };

    const response = await fetchWithAuth(
      editingSlot ? `/api/availability/${editingSlot.id}` : "/api/availability",
      {
        method: editingSlot ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const text = await response.text();
      setErrorMessage(text || "Speichern fehlgeschlagen.");
      return;
    }

    closeForm();
    await loadSlots();
  };

  const handleDelete = async (slotId: string) => {
    if (!window.confirm("Slot wirklich löschen?")) {
      return;
    }
    const response = await fetchWithAuth(`/api/availability/${slotId}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      const text = await response.text();
      setErrorMessage(text || "Löschen fehlgeschlagen.");
      return;
    }
    await loadSlots();
  };

  return (
    <AppShell
      title="Kalender"
      subtitle="Artist Availability"
      action={
        <Button variant="primary" onClick={openCreate}>
          Slot hinzufügen
        </Button>
      }
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="min-w-[220px]">
          <label className="mb-1 block text-xs text-text-muted">Standort</label>
          <select
            className="w-full rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
          >
            <option value="all">Alle Standorte</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs text-text-muted">Zeitraum</label>
          <select
            className="w-full rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
            value={rangeType}
            onChange={(event) =>
              setRangeType(event.target.value === "month" ? "month" : "week")
            }
          >
            <option value="week">Woche</option>
            <option value="month">Monat</option>
          </select>
        </div>
        <div className="min-w-[200px]">
          <label className="mb-1 block text-xs text-text-muted">Datum</label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </div>
        <div className="flex items-end gap-2 pt-5">
          <Button
            variant="outline"
            onClick={() => {
              setRangeType("week");
              setSelectedDate(toISODate(new Date()));
            }}
          >
            Diese Woche
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const next = new Date();
              next.setDate(next.getDate() + 7);
              setRangeType("week");
              setSelectedDate(toISODate(next));
            }}
          >
            Nächste Woche
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="mb-4 rounded-md border border-red-500/60 bg-red-500/10 p-3 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="space-y-6">
        {groupedSlots.map((group) => (
          <div
            key={group.date}
            className="overflow-hidden rounded-md border border-base-800"
          >
            <div className="bg-base-900 px-4 py-3 text-sm font-medium text-text-muted">
              {new Date(`${group.date}T00:00:00`).toLocaleDateString("de-DE", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric"
              })}
            </div>
            <div className="divide-y divide-base-800">
              {group.items.map((slot) => (
                <div key={slot.id} className="flex flex-wrap gap-4 px-4 py-4">
                  <div className="min-w-[180px]">
                    <div className="text-sm font-semibold text-text-base">
                      {slot.artist?.name ?? "Unbekannt"}
                    </div>
                    <div className="text-xs text-text-muted">
                      {formatTime(slot.start_at)}–{formatTime(slot.end_at)}
                    </div>
                  </div>
                  <div className="min-w-[160px] text-sm text-text-muted">
                    {slot.location?.name ?? "Kein Standort"}
                  </div>
                  <div className="flex-1 text-sm text-text-muted">
                    {slot.note ? (
                      <span className="text-xs">{slot.note}</span>
                    ) : (
                      <span className="text-xs">Keine Notiz</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => openEdit(slot)}>
                      Bearbeiten
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDelete(slot.id)}
                    >
                      Löschen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {groupedSlots.length === 0 ? (
          <div className="rounded-md border border-base-800 bg-base-900 p-6 text-sm text-text-muted">
            {isLoading ? "Lade Slots..." : "Keine Slots im gewählten Zeitraum."}
          </div>
        ) : null}
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-lg rounded-md border border-base-800 bg-base-950 p-6">
            <div className="mb-4 text-lg font-semibold text-text-base">
              {editingSlot ? "Slot bearbeiten" : "Slot hinzufügen"}
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-text-muted">
                  Artist
                </label>
                <select
                  className="w-full rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
                  value={formState.artistId}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      artistId: event.target.value
                    }))
                  }
                >
                  <option value="">Artist wählen</option>
                  {activeArtists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">
                  Standort
                </label>
                <select
                  className="w-full rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
                  value={formState.locationId}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      locationId: event.target.value
                    }))
                  }
                >
                  <option value="">Standort wählen</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-text-muted">
                    Start
                  </label>
                  <Input
                    type="datetime-local"
                    value={formState.startAt}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        startAt: event.target.value
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">
                    Ende
                  </label>
                  <Input
                    type="datetime-local"
                    value={formState.endAt}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        endAt: event.target.value
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">
                  Notiz
                </label>
                <Textarea
                  rows={3}
                  value={formState.note}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      note: event.target.value
                    }))
                  }
                />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={closeForm}>
                Abbrechen
              </Button>
              <Button variant="primary" onClick={handleSave}>
                Speichern
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
