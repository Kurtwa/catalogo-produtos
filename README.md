# Catalogo Interno de Produtos

MVP em React para centralizar produtos vindos de PDFs de fornecedores, com cadastro manual, upload de PDFs, busca simples, filtros, calculo de preco e estrutura pronta para busca semantica.

## Como abrir

Abra `index.html` no navegador. Sem Supabase configurado, o app inicia em modo demo.

## Conectar ao Supabase

1. Crie um projeto no Supabase.
2. No SQL Editor, rode nesta ordem:

```text
supabase/migrations/202605280001_initial_catalog_schema.sql
supabase/migrations/202605280003_data_api_grants.sql
supabase/migrations/202605280004_public_catalog_view.sql
imports/syt-05-2026/syt_seed.sql
imports/syt-05-2026/syt_tag_enrichment.sql
```

3. Em Project Settings > API, copie a Project URL e a chave publica `anon`/`publishable`.
4. Em `supabase-config.js`, preencha:

```js
window.CATALOGO_SUPABASE = {
  url: "https://SEU-PROJETO.supabase.co",
  anonKey: "SUA_CHAVE_PUBLICA_ANON_OU_PUBLISHABLE",
  buckets: {
    catalogs: "catalog-files",
    productImages: "product-images",
  },
};
```

Use apenas chave publica no frontend. Nunca coloque `service_role` neste arquivo.

Depois disso, publique a alteracao no GitHub Pages com:

```powershell
git add supabase-config.js README.md supabase/migrations/202605280003_data_api_grants.sql supabase/migrations/202605280004_public_catalog_view.sql
git commit -m "Configure Supabase setup instructions"
git push
```

## Publicar online

O app e estatico e pode rodar no GitHub Pages. Publique a branch `main` e ative Pages usando a pasta raiz do repositorio.

Arquivos locais de auditoria, OCR, Excel extraido e referencias visuais ficam fora do Git por `.gitignore`. O catalogo online usa `imports/syt-05-2026/syt_seed_data.js` e as imagens finais em `imports/syt-05-2026/product-images`.

## O que ja esta implementado

- Login com Supabase Auth.
- Cadastro/listagem de fornecedores.
- Upload de PDF para Supabase Storage e registro em `catalog_files`.
- Cadastro manual de produtos.
- Upload de imagem de produto.
- Dashboard com indicadores.
- Busca por nome, codigo, categoria, descricao, fornecedor e tags.
- Filtros por categoria, fornecedor, preco, tag e status.
- Lista em tabela e cards.
- Pagina individual do produto.
- Vinculo com PDF original.
- Produtos semelhantes por tags e categoria.
- Calculo automatico de custo nacionalizado e preco sugerido.

## Preparacao para IA/embeddings

A tabela `products` inclui a coluna `embedding vector(1536)` e `search_vector`. Para ativar embeddings depois:

1. Habilite a extensao `vector` no Supabase.
2. Gere embeddings a partir de nome, descricao, specs, categoria e tags.
3. Crie uma funcao RPC de similaridade usando cosine distance.
4. Substitua a heuristica local de produtos semelhantes por uma chamada RPC.

## Observacao de seguranca

O schema habilita RLS em todas as tabelas publicas e permite acesso apenas para usuarios autenticados nos dados internos. As imagens de produto ficam publicas para exibicao simples; PDFs ficam privados para usuarios autenticados.

## Importacao dos PDFs SYT 05/2026

Foi criado um importador local em `scripts/import_syt_pdfs.py`. Ele le os PDFs da pasta da SYT, extrai os itens encontrados e gera:

- `imports/syt-05-2026/syt_catalog_files.csv`
- `imports/syt-05-2026/syt_products_pending.csv`
- `imports/syt-05-2026/syt_seed.sql`

Para gerar novamente:

```powershell
python scripts/import_syt_pdfs.py "C:\Users\kurtw\OneDrive\Área de Trabalho\arquivos\price list syt 05.2026" --out imports\syt-05-2026
```

Os produtos entram como `pendente` porque a extracao de PDF precisa de revisao humana antes de virar cadastro final.

As fotos dos PDFs podem ser extraidas com:

```powershell
python scripts/extract_syt_images.py "C:\Users\kurtw\OneDrive\Área de Trabalho\arquivos\price list syt 05.2026" --import-dir imports\syt-05-2026
```

Esse processo salva imagens em `imports/syt-05-2026/product-images`, atualiza `syt_seed_data.js` e cria `syt_product_image_links_review.csv` para revisar se cada foto ficou vinculada ao produto correto.

Para conferir a conversao JPG do Smallpdf com OCR:

```powershell
$env:NODE_PATH="C:\Users\kurtw\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules;C:\Users\kurtw\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\.pnpm\node_modules"
& "C:\Users\kurtw\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\ocr_smallpdf_cardio.js "C:\Users\kurtw\Downloads\smallpdf-convert-20260520-175225" imports\syt-05-2026\ocr-cardio
python scripts\compare_cardio_ocr.py
```

Os resultados ficam em `imports/syt-05-2026/ocr-cardio`.

O Markdown extraido da lista Cardio pode ser comparado com:

```powershell
python scripts/compare_cardio_markdown.py "C:\Users\kurtw\Downloads\2026_SYT_Cardio_price_list_extraido.md"
```

Para enriquecer a busca com tags auxiliares em portugues:

```powershell
python scripts/enrich_search_tags.py
```

Esse enriquecimento mantem os nomes originais em ingles e adiciona termos como `banco`, `supino`, `anilhada`, `esteira`, `bike`, `remada`, `extensora`, `flexora` e outros no campo `tags`.

## Perfis de acesso

O app agora trabalha com dois perfis:

- `editor`: pode cadastrar produtos, fornecedores, PDFs e alterar dados do catalogo.
- `viewer`: pode visualizar o catalogo, pesquisar e montar carrinho para orcamento.

No modo demo, use o seletor de perfil na barra lateral. No Supabase, novos usuarios entram como `viewer`. Para transformar um usuario em editor, rode no SQL Editor:
No modo demo, use:

- usuario `kurt`, senha `123456`: perfil `editor`
- usuario `luiz`, senha `123456`: perfil `viewer`

No Supabase, novos usuarios entram como `viewer`. Para transformar um usuario em editor, rode no SQL Editor:

```sql
update public.users
set role = 'editor'
where email = 'usuario@empresa.com';
```

O schema tambem inclui `quotes` e `quote_items` para salvar orcamentos criados a partir do carrinho.

Nas configuracoes gerais, o markup e informado como porcentagem. Exemplo: `100%` significa vender pelo dobro do custo nacionalizado.
