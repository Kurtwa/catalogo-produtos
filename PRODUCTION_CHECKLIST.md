# Checklist de producao - GR8 Catalogo

Use este checklist antes de publicar no GitHub Pages e liberar para usuarios reais.

## GitHub Pages

- [ ] Confirmar que `supabase-config.js` usa apenas chave publica/publishable. Nunca publicar `service_role` ou secret key.
- [ ] Manter `devProfileSwitcher: false` em `supabase-config.js`.
- [ ] Confirmar que o simulador de perfil nao aparece fora de `file:`, `localhost` ou `127.0.0.1`.
- [ ] Publicar somente arquivos do app estatico: `index.html`, `app.js`, `styles.css`, `assets/`, `imports/` e `supabase-config.js`.
- [ ] Nao publicar arquivos temporarios, dumps privados, planilhas internas ou scripts com credenciais.

## Supabase Auth

- [ ] Em Authentication > URL Configuration, configurar o Site URL do GitHub Pages.
- [ ] Adicionar o URL do GitHub Pages em Redirect URLs.
- [ ] Confirmar se cadastro de novos usuarios exige confirmacao de email, caso desejado.
- [ ] Confirmar que novos cadastros entram como `cliente`.
- [ ] Promover usuarios avancados somente pela tela de Usuarios do Adm.

## Supabase Database e RLS

- [ ] Aplicar todas as migrations pendentes no banco real antes de publicar.
- [ ] Confirmar que `catalog_products`, `catalog_product_images`, `catalog_quotes`, `catalog_quote_items`, `catalog_user_profiles` e `catalog_price_rules` estao com RLS ativo.
- [ ] Confirmar que `anon` nao consegue ler produtos, imagens e configuracoes quando o catalogo exige login.
- [ ] Confirmar que `authenticated` le apenas os dados permitidos pelo perfil.
- [ ] Confirmar que somente Adm consegue criar/editar/excluir produtos e sincronizar imagens.
- [ ] Confirmar que orcamentos sao filtrados por `created_by`, sem vazar carrinho/orcamento entre usuarios.
- [x] Hardening de grants aplicado no Supabase real em 03/06/2026: `anon` nao le tabelas internas do catalogo.
- [x] RLS verificado ativo nas tabelas principais do catalogo.
- [x] Storage ajustado: bucket publico nao tem policy ampla de listagem em `storage.objects`; somente Adm gerencia imagens.
- [ ] Rodar advisors do Supabase depois das migrations:

```powershell
supabase db advisors
```

## Migrations importantes para aplicar

Estas duas migrations sao criticas para producao:

```powershell
supabase db query --linked --file "supabase\migrations\20260602062506_fix_admin_product_image_upload.sql"
supabase db query --linked --file "supabase\migrations\20260602063837_product_primary_image_support.sql"
supabase db query --linked --file "supabase\migrations\20260603021355_production_grants_hardening.sql"
```

Se `supabase db push` reclamar que o historico remoto tem migrations que nao existem localmente, nao force deploy sem revisar. Primeiro alinhe historico com:

```powershell
supabase migration list
supabase db pull
```

Depois decida se vai reparar historico remoto ou aplicar arquivos SQL pontuais com `supabase db query --linked --file`.

## Testes manuais obrigatorios

- [ ] Usuario cliente consegue criar conta, logar, ver produtos e montar carrinho.
- [ ] Cliente nao ve fornecedor, custo interno, margem, configuracoes nem usuarios.
- [ ] Vendedor/representante/importador ve apenas os precos liberados nas Configuracoes.
- [ ] Adm consegue editar produto, alterar status e excluir produto com confirmacao.
- [ ] Adm consegue adicionar foto, substituir foto principal e definir foto principal.
- [ ] Miniaturas no detalhe trocam a imagem principal.
- [ ] Zoom de imagem respeita altura da tela.
- [ ] Salvar orcamento cria item salvo atrelado ao usuario logado.
- [ ] Outro usuario nao ve orcamentos salvos de terceiros.

## Observacoes de seguranca

- O frontend do GitHub Pages e publico por definicao. Todas as permissoes reais precisam estar no Supabase.
- Esconder botoes no JavaScript melhora UX, mas nao protege dados.
- A chave publishable do Supabase pode ficar publica; a protecao vem de RLS, policies e grants.
- O bucket `product-images` esta publico para leitura das imagens. Isso significa que quem tiver a URL publica pode abrir a imagem. Para imagens sensiveis, mudar para bucket privado e URLs assinadas.
- Advisors ainda podem avisar sobre `SECURITY DEFINER` em funcoes RPC usadas pelo app e extensoes (`pg_trgm`, `vector`) no schema `public`. Isso nao bloqueia a publicacao, mas vale planejar uma fase posterior para mover funcoes sensiveis para schema privado e extensoes para schema dedicado.
