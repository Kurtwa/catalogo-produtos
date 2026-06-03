select
  count(*) as total_products,
  count(*) filter (where line is null or line = '') as products_without_line,
  count(distinct line) as distinct_lines
from public.catalog_products;

select
  line,
  count(*) as products
from public.catalog_products
group by line
order by line nulls last;
