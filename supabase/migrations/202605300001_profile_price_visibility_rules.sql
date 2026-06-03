-- Centralized role visibility and profile-based price rules.
-- Keeps sensitive product fields out of API responses for public-facing roles.

insert into public.catalog_settings (key, value, description)
values
  ('percentualRepresentante', 0, 'Percentual aplicado sobre o preco de venda Brasil para Representante'),
  ('percentualImportador', 0, 'Percentual aplicado sobre o preco de compra China para Importador')
on conflict (key) do nothing;

update public.catalog_price_rules
set show_supplier = true,
    show_china_cost = true,
    show_nationalized_cost = true,
    show_resale_price = true,
    show_final_price = true,
    show_margin = true,
    can_edit_products = true,
    can_delete_products = true,
    can_manage_users = true,
    can_view_audit = true,
    updated_at = now()
where role = 'admin';

update public.catalog_price_rules
set show_supplier = true,
    show_china_cost = true,
    show_nationalized_cost = true,
    show_resale_price = true,
    show_final_price = true,
    show_margin = true,
    can_edit_products = false,
    can_delete_products = false,
    can_manage_users = false,
    can_view_audit = true,
    updated_at = now()
where role = 'comercial_interno';

update public.catalog_price_rules
set show_supplier = false,
    show_china_cost = false,
    show_nationalized_cost = false,
    show_resale_price = false,
    show_final_price = true,
    show_margin = false,
    can_edit_products = false,
    can_delete_products = false,
    can_manage_users = false,
    can_view_audit = false,
    updated_at = now()
where role = 'cliente';

update public.catalog_price_rules
set show_supplier = false,
    show_china_cost = false,
    show_nationalized_cost = false,
    show_resale_price = true,
    show_final_price = true,
    show_margin = false,
    can_edit_products = false,
    can_delete_products = false,
    can_manage_users = false,
    can_view_audit = false,
    updated_at = now()
where role = 'representante';

update public.catalog_price_rules
set show_supplier = true,
    show_china_cost = true,
    show_nationalized_cost = false,
    show_resale_price = false,
    show_final_price = false,
    show_margin = false,
    can_edit_products = false,
    can_delete_products = false,
    can_manage_users = false,
    can_view_audit = false,
    updated_at = now()
where role = 'importador';

drop policy if exists "editors can manage catalog settings" on public.catalog_settings;
drop policy if exists "admin can manage catalog settings" on public.catalog_settings;
create policy "admin can manage catalog settings"
on public.catalog_settings for all
to authenticated
using (public.is_catalog_admin())
with check (public.is_catalog_admin());

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
  with current_context as (
    select public.get_current_user_role() as role
  ),
  rule as (
    select pr.*
    from public.catalog_price_rules pr
    join current_context ctx on ctx.role = pr.role
    limit 1
  ),
  settings as (
    select
      coalesce(max(value) filter (where key = 'percentualRepresentante'), 0) as percentual_representante,
      greatest(coalesce(max(value) filter (where key = 'percentualImportador'), 0), 0) as percentual_importador
    from public.catalog_settings
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
    case when r.show_china_cost then p.original_price else null::numeric end,
    case when r.show_china_cost then p.currency else null::text end,
    case when r.show_china_cost then p.exchange_rate else null::numeric end,
    case when r.show_nationalized_cost then p.multiplier_factor else null::numeric end,
    case when r.show_nationalized_cost then p.nationalized_cost_brl else null::numeric end,
    case when r.show_margin then p.markup else null::numeric end,
    case when r.show_final_price or r.show_resale_price then p.suggested_sale_price else null::numeric end,
    case
      when ctx.role = 'importador' then p.original_price * (1 + st.percentual_importador / 100)
      when ctx.role = 'representante' then p.suggested_sale_price * (1 + st.percentual_representante / 100)
      when ctx.role in ('cliente', 'admin', 'comercial_interno') then p.suggested_sale_price
      else null::numeric
    end,
    case
      when ctx.role = 'importador' then 'Preco para importador'
      when ctx.role = 'representante' then 'Preco para representante'
      when ctx.role = 'cliente' then 'Preco de venda'
      when ctx.role in ('admin', 'comercial_interno') then 'Preco de venda Brasil'
      else 'Consulte valor'
    end,
    p.weight,
    p.dimensions,
    p.material,
    p.tags,
    null::uuid,
    p.status,
    p.image_url,
    p.created_at,
    p.updated_at
  from public.catalog_products p
  cross join current_context ctx
  cross join rule r
  cross join settings st
  left join public.catalog_suppliers s on s.id = p.supplier_id
  where p.status <> 'arquivado';
$$;

grant execute on function public.get_visible_products_for_current_user() to authenticated;
