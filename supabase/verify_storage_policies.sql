select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    qual ilike '%product-images%'
    or with_check ilike '%product-images%'
    or policyname ilike '%product image%'
  )
order by policyname;
