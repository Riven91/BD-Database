create extension if not exists "pgcrypto";

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists labels_name_unique on public.labels (name);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists message_templates_title_unique on public.message_templates (title);

create table if not exists public.contact_labels (
  contact_id uuid not null,
  label_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (contact_id, label_id),
  constraint fk_contact_labels_contact foreign key (contact_id) references public.contacts(id) on delete cascade,
  constraint fk_contact_labels_label foreign key (label_id) references public.labels(id) on delete cascade
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_labels_updated_at on public.labels;
create trigger set_labels_updated_at
before update on public.labels
for each row
execute function public.set_updated_at();

drop trigger if exists set_message_templates_updated_at on public.message_templates;
create trigger set_message_templates_updated_at
before update on public.message_templates
for each row
execute function public.set_updated_at();

alter table public.labels enable row level security;
alter table public.message_templates enable row level security;
alter table public.contact_labels enable row level security;

drop policy if exists "labels_authenticated_all" on public.labels;
create policy "labels_authenticated_all" on public.labels
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "message_templates_authenticated_all" on public.message_templates;
create policy "message_templates_authenticated_all" on public.message_templates
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "contact_labels_authenticated_all" on public.contact_labels;
create policy "contact_labels_authenticated_all" on public.contact_labels
  for all
  to authenticated
  using (true)
  with check (true);
