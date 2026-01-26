"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui";

type Location = {
  id: string;
  name: string;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const profileResponse = await fetch("/api/profile", { method: "POST" });
      if (profileResponse.status === 401) {
        router.push("/login");
        return;
      }
      const profilePayload = await profileResponse.json();
      if (profilePayload.profile?.location_id) {
        router.push("/");
        return;
      }
      const locationsResponse = await fetch("/api/locations");
      if (locationsResponse.ok) {
        const payload = await locationsResponse.json();
        setLocations(payload.locations ?? []);
      }
      setLoading(false);
    };

    loadData();
  }, [router]);

  const handleSave = async () => {
    if (!selectedLocation) {
      setError("Bitte Standort auswählen");
      return;
    }
    setSaving(true);
    setError(null);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location_id: selectedLocation })
    });
    if (!response.ok) {
      setError("Standort konnte nicht gespeichert werden");
      setSaving(false);
      return;
    }
    router.push("/");
  };

  return (
    <AppShell title="Onboarding" subtitle="Standort auswählen">
      <section className="space-y-4 rounded-lg border border-base-800 bg-base-850 p-4">
        {loading ? (
          <p className="text-sm text-text-muted">Lade Standorte...</p>
        ) : (
          <>
            <div>
              <label className="mb-2 block text-sm text-text-muted">Standort</label>
              <select
                value={selectedLocation}
                onChange={(event) => setSelectedLocation(event.target.value)}
                className="w-full rounded-md border border-base-800 bg-base-900 px-3 py-2 text-sm"
              >
                <option value="">Bitte auswählen</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Speichern..." : "Standort speichern"}
            </Button>
          </>
        )}
      </section>
    </AppShell>
  );
}
