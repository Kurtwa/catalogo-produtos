select
  grantee,
  table_name,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in (
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
    'catalog_client_products',
    'catalog_access_requests'
  )
group by grantee, table_name
order by table_name, grantee;
