"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Input } from "@/components/ui";

const teamAccounts = [
  { email: "artist1@local", label: "Artist 1" },
  { email: "artist2@local", label: "Artist 2" },
  { email: "artist3@local", label: "Artist 3" },
  { email: "studio@local", label: "Studio" }
];

export default function SetupPage() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSeed = async () => {
    setIsSubmitting(true);
    setStatus(null);
    const response = await fetch("/api/setup/seed-users", {
      method: "POST",
      headers: { "x-setup-token": token }
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Setup fehlgeschlagen" }));
      setStatus(payload.error ?? "Setup fehlgeschlagen");
    } else {
      const payload = await response.json();
      setStatus(payload.message ?? "Setup bestätigt");
    }
    setIsSubmitting(false);
  };

  return (
    <AppShell title="Setup" subtitle="Team-Accounts vorbereiten">
      <section className="space-y-4 rounded-lg border border-base-800 bg-base-850 p-4">
        <div>
          <h2 className="text-lg font-semibold">1) Supabase Users manuell anlegen</h2>
          <p className="text-sm text-text-muted">
            Öffne Supabase → Authentication → Users → Add user. Lege die folgenden
            Accounts mit einem Passwort an (kein E-Mail-Versand notwendig):
          </p>
          <ul className="mt-2 list-disc pl-6 text-sm text-text-muted">
            {teamAccounts.map((account) => (
              <li key={account.email}>
                {account.label}: {account.email}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-semibold">2) Profiles anlegen</h2>
          <p className="text-sm text-text-muted">
            Beim ersten Login wird automatisch ein Profile-Eintrag erstellt.
            Anschließend wählt jede Person einmalig ihren Standort.
          </p>
        </div>
        <div className="space-y-2">
          <Input
            placeholder="SETUP_TOKEN"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          <Button variant="primary" onClick={handleSeed} disabled={isSubmitting}>
            {isSubmitting ? "Prüfe..." : "Create Profiles"}
          </Button>
          {status ? <p className="text-sm text-text-muted">{status}</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
