-- Production hardening for GitHub Pages + Supabase.
-- RLS is still the main authorization layer; these grants only decide which
-- tables can be reached through Supabase Data API.

grant usage on schema public to anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'catalog_suppliers',
    'catalog_settings',
    'catalog_files',
    'catalog_products',
    'catalog_product_images',
    'catalog_product_tags',
    'catalog_product_file_links',
    'catalog_quotes',
    'catalog_quote_items',
    'catalog_users',
    'catalog_user_profiles',
    'catalog_price_rules',
    'catalog_client_products'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('revoke all privileges on table public.%I from anon', table_name);
      execute format('revoke all privileges on table public.%I from authenticated', table_name);
    end if;
  end loop;
end;
$$;

do $$
begin
  if to_regclass('public.catalog_suppliers') is not null then
    grant select, insert, update, delete on public.catalog_suppliers to authenticated;
  end if;

  if to_regclass('public.catalog_settings') is not null then
    grant select, insert, update on public.catalog_settings to authenticated;
  end if;

  if to_regclass('public.catalog_files') is not null then
    grant select, insert, update on public.catalog_files to authenticated;
  end if;

  if to_regclass('public.catalog_products') is not null then
    grant select, insert, update, delete on public.catalog_products to authenticated;
  end if;

  if to_regclass('public.catalog_product_images') is not null then
    grant select, insert, update, delete on public.catalog_product_images to authenticated;
  end if;

  if to_regclass('public.catalog_product_tags') is not null then
    grant select, insert, update, delete on public.catalog_product_tags to authenticated;
  end if;

  if to_regclass('public.catalog_product_file_links') is not null then
    grant select, insert, update on public.catalog_product_file_links to authenticated;
  end if;

  if to_regclass('public.catalog_quotes') is not null then
    grant select, insert, update, delete on public.catalog_quotes to authenticated;
  end if;

  if to_regclass('public.catalog_quote_items') is not null then
    grant select, insert, update, delete on public.catalog_quote_items to authenticated;
  end if;

  if to_regclass('public.catalog_users') is not null then
    grant select, insert, update on public.catalog_users to authenticated;
  end if;

  if to_regclass('public.catalog_user_profiles') is not null then
    grant select, insert, update on public.catalog_user_profiles to authenticated;
  end if;

  if to_regclass('public.catalog_price_rules') is not null then
    grant select, insert, update on public.catalog_price_rules to authenticated;
  end if;

  if to_regclass('public.catalog_client_products') is not null then
    grant select on public.catalog_client_products to authenticated;
  end if;
end;
$$;

-- Public signup/login can still use Supabase Auth. The optional access request
-- table remains reachable only for creating a request, not for reading all rows.
do $$
begin
  if to_regclass('public.catalog_access_requests') is not null then
    revoke all privileges on table public.catalog_access_requests from anon;
    revoke all privileges on table public.catalog_access_requests from authenticated;
    grant insert on public.catalog_access_requests to anon, authenticated;
    grant select, insert, update, delete on public.catalog_access_requests to authenticated;
  end if;
end;
$$;

revoke execute on function public.get_visible_products_for_current_user() from public, anon;
grant execute on function public.get_visible_products_for_current_user() to authenticated;

revoke execute on function public.get_current_user_role() from public, anon;
grant execute on function public.get_current_user_role() to authenticated;

revoke execute on function public.is_catalog_admin() from public, anon;
grant execute on function public.is_catalog_admin() to authenticated;

revoke execute on function public.get_current_price_rule() from public, anon;
grant execute on function public.get_current_price_rule() to authenticated;

revoke execute on function public.catalog_sync_product_images(uuid, jsonb) from public, anon;
grant execute on function public.catalog_sync_product_images(uuid, jsonb) to authenticated;

-- Public object URLs keep working for the public bucket, but clients should not
-- be able to list every object in the bucket through storage.objects.
drop policy if exists "catalog public read product images" on storage.objects;
drop policy if exists "public can read product images" on storage.objects;
drop policy if exists "authenticated users can manage product images" on storage.objects;
