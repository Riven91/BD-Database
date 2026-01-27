create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  is_archived boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone_raw text,
  phone_e164 text unique,
  location text,
  status text not null default 'neu',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'contacts_status_check'
  ) then
    alter table public.contacts drop constraint contacts_status_check;
  end if;
end$$;

alter table public.contacts
  add constraint contacts_status_check
  check (status in ('neu','in_bearbeitung','tattoo_termin','abgeschlossen','tot'));

create table if not exists public.contact_labels (
  contact_id uuid references public.contacts(id) on delete cascade,
  label_id uuid references public.labels(id) on delete cascade,
  primary key (contact_id, label_id)
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.message_templates
  add column if not exists updated_at timestamptz default now();

drop trigger if exists set_message_templates_updated_at on public.message_templates;
create trigger set_message_templates_updated_at
before update on public.message_templates
for each row
execute function public.set_updated_at();

alter table public.labels enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_labels enable row level security;
alter table public.message_templates enable row level security;

drop policy if exists labels_admin_all on public.labels;
drop policy if exists labels_staff_read on public.labels;
create policy "labels_authenticated_all" on public.labels
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists contacts_admin_all on public.contacts;
drop policy if exists contacts_staff_select on public.contacts;
drop policy if exists contacts_staff_write on public.contacts;
drop policy if exists contacts_staff_update on public.contacts;
create policy "contacts_authenticated_all" on public.contacts
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists contact_labels_admin_all on public.contact_labels;
drop policy if exists contact_labels_staff_select on public.contact_labels;
drop policy if exists contact_labels_staff_write on public.contact_labels;
drop policy if exists contact_labels_staff_delete on public.contact_labels;
create policy "contact_labels_authenticated_all" on public.contact_labels
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists templates_admin_all on public.message_templates;
drop policy if exists templates_staff_read on public.message_templates;
create policy "templates_authenticated_all" on public.message_templates
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
