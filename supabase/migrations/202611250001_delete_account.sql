-- "Delete account" in the app (Apple requires it for apps with sign-up).
-- A signed-in user can delete only themselves; their planner_trips,
-- planner_ideas and older trip tables are removed by `on delete cascade`.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to delete your account.' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
notify pgrst, 'reload schema';
