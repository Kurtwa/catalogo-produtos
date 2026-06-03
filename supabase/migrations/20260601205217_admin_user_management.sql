-- Admin user management screen support.
-- Profiles are soft-deactivated through catalog_user_profiles.is_active.

create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  with profile as (
    select role, is_active
    from public.catalog_user_profiles
    where id = auth.uid()
    limit 1
  )
  select case
    when exists (select 1 from profile) then
      case
        when (select is_active from profile) then (select role from profile)
        else 'bloqueado'
      end
    else coalesce(
      (select public.catalog_normalized_role(role) from public.catalog_users where id = auth.uid() limit 1),
      'cliente'
    )
  end;
$$;

grant select, update on public.catalog_user_profiles to authenticated;
grant execute on function public.get_current_user_role() to authenticated;
