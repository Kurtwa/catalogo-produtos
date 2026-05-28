-- Public catalog surface for the client profile.
-- The raw products table keeps supplier and price fields for authenticated users only.

revoke select on public.products from anon;
revoke select on public.suppliers from anon;
revoke select on public.product_tags from anon;

drop view if exists public.client_products;

create view public.client_products as
select
  id,
  name,
  code,
  category,
  subcategory,
  description,
  technical_specs,
  weight,
  dimensions,
  material,
  tags,
  status,
  image_url,
  created_at,
  updated_at
from public.products
where status <> 'arquivado';

grant select on public.client_products to anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant select on public.catalog_settings to anon, authenticated;

drop policy if exists "public can read catalog settings" on public.catalog_settings;
drop policy if exists "public can read product images" on public.product_images;

create policy "public can read catalog settings"
on public.catalog_settings for select
to anon, authenticated
using (true);

create policy "public can read product images"
on public.product_images for select
to anon, authenticated
using (true);
