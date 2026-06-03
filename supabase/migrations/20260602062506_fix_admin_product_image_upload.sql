-- Align product image management with the current access-profile model.
-- Older policies still checked catalog_users.role = 'editor', while the app now
-- normalizes editor/admin through get_current_user_role() and is_catalog_admin().

drop policy if exists "editors can insert products" on public.catalog_products;
drop policy if exists "editors can update products" on public.catalog_products;
drop policy if exists "editors can delete products" on public.catalog_products;

create policy "admins can insert products"
on public.catalog_products for insert
to authenticated
with check (public.is_catalog_admin());

create policy "admins can update products"
on public.catalog_products for update
to authenticated
using (public.is_catalog_admin())
with check (public.is_catalog_admin());

create policy "admins can delete products"
on public.catalog_products for delete
to authenticated
using (public.is_catalog_admin());

drop policy if exists "editors can manage product images" on public.catalog_product_images;

create policy "admins can manage product images"
on public.catalog_product_images for all
to authenticated
using (public.is_catalog_admin())
with check (public.is_catalog_admin());

drop policy if exists "catalog editors upload product images" on storage.objects;
drop policy if exists "catalog editors update product images" on storage.objects;
drop policy if exists "catalog admins upload product images" on storage.objects;
drop policy if exists "catalog admins update product images" on storage.objects;
drop policy if exists "catalog admins delete product images" on storage.objects;

create policy "catalog admins upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_catalog_admin()
);

create policy "catalog admins update product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_catalog_admin()
)
with check (
  bucket_id = 'product-images'
  and public.is_catalog_admin()
);

create policy "catalog admins delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_catalog_admin()
);
