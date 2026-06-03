# Relatório de Melhorias - Catálogo de Produtos GR8

Este relatório foi gerado para auxiliar na otimização e evolução do catálogo de produtos.

---

## 📊 Visão Geral: Estado Atual vs. Estado Proposto

| Aspecto | Estado Atual (Vanilla Monolítico) | Estado Proposto (Modular / Moderno) |
| :--- | :--- | :--- |
| **Tamanho do JS Principal** | `app.js` único com **2.273 linhas** de código. | Código dividido em módulos pequenos, reutilizáveis e focados. |
| **Performance Inicial** | `syt_seed_data.js` de **1,28 MB** carregado no `<head>` bloqueando a tela. | Seed carregado de forma assíncrona (JSON/fetch) apenas no modo demo. |
| **Reatividade/Renderização** | Reconstrução total da tela com `innerHTML` (causa perda de foco/cursor). | Virtual DOM (React/Preact) ou atualizações finas de DOM. |
| **Build & Dependências** | Depende de CDNs externos (unpkg) e roda direto via protocolo `file://`. | Empacotamento via **Vite**, dependências locais (`npm`) e servidor local. |
| **Cálculos e Negócios** | Lógica de precificação e margens duplicada e espalhada por várias funções. | Módulo utilitário centralizado com testes unitários associados. |

---

## 🔍 Detalhamento das Recomendações

### 1. Performance: Otimizar o Carregamento do Seed Data (1.28MB)
Atualmente, o arquivo `imports/syt-05-2026/syt_seed_data.js` é carregado na tag `<head>` de forma síncrona. O navegador é forçado a baixar e analisar 1.28MB de dados antes de exibir qualquer elemento na tela.
* **Impacto:** Lentidão ao abrir o catálogo, mesmo que o usuário use o Supabase (situação onde o arquivo de sementes nem sequer é necessário).
* **Melhoria:** Converter os dados para um formato JSON puro e fazer o carregamento assíncrono via `fetch()` somente se o Supabase não estiver configurado (Modo Demo).

### 2. Organização: Modularização de Módulos ES
O arquivo `app.js` faz tudo sozinho: conecta ao banco, controla quem está logado, gera as telas no HTML e calcula preços.
* **Impacto:** Alterar uma fórmula matemática pode quebrar uma tela inteira por acidente. O código fica difícil de ler e expandir.
* **Melhoria:** Separar o código em arquivos menores, tais como:
  * `src/utils/pricing.js`: Apenas para regras e fórmulas de preços e moedas.
  * `src/services/supabase.js`: Apenas para chamadas de banco de dados e login.
  * `src/components/`: Telas e elementos visuais isolados (ex: cards de produtos, carrinho).

### 3. Interface: Melhoria na Reatividade e DOM
O aplicativo renderiza as telas redesenhando tudo com `innerHTML = ...` a cada interação.
* **Impacto:** Quando você digita nos filtros ou altera valores nas configurações, a tela "pisca" e você perde o cursor/foco do teclado.
* **Melhoria:** Usar uma biblioteca de renderização leve (como Preact ou lit-html) ou migrar para **React com Vite** (o que tornará a interface extremamente fluida e reativa).

### 4. Infraestrutura: Implementação de Ambiente com Vite
O aplicativo é aberto por um arquivo `.bat` apontando para o arquivo local (`file:///...`).
* **Impacto:** Algumas funcionalidades avançadas de autenticação do Supabase ou armazenamento local (localStorage) funcionam com limitações no navegador devido a restrições de segurança do protocolo `file://`.
* **Melhoria:** Adotar o gerenciador de pacotes NPM e o **Vite** para empacotar o projeto. Isso disponibilizará um servidor local seguro (`http://localhost:5173`) e facilitará o deploy em servidores de produção.

---

## 🛠️ Como prosseguir?

Se desejar que eu comece a aplicar essas otimizações no seu projeto, me informe qual o seu objetivo prioritário (ex: "Quero migrar para React com Vite" ou "Vamos apenas dividir o arquivo JS atual em módulos menores").
