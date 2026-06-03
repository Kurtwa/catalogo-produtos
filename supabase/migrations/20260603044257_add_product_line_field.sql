-- Adds an explicit product line field. Previously the app used subcategory as
-- "linha"; this keeps subcategory as legacy while making line first-class.

alter table public.catalog_products
  add column if not exists line text;

update public.catalog_products
set line = coalesce(nullif(line, ''), nullif(subcategory, ''), nullif(category, ''), 'Sem linha')
where line is null
   or line = '';

create index if not exists catalog_products_line_idx on public.catalog_products (line);

drop function if exists public.get_visible_products_for_current_user();
create function public.get_visible_products_for_current_user()
returns table (
  id uuid,
  supplier_id uuid,
  supplier_name text,
  name text,
  code text,
  category text,
  line text,
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
    p.line,
    p.subcategory,
    case when r.show_description then p.description else null::text end,
    case when r.show_technical_specs then p.technical_specs else null::text end,
    case when r.show_china_cost then p.original_price else null::numeric end,
    case when r.show_china_cost then p.currency else null::text end,
    case when r.show_china_cost then p.exchange_rate else null::numeric end,
    case when r.show_nationalized_cost then p.multiplier_factor else null::numeric end,
    case when r.show_nationalized_cost then p.nationalized_cost_brl else null::numeric end,
    case when r.show_margin then p.markup else null::numeric end,
    case when r.show_final_price or r.show_resale_price then p.suggested_sale_price else null::numeric end,
    case
      when ctx.role = 'importador' and r.show_china_cost then p.original_price * (1 + st.percentual_importador / 100)
      when ctx.role = 'representante' and (r.show_final_price or r.show_resale_price) then p.suggested_sale_price * (1 + st.percentual_representante / 100)
      when ctx.role in ('cliente', 'admin', 'comercial_interno') and r.show_final_price then p.suggested_sale_price
      else null::numeric
    end,
    case
      when ctx.role = 'importador' and r.show_china_cost then 'Preco para importador'
      when ctx.role = 'representante' and (r.show_final_price or r.show_resale_price) then 'Preco para representante'
      when ctx.role = 'cliente' and r.show_final_price then 'Preco de venda'
      when ctx.role in ('admin', 'comercial_interno') and r.show_final_price then 'Preco de venda Brasil'
      else 'Consulte valor'
    end,
    case when r.show_weight then p.weight else null::numeric end,
    case when r.show_dimensions then p.dimensions else null::text end,
    case when r.show_material then p.material else null::text end,
    case when r.show_tags then p.tags else array[]::text[] end,
    null::uuid,
    case when r.show_status then p.status else null::text end,
    case when r.show_images then p.image_url else null::text end,
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
