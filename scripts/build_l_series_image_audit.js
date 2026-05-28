const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..");
const sourceDir = process.argv[2] || "C:\\Users\\kurtw\\Downloads\\L line imagens";
const seedPath = path.join(projectRoot, "imports", "syt-05-2026", "syt_seed_data.js");
const outputDir = path.join(projectRoot, "imports", "syt-05-2026", "product-images", "l-line-extracted");
const outputHtml = path.join(projectRoot, "imports", "syt-05-2026", "l-series-image-audit.html");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function naturalCodeValue(code) {
  const match = String(code || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function readSeed() {
  const source = fs.readFileSync(seedPath, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: seedPath });
  return sandbox.window.CATALOGO_SEED_DATA;
}

function copyImages() {
  fs.mkdirSync(outputDir, { recursive: true });
  return fs.readdirSync(sourceDir)
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }))
    .map((file, index) => {
      const extension = path.extname(file).toLowerCase();
      const targetName = `l-candidate-${String(index + 1).padStart(3, "0")}${extension}`;
      const from = path.join(sourceDir, file);
      const to = path.join(outputDir, targetName);
      fs.copyFileSync(from, to);
      return {
        index: index + 1,
        original: file,
        file: targetName,
        src: `./product-images/l-line-extracted/${targetName}`,
        size: fs.statSync(to).size,
      };
    });
}

