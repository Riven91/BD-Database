# Blood Diamond Mini-CRM

## Setup

### 1) Supabase Projekt (einmalig)
1. Neues Supabase-Projekt erstellen.
2. API-Anmeldedaten abrufen: Project URL + Anon Key (siehe Supabase → Project Settings → API).
3. SQL Migrationen ausführen: `supabase/migrations/001_init.sql`, `supabase/migrations/002_fixpack.sql`, `supabase/migrations/003_relax_rls.sql`, `supabase/migrations/004_debug_health.sql`, `supabase/migrations/005_core_schema.sql`.
4. Supabase Auth User für das Team anlegen (siehe /setup).

### 2) ENV Variablen
Lege eine `.env.local` an:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SETUP_TOKEN=... (ein langes, zufälliges Token)
```

### 3) App starten
```
npm install
npm run dev
```

## Setup: Team Logins
1. Öffne `/setup` in der App.
2. Erstelle die vier User manuell in Supabase (Authentication → Users → Add user).
3. Loggt sich ein User das erste Mal ein, wird automatisch ein `profiles`-Eintrag erstellt.
4. Danach wählt jede Person einmalig ihren Standort unter `/onboarding`.

## Import Hinweise
- Der Import akzeptiert `.csv`, `.xlsx`, `.xls` und zeigt die ersten 50 Zeilen als Preview.
- Preview zeigt neue Kontakte, Updates und Fehler (z.B. ungültige Telefonnummern).
- Import läuft serverseitig mit einem user-scoped Supabase Client.
- RLS ist für v1 auf alle authentifizierten Nutzer geöffnet.

## Supabase Hinweise (RLS, Schema, MCP)
- RLS ist standardmäßig aktiv: Ohne Policies blockiert Supabase Lese-/Schreibzugriffe.
- Für Tests kannst du RLS deaktivieren (nicht empfohlen), besser: Policies in den Migrationen prüfen/anpassen.
- Tabellen müssen physisch in der DB existieren: entweder per SQL Editor (Migrationen) oder Table Editor.
- Moderne KI-Workflows: Mit dem Supabase MCP Server (z.B. in Cursor/VS Code) kann die KI nach OAuth-Zugriff direkt Schema/Abfragen synchronisieren.

## Seiten
- `/login` – Supabase Auth (Email + Passwort)
- `/` – Dashboard mit Inline-Editor (Status + Label-Dropdown)
- `/contacts/[id]` – Kontaktkarte mit Copy-Buttons und Templates
- `/labels` – Labelverwaltung (Archivierung)
- `/templates` – Templateverwaltung
- `/setup` – Setup-Hilfe für Team-Accounts
- `/onboarding` – Standort-Auswahl nach erstem Login
- `/import` – XLSX/CSV Import

## Deployment (Vercel)
1. Projekt in Vercel anlegen.
2. ENV Variablen setzen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SETUP_TOKEN`
3. Build Command: `npm run build`
4. Output: Next.js Standard (kein Custom Output).
