select
  id,
  code,
  name,
  category,
  subcategory,
  original_price,
  image_url
from public.catalog_products
order by code nulls last, name;