function buildHtml(products, images) {
  const initialPairs = products.map((product, index) => ({
    productId: product.id,
    code: product.code,
    candidateIndex: images[index]?.index || "",
  }));

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auditoria de imagens - L Series</title>
  <style>
    :root {
      --ink: #101820;
      --muted: #627084;
      --line: #d9e3ee;
      --panel: #fff;
      --soft: #f3f8fb;
      --accent: #008c7a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: var(--ink);
      background: #eef5f7;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 18px;
      background: rgba(255,255,255,.94);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(10px);
    }
    h1 { margin: 0; font-size: 22px; }
    header p { margin: 4px 0 0; color: var(--muted); }
    button, input, select {
      font: inherit;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      padding: 9px 11px;
    }
    button {
      cursor: pointer;
      font-weight: 700;
    }
    button.primary {
      color: #fff;
      border-color: var(--accent);
      background: var(--accent);
    }
    main {
      display: grid;
      grid-template-columns: minmax(420px, 520px) minmax(0, 1fr);
      gap: 16px;
      padding: 16px;
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      overflow: hidden;
    }
    .panel-head {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      border-bottom: 1px solid var(--line);
      background: var(--soft);
    }
    .products {
      max-height: calc(100vh - 122px);
      overflow: auto;
    }
    .product-row {
      display: grid;
      grid-template-columns: 84px minmax(0, 1fr) 98px;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      cursor: pointer;
    }
    .product-row.active {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
      background: #eefcf8;
    }
    .product-row strong, .product-row small { display: block; }
    .product-row small { color: var(--muted); margin-top: 2px; }
    .product-row img {
      width: 76px;
      height: 76px;
      object-fit: contain;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: #f8fbfd;
      padding: 4px;
    }
    .candidate-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
      gap: 10px;
      max-height: calc(100vh - 122px);
      overflow: auto;
      padding: 12px;
    }
    .candidate {
      display: grid;
      gap: 6px;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
    }
    .candidate.active {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(0,140,122,.18);
    }
    .candidate img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: contain;
      background: #f8fbfd;
      border-radius: 6px;
    }
    .candidate span {
      font-size: 12px;
      color: var(--muted);
      overflow-wrap: anywhere;
    }
    .tools {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    textarea {
      width: 100%;
      min-height: 220px;
      margin-top: 10px;
      font-family: Consolas, monospace;
      font-size: 12px;
    }
    dialog {
      width: min(920px, 94vw);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }
    @media (max-width: 980px) {
      main { grid-template-columns: 1fr; }
      .products, .candidate-grid { max-height: none; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Auditoria de imagens - L Series</h1>
      <p>${products.length} produtos e ${images.length} imagens extraidas. Clique em um produto e depois na imagem correta.</p>
    </div>
    <div class="tools">
      <input id="search" placeholder="Buscar codigo ou nome">
      <button id="exportCsv">Exportar CSV</button>
      <button id="exportJson" class="primary">Exportar JSON</button>
    </div>
  </header>
  <main>
    <section class="panel">
      <div class="panel-head">
        <strong>Produtos</strong>
        <span id="selectedText">Nenhum selecionado</span>
      </div>
      <div class="products" id="products"></div>
    </section>
    <section class="panel">
      <div class="panel-head">
        <strong>Imagens candidatas</strong>
        <span>Clique para associar</span>
      </div>
      <div class="candidate-grid" id="candidates"></div>
    </section>
  </main>
  <dialog id="exportDialog">
    <strong>Mapa exportado</strong>
    <p>Use este conteudo para aplicar as imagens no catalogo.</p>
    <textarea id="exportText"></textarea>
    <div class="tools">
      <button id="copyExport" class="primary">Copiar</button>
      <button id="closeDialog">Fechar</button>
    </div>
  </dialog>
  <script>
    const products = ${JSON.stringify(products, null, 2)};
    const images = ${JSON.stringify(images, null, 2)};
    const initialPairs = ${JSON.stringify(initialPairs, null, 2)};
    const storageKey = "l-series-image-audit-v1";
    let selectedProductId = products[0]?.id || "";
    let pairs = JSON.parse(localStorage.getItem(storageKey) || "null") || Object.fromEntries(initialPairs.map((item) => [item.productId, item.candidateIndex]));

    const productEl = document.querySelector("#products");
    const candidateEl = document.querySelector("#candidates");
    const selectedText = document.querySelector("#selectedText");
    const search = document.querySelector("#search");
    const dialog = document.querySelector("#exportDialog");
    const exportText = document.querySelector("#exportText");

    function savePairs() {
      localStorage.setItem(storageKey, JSON.stringify(pairs));
    }

    function selectedProduct() {
      return products.find((item) => item.id === selectedProductId) || products[0];
    }

    function renderProducts() {
      const query = search.value.trim().toLowerCase();
      productEl.innerHTML = products
        .filter((product) => !query || [product.code, product.name, product.description].join(" ").toLowerCase().includes(query))
        .map((product) => {
          const image = images.find((item) => item.index === Number(pairs[product.id]));
          return '<article class="product-row ' + (product.id === selectedProductId ? 'active' : '') + '" data-product="' + product.id + '">' +
            '<img src="' + (image ? image.src : product.image_url) + '" alt="">' +
            '<div><strong>' + product.code + ' - ' + product.name + '</strong><small>' + product.dimensions + '</small><small>' + product.weight + '</small></div>' +
            '<select data-pair="' + product.id + '">' + images.map((candidate) => '<option value="' + candidate.index + '"' + (Number(pairs[product.id]) === candidate.index ? ' selected' : '') + '>#' + String(candidate.index).padStart(3, "0") + '</option>').join("") + '</select>' +
          '</article>';
        }).join("");
      productEl.querySelectorAll("[data-product]").forEach((row) => row.addEventListener("click", (event) => {
        if (event.target.tagName === "SELECT") return;
        selectedProductId = row.dataset.product;
        render();
      }));
      productEl.querySelectorAll("[data-pair]").forEach((select) => select.addEventListener("change", () => {
        pairs[select.dataset.pair] = Number(select.value);
        selectedProductId = select.dataset.pair;
        savePairs();
        render();
      }));
    }

    function renderCandidates() {
      const current = selectedProduct();
      selectedText.textContent = current ? current.code + " - " + current.name : "Nenhum selecionado";
      const activeIndex = Number(pairs[selectedProductId]);
      candidateEl.innerHTML = images.map((image) => {
        return '<article class="candidate ' + (image.index === activeIndex ? 'active' : '') + '" data-image="' + image.index + '">' +
          '<img src="' + image.src + '" alt="Imagem candidata #' + image.index + '">' +
          '<span>#' + String(image.index).padStart(3, "0") + '</span>' +
          '<span>' + image.original + '</span>' +
        '</article>';
      }).join("");
      candidateEl.querySelectorAll("[data-image]").forEach((card) => card.addEventListener("click", () => {
        if (!selectedProductId) return;
        pairs[selectedProductId] = Number(card.dataset.image);
        savePairs();
        render();
      }));
    }

    function exportRows() {
      return products.map((product) => {
        const image = images.find((item) => item.index === Number(pairs[product.id]));
        return {
          id: product.id,
          code: product.code,
          name: product.name,
          image_url: image ? image.src : "",
          original_file: image ? image.original : "",
        };
      });
    }

    function toCsv(rows) {
      const headers = ["id", "code", "name", "image_url", "original_file"];
      return [headers.join(","), ...rows.map((row) => headers.map((key) => '"' + String(row[key] || "").replace(/"/g, '""') + '"').join(","))].join("\\n");
    }

    function showExport(type) {
      const rows = exportRows();
      exportText.value = type === "csv" ? toCsv(rows) : JSON.stringify(rows, null, 2);
      dialog.showModal();
      exportText.focus();
      exportText.select();
    }

    function render() {
      renderProducts();
      renderCandidates();
    }

    search.addEventListener("input", renderProducts);
    document.querySelector("#exportCsv").addEventListener("click", () => showExport("csv"));
    document.querySelector("#exportJson").addEventListener("click", () => showExport("json"));
    document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());
    document.querySelector("#copyExport").addEventListener("click", async () => {
      await navigator.clipboard.writeText(exportText.value);
    });
    render();
  </script>
</body>
</html>`;
}

const seed = readSeed();
const products = seed.products
  .filter((product) => product.subcategory === "L Series")
  .sort((a, b) => naturalCodeValue(a.code) - naturalCodeValue(b.code))
  .map((product) => ({
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    dimensions: product.dimensions,
    weight: product.weight,
    image_url: product.image_url,
  }));
const images = copyImages();
const html = buildHtml(products, images);
fs.writeFileSync(outputHtml, html, "utf8");

console.log(JSON.stringify({
  products: products.length,
  images: images.length,
  outputHtml,
  outputDir,
}, null, 2));
