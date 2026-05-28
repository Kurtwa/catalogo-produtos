# Supabase

Este diretorio guarda as migracoes SQL do catalogo.

## Ordem recomendada

1. Rode `migrations/202605280001_initial_catalog_schema.sql` no SQL Editor do Supabase.
2. Crie os usuarios no Supabase Auth.
3. Rode `migrations/202605280002_demo_users_roles.sql` se quiser marcar `kurt` como editor e `luiz` como visualizador.
4. Preencha `supabase-config.js` com a URL do projeto e a chave publica `anon/publishable`.

O schema cria as tabelas, indices, RLS, policies e buckets:

- `catalog-files`
- `product-images`

Use somente chave publica no frontend. Nunca publique `service_role`.
