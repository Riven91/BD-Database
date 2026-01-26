# Blood Diamond Mini-CRM

## Setup

### 1) Supabase Projekt
1. Neues Supabase-Projekt erstellen.
2. SQL Migration ausführen: `supabase/migrations/001_init.sql`.
3. Admin-User in Supabase Auth anlegen.
4. In `profiles` den `role` auf `admin` setzen (und `location_id` optional lassen).

### 2) ENV Variablen
Lege eine `.env.local` an:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 3) App starten
```
npm install
npm run dev
```

## Import Hinweise
- Der Import erwartet die Datei `blood_d_kontakte_dedupe_nach_standort.csv` (clientseitig uploaden).
- Preview zeigt neue Kontakte, Updates und Fehler (z.B. ungültige Telefonnummern).
- Import läuft serverseitig über den Service Role Key, UI bleibt per RLS geschützt.

## Seiten
- `/login` – Supabase Auth (Email + Passwort)
- `/` – Kontaktliste mit Filter/Status/Systemlabels
- `/contacts/[id]` – Kontaktkarte mit Copy-Buttons, Templates, Tasks
- `/labels` – Admin Labelverwaltung
- `/templates` – Admin Templateverwaltung
- `/import` – CSV Import
