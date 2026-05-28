const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..");
const importRoot = path.join(projectRoot, "imports", "syt-05-2026");
const seedPath = path.join(importRoot, "syt_seed_data.js");
const imageRoot = path.join(importRoot, "product-images");
const outputHtml = path.join(importRoot, "all-lines-image-audit.html");

const folderByLine = {
  "A7 Series": ["a7-series-price-list"],
  "A8 Panatta": ["a8-panatta-price"],
  "A9 Series": ["a9-series-price-list"],
  "Cardio": ["2026-syt-cardio-price-list"],
  "F Series": ["f-series-price-list"],
  "HY&HM Series": ["hy-hm-series-syt"],
  "K1 Series": ["k1-series-price-list"],
  "K3 Series": ["k3-series-price-list"],
  "K5 Series": ["k5-series-price-list"],
  "K6 Series": ["k6-series-price-list"],
  "K8 Series": ["k8-series-price-list"],
  "L Series": ["l-line-extracted"],
  "P8 Series": ["p8-series-price-list"],
  "Pilates": ["2026-syt-pilates-price-list"],
  "SQ Series": ["sq-series-price-list"],
};

function readSeed() {
  const source = fs.readFileSync(seedPath, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: seedPath });
  return sandbox.window.CATALOGO_SEED_DATA;
}

function naturalCodeValue(code) {
  const match = String(code || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function walkImages(dir, lineRoot) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkImages(full, lineRoot);
    if (!/\.(jpe?g|png|webp)$/i.test(entry.name)) return [];
    const relativeFromImageRoot = path.relative(imageRoot, full).replace(/\\/g, "/");
    const relativeFromImportRoot = `./product-images/${relativeFromImageRoot}`;
    const appPath = `./imports/syt-05-2026/product-images/${relativeFromImageRoot}`;
    return [{
      id: relativeFromImageRoot,
      file: entry.name,
      folder: lineRoot,
      src: relativeFromImportRoot,
      appPath,
      size: fs.statSync(full).size,
    }];
  });
}

function imagesForLine(line) {
  const folders = folderByLine[line] || [];
  const images = folders.flatMap((folder) => walkImages(path.join(imageRoot, folder), folder));
  return images
    .sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true }))
    .map((image, index) => ({ ...image, index: index + 1 }));
}

function normalizeAuditSrc(value) {
  return String(value || "").replace("./imports/syt-05-2026/", "./");
}

