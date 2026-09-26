create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  destination text not null check (char_length(destination) between 1 and 120),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  constraint trips_dates_ordered check (end_date >= start_date)
);

create index if not exists trips_user_dates_idx
  on public.trips (user_id, start_date);

alter table public.trips enable row level security;

drop policy if exists "Users can view their own trips" on public.trips;
create policy "Users can view their own trips"
  on public.trips for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own trips" on public.trips;
create policy "Users can create their own trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own trips" on public.trips;
create policy "Users can update their own trips"
  on public.trips for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own trips" on public.trips;
create policy "Users can delete their own trips"
  on public.trips for delete
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
