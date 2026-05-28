create extension if not exists pg_trgm;
create extension if not exists vector;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'viewer' check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  contact_name text,
  email text,
  phone text,
  website text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_settings (
  key text primary key,
  value numeric(14, 6) not null,
  description text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_files (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  file_name text not null,
  file_path text not null,
  mime_type text,
  file_size bigint,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'processed', 'failed', 'archived')),
  extraction_status text not null default 'pending',
  extracted_text text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  code text,
  category text,
  subcategory text,
  description text,
  technical_specs text,
  original_price numeric(14, 4) not null default 0,
  currency text not null default 'USD',
  exchange_rate numeric(14, 6) not null default 0,
  multiplier_factor numeric(14, 6) not null default 1,
  nationalized_cost_brl numeric(14, 4) generated always as (original_price * exchange_rate * multiplier_factor) stored,
  markup numeric(14, 6) not null default 1,
  suggested_sale_price numeric(14, 4) generated always as (original_price * exchange_rate * multiplier_factor * markup) stored,
  weight numeric(14, 4),
  dimensions text,
  material text,
  tags text[] not null default '{}',
  source_file_id uuid references public.catalog_files(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'revisado', 'arquivado')),
  image_url text,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(code, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(tags, ' ')), 'B')
  ) stored,
  embedding vector(1536),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  file_path text not null,
  public_url text,
  is_primary boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.product_tags (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (product_id, tag)
);

create table if not exists public.product_file_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  catalog_file_id uuid not null references public.catalog_files(id) on delete cascade,
  page_number integer,
  notes text,
  created_at timestamptz not null default now(),
  unique (product_id, catalog_file_id, page_number)
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text,
  customer_name text,
  customer_contact text,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'cancelled')),
  currency text not null default 'USD',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_usd numeric(14, 4) not null default 0,
  exchange_rate numeric(14, 6),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists suppliers_name_idx on public.suppliers using gin (name gin_trgm_ops);
create index if not exists products_search_vector_idx on public.products using gin (search_vector);
create index if not exists products_name_idx on public.products using gin (name gin_trgm_ops);
create index if not exists products_code_idx on public.products (code);
create index if not exists products_supplier_idx on public.products (supplier_id);
create index if not exists products_status_idx on public.products (status);
create index if not exists products_tags_idx on public.products using gin (tags);
create index if not exists quotes_created_by_idx on public.quotes (created_by);
create index if not exists quote_items_quote_idx on public.quote_items (quote_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_users_updated_at on public.users;
create trigger touch_users_updated_at before update on public.users for each row execute function public.touch_updated_at();
drop trigger if exists touch_suppliers_updated_at on public.suppliers;
create trigger touch_suppliers_updated_at before update on public.suppliers for each row execute function public.touch_updated_at();
drop trigger if exists touch_catalog_settings_updated_at on public.catalog_settings;
create trigger touch_catalog_settings_updated_at before update on public.catalog_settings for each row execute function public.touch_updated_at();
drop trigger if exists touch_catalog_files_updated_at on public.catalog_files;
create trigger touch_catalog_files_updated_at before update on public.catalog_files for each row execute function public.touch_updated_at();
drop trigger if exists touch_products_updated_at on public.products;
create trigger touch_products_updated_at before update on public.products for each row execute function public.touch_updated_at();
drop trigger if exists touch_quotes_updated_at on public.quotes;
create trigger touch_quotes_updated_at before update on public.quotes for each row execute function public.touch_updated_at();

alter table public.users enable row level security;
alter table public.suppliers enable row level security;
alter table public.catalog_settings enable row level security;
alter table public.catalog_files enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_tags enable row level security;
alter table public.product_file_links enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

drop policy if exists "authenticated users can read users" on public.users;
drop policy if exists "users can update themselves" on public.users;
drop policy if exists "users can insert own viewer profile" on public.users;
drop policy if exists "editors can update users" on public.users;
drop policy if exists "authenticated users can read suppliers" on public.suppliers;
drop policy if exists "authenticated users can insert suppliers" on public.suppliers;
drop policy if exists "authenticated users can update suppliers" on public.suppliers;
drop policy if exists "authenticated users can delete suppliers" on public.suppliers;
drop policy if exists "editors can insert suppliers" on public.suppliers;
drop policy if exists "editors can update suppliers" on public.suppliers;
drop policy if exists "editors can delete suppliers" on public.suppliers;
drop policy if exists "authenticated users can read catalog settings" on public.catalog_settings;
drop policy if exists "editors can manage catalog settings" on public.catalog_settings;
drop policy if exists "authenticated users can read catalog files" on public.catalog_files;
drop policy if exists "authenticated users can insert catalog files" on public.catalog_files;
drop policy if exists "authenticated users can update catalog files" on public.catalog_files;
drop policy if exists "editors can insert catalog files" on public.catalog_files;
drop policy if exists "editors can update catalog files" on public.catalog_files;
drop policy if exists "authenticated users can read products" on public.products;
drop policy if exists "authenticated users can insert products" on public.products;
drop policy if exists "authenticated users can update products" on public.products;
drop policy if exists "authenticated users can delete products" on public.products;
drop policy if exists "editors can insert products" on public.products;
drop policy if exists "editors can update products" on public.products;
drop policy if exists "editors can delete products" on public.products;
drop policy if exists "authenticated users can manage product images" on public.product_images;
drop policy if exists "authenticated users can read product images" on public.product_images;
drop policy if exists "editors can manage product images" on public.product_images;
drop policy if exists "authenticated users can manage product tags" on public.product_tags;
drop policy if exists "authenticated users can read product tags" on public.product_tags;
drop policy if exists "editors can manage product tags" on public.product_tags;
drop policy if exists "authenticated users can manage product file links" on public.product_file_links;
drop policy if exists "authenticated users can read product file links" on public.product_file_links;
drop policy if exists "editors can manage product file links" on public.product_file_links;
drop policy if exists "authenticated users can read quotes" on public.quotes;
drop policy if exists "authenticated users can insert quotes" on public.quotes;
drop policy if exists "authenticated users can update quotes" on public.quotes;
drop policy if exists "authenticated users can delete quotes" on public.quotes;
drop policy if exists "authenticated users can read quote items" on public.quote_items;
drop policy if exists "authenticated users can insert quote items" on public.quote_items;
drop policy if exists "authenticated users can update quote items" on public.quote_items;
drop policy if exists "authenticated users can delete quote items" on public.quote_items;

create policy "authenticated users can read users" on public.users for select to authenticated using (true);
create policy "users can insert own viewer profile" on public.users for insert to authenticated with check ((select auth.uid()) = id and role = 'viewer');

create policy "authenticated users can read suppliers" on public.suppliers for select to authenticated using (true);
create policy "editors can insert suppliers" on public.suppliers for insert to authenticated with check (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));
create policy "editors can update suppliers" on public.suppliers for update to authenticated using (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor')) with check (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));
create policy "editors can delete suppliers" on public.suppliers for delete to authenticated using (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));

