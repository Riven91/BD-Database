"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function SetupEnvPage() {
  return (
    <AppShell title="Supabase Setup" subtitle="ENV Variablen konfigurieren">
      <section className="space-y-6 rounded-lg border border-base-800 bg-base-850 p-6 text-sm text-text-muted">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-text">1) Supabase Projekt erstellen</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>In Supabase ein neues Projekt anlegen.</li>
            <li>Im Dashboard unter Project Settings → API die Werte kopieren:</li>
            <li>
              <span className="font-semibold text-text">Project URL</span> und{" "}
              <span className="font-semibold text-text">Publishable (anon) key</span>.
            </li>
          </ol>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-text">2) Lokale .env.local anlegen</h2>
          <p>Lege im Projekt-Root eine Datei namens `.env.local` an:</p>
          <pre className="rounded-md border border-base-800 bg-base-900 p-3 text-xs text-text">
            NEXT_PUBLIC_SUPABASE_URL=...
            <br />
            NEXT_PUBLIC_SUPABASE_ANON_KEY=...
          </pre>
          <p className="text-xs">
            Tipp: Die Vorlage findest du in{" "}
            <Link href="/README.md#env-variablen" className="text-emerald-400 hover:underline">
              README → ENV Variablen
            </Link>
            .
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-text">3) Vercel ENV setzen</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>In Vercel die beiden Variablen unter Environment Variables anlegen.</li>
            <li>Nach dem Speichern ein Redeploy starten.</li>
          </ol>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-text">Checklist</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Supabase Project URL kopiert.</li>
            <li>Publishable (anon) key kopiert.</li>
            <li>.env.local erstellt (lokal).</li>
            <li>Vercel Environment Variables gesetzt.</li>
            <li>Deployment erneut ausgeführt.</li>
          </ul>
        </div>
      </section>
    </AppShell>
  );
}
