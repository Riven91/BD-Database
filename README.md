# Blood Diamond Mini-CRM

## Setup

### 1) Supabase Projekt
1. Neues Supabase-Projekt erstellen.
2. SQL Migrationen ausführen: `supabase/migrations/001_init.sql`, `supabase/migrations/002_fixpack.sql` und `supabase/migrations/003_relax_rls.sql`.
3. Project URL und Publishable (anon) key aus Project Settings → API kopieren.
4. Supabase Auth User für das Team anlegen (siehe /setup).

### 2) ENV Variablen
Kopiere `.env.example` zu `.env.local` und ergänze die Werte:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SETUP_TOKEN=... (ein langes, zufälliges Token)
NEXT_TELEMETRY_DISABLED=1
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

## Seiten
- `/login` – Supabase Auth (Email + Passwort)
- `/` – Dashboard mit Inline-Editor (Status + Drag&Drop Labels)
- `/contacts/[id]` – Kontaktkarte mit Copy-Buttons und Templates
- `/labels` – Labelverwaltung (Sortierung/Archivierung)
- `/templates` – Templateverwaltung
- `/setup` – Setup-Hilfe für Team-Accounts
- `/onboarding` – Standort-Auswahl nach erstem Login
- `/import` – XLSX/CSV Import

## Deployment (Vercel)
1. Projekt in Vercel anlegen.
2. Environment Variables setzen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SETUP_TOKEN`
3. Redeploy nach dem Setzen der Variablen starten.
4. Build Command: `npm run build`
5. Output: Next.js Standard (kein Custom Output).
