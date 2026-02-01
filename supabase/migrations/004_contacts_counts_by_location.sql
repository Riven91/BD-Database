create or replace function public.contacts_counts_by_location()
returns table(location_id uuid, location_name text, count bigint)
language sql
security definer
as $$
  select
    c.location_id,
    coalesce(l.name, 'Unbekannt') as location_name,
    count(*)::bigint as count
  from public.contacts c
  left join public.locations l on l.id = c.location_id
  group by c.location_id, l.name
  order by count desc;
$$;

grant execute on function public.contacts_counts_by_location() to authenticated;
