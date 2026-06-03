-- Catalog data requires an authenticated user. Anonymous visitors should only
-- see the login screen in the app and should not call product RPCs directly.

revoke execute on function public.get_visible_products_for_current_user() from public, anon;
grant execute on function public.get_visible_products_for_current_user() to authenticated;

revoke select on public.catalog_client_products from anon;
revoke select on public.catalog_product_images from anon;
revoke select on public.catalog_settings from anon;

drop policy if exists "public can read product images" on public.catalog_product_images;
drop policy if exists "authenticated users can read product images" on public.catalog_product_images;
create policy "authenticated users can read product images"
on public.catalog_product_images for select
to authenticated
using (true);

drop policy if exists "public can read catalog settings" on public.catalog_settings;
drop policy if exists "authenticated users can read catalog settings" on public.catalog_settings;
create policy "authenticated users can read catalog settings"
on public.catalog_settings for select
to authenticated
using (true);
