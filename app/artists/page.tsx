"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Input } from "@/components/ui";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

type Artist = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const validateName = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return { ok: false, name: trimmed, message: "Name muss mindestens 2 Zeichen haben." };
  }
  return { ok: true, name: trimmed, message: "" };
};

const resolveErrorMessage = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes("duplicate") || lower.includes("unique")) {
    return "Name existiert bereits.";
  }
  return message;
};

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newArtistName, setNewArtistName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadArtists = async () => {
    setIsLoading(true);
    const response = await fetchWithAuth("/api/artists");
    if (!response.ok) {
      const text = await response.text();
      setErrorMessage(text || "Artists konnten nicht geladen werden.");
      setIsLoading(false);
      return;
    }
    const payload = await response.json();
    setArtists(payload.artists ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    loadArtists();
  }, []);

  const filteredArtists = useMemo(() => {
    const query = search.trim().toLowerCase();
    return artists
      .filter((artist) => (showInactive ? true : artist.is_active))
      .filter((artist) => (query ? artist.name.toLowerCase().includes(query) : true))
      .slice()
      .sort((a, b) => {
        if (a.is_active !== b.is_active) {
          return a.is_active ? -1 : 1;
        }
        return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
      });
  }, [artists, search, showInactive]);

  const parseError = async (response: Response) => {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      if (payload?.error) {
        return resolveErrorMessage(String(payload.error));
      }
      return resolveErrorMessage(JSON.stringify(payload));
    }
    const text = await response.text();
    return resolveErrorMessage(text || "Aktion fehlgeschlagen.");
  };

  const handleCreate = async () => {
    const validation = validateName(newArtistName);
    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }
    const response = await fetchWithAuth("/api/artists", {
      method: "POST",
      body: JSON.stringify({ name: validation.name })
    });
    if (!response.ok) {
      const message = await parseError(response);
      setErrorMessage(message);
      return;
    }
    setNewArtistName("");
    setShowCreate(false);
    setErrorMessage("");
    await loadArtists();
  };

  const updateArtist = async (artistId: string, updates: Partial<Artist>) => {
    const response = await fetchWithAuth(`/api/artists/${artistId}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });
    if (!response.ok) {
      const message = await parseError(response);
      setErrorMessage(message);
      return false;
    }
    setErrorMessage("");
    await loadArtists();
    return true;
  };

  const handleRename = async (artistId: string) => {
    const validation = validateName(editName);
    if (!validation.ok) {
      setErrorMessage(validation.message);
      return;
    }
    const ok = await updateArtist(artistId, { name: validation.name });
    if (ok) {
      setEditingId(null);
      setEditName("");
    }
  };

  return (
    <AppShell title="Artists">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <Input
            placeholder="Artists suchen"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => setShowInactive((prev) => !prev)}>
          {showInactive ? "Nur aktive anzeigen" : "Inaktive anzeigen"}
        </Button>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          Artist hinzufügen
        </Button>
      </div>

      {showCreate ? (
        <div className="mb-6 rounded-md border border-base-800 bg-base-850 p-4">
          <div className="mb-3 text-sm font-medium text-text-base">
            Neuer Artist
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Name"
              value={newArtistName}
              onChange={(event) => setNewArtistName(event.target.value)}
              className="max-w-sm"
            />
            <Button variant="primary" onClick={handleCreate}>
              Speichern
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setNewArtistName("");
                setErrorMessage("");
              }}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mb-4 rounded-md border border-red-500/60 bg-red-500/10 p-3 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-base-800">
        <table className="min-w-full divide-y divide-base-800 text-sm">
          <thead className="bg-base-900 text-left text-text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-800">
            {filteredArtists.map((artist) => (
              <tr key={artist.id} className="bg-base-950">
                <td className="px-4 py-3">
                  {editingId === artist.id ? (
                    <Input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="max-w-xs"
                    />
                  ) : (
                    <span>{artist.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {artist.is_active ? "Aktiv" : "Inaktiv"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {editingId === artist.id ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => handleRename(artist.id)}
                        >
                          Speichern
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingId(null);
                            setEditName("");
                            setErrorMessage("");
                          }}
                        >
                          Abbrechen
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingId(artist.id);
                          setEditName(artist.name);
                        }}
                      >
                        Umbenennen
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() =>
                        updateArtist(artist.id, { is_active: !artist.is_active })
                      }
                    >
                      {artist.is_active ? "Deaktivieren" : "Aktivieren"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredArtists.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-text-muted" colSpan={3}>
                  {isLoading ? "Lade Artists..." : "Keine Artists gefunden."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
