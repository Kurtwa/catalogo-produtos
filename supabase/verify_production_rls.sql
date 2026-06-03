select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'catalog_suppliers',
    'catalog_settings',
    'catalog_files',
    'catalog_products',
    'catalog_product_images',
    'catalog_product_tags',
    'catalog_product_file_links',
    'catalog_quotes',
    'catalog_quote_items',
    'catalog_users',
    'catalog_user_profiles',
    'catalog_price_rules',
    'catalog_access_requests'
  )
order by tablename;
