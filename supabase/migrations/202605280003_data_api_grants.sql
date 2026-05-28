-- Explicit Data API grants for Supabase projects where public schema access is not automatic.
-- RLS policies still decide which rows each role can read or change.

grant usage on schema public to anon, authenticated;

grant select on public.suppliers to anon, authenticated;
grant select on public.catalog_settings to anon, authenticated;
grant select on public.catalog_files to authenticated;
grant select on public.products to anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant select on public.product_tags to anon, authenticated;
grant select on public.product_file_links to authenticated;

grant select, insert, update, delete on public.quotes to authenticated;
grant select, insert, update, delete on public.quote_items to authenticated;

grant insert, update, delete on public.suppliers to authenticated;
grant insert, update, delete on public.catalog_settings to authenticated;
grant insert, update, delete on public.catalog_files to authenticated;
grant insert, update, delete on public.products to authenticated;
grant insert, update, delete on public.product_images to authenticated;
grant insert, update, delete on public.product_tags to authenticated;
grant insert, update, delete on public.product_file_links to authenticated;

grant select, insert, update on public.users to authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;
