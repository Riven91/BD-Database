-- Labels metadata
alter table public.labels
  add column if not exists sort_order int not null default 1000;

alter table public.labels
  alter column is_archived set default false;

-- Update contact status values
alter table public.contacts drop constraint if exists contacts_status_check;

update public.contacts set status = 'tattoo_termin' where status = 'termin';
update public.contacts set status = 'tot' where status = 'verloren';

alter table public.contacts
  add constraint contacts_status_check
  check (status in ('neu','in_bearbeitung','tattoo_termin','abgeschlossen','tot'));

-- Seed locations
insert into public.locations (name, is_admin_only)
values
  ('Pforzheim', false),
  ('Böblingen', false),
  ('Heilbronn', false),
  ('Unbekannt', true)
on conflict (name) do nothing;

-- Seed labels
insert into public.labels (name, sort_order, is_archived)
values
  ('Januar', 10, false),
  ('Februar', 11, false),
  ('März', 12, false),
  ('April', 13, false),
  ('Mai', 14, false),
  ('Juni', 15, false),
  ('Juli', 16, false),
  ('August', 17, false),
  ('September', 18, false),
  ('Oktober', 19, false),
  ('November', 20, false),
  ('Dezember', 21, false),
  ('Bestandskunde', 100, false),
  ('Budget', 110, false),
  ('Erstgespräch gebucht', 120, false),
  ('Tattoo-Termin gebucht', 130, false),
  ('warten auf Anzahlung', 140, false),
  ('im Kontaktgespräch', 150, false),
  ('Rücksprache', 160, false),
  ('keine Antwort', 170, false),
  ('keine Reaktion dreimal', 180, false),
  ('Lead meldet sich bei Bedarf', 190, false),
  ('niedrige Prio', 200, false),
  ('Gutschein-Reminder', 210, false),
  ('SMS noch offen', 220, false),
  ('kein WhatsApp', 230, false),
  ('minderjährig', 240, false),
  ('nicht zum Gespräch', 250, false),
  ('Fragezeichen', 260, false),
  ('toter Lead', 270, false),
  ('2027', 280, false)
on conflict (name) do update set
  sort_order = excluded.sort_order,
  is_archived = false;
