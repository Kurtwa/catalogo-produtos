alter table public.catalog_user_profiles
  add column if not exists customer_type text not null default 'usuario'
  check (customer_type in ('usuario', 'academia', 'estudio', 'empresa'));
