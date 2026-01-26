-- Extensions
create extension if not exists "pgcrypto";

-- Tables
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_admin_only boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','staff')),
  location_id uuid null references public.locations(id),
  created_at timestamptz default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  gender text null,
  first_name text null,
  last_name text null,
  full_name text generated always as (
    trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
  ) stored,
  phone_raw text null,
  phone_e164 text not null unique,
  email text null,
  telegram text null,
  source_origin text null,
  form_size text null,
  artist_booking text null,
  created_in_system_at timestamptz null,
  date_erstgespraech date null,
  date_tattoo_termin date null,
  price_deposit_cents int null,
  price_total_cents int null,
  last_sent_at timestamptz null,
  last_received_at timestamptz null,
  notes text null,
  status text not null default 'neu' check (status in ('neu','in_bearbeitung','termin','abgeschlossen','verloren')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text null,
  is_archived boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.contact_labels (
  contact_id uuid references public.contacts(id) on delete cascade,
  label_id uuid references public.labels(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (contact_id, label_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  due_at timestamptz not null,
  type text not null default 'follow_up',
  status text not null default 'offen' check (status in ('offen','erledigt')),
  note text null,
  created_at timestamptz default now()
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  body text not null,
  is_archived boolean not null default false,
  created_at timestamptz default now()
);

-- Trigger for updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_contacts_updated_at on public.contacts;
create trigger set_contacts_updated_at
before update on public.contacts
for each row
execute function public.set_updated_at();

-- Indexes
create index if not exists contacts_location_status_idx on public.contacts(location_id, status);
create index if not exists contacts_updated_at_idx on public.contacts(updated_at);
create index if not exists tasks_contact_due_status_idx on public.tasks(contact_id, due_at, status);
create index if not exists contact_labels_label_idx on public.contact_labels(label_id);
create index if not exists contact_labels_contact_idx on public.contact_labels(contact_id);

-- Helper function
create or replace function public.current_profile()
returns public.profiles
language sql
stable
as $$
  select * from public.profiles where id = auth.uid();
$$;

-- RLS
alter table public.locations enable row level security;
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.labels enable row level security;
alter table public.contact_labels enable row level security;
alter table public.tasks enable row level security;
alter table public.message_templates enable row level security;

-- Policies: profiles
create policy "profiles_self_read" on public.profiles
  for select
  using (id = auth.uid());

create policy "profiles_admin_read" on public.profiles
  for select
  using ((current_profile()).role = 'admin');

-- Policies: locations
create policy "locations_admin_all" on public.locations
  for all
  using ((current_profile()).role = 'admin');

create policy "locations_staff_read" on public.locations
  for select
  using (
    (current_profile()).role = 'staff'
    and id = (current_profile()).location_id
    and is_admin_only = false
  );

-- Policies: contacts
create policy "contacts_admin_all" on public.contacts
  for all
  using ((current_profile()).role = 'admin')
  with check ((current_profile()).role = 'admin');

create policy "contacts_staff_select" on public.contacts
  for select
  using (
    (current_profile()).role = 'staff'
    and location_id = (current_profile()).location_id
  );

create policy "contacts_staff_write" on public.contacts
  for insert
  with check (
    (current_profile()).role = 'staff'
    and location_id = (current_profile()).location_id
    and location_id in (select id from public.locations where is_admin_only = false)
  );

create policy "contacts_staff_update" on public.contacts
  for update
  using (
    (current_profile()).role = 'staff'
    and location_id = (current_profile()).location_id
  )
  with check (
    (current_profile()).role = 'staff'
    and location_id = (current_profile()).location_id
    and location_id in (select id from public.locations where is_admin_only = false)
  );

-- Policies: tasks
create policy "tasks_admin_all" on public.tasks
  for all
  using ((current_profile()).role = 'admin')
  with check ((current_profile()).role = 'admin');

create policy "tasks_staff_read" on public.tasks
  for select
  using (
    (current_profile()).role = 'staff'
    and exists (
      select 1 from public.contacts
      where public.contacts.id = tasks.contact_id
      and public.contacts.location_id = (current_profile()).location_id
    )
  );

create policy "tasks_staff_write" on public.tasks
  for insert
  with check (
    (current_profile()).role = 'staff'
    and exists (
      select 1 from public.contacts
      where public.contacts.id = tasks.contact_id
      and public.contacts.location_id = (current_profile()).location_id
    )
  );

create policy "tasks_staff_update" on public.tasks
  for update
  using (
    (current_profile()).role = 'staff'
    and exists (
      select 1 from public.contacts
      where public.contacts.id = tasks.contact_id
      and public.contacts.location_id = (current_profile()).location_id
    )
  )
  with check (
    (current_profile()).role = 'staff'
    and exists (
      select 1 from public.contacts
      where public.contacts.id = tasks.contact_id
      and public.contacts.location_id = (current_profile()).location_id
    )
  );

-- Policies: labels
create policy "labels_admin_all" on public.labels
  for all
  using ((current_profile()).role = 'admin')
  with check ((current_profile()).role = 'admin');

create policy "labels_staff_read" on public.labels
  for select
  using ((current_profile()).role = 'staff');

-- Policies: contact_labels
create policy "contact_labels_admin_all" on public.contact_labels
  for all
  using ((current_profile()).role = 'admin')
  with check ((current_profile()).role = 'admin');

create policy "contact_labels_staff_select" on public.contact_labels
  for select
  using (
    (current_profile()).role = 'staff'
    and exists (
      select 1 from public.contacts
      where public.contacts.id = contact_labels.contact_id
      and public.contacts.location_id = (current_profile()).location_id
    )
  );

create policy "contact_labels_staff_write" on public.contact_labels
  for insert
  with check (
    (current_profile()).role = 'staff'
    and exists (
      select 1 from public.contacts
      where public.contacts.id = contact_labels.contact_id
      and public.contacts.location_id = (current_profile()).location_id
    )
    and exists (
      select 1 from public.labels
      where public.labels.id = contact_labels.label_id
      and public.labels.is_archived = false
    )
  );

create policy "contact_labels_staff_delete" on public.contact_labels
  for delete
  using (
    (current_profile()).role = 'staff'
    and exists (
      select 1 from public.contacts
      where public.contacts.id = contact_labels.contact_id
      and public.contacts.location_id = (current_profile()).location_id
    )
  );

-- Policies: message_templates
create policy "templates_admin_all" on public.message_templates
  for all
  using ((current_profile()).role = 'admin')
  with check ((current_profile()).role = 'admin');

create policy "templates_staff_read" on public.message_templates
  for select
  using ((current_profile()).role = 'staff');

-- Seed data
insert into public.locations (name, is_admin_only)
values
  ('Pforzheim', false),
  ('Böblingen', false),
  ('Heilbronn', false),
  ('Unbekannt', true)
on conflict (name) do nothing;

insert into public.message_templates (title, body)
values
  ('Nummernwechsel', 'Hallo {vorname}, wir haben eine neue Nummer für {standort}. Bitte aktualisieren.'),
  ('Reaktivierung freundlich', 'Hi {vorname}, wir wollten uns freundlich melden. Gibt es Neuigkeiten?'),
  ('Termin bestätigen', 'Hallo {vorname}, hiermit bestätigen wir deinen Termin in {standort}.')
on conflict (title) do nothing;
