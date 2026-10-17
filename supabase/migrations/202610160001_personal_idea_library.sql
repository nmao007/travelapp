create table if not exists public.planner_ideas (
  user_id uuid not null references auth.users (id) on delete cascade,
  id uuid not null,
  idea jsonb not null check (jsonb_typeof(idea) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists planner_ideas_user_updated_idx
  on public.planner_ideas (user_id, updated_at desc);

alter table public.planner_ideas enable row level security;

drop policy if exists "Users can read their planner ideas" on public.planner_ideas;
create policy "Users can read their planner ideas"
  on public.planner_ideas for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their planner ideas" on public.planner_ideas;
create policy "Users can create their planner ideas"
  on public.planner_ideas for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their planner ideas" on public.planner_ideas;
create policy "Users can update their planner ideas"
  on public.planner_ideas for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their planner ideas" on public.planner_ideas;
create policy "Users can delete their planner ideas"
  on public.planner_ideas for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.planner_ideas to authenticated;
revoke all on public.planner_ideas from anon;
notify pgrst, 'reload schema';
