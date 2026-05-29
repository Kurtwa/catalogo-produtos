insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-files', 'catalog-files', false, 52428800, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "catalog public read product images" on storage.objects;
create policy "catalog public read product images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "catalog editors upload product images" on storage.objects;
create policy "catalog editors upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.catalog_users
    where id = (select auth.uid())
      and role = 'editor'
  )
);

drop policy if exists "catalog editors update product images" on storage.objects;
create policy "catalog editors update product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.catalog_users
    where id = (select auth.uid())
      and role = 'editor'
  )
)
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.catalog_users
    where id = (select auth.uid())
      and role = 'editor'
  )
);

drop policy if exists "catalog editors manage catalog files" on storage.objects;
create policy "catalog editors manage catalog files"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'catalog-files'
  and exists (
    select 1
    from public.catalog_users
    where id = (select auth.uid())
      and role = 'editor'
  )
)
with check (
  bucket_id = 'catalog-files'
  and exists (
    select 1
    from public.catalog_users
    where id = (select auth.uid())
      and role = 'editor'
  )
);