function buildHtml(lines, productsByLine, imagesByLine) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auditoria visual de imagens - todas as linhas</title>
  <style>
    :root {
      --ink: #101820;
      --muted: #627084;
      --line: #d9e3ee;
      --panel: #fff;
      --soft: #f3f8fb;
      --accent: #008c7a;
      --accent-soft: #e7fbf6;
      --warn: #b7791f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: var(--ink);
      background:
        linear-gradient(rgba(0, 140, 122, .035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 140, 122, .035) 1px, transparent 1px),
        #eef5f7;
      background-size: 32px 32px;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      display: grid;
      grid-template-columns: minmax(260px, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 14px 18px;
      background: rgba(255,255,255,.95);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(10px);
    }
    h1 { margin: 0; font-size: 22px; }
    p { margin: 4px 0 0; color: var(--muted); }
    button, input, select {
      font: inherit;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      padding: 9px 11px;
      min-height: 38px;
    }
    button { cursor: pointer; font-weight: 700; }
    button.primary {
      color: #fff;
      border-color: var(--accent);
      background: var(--accent);
    }
    .tools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
    .tools select { min-width: 220px; }
    .summary {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      padding: 10px 18px;
      border-bottom: 1px solid var(--line);
      background: rgba(255,255,255,.74);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: #fff;
      padding: 7px 10px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }
    .pill strong { color: var(--ink); }
    main {
      display: grid;
      grid-template-columns: minmax(440px, 540px) minmax(0, 1fr);
      gap: 16px;
      padding: 16px;
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      overflow: hidden;
      box-shadow: 0 18px 48px rgba(16, 24, 32, .08);
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
      max-height: calc(100vh - 186px);
      overflow: auto;
    }
    .product-row {
      display: grid;
      grid-template-columns: 82px minmax(0, 1fr) 116px;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      cursor: pointer;
    }
    .product-row.active {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
      background: var(--accent-soft);
    }
    .product-row strong,
    .product-row small { display: block; overflow-wrap: anywhere; }
    .product-row small { color: var(--muted); margin-top: 2px; }
    .product-row img {
      width: 74px;
      height: 74px;
      object-fit: contain;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: #f8fbfd;
      padding: 4px;
    }
    .candidate-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(138px, 1fr));
      gap: 10px;
      max-height: calc(100vh - 186px);
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
    .empty {
      padding: 24px;
      color: var(--muted);
    }
    textarea {
      width: 100%;
      min-height: 280px;
      margin-top: 10px;
      font-family: Consolas, monospace;
      font-size: 12px;
    }
    dialog {
      width: min(980px, 94vw);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
    }
    @media (max-width: 1060px) {
      header { grid-template-columns: 1fr; }
      .tools { justify-content: flex-start; }
      main { grid-template-columns: 1fr; }
      .products, .candidate-grid { max-height: none; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Auditoria visual de imagens</h1>
      <p>Filtre por linha, selecione um produto e clique na imagem correta para conferir aos poucos.</p>
    </div>
    <div class="tools">
      <select id="lineFilter" aria-label="Linha"></select>
      <input id="search" placeholder="Buscar codigo ou nome">
      <button id="exportLine">Exportar linha</button>
      <button id="exportAll" class="primary">Exportar tudo</button>
    </div>
  </header>
  <section class="summary" id="summary"></section>
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
        <strong>Imagens da linha</strong>
        <span id="candidateCount">0 imagens</span>
      </div>
      <div class="candidate-grid" id="candidates"></div>
    </section>
  </main>
  <dialog id="exportDialog">
    <strong>Mapa exportado</strong>
    <p>Este conteudo pode ser usado depois para aplicar correcoes em lote no catalogo.</p>
    <textarea id="exportText"></textarea>
    <div class="tools">
      <button id="copyExport" class="primary">Copiar</button>
      <button id="closeDialog">Fechar</button>
    </div>
  </dialog>
  <script>
    const lines = ${JSON.stringify(lines)};
    const productsByLine = ${JSON.stringify(productsByLine)};
    const imagesByLine = ${JSON.stringify(imagesByLine)};
    const storageKey = "all-lines-image-audit-v1";
    let pairs = JSON.parse(localStorage.getItem(storageKey) || "{}");
    let selectedLine = localStorage.getItem(storageKey + "-line") || lines[0] || "";
    let selectedProductId = "";

    const lineFilter = document.querySelector("#lineFilter");
    const search = document.querySelector("#search");
    const productEl = document.querySelector("#products");
    const candidateEl = document.querySelector("#candidates");
    const selectedText = document.querySelector("#selectedText");
    const candidateCount = document.querySelector("#candidateCount");
    const summary = document.querySelector("#summary");
    const dialog = document.querySelector("#exportDialog");
    const exportText = document.querySelector("#exportText");

    function savePairs() {
      localStorage.setItem(storageKey, JSON.stringify(pairs));
    }

    function lineProducts() {
      return productsByLine[selectedLine] || [];
    }

    function lineImages() {
      return imagesByLine[selectedLine] || [];
    }

    function selectedProduct() {
      return lineProducts().find((item) => item.id === selectedProductId) || lineProducts()[0];
    }

    function productImage(product) {
      const selected = pairs[product.id];
      const image = lineImages().find((item) => item.id === selected);
      return image ? image.src : product.currentSrc;
    }

    function renderLineOptions() {
      lineFilter.innerHTML = lines.map((line) => {
        const products = productsByLine[line]?.length || 0;
        const images = imagesByLine[line]?.length || 0;
        return '<option value="' + line + '"' + (line === selectedLine ? ' selected' : '') + '>' + line + ' (' + products + ' produtos / ' + images + ' imagens)</option>';
      }).join("");
    }

    function renderSummary() {
      const products = lineProducts();
      const images = lineImages();
      const assigned = products.filter((product) => pairs[product.id]).length;
      summary.innerHTML = [
        '<span class="pill">Linha <strong>' + selectedLine + '</strong></span>',
        '<span class="pill">Produtos <strong>' + products.length + '</strong></span>',
        '<span class="pill">Imagens <strong>' + images.length + '</strong></span>',
        '<span class="pill">Conferidos <strong>' + assigned + '</strong></span>',
        '<span class="pill">Diferença <strong>' + Math.abs(products.length - images.length) + '</strong></span>'
      ].join("");
    }

    function renderProducts() {
      const query = search.value.trim().toLowerCase();
      const products = lineProducts().filter((product) => {
        return !query || [product.code, product.name, product.description, product.dimensions, product.weight].join(" ").toLowerCase().includes(query);
      });
      if (!products.length) {
        productEl.innerHTML = '<div class="empty">Nenhum produto encontrado nesta linha.</div>';
        return;
      }
      if (!selectedProductId || !lineProducts().some((item) => item.id === selectedProductId)) selectedProductId = products[0].id;
      productEl.innerHTML = products.map((product) => {
        const selectedImageId = pairs[product.id] || "";
        return '<article class="product-row ' + (product.id === selectedProductId ? 'active' : '') + '" data-product="' + product.id + '">' +
          '<img src="' + productImage(product) + '" alt="">' +
          '<div><strong>' + product.code + ' - ' + product.name + '</strong><small>' + (product.dimensions || '-') + '</small><small>' + (product.weight || '-') + '</small></div>' +
          '<select data-pair="' + product.id + '"><option value="">Atual</option>' + lineImages().map((image) => '<option value="' + image.id + '"' + (selectedImageId === image.id ? ' selected' : '') + '>#' + String(image.index).padStart(3, "0") + '</option>').join("") + '</select>' +
        '</article>';
      }).join("");
      productEl.querySelectorAll("[data-product]").forEach((row) => row.addEventListener("click", (event) => {
        if (event.target.tagName === "SELECT") return;
        selectedProductId = row.dataset.product;
        render();
      }));
      productEl.querySelectorAll("[data-pair]").forEach((select) => select.addEventListener("change", () => {
        if (select.value) pairs[select.dataset.pair] = select.value;
        else delete pairs[select.dataset.pair];
        selectedProductId = select.dataset.pair;
        savePairs();
        render();
      }));
    }

    function renderCandidates() {
      const current = selectedProduct();
      const selectedImageId = current ? pairs[current.id] : "";
      selectedText.textContent = current ? current.code + " - " + current.name : "Nenhum selecionado";
      candidateCount.textContent = lineImages().length + " imagens";
      if (!lineImages().length) {
        candidateEl.innerHTML = '<div class="empty">Nenhuma imagem encontrada para esta linha.</div>';
        return;
      }
      candidateEl.innerHTML = lineImages().map((image) => {
        return '<article class="candidate ' + (image.id === selectedImageId ? 'active' : '') + '" data-image="' + image.id + '">' +
          '<img src="' + image.src + '" alt="Imagem candidata #' + image.index + '">' +
          '<span>#' + String(image.index).padStart(3, "0") + ' · ' + image.folder + '</span>' +
          '<span>' + image.file + '</span>' +
        '</article>';
      }).join("");
      candidateEl.querySelectorAll("[data-image]").forEach((card) => card.addEventListener("click", () => {
        if (!selectedProductId) return;
        pairs[selectedProductId] = card.dataset.image;
        savePairs();
        render();
      }));
    }

    function exportRows(scope) {
      const selectedLines = scope === "all" ? lines : [selectedLine];
      return selectedLines.flatMap((line) => {
        return (productsByLine[line] || []).map((product) => {
          const image = (imagesByLine[line] || []).find((item) => item.id === pairs[product.id]);
          return {
            line,
            id: product.id,
            code: product.code,
            name: product.name,
            image_url: image ? image.appPath : product.currentAppPath,
            candidate_file: image ? image.file : "",
            candidate_folder: image ? image.folder : "",
            changed: Boolean(image),
          };
        });
      });
    }

    function showExport(scope) {
      exportText.value = JSON.stringify(exportRows(scope), null, 2);
      dialog.showModal();
      exportText.focus();
      exportText.select();
    }

    function render() {
      renderLineOptions();
      renderSummary();
      renderProducts();
      renderCandidates();
    }

    lineFilter.addEventListener("change", () => {
      selectedLine = lineFilter.value;
      selectedProductId = "";
      localStorage.setItem(storageKey + "-line", selectedLine);
      render();
    });
    search.addEventListener("input", renderProducts);
    document.querySelector("#exportLine").addEventListener("click", () => showExport("line"));
    document.querySelector("#exportAll").addEventListener("click", () => showExport("all"));
    document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());
    document.querySelector("#copyExport").addEventListener("click", async () => navigator.clipboard.writeText(exportText.value));
    render();
  </script>
</body>
</html>`;
}

const seed = readSeed();
const lines = [...new Set(seed.products.map((product) => product.subcategory || product.category || "Sem linha"))]
  .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
const productsByLine = {};
const imagesByLine = {};

lines.forEach((line) => {
  productsByLine[line] = seed.products
    .filter((product) => (product.subcategory || product.category || "Sem linha") === line)
    .sort((a, b) => naturalCodeValue(a.code) - naturalCodeValue(b.code) || String(a.code).localeCompare(String(b.code), "pt-BR", { numeric: true }))
    .map((product) => ({
      id: product.id,
      code: product.code,
      name: product.name,
      description: product.description,
      dimensions: product.dimensions,
      weight: product.weight,
      currentSrc: normalizeAuditSrc(product.image_url),
      currentAppPath: product.image_url,
    }));
  imagesByLine[line] = imagesForLine(line);
});

fs.writeFileSync(outputHtml, buildHtml(lines, productsByLine, imagesByLine), "utf8");

console.log(JSON.stringify({
  outputHtml,
  lines: lines.length,
  products: seed.products.length,
  images: Object.values(imagesByLine).reduce((sum, items) => sum + items.length, 0),
  counts: lines.map((line) => ({ line, products: productsByLine[line].length, images: imagesByLine[line].length })),
}, null, 2));
