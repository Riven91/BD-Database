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

-- junction (assumes public.contacts exists with id uuid)
create table if not exists public.contact_labels (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, label_id)
);

alter table public.labels enable row level security;
alter table public.message_templates enable row level security;
alter table public.contact_labels enable row level security;

drop policy if exists labels_all_authenticated on public.labels;
create policy labels_all_authenticated on public.labels
for all to authenticated using (true) with check (true);

drop policy if exists templates_all_authenticated on public.message_templates;
create policy templates_all_authenticated on public.message_templates
for all to authenticated using (true) with check (true);

drop policy if exists contact_labels_all_authenticated on public.contact_labels;
create policy contact_labels_all_authenticated on public.contact_labels
for all to authenticated using (true) with check (true);
