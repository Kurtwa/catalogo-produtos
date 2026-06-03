-- Harden public API surface after adding role-based catalog profiles.

alter function public.catalog_normalized_role(text) set search_path = public;
alter function public.touch_updated_at() set search_path = public;

-- The app now loads products through get_visible_products_for_current_user().
-- Keep the legacy view present for compatibility, but do not expose it through
-- the public API because security-definer views bypass the caller context.
revoke select on public.catalog_client_products from anon, authenticated;

do $$
begin
  begin
    alter view public.catalog_client_products set (security_invoker = true);
  exception
    when others then
      null;
  end;
end $$;

-- Administrative/profile helper RPCs should not be callable as public API
-- endpoints unless the app explicitly implements a guarded admin screen.
revoke execute on function public.accept_invite(text, text, text) from public, anon, authenticated;
revoke execute on function public.admin_create_user(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.claim_master_profile(text, text) from public, anon, authenticated;
revoke execute on function public.update_my_profile(text, text) from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;

-- Internal role helpers are used by policies/functions; clients do not need to
-- call these endpoints directly.
revoke execute on function public.get_current_user_role() from public, anon;
revoke execute on function public.is_catalog_admin() from public, anon;
revoke execute on function public.get_current_price_rule() from public, anon;

-- Public product browsing intentionally remains available, but the function
-- only returns client-safe fields when no authenticated profile is present.
grant execute on function public.get_visible_products_for_current_user() to anon, authenticated;
