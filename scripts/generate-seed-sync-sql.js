const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const seedPath = path.join(root, "imports", "syt-05-2026", "syt_seed_data.js");
const comparePath = path.join(root, "supabase", "compare_missing_seed_products.sql");
const diagnosePath = path.join(root, "supabase", "diagnose_seed_product_sync.sql");
const syncPath = path.join(root, "supabase", "sync_missing_seed_products.sql");

function sqlString(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  if (value === null || value === undefined || value === "") return "null";
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : "null";
}

function sqlTextArray(values) {
  if (!Array.isArray(values) || values.length === 0) return "'{}'::text[]";
  return `array[${values.map(sqlString).join(", ")}]::text[]`;
}

function loadSeedProducts() {
  const code = fs.readFileSync(seedPath, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: seedPath });
  const data = sandbox.window.CATALOGO_SEED_DATA || sandbox.CATALOGO_SEED_DATA;
  if (!data || !Array.isArray(data.products)) {
    throw new Error("Seed local nao contem window.CATALOGO_SEED_DATA.products.");
  }
  return data.products;
}

function productValues(products) {
  return products
    .map((product) => {
      const gallery = Array.isArray(product.gallery)
        ? product.gallery.filter(Boolean)
        : product.image_url
          ? [product.image_url]
          : [];

      return `(${[
        sqlString(product.id),
        sqlString(product.supplier_id),
        sqlString(product.name),
        sqlString(product.code),
        sqlString(product.category),
        sqlString(product.line || product.subcategory || product.category),
        sqlString(product.subcategory),
        sqlString(product.description),
        sqlString(product.technical_specs),
        sqlNumber(product.original_price),
        sqlString(product.currency || "USD"),
        sqlNumber(product.exchange_rate),
        sqlNumber(product.multiplier_factor),
        sqlNumber(product.markup),
        sqlNumber(product.weight),
        sqlString(product.dimensions),
        sqlString(product.material),
        sqlTextArray(product.tags),
        sqlString(product.source_file_id),
        sqlString(product.status || "pendente"),
        sqlString(product.image_url),
        sqlTextArray(gallery)
      ].join(", ")})`;
    })
    .join(",\n");
}

function withLocalProducts(products) {
  return `with local_products (
  id,
  supplier_id,
  name,
  code,
  category,
  line,
  subcategory,
  description,
  technical_specs,
  original_price,
  currency,
  exchange_rate,
  multiplier_factor,
  markup,
  weight,
  dimensions,
  material,
  tags,
  source_file_id,
  status,
  image_url,
  gallery
) as (
  values
${productValues(products)}
)`;
}

function buildCompareSql(products) {
  return `${withLocalProducts(products)}
select
  lp.code,
  lp.name,
  lp.category,
  lp.subcategory,
  lp.original_price,
  lp.image_url
from local_products lp
left join public.catalog_products cp on cp.id = lp.id::uuid or cp.code = lp.code
where cp.id is null
order by lp.code;
`;
}

function buildSyncSql(products) {
  return `${withLocalProducts(products)},
inserted_products as (
  insert into public.catalog_products (
    id,
    supplier_id,
    name,
    code,
    category,
    line,
    subcategory,
    description,
    technical_specs,
    original_price,
    currency,
    exchange_rate,
    multiplier_factor,
    markup,
    weight,
    dimensions,
    material,
    tags,
    source_file_id,
    status,
    image_url,
    updated_at
  )
  select
    lp.id::uuid,
    lp.supplier_id::uuid,
    lp.name,
    lp.code,
    lp.category,
    lp.line,
    lp.subcategory,
    lp.description,
    lp.technical_specs,
    coalesce(lp.original_price::numeric, 0),
    coalesce(lp.currency, 'USD'),
    coalesce(lp.exchange_rate::numeric, 0),
    coalesce(lp.multiplier_factor::numeric, 1),
    coalesce(lp.markup::numeric, 1),
    lp.weight::numeric,
    lp.dimensions,
    lp.material,
    coalesce(lp.tags, '{}'::text[]),
    lp.source_file_id::uuid,
    coalesce(lp.status, 'pendente'),
    lp.image_url,
    now()
  from local_products lp
  where not exists (
    select 1
    from public.catalog_products cp
    where cp.id = lp.id::uuid
       or cp.code = lp.code
  )
  returning id, code, name, image_url
),
image_candidates as (
  select
    ip.id as product_id,
    unnest(
      case
        when lp.gallery is not null and array_length(lp.gallery, 1) > 0 then lp.gallery
        when ip.image_url is not null then array[ip.image_url]::text[]
        else '{}'::text[]
      end
    ) as image_url,
    generate_subscripts(
      case
        when lp.gallery is not null and array_length(lp.gallery, 1) > 0 then lp.gallery
        when ip.image_url is not null then array[ip.image_url]::text[]
        else '{}'::text[]
      end,
      1
    ) as image_index
  from inserted_products ip
  join local_products lp on lp.code = ip.code
),
inserted_images as (
  insert into public.catalog_product_images (
    product_id,
    file_path,
    public_url,
    is_primary
  )
  select
    ic.product_id,
    ic.image_url,
    ic.image_url,
    ic.image_index = 1
  from image_candidates ic
  where ic.image_url is not null
    and ic.image_url <> ''
    and not exists (
      select 1
      from public.catalog_product_images cpi
      where cpi.product_id = ic.product_id
        and cpi.file_path = ic.image_url
    )
  returning product_id
)
select
  (select count(*) from inserted_products) as inserted_products,
  (select count(*) from inserted_images) as inserted_images,
  (select count(*) from public.catalog_products) as total_products_after;
`;
}

function buildDiagnoseSql(products) {
  return `${withLocalProducts(products)}
select
  (select count(*) from local_products) as local_products,
  (select count(*) from public.catalog_products) as remote_products,
  (select count(*) from local_products lp where exists (select 1 from public.catalog_products cp where cp.id = lp.id::uuid)) as local_matched_by_id,
  (select count(*) from local_products lp where exists (select 1 from public.catalog_products cp where cp.code = lp.code)) as local_matched_by_code,
  (select count(*) from local_products lp where exists (select 1 from public.catalog_products cp where cp.id = lp.id::uuid or cp.code = lp.code)) as local_matched_by_id_or_code,
  (select count(*) from local_products lp where not exists (select 1 from public.catalog_products cp where cp.id = lp.id::uuid)) as local_missing_by_id,
  (select count(*) from local_products lp where not exists (select 1 from public.catalog_products cp where cp.code = lp.code)) as local_missing_by_code,
  (select count(*) from local_products lp where not exists (select 1 from public.catalog_products cp where cp.id = lp.id::uuid or cp.code = lp.code)) as local_missing_by_id_and_code,
  (select count(*) from public.catalog_products cp where not exists (select 1 from local_products lp where lp.id::uuid = cp.id)) as remote_not_in_local_by_id,
  (select count(*) from public.catalog_products cp where not exists (select 1 from local_products lp where lp.code = cp.code)) as remote_not_in_local_by_code;
`;
}

const products = loadSeedProducts();
fs.writeFileSync(comparePath, buildCompareSql(products), "utf8");
fs.writeFileSync(diagnosePath, buildDiagnoseSql(products), "utf8");
fs.writeFileSync(syncPath, buildSyncSql(products), "utf8");

console.log(JSON.stringify({
  products: products.length,
  comparePath,
  diagnosePath,
  syncPath
}, null, 2));
