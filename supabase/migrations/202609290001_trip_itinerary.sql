begin;

create table public.trip_destinations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  date date not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index trip_destinations_one_primary_idx
  on public.trip_destinations(trip_id) where is_primary;
create index trip_destinations_trip_date_idx
  on public.trip_destinations(trip_id, date, created_at);

insert into public.trip_destinations (trip_id, name, date, is_primary)
select id, destination, start_date, true from public.trips;

create function public.sync_primary_trip_destination() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.trip_destinations(trip_id, name, date, is_primary)
    values (new.id, new.destination, new.start_date, true);
  elsif tg_op = 'UPDATE' then
    update public.trip_destinations
      set name = new.destination, date = new.start_date
      where trip_id = new.id and is_primary;
  end if;
  return new;
end $$;
create trigger trips_sync_primary_destination
  after insert or update of destination, start_date on public.trips
  for each row execute function public.sync_primary_trip_destination();

create function public.validate_trip_itinerary_dates() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.trip_destinations where trip_id = new.id and date < new.start_date and not is_primary)
     or exists (select 1 from public.trip_destinations where trip_id = new.id and date > new.end_date and not is_primary) then
    raise exception 'Trip dates must include all destination stops';
  end if;
  if exists (select 1 from public.transport_segments where trip_id = new.id and (departure_date < new.start_date or arrival_date > new.end_date)) then
    raise exception 'Trip dates must include all transportation';
  end if;
  return new;
end $$;
create trigger trips_itinerary_dates_valid before update of start_date, end_date on public.trips
  for each row execute function public.validate_trip_itinerary_dates();

create table public.transport_segments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  mode text not null check (mode in ('Flight', 'Train')),
  service_id text not null check (char_length(service_id) between 1 and 40),
  departure_location text not null check (char_length(departure_location) between 1 and 240),
  arrival_location text not null check (char_length(arrival_location) between 1 and 240),
  departure_date date not null,
  departure_time time not null,
  departure_time_zone text not null check (char_length(departure_time_zone) between 1 and 100),
  arrival_date date not null,
  arrival_time time not null,
  arrival_time_zone text not null check (char_length(arrival_time_zone) between 1 and 100),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  constraint transport_arrival_after_departure check (
    ((arrival_date + arrival_time) at time zone arrival_time_zone) >
    ((departure_date + departure_time) at time zone departure_time_zone)
  )
);
create index transport_segments_trip_departure_idx
  on public.transport_segments(trip_id, departure_date, departure_time);

create function public.validate_itinerary_destination() returns trigger
language plpgsql set search_path = '' as $$
declare parent public.trips;
begin
  if tg_op = 'DELETE' then
    if old.is_primary and pg_catalog.pg_trigger_depth() = 1 then
      raise exception 'The main trip destination cannot be removed';
    end if;
    return old;
  end if;
  select * into parent from public.trips where id = new.trip_id;
  if not found then raise exception 'Trip unavailable'; end if;
  if new.date < parent.start_date or new.date > parent.end_date then
    raise exception 'Destination date must be inside trip dates';
  end if;
  return new;
end $$;
create trigger trip_destinations_valid before insert or update or delete on public.trip_destinations
  for each row execute function public.validate_itinerary_destination();

create function public.validate_transport_segment() returns trigger
language plpgsql set search_path = '' as $$
declare parent public.trips;
begin
  select * into parent from public.trips where id = new.trip_id for update;
  if not found then raise exception 'Trip unavailable'; end if;
  if new.departure_date < parent.start_date or new.arrival_date > parent.end_date then
    raise exception 'Transport dates must be inside trip dates';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.departure_time_zone)
     or not exists (select 1 from pg_catalog.pg_timezone_names where name = new.arrival_time_zone) then
    raise exception 'Invalid transport time zone';
  end if;
  return new;
end $$;
create trigger transport_segments_valid before insert or update on public.transport_segments
  for each row execute function public.validate_transport_segment();

alter table public.trip_destinations enable row level security;
alter table public.transport_segments enable row level security;
create policy owner_access on public.trip_destinations for all to authenticated
  using (exists (select 1 from public.trips where trips.id = trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from public.trips where trips.id = trip_id and trips.user_id = auth.uid()));
create policy owner_access on public.transport_segments for all to authenticated
  using (exists (select 1 from public.trips where trips.id = trip_id and trips.user_id = auth.uid()))
  with check (exists (select 1 from public.trips where trips.id = trip_id and trips.user_id = auth.uid()));
grant select, insert, update, delete on public.trip_destinations, public.transport_segments to authenticated;
revoke all on public.trip_destinations, public.transport_segments from anon;

notify pgrst, 'reload schema';
commit;
