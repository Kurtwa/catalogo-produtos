-- Usuarios solicitados:
-- kurt = editor
-- luiz = visualizador
--
-- Arquivo historico de demo. Nao use senhas genericas em producao.
-- Crie usuarios reais pelo Supabase Auth ou pelo fluxo de cadastro do app.
-- Depois rode este SQL para ajustar os perfis na tabela publica do app.

insert into public.users (id, email, full_name, role)
select id, email, coalesce(raw_user_meta_data->>'full_name', 'Kurt'), 'editor'
from auth.users
where lower(email) in ('kurt', 'kurt@catalogo.local', 'kurt@empresa.com')
on conflict (id) do update
set role = 'editor',
    full_name = excluded.full_name,
    updated_at = now();

insert into public.users (id, email, full_name, role)
select id, email, coalesce(raw_user_meta_data->>'full_name', 'Luiz'), 'viewer'
from auth.users
where lower(email) in ('luiz', 'luiz@catalogo.local', 'luiz@empresa.com')
on conflict (id) do update
set role = 'viewer',
    full_name = excluded.full_name,
    updated_at = now();
