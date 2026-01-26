# Blood Diamond Mini-CRM

## Setup

### 1) Supabase Projekt
1. Neues Supabase-Projekt erstellen.
2. SQL Migrationen ausführen: `supabase/migrations/001_init.sql` und `supabase/migrations/002_fixpack.sql`.
3. Admin-User in Supabase Auth anlegen.
4. In `profiles` den `role` auf `admin` setzen (und `location_id` optional lassen).

### 2) ENV Variablen
Lege eine `.env.local` an:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 3) App starten
```
npm install
npm run dev
```

## Import Hinweise
- Der Import akzeptiert `.csv`, `.xlsx`, `.xls` und zeigt die ersten 50 Zeilen als Preview.
- Preview zeigt neue Kontakte, Updates und Fehler (z.B. ungültige Telefonnummern).
- Import läuft serverseitig mit einem user-scoped Supabase Client und erfordert `profiles.role = 'admin'`.
- RLS schützt weiterhin alle Datenzugriffe.

## Seiten
- `/login` – Supabase Auth (Email + Passwort)
- `/` – Dashboard mit Inline-Editor (Status + Drag&Drop Labels)
- `/contacts/[id]` – Kontaktkarte mit Copy-Buttons und Templates
- `/labels` – Admin Labelverwaltung (Sortierung/Archivierung)
- `/templates` – Admin Templateverwaltung
- `/import` – XLSX/CSV Import

## Deployment (Vercel)
1. Projekt in Vercel anlegen.
2. ENV Variablen setzen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Build Command: `npm run build`
4. Output: Next.js Standard (kein Custom Output).
