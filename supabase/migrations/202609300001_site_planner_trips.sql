create table if not exists public.planner_trips (
  user_id uuid not null references auth.users (id) on delete cascade,
  id uuid not null,
  trip jsonb not null check (jsonb_typeof(trip) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists planner_trips_user_updated_idx
  on public.planner_trips (user_id, updated_at desc);

alter table public.planner_trips enable row level security;

drop policy if exists "Users can read their planner trips" on public.planner_trips;
create policy "Users can read their planner trips"
  on public.planner_trips for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their planner trips" on public.planner_trips;
create policy "Users can create their planner trips"
  on public.planner_trips for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their planner trips" on public.planner_trips;
create policy "Users can update their planner trips"
  on public.planner_trips for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their planner trips" on public.planner_trips;
create policy "Users can delete their planner trips"
  on public.planner_trips for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.planner_trips to authenticated;
revoke all on public.planner_trips from anon;
notify pgrst, 'reload schema';