create policy "authenticated users can read catalog settings" on public.catalog_settings for select to authenticated using (true);
create policy "editors can manage catalog settings" on public.catalog_settings for all to authenticated using (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor')) with check (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));

insert into public.catalog_settings (key, value, description)
values ('usdToBrl', 5.25, 'Cambio USD para BRL usado no catalogo'),
       ('usdToCny', 7.24, 'Cambio USD para CNY usado no catalogo'),
       ('multiplierFactor', 1.60, 'Fator geral para custo nacionalizado'),
       ('markupPercent', 100.00, 'Markup percentual para preco sugerido')
on conflict (key) do nothing;

create policy "authenticated users can read catalog files" on public.catalog_files for select to authenticated using (true);
create policy "editors can insert catalog files" on public.catalog_files for insert to authenticated with check (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));
create policy "editors can update catalog files" on public.catalog_files for update to authenticated using (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor')) with check (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));

create policy "authenticated users can read products" on public.products for select to authenticated using (true);
create policy "editors can insert products" on public.products for insert to authenticated with check (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));
create policy "editors can update products" on public.products for update to authenticated using (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor')) with check (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));
create policy "editors can delete products" on public.products for delete to authenticated using (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));

create policy "authenticated users can read product images" on public.product_images for select to authenticated using (true);
create policy "editors can manage product images" on public.product_images for all to authenticated using (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor')) with check (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));
create policy "authenticated users can read product tags" on public.product_tags for select to authenticated using (true);
create policy "editors can manage product tags" on public.product_tags for all to authenticated using (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor')) with check (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));
create policy "authenticated users can read product file links" on public.product_file_links for select to authenticated using (true);
create policy "editors can manage product file links" on public.product_file_links for all to authenticated using (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor')) with check (exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));

create policy "authenticated users can read quotes" on public.quotes for select to authenticated using (created_by = (select auth.uid()) or exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));
create policy "authenticated users can insert quotes" on public.quotes for insert to authenticated with check (created_by = (select auth.uid()));
create policy "authenticated users can update quotes" on public.quotes for update to authenticated using (created_by = (select auth.uid()) or exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor')) with check (created_by = (select auth.uid()) or exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));
create policy "authenticated users can delete quotes" on public.quotes for delete to authenticated using (created_by = (select auth.uid()) or exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));

create policy "authenticated users can read quote items" on public.quote_items for select to authenticated using (exists (select 1 from public.quotes q where q.id = quote_id and (q.created_by = (select auth.uid()) or exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'))));
create policy "authenticated users can insert quote items" on public.quote_items for insert to authenticated with check (exists (select 1 from public.quotes q where q.id = quote_id and q.created_by = (select auth.uid())));
create policy "authenticated users can update quote items" on public.quote_items for update to authenticated using (exists (select 1 from public.quotes q where q.id = quote_id and (q.created_by = (select auth.uid()) or exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor')))) with check (exists (select 1 from public.quotes q where q.id = quote_id and (q.created_by = (select auth.uid()) or exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'))));
create policy "authenticated users can delete quote items" on public.quote_items for delete to authenticated using (exists (select 1 from public.quotes q where q.id = quote_id and (q.created_by = (select auth.uid()) or exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'))));

insert into storage.buckets (id, name, public)
values ('catalog-files', 'catalog-files', false),
       ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "authenticated users can upload catalog files" on storage.objects;
drop policy if exists "authenticated users can read catalog files" on storage.objects;
drop policy if exists "authenticated users can manage product images" on storage.objects;
drop policy if exists "public can read product images" on storage.objects;

create policy "authenticated users can upload catalog files"
on storage.objects for insert to authenticated
with check (bucket_id = 'catalog-files' and exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));

create policy "authenticated users can read catalog files"
on storage.objects for select to authenticated
using (bucket_id = 'catalog-files');

create policy "authenticated users can manage product images"
on storage.objects for all to authenticated
using (bucket_id = 'product-images' and exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'))
with check (bucket_id = 'product-images' and exists (select 1 from public.users where id = (select auth.uid()) and role = 'editor'));

create policy "public can read product images"
on storage.objects for select to anon, authenticated
using (bucket_id = 'product-images');

-- Busca simples:
-- select p.*, s.name as supplier_name
-- from public.products p
-- left join public.suppliers s on s.id = p.supplier_id
-- where p.search_vector @@ plainto_tsquery('simple', 'sensor indutivo')
--    or p.name ilike '%sensor%'
--    or p.code ilike '%sensor%'
--    or s.name ilike '%sensor%';
