-- Access profiles, price rules and safe product RPC.
-- Keeps compatibility with the early MVP roles: editor/viewer.

alter table public.catalog_users
  drop constraint if exists catalog_users_role_check;

alter table public.catalog_users
  add constraint catalog_users_role_check
  check (role in ('admin', 'comercial_interno', 'representante', 'importador', 'cliente', 'editor', 'viewer'));

create table if not exists public.catalog_price_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null unique check (role in ('admin', 'comercial_interno', 'representante', 'importador', 'cliente')),
  markup_percent numeric default 0,
  discount_percent numeric default 0,
  show_supplier boolean not null default false,
  show_china_cost boolean not null default false,
  show_nationalized_cost boolean not null default false,
  show_resale_price boolean not null default false,
  show_final_price boolean not null default true,
  show_margin boolean not null default false,
  can_edit_products boolean not null default false,
  can_delete_products boolean not null default false,
  can_manage_users boolean not null default false,
  can_approve_imports boolean not null default false,
  can_view_audit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  phone text,
  company_name text,
  role text not null check (role in ('admin', 'representante', 'comercial_interno', 'importador', 'cliente')),
  is_active boolean not null default true,
  price_rule_id uuid references public.catalog_price_rules(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_access_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  company_name text,
  document_number text,
  country text,
  requested_role text check (requested_role in ('cliente', 'representante', 'comercial_interno', 'importador')),
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'invited', 'cancelled')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  invitation_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catalog_price_rules enable row level security;
alter table public.catalog_user_profiles enable row level security;
alter table public.catalog_access_requests enable row level security;

insert into public.catalog_price_rules
  (name, role, markup_percent, discount_percent, show_supplier, show_china_cost, show_nationalized_cost, show_resale_price, show_final_price, show_margin, can_edit_products, can_delete_products, can_manage_users, can_approve_imports, can_view_audit)
values
  ('Admin Full', 'admin', 0, 0, true, true, true, true, true, true, true, true, true, true, true),
  ('Comercial Interno', 'comercial_interno', 0, 0, true, true, true, true, true, true, false, false, false, false, true),
  ('Representante Padrao', 'representante', 0, 0, false, false, false, true, true, false, false, false, false, false, false),
  ('Importador Markup 30%', 'importador', 30, 0, false, true, false, false, true, false, false, false, false, false, false),
  ('Cliente Padrao', 'cliente', 0, 0, false, false, false, false, true, false, false, false, false, false, false)
on conflict (role) do update set
  name = excluded.name,
  markup_percent = excluded.markup_percent,
  discount_percent = excluded.discount_percent,
  show_supplier = excluded.show_supplier,
  show_china_cost = excluded.show_china_cost,
  show_nationalized_cost = excluded.show_nationalized_cost,
  show_resale_price = excluded.show_resale_price,
  show_final_price = excluded.show_final_price,
  show_margin = excluded.show_margin,
  can_edit_products = excluded.can_edit_products,
  can_delete_products = excluded.can_delete_products,
  can_manage_users = excluded.can_manage_users,
  can_approve_imports = excluded.can_approve_imports,
  can_view_audit = excluded.can_view_audit,
  updated_at = now();

insert into public.catalog_user_profiles (id, email, full_name, role, price_rule_id, created_at, updated_at)
select
  cu.id,
  cu.email,
  cu.full_name,
  case
    when cu.role in ('editor', 'admin') then 'admin'
    when cu.role in ('viewer', 'comercial_interno') then 'comercial_interno'
    when cu.role in ('representante', 'importador', 'cliente') then cu.role
    else 'cliente'
  end as role,
  pr.id,
  coalesce(cu.created_at, now()),
  now()
from public.catalog_users cu
join public.catalog_price_rules pr
  on pr.role = case
    when cu.role in ('editor', 'admin') then 'admin'
    when cu.role in ('viewer', 'comercial_interno') then 'comercial_interno'
    when cu.role in ('representante', 'importador', 'cliente') then cu.role
    else 'cliente'
  end
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  price_rule_id = excluded.price_rule_id,
  updated_at = now();

update public.catalog_users
set role = 'admin',
    updated_at = now()
where lower(email) = 'plyarte@gmail.com';

update public.catalog_user_profiles up
set role = 'admin',
    price_rule_id = (select id from public.catalog_price_rules where role = 'admin'),
    updated_at = now()
where lower(up.email) = 'plyarte@gmail.com';

create or replace function public.catalog_normalized_role(input_role text)
returns text
language sql
stable
as $$
  select case
    when input_role in ('editor', 'admin') then 'admin'
    when input_role in ('viewer', 'comercial_interno') then 'comercial_interno'
    when input_role in ('representante', 'importador', 'cliente') then input_role
    else 'cliente'
  end;
$$;

create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.catalog_user_profiles where id = auth.uid() and is_active = true limit 1),
    (select public.catalog_normalized_role(role) from public.catalog_users where id = auth.uid() limit 1),
    'cliente'
  );
$$;

create or replace function public.is_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_current_user_role() = 'admin';
$$;

create or replace function public.get_current_price_rule()
returns public.catalog_price_rules
language sql
stable
security definer
set search_path = public
as $$
  select pr.*
  from public.catalog_price_rules pr
  where pr.role = public.get_current_user_role()
  limit 1;
