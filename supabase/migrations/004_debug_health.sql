create table if not exists public.debug_health (
  id bigserial primary key,
  created_at timestamptz default now(),
  note text
);

alter table public.debug_health enable row level security;

create policy "debug_health_all" on public.debug_health
  for all to authenticated
  using (true) with check (true);
