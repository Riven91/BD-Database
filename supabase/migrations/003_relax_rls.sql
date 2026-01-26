-- Relax RLS policies for v1 usage

-- Profiles

drop policy if exists "profiles_self_read" on public.profiles;
drop policy if exists "profiles_admin_read" on public.profiles;

create policy "profiles_self_select" on public.profiles
  for select
  using (id = auth.uid());

create policy "profiles_self_insert" on public.profiles
  for insert
  with check (id = auth.uid());

create policy "profiles_self_update" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Locations

drop policy if exists "locations_admin_all" on public.locations;
drop policy if exists "locations_staff_read" on public.locations;

create policy "locations_auth_select" on public.locations
  for select
  using (auth.role() = 'authenticated');

create policy "locations_auth_insert" on public.locations
  for insert
  with check (auth.role() = 'authenticated');

create policy "locations_auth_update" on public.locations
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Contacts

drop policy if exists "contacts_admin_all" on public.contacts;
drop policy if exists "contacts_staff_select" on public.contacts;
drop policy if exists "contacts_staff_write" on public.contacts;
drop policy if exists "contacts_staff_update" on public.contacts;

create policy "contacts_auth_all" on public.contacts
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Tasks

drop policy if exists "tasks_admin_all" on public.tasks;
drop policy if exists "tasks_staff_read" on public.tasks;
drop policy if exists "tasks_staff_write" on public.tasks;
drop policy if exists "tasks_staff_update" on public.tasks;

create policy "tasks_auth_all" on public.tasks
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Labels

drop policy if exists "labels_admin_all" on public.labels;
drop policy if exists "labels_staff_read" on public.labels;

create policy "labels_auth_all" on public.labels
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Contact labels

drop policy if exists "contact_labels_admin_all" on public.contact_labels;
drop policy if exists "contact_labels_staff_select" on public.contact_labels;
drop policy if exists "contact_labels_staff_write" on public.contact_labels;
drop policy if exists "contact_labels_staff_delete" on public.contact_labels;

create policy "contact_labels_auth_all" on public.contact_labels
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Message templates

drop policy if exists "templates_admin_all" on public.message_templates;
drop policy if exists "templates_staff_read" on public.message_templates;

create policy "templates_auth_all" on public.message_templates
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