$$;

drop function if exists public.get_visible_products_for_current_user();
create function public.get_visible_products_for_current_user()
returns table (
  id uuid,
  supplier_id uuid,
  supplier_name text,
  name text,
  code text,
  category text,
  subcategory text,
  description text,
  technical_specs text,
  original_price numeric,
  currency text,
  exchange_rate numeric,
  multiplier_factor numeric,
  nationalized_cost_brl numeric,
  markup numeric,
  suggested_sale_price numeric,
  visible_price numeric,
  visible_price_label text,
  weight numeric,
  dimensions text,
  material text,
  tags text[],
  source_file_id uuid,
  status text,
  image_url text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with rule as (
    select *
    from public.catalog_price_rules
    where role = public.get_current_user_role()
    limit 1
  )
  select
    p.id,
    case when r.show_supplier then p.supplier_id else null::uuid end,
    case when r.show_supplier then s.name else null::text end,
    p.name,
    p.code,
    p.category,
    p.subcategory,
    p.description,
    p.technical_specs,
    case when r.show_china_cost or r.show_supplier then p.original_price else null::numeric end,
    case when r.show_china_cost or r.show_supplier then p.currency else null::text end,
    case when r.show_china_cost or r.show_supplier then p.exchange_rate else null::numeric end,
    case when r.show_nationalized_cost then p.multiplier_factor else null::numeric end,
    case when r.show_nationalized_cost then p.nationalized_cost_brl else null::numeric end,
    case when r.show_margin then p.markup else null::numeric end,
    case when r.show_final_price or r.show_resale_price then p.suggested_sale_price else null::numeric end,
    case
      when public.get_current_user_role() = 'importador' then p.original_price * (1 + coalesce(r.markup_percent, 0) / 100)
      when r.show_final_price or r.show_resale_price then p.suggested_sale_price
      else null::numeric
    end,
    case
      when public.get_current_user_role() = 'importador' then 'Custo China + markup'
      when r.show_resale_price and not r.show_supplier then 'Preco de revenda'
      when r.show_final_price then 'Preco final'
      else 'Orcamento'
    end,
    p.weight,
    p.dimensions,
    p.material,
    p.tags,
    case when r.show_supplier then p.source_file_id else null::uuid end,
    p.status,
    p.image_url,
    p.created_at,
    p.updated_at
  from public.catalog_products p
  cross join rule r
  left join public.catalog_suppliers s on s.id = p.supplier_id
  where p.status <> 'arquivado';
$$;

drop policy if exists "authenticated users can read users" on public.catalog_users;
drop policy if exists "users can insert own viewer profile" on public.catalog_users;
drop policy if exists "users can insert own profile" on public.catalog_users;

create policy "users can read own catalog user"
on public.catalog_users for select
to authenticated
using (id = (select auth.uid()) or public.is_catalog_admin());

create policy "users can insert own client profile"
on public.catalog_users for insert
to authenticated
with check ((select auth.uid()) = id and role in ('cliente', 'viewer'));

drop policy if exists "users can read own profile" on public.catalog_user_profiles;
drop policy if exists "admin can read all profiles" on public.catalog_user_profiles;
drop policy if exists "admin can update profiles" on public.catalog_user_profiles;
drop policy if exists "users can insert own client profile" on public.catalog_user_profiles;

create policy "users can read own profile"
on public.catalog_user_profiles for select
to authenticated
using (id = (select auth.uid()) or public.is_catalog_admin());

create policy "users can insert own client profile"
on public.catalog_user_profiles for insert
to authenticated
with check ((select auth.uid()) = id and role = 'cliente');

create policy "admin can update profiles"
on public.catalog_user_profiles for update
to authenticated
using (public.is_catalog_admin())
with check (public.is_catalog_admin());

drop policy if exists "public can request access" on public.catalog_access_requests;
drop policy if exists "admin can manage access requests" on public.catalog_access_requests;

create policy "public can request access"
on public.catalog_access_requests for insert
to anon, authenticated
with check (status = 'pending');

create policy "admin can manage access requests"
on public.catalog_access_requests for all
to authenticated
using (public.is_catalog_admin())
with check (public.is_catalog_admin());

drop policy if exists "authenticated users can read price rules" on public.catalog_price_rules;
drop policy if exists "admin can manage price rules" on public.catalog_price_rules;

create policy "authenticated users can read own price rule"
on public.catalog_price_rules for select
to authenticated
using (role = public.get_current_user_role() or public.is_catalog_admin());

create policy "admin can manage price rules"
on public.catalog_price_rules for all
to authenticated
using (public.is_catalog_admin())
with check (public.is_catalog_admin());

grant select, insert, update on public.catalog_users to authenticated;
grant select, insert, update on public.catalog_user_profiles to authenticated;
grant select, insert on public.catalog_access_requests to anon, authenticated;
grant select on public.catalog_price_rules to authenticated;
grant execute on function public.get_current_user_role() to anon, authenticated;
grant execute on function public.is_catalog_admin() to anon, authenticated;
grant execute on function public.get_current_price_rule() to authenticated;
grant execute on function public.get_visible_products_for_current_user() to anon, authenticated;
