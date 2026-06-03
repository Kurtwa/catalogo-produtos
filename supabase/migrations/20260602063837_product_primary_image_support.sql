-- Keep product galleries deterministic: one primary image per product.

with ranked_images as (
  select
    id,
    row_number() over (
      partition by product_id
      order by is_primary desc, created_at asc, id asc
    ) as position
  from public.catalog_product_images
)
update public.catalog_product_images images
set is_primary = ranked_images.position = 1
from ranked_images
where images.id = ranked_images.id;

create unique index if not exists catalog_product_images_one_primary_per_product_idx
on public.catalog_product_images (product_id)
where is_primary;

create or replace function public.catalog_sync_product_images(
  p_product_id uuid,
  p_images jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_catalog_admin() then
    raise exception 'Apenas administradores podem sincronizar imagens de produto.';
  end if;

  if p_product_id is null then
    raise exception 'Produto invalido.';
  end if;

  if coalesce(jsonb_typeof(p_images), 'array') <> 'array' then
    raise exception 'Lista de imagens invalida.';
  end if;

  delete from public.catalog_product_images
  where product_id = p_product_id;

  insert into public.catalog_product_images (
    product_id,
    file_path,
    public_url,
    is_primary,
    created_by
  )
  select
    p_product_id,
    coalesce(nullif(image_rows.file_path, ''), image_rows.public_url),
    image_rows.public_url,
    image_rows.ordinality = 1,
    auth.uid()
  from jsonb_to_recordset(p_images) with ordinality as image_rows(
    public_url text,
    file_path text,
    is_primary boolean,
    ordinality bigint
  )
  where coalesce(image_rows.public_url, '') <> '';
end;
$$;

revoke execute on function public.catalog_sync_product_images(uuid, jsonb) from public, anon;
grant execute on function public.catalog_sync_product_images(uuid, jsonb) to authenticated;
