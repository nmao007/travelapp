begin;

alter table public.trips
  add column time_zone text not null default 'UTC',
  add column currency text not null default 'USD',
  add column budget_minor bigint;
alter table public.trips add constraint trips_currency_supported
  check (currency in ('USD','EUR','GBP','INR','JPY','AUD','CAD','CHF','SGD','NZD','CNY','THB','KRW','BHD'));
alter table public.trips add constraint trips_budget_valid
  check (budget_minor between 0 and 1000000000000);
alter table public.trips add constraint trips_time_zone_length check (char_length(time_zone) between 1 and 100);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  category text not null check (category in ('Activity','Flight','Stay','Transport','Food')),
  date date not null,
  time time,
  time_zone text not null check (char_length(time_zone) between 1 and 100),
  location text not null default '' check (char_length(location) <= 300),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  amount_minor bigint not null check (amount_minor between 1 and 1000000000000),
  currency text not null,
  category text not null check (category in ('Transport','Stay','Food','Activities','Shopping','Other')),
  date date not null,
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now()
);

create table public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  category text not null check (category in ('Essentials','Clothing','Toiletries','Electronics','Other')),
  packed boolean not null default false,
  created_at timestamptz not null default now()
);

create index activities_trip_date_idx on public.activities(trip_id, date, time);
create index expenses_trip_date_idx on public.expenses(trip_id, date);
create index packing_items_trip_idx on public.packing_items(trip_id, created_at);

-- Lock the parent while changing children so currency/date edits cannot race with new records.
create function public.validate_workspace_item() returns trigger
language plpgsql set search_path = '' as $$
declare parent public.trips;
begin
  if tg_op = 'DELETE' then
    perform 1 from public.trips where id = old.trip_id for update;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.trip_id <> old.trip_id then
    raise exception 'Items cannot be moved between trips';
  end if;
  select * into parent from public.trips where id = new.trip_id for update;
  if not found then raise exception 'Trip unavailable'; end if;
  if tg_table_name = 'activities' then
    if new.date < parent.start_date or new.date > parent.end_date then
      raise exception 'Activity date must be inside trip dates';
    end if;
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
      raise exception 'Invalid time zone';
    end if;
  elsif tg_table_name = 'expenses' then
    if new.currency <> parent.currency then raise exception 'Expense currency must match trip currency'; end if;
  end if;
  return new;
end $$;

create trigger activities_valid before insert or update or delete on public.activities
  for each row execute function public.validate_workspace_item();
create trigger expenses_valid before insert or update or delete on public.expenses
  for each row execute function public.validate_workspace_item();
create trigger packing_items_valid before insert or update or delete on public.packing_items
  for each row execute function public.validate_workspace_item();

create function public.validate_trip_workspace() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'Invalid time zone';
  end if;
  if tg_op = 'UPDATE' then
    if new.currency <> old.currency and exists (select 1 from public.expenses where trip_id = new.id) then
      raise exception 'Cannot change currency with recorded expenses';
    end if;
    if exists (select 1 from public.activities where trip_id = new.id and (date < new.start_date or date > new.end_date)) then
      raise exception 'Trip dates must contain existing activities';
    end if;
  end if;
  return new;
end $$;
create trigger trip_workspace_valid before insert or update on public.trips
  for each row execute function public.validate_trip_workspace();

-- Authorization follows the parent trip; changing trip_id cannot transfer records to another owner.
do $$
declare table_name text;
begin
  foreach table_name in array array['activities', 'expenses', 'packing_items'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy owner_access on public.%I for all to authenticated using (exists (select 1 from public.trips where trips.id = trip_id and trips.user_id = auth.uid())) with check (exists (select 1 from public.trips where trips.id = trip_id and trips.user_id = auth.uid()))', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('revoke all on public.%I from anon', table_name);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
