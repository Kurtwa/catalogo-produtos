(function () {
  const config = window.CATALOGO_SUPABASE || {};
  const isConfigured = Boolean(config.url && config.anonKey && window.supabase);
  const client = isConfigured ? window.supabase.createClient(config.url, config.anonKey) : null;
  const buckets = config.buckets || { catalogs: "catalog-files", productImages: "product-images" };
  let productRefreshTimer;
  const defaultSettings = {
    usdToBrl: Number(config.usdToBrl || 5.25),
    usdToCny: Number(config.usdToCny || 7.24),
    multiplierFactor: Number(config.multiplierFactor || 1.6),
    markupPercent: Number(config.markupPercent || 100),
  };
  const profileOptions = [
    ["editor", "Adm"],
    ["viewer", "Vendedor"],
    ["client", "Cliente"],
  ];
  const searchAliases = {
    banco: ["bench", "reformer", "seat", "abdominal"],
    supino: ["bench press", "chest press", "olympic bench", "flat bench", "incline bench"],
    anilhada: ["plate loaded", "plate-loaded", "loading plate"],
    musculacao: ["strength", "gym", "fitness"],
    costas: ["row", "lat", "pulldown", "back"],
    peito: ["chest", "pec", "bench press"],
    perna: ["leg", "squat", "calf", "glute"],
    ombro: ["shoulder", "deltoid"],
    braco: ["arm", "biceps", "triceps"],
    esteira: ["treadmill"],
    bicicleta: ["bike", "cycle"],
    eliptico: ["elliptical", "cross trainer"],
    cadeira: ["chair", "seated"],
    polia: ["cable", "pulley"],
    extensora: ["leg extension", "extension"],
    flexora: ["leg curl", "curl"],
    remada: ["row"],
    puxada: ["lat pulldown", "pulldown"],
    voador: ["pec fly", "peck deck", "butterfly"],
    abdutora: ["abductor"],
    adutora: ["adductor"],
    panturrilha: ["calf"],
    gluteo: ["glute", "hip thrust"],
  };
  const brazilTagRules = [
    { includes: ["leg", "curl"], tags: ["flexora", "posterior de coxa"] },
    { includes: ["leg", "curling"], tags: ["flexora", "posterior de coxa"] },
    { includes: ["leg", "extension"], tags: ["extensora", "quadriceps"] },
    { includes: ["stretch", "leg"], tags: ["extensora", "quadriceps"] },
    { includes: ["bend", "leg"], tags: ["flexora", "posterior de coxa"] },
    { includes: ["leg", "press"], tags: ["leg press", "perna"] },
    { includes: ["hack", "squat"], tags: ["hack", "agachamento"] },
    { includes: ["smith"], tags: ["smith", "agachamento"] },
    { includes: ["chest", "press"], tags: ["supino", "peitoral"] },
    { includes: ["bench", "press"], tags: ["supino", "banco"] },
    { includes: ["shoulder", "press"], tags: ["desenvolvimento", "ombro"] },
    { includes: ["lat", "pulldown"], tags: ["puxada alta", "costas"] },
    { includes: ["seated", "row"], tags: ["remada baixa", "costas"] },
    { includes: ["low", "row"], tags: ["remada baixa", "costas"] },
    { includes: ["high", "row"], tags: ["remada alta", "costas"] },
    { includes: ["rowing"], tags: ["remada", "costas"] },
    { includes: ["pec", "fly"], tags: ["voador", "peitoral"] },
    { includes: ["peck", "deck"], tags: ["voador", "peitoral"] },
    { includes: ["abductor"], tags: ["abdutora", "gluteo"] },
    { includes: ["adductor"], tags: ["adutora", "interno de coxa"] },
    { includes: ["glute"], tags: ["gluteo"] },
    { includes: ["hip", "thrust"], tags: ["elevacao pelvica", "gluteo"] },
    { includes: ["calf"], tags: ["panturrilha"] },
    { includes: ["treadmill"], tags: ["esteira", "cardio"] },
    { includes: ["elliptical"], tags: ["eliptico", "cardio"] },
    { includes: ["bike"], tags: ["bicicleta", "cardio"] },
    { includes: ["functional", "trainer"], tags: ["crossover", "polia"] },
    { includes: ["cable"], tags: ["polia"] },
    { includes: ["preacher"], tags: ["banco scott", "biceps"] },
    { includes: ["biceps"], tags: ["biceps"] },
    { includes: ["triceps"], tags: ["triceps"] },
    { includes: ["abdominal"], tags: ["abdominal"] },
    { includes: ["roman", "chair"], tags: ["cadeira romana", "abdominal"] },
  ];

  const state = {
    session: null,
    view: "dashboard",
    productViewMode: "table",
    query: "",
    filters: { category: "", subcategory: "", supplier_id: "", status: "", tag: "", min: "", max: "" },
    selectedProductId: "prod-1",
    profileRole: "client",
    settings: { ...defaultSettings },
    converter: {
      usd: 1,
      brl: defaultSettings.usdToBrl,
      cny: defaultSettings.usdToCny,
    },
    editingProductId: "",
    ratesMeta: {
      source: "manual",
      updatedAt: "",
      loading: false,
    },
    cart: [],
    message: "",
    suppliers: [
      { id: "sup-1", name: "Ningbo Equipamentos", country: "China", contact_name: "Lina Zhou", email: "sales@ningbo.example" },
      { id: "sup-2", name: "Tecno Parts Europe", country: "Italia", contact_name: "Marco Bianchi", email: "export@tecnoparts.example" },
    ],
    catalogs: [
      { id: "file-1", supplier_id: "sup-1", file_name: "catalogo-industrial-2026.pdf", file_path: "demo/catalogo-industrial-2026.pdf", status: "uploaded" },
    ],
    products: [
      {
        id: "prod-1",
        supplier_id: "sup-1",
        name: "Valvula solenoide compacta",
        code: "NSV-220",
        category: "Automacao",
        subcategory: "Valvulas",
        description: "Valvula para acionamento pneumatico em linhas compactas.",
        technical_specs: "220V, corpo em latao, conexao 1/4.",
        original_price: 18.5,
        currency: "USD",
        exchange_rate: 5.25,
        multiplier_factor: 1.65,
        markup: 2.1,
        weight: 0.42,
        dimensions: "9 x 5 x 4 cm",
        material: "Latao",
        tags: ["pneumatica", "valvula", "automacao"],
        source_file_id: "file-1",
        status: "pendente",
        image_url: "",
      },
      {
        id: "prod-2",
        supplier_id: "sup-2",
        name: "Sensor indutivo M18",
        code: "TP-SI18",
        category: "Sensores",
        subcategory: "Indutivos",
        description: "Sensor indutivo cilindrico para deteccao de metais.",
        technical_specs: "M18, PNP, NA, IP67, 10-30VDC.",
        original_price: 12.9,
        currency: "EUR",
        exchange_rate: 5.72,
        multiplier_factor: 1.52,
        markup: 2.25,
        weight: 0.12,
        dimensions: "M18 x 65 mm",
        material: "Aco inox",
        tags: ["sensor", "indutivo", "m18"],
        source_file_id: "",
        status: "revisado",
        image_url: "",
      },
    ],
  };

  if (window.CATALOGO_SEED_DATA) {
    state.suppliers = window.CATALOGO_SEED_DATA.suppliers || state.suppliers;
    state.catalogs = window.CATALOGO_SEED_DATA.catalogs || state.catalogs;
    state.products = window.CATALOGO_SEED_DATA.products || state.products;
    state.selectedProductId = state.products[0]?.id || state.selectedProductId;
  }
  try {
    const savedSettings = JSON.parse(window.localStorage?.getItem("catalogo-settings") || "null");
    if (savedSettings) {
      if (savedSettings.markup && !savedSettings.markupPercent) savedSettings.markupPercent = (Number(savedSettings.markup) - 1) * 100;
      state.settings = { ...state.settings, ...savedSettings };
    }
  } catch (_error) {
    window.localStorage?.removeItem("catalogo-settings");
  }
  syncConverterFromUsd(state.converter.usd);

  const root = document.getElementById("root");
  const statuses = ["pendente", "revisado", "arquivado"];
  const currencies = ["USD", "EUR", "BRL", "CNY"];

  function isEditor() {
    return state.profileRole === "editor";
  }

  function isClient() {
    return state.profileRole === "client";
  }

  function roleLabel() {
    if (isEditor()) return "Adm";
    if (isClient()) return "Cliente";
    return "Vendedor";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  function icon(name) {
    return `<i data-lucide="${escapeHtml(name)}" aria-hidden="true"></i>`;
  }

  function withIcon(name, label) {
    return `${icon(name)}<span>${escapeHtml(label)}</span>`;
  }

  function iconOnly(name, label) {
    return `<span class="sr-only">${escapeHtml(label)}</span>${icon(name)}`;
  }

  function refreshIcons() {
    const renderer = window.CatalogIcons || window.lucide;
    if (renderer) renderer.createIcons({ attrs: { "stroke-width": 2.2 } });
  }

  function money(value, currency) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(Number(value || 0));
  }

  function formatNumber(value) {
    return Number(value || 0).toFixed(2);
  }

  function syncConverterFromUsd(usdValue) {
    const usd = Number(usdValue || 0);
    state.converter = {
      usd,
      brl: usd * Number(state.settings.usdToBrl || 0),
      cny: usd * Number(state.settings.usdToCny || 0),
    };
  }

  function updateConverter(currency, value) {
    const numeric = Number(String(value || "").replace(",", "."));
    if (Number.isNaN(numeric)) return;
    if (currency === "usd") syncConverterFromUsd(numeric);
    if (currency === "brl") syncConverterFromUsd(numeric / Number(state.settings.usdToBrl || 1));
    if (currency === "cny") syncConverterFromUsd(numeric / Number(state.settings.usdToCny || 1));
    root.querySelectorAll("[data-converter]").forEach((input) => {
      if (input.dataset.converter !== currency) input.value = formatNumber(state.converter[input.dataset.converter]);
    });
  }

  function applyRates(usdToBrl, usdToCny, source) {
    state.settings.usdToBrl = Number(usdToBrl || state.settings.usdToBrl);
    state.settings.usdToCny = Number(usdToCny || state.settings.usdToCny);
    state.ratesMeta = {
      source,
      updatedAt: new Date().toLocaleString("pt-BR"),
      loading: false,
    };
    syncConverterFromUsd(state.converter.usd);
    window.localStorage?.setItem("catalogo-settings", JSON.stringify(state.settings));
  }

  async function fetchAwesomeRates() {
    const response = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,USD-CNY", { cache: "no-store" });
    if (!response.ok) throw new Error("AwesomeAPI indisponivel");
    const data = await response.json();
    const usdToBrl = Number(data.USDBRL?.bid);
    const usdToCny = Number(data.USDCNY?.bid);
    if (!usdToBrl || !usdToCny) throw new Error("Resposta de cambio incompleta");
    return { usdToBrl, usdToCny, source: "AwesomeAPI" };
  }

  async function fetchFrankfurterRates() {
    const response = await fetch("https://api.frankfurter.dev/v2/rates?base=USD", { cache: "no-store" });
    if (!response.ok) throw new Error("Frankfurter indisponivel");
    const data = await response.json();
    let usdToBrl;
    let usdToCny;
    if (Array.isArray(data)) {
      usdToBrl = Number(data.find((item) => item.quote === "BRL")?.rate);
      usdToCny = Number(data.find((item) => item.quote === "CNY")?.rate);
    } else {
      usdToBrl = Number(data.rates?.BRL || data.BRL);
      usdToCny = Number(data.rates?.CNY || data.CNY);
    }
    if (!usdToBrl || !usdToCny) throw new Error("Resposta de cambio incompleta");
    return { usdToBrl, usdToCny, source: "Frankfurter" };
  }

  async function refreshRates(options = {}) {
    state.ratesMeta.loading = true;
    if (!options.silent) render();
    try {
      let rates;
      try {
        rates = await fetchAwesomeRates();
      } catch (_primaryError) {
        rates = await fetchFrankfurterRates();
      }
      applyRates(rates.usdToBrl, rates.usdToCny, rates.source);
      if (!options.silent) state.message = `Cotacao atualizada via ${rates.source}.`;
      render();
    } catch (error) {
      state.ratesMeta.loading = false;
      if (!options.silent) setMessage(`Nao foi possivel atualizar a cotacao pela API. Mantive os valores atuais. ${error.message}`);
      else render();
    }
  }

  function calc(product) {
    const exchangeRate = Number(state.settings.usdToBrl || 0);
    const multiplierFactor = Number(state.settings.multiplierFactor || 0);
    const markupMultiplier = 1 + Number(state.settings.markupPercent || 0) / 100;
    const nationalized = Number(product.original_price || 0) * exchangeRate * multiplierFactor;
    const originalUsd = product.currency === "BRL"
      ? Number(product.original_price || 0) / Number(exchangeRate || 1)
      : Number(product.original_price || 0);
    return {
      original_usd: originalUsd,
      original_brl: originalUsd * exchangeRate,
      original_cny: originalUsd * Number(state.settings.usdToCny || 0),
      nationalized_cost_brl: nationalized,
      suggested_sale_price: nationalized * markupMultiplier,
    };
  }

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function splitTags(value) {
    return String(value || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, " ")
      .toLowerCase()
      .trim();
  }

  function expandSearchTerms(value) {
    const normalized = normalizeText(value);
    if (!normalized) return [];
    const baseTerms = normalized.split(/\s+/).filter(Boolean);
    const expanded = [...baseTerms];
    Object.entries(searchAliases).forEach(([alias, matches]) => {
      if (normalized.includes(alias)) expanded.push(...matches.flatMap((item) => normalizeText(item).split(/\s+/)));
    });
    return unique(expanded);
  }

  function supplierTagNames() {
    const ignored = new Set(["fitness", "equipamentos", "equipment", "equip", "ltda", "inc", "sales", "com"]);
    return unique(state.suppliers.flatMap((supplier) => {
      const normalizedName = normalizeText(supplier.name);
      return [
        normalizedName,
        ...normalizedName.split(/\s+/),
        normalizeText(supplier.contact_name),
        normalizeText(supplier.email),
      ];
    })).filter((item) => item.length > 2 && !ignored.has(item));
  }

  function isSupplierTag(tag) {
    const normalized = normalizeText(tag);
    if (!normalized) return false;
    return supplierTagNames().some((supplierTag) => normalized === supplierTag || normalized.includes(supplierTag));
  }

  function inferredBrazilTags(product) {
    const text = normalizeText([product.name, product.category, product.subcategory, product.description, product.technical_specs, ...(product.tags || [])].join(" "));
    return unique(brazilTagRules.flatMap((rule) => rule.includes.every((term) => text.includes(term)) ? rule.tags : []));
  }

  function productTags(product, options = {}) {
    const tags = unique([...(product.tags || []), ...inferredBrazilTags(product)].map((tag) => String(tag).trim().toLowerCase()).filter(Boolean));
    return options.publicOnly ? tags.filter((tag) => !isSupplierTag(tag)) : tags;
  }

  function productSearchText(product) {
    return normalizeText([
      product.name,
      product.code,
      product.category,
      product.subcategory,
      product.description,
      product.technical_specs,
      product.material,
      product.dimensions,
      ...(isClient() ? [] : [supplierName(product.supplier_id)]),
      ...productTags(product, { publicOnly: isClient() }),
    ].join(" "));
  }

  function scoreProduct(product, terms) {
    if (!terms.length) return 1;
    const text = productSearchText(product);
    const tags = normalizeText(productTags(product, { publicOnly: isClient() }).join(" "));
    const name = normalizeText(product.name);
    const code = normalizeText(product.code);
    return terms.reduce((score, term) => {
      if (!term) return score;
      if (code.includes(term)) return score + 8;
      if (name.includes(term)) return score + 6;
      if (tags.includes(term)) return score + 5;
      if (text.includes(term)) return score + 2;
      return score;
    }, 0);
  }

  function unique(items) {
    return [...new Set(items.filter(Boolean))];
  }

  function supplierName(id) {
    return state.suppliers.find((supplier) => supplier.id === id)?.name || "-";
  }

  function visibilityNote() {
    return isClient()
      ? "Perfil cliente: selecione as maquinas para solicitar orcamento. Valores e fornecedores ficam ocultos."
      : "Produtos, fornecedores e PDFs em um so lugar";
  }

  function pageTitle() {
    const titles = {
      dashboard: "Produtos",
      "new-product": "Novo produto",
      suppliers: "Fornecedores",
      upload: "Upload PDF",
      settings: "Configuracoes",
      product: "Produto",
      cart: "Carrinho",
    };
    return titles[state.view] || "Produtos";
  }

  function getProducts() {
    const terms = expandSearchTerms(state.query);
    return state.products.map((product, index) => ({ ...product, _searchScore: scoreProduct(product, terms), _searchIndex: index })).filter((product) => {
      const computed = calc(product);
      const price = Number(product.suggested_sale_price || computed.suggested_sale_price || 0);
      return (!terms.length || product._searchScore > 0) &&
        (!state.filters.category || product.category === state.filters.category) &&
        (!state.filters.subcategory || product.subcategory === state.filters.subcategory) &&
        (isClient() || !state.filters.supplier_id || product.supplier_id === state.filters.supplier_id) &&
        (!state.filters.status || product.status === state.filters.status) &&
        (!state.filters.tag || productTags(product, { publicOnly: isClient() }).includes(state.filters.tag)) &&
        (isClient() || !state.filters.min || price >= Number(state.filters.min)) &&
        (isClient() || !state.filters.max || price <= Number(state.filters.max));
    }).sort((a, b) => terms.length ? ((b._searchScore - a._searchScore) || String(a.name).localeCompare(String(b.name))) : (a._searchIndex - b._searchIndex));
  }

  function similarProducts(product) {
    if (!product) return [];
    const baseTags = new Set(productTags(product, { publicOnly: isClient() }));
    const baseTerms = new Set(expandSearchTerms([product.name, product.category, product.subcategory, product.description, product.technical_specs, ...productTags(product, { publicOnly: isClient() })].join(" ")));
    return state.products
      .filter((item) => item.id !== product.id)
      .map((item) => {
        const itemTags = productTags(item, { publicOnly: isClient() });
        const itemTerms = expandSearchTerms([item.name, item.category, item.subcategory, item.description, item.technical_specs, ...itemTags].join(" "));
        const semanticOverlap = itemTerms.filter((term) => baseTerms.has(term)).length;
        const tagOverlap = itemTags.filter((tag) => baseTags.has(tag)).length;
        return { ...item, score: (item.category === product.category ? 4 : 0) + (item.subcategory === product.subcategory ? 2 : 0) + (tagOverlap * 3) + semanticOverlap };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  function setMessage(message) {
    state.message = message;
    render();
  }

  async function loadRemoteData() {
    if (!client || !state.session) return;
    const [suppliers, products, catalogs] = await Promise.all([
      client.from("suppliers").select("*").order("name"),
      client.from("products").select("*").order("updated_at", { ascending: false }),
      client.from("catalog_files").select("*").order("created_at", { ascending: false }),
    ]);
    const settings = await client.from("catalog_settings").select("key, value").in("key", ["usdToBrl", "usdToCny", "multiplierFactor", "markupPercent"]);
    const profile = await client.from("users").select("role").eq("id", state.session.user.id).maybeSingle();
    if (profile.data?.role) state.profileRole = profile.data.role;
    else state.profileRole = "viewer";
    if (settings.data?.length) {
      for (const item of settings.data) state.settings[item.key] = Number(item.value || state.settings[item.key]);
      syncConverterFromUsd(state.converter.usd);
    }
    const error = suppliers.error || products.error || catalogs.error || settings.error;
    if (error) {
      setMessage(error.message);
      return;
    }
    state.suppliers = suppliers.data || [];
    state.products = (products.data || []).map((product) => ({ ...product, tags: Array.isArray(product.tags) ? product.tags : [] }));
    state.catalogs = catalogs.data || [];
    render();
  }

  async function ensureUserProfile() {
    if (!client || !state.session) return;
    const existing = await client.from("users").select("id, role").eq("id", state.session.user.id).maybeSingle();
    if (existing.data) {
      state.profileRole = existing.data.role || "viewer";
      return;
    }
    await client.from("users").insert({
      id: state.session.user.id,
      email: state.session.user.email,
      role: "viewer",
    });
    state.profileRole = "viewer";
  }

  async function initAuth() {
    if (!client) return;
    const session = await client.auth.getSession();
    state.session = session.data.session;
    if (state.session) {
      await ensureUserProfile();
      await loadRemoteData();
    } else {
      state.profileRole = "client";
    }
    client.auth.onAuthStateChange(async (_event, sessionValue) => {
      state.session = sessionValue;
      if (sessionValue) {
        await ensureUserProfile();
        await loadRemoteData();
      } else {
        state.profileRole = "client";
      }
      render();
    });
  }

  function shell(content) {
    const navIcons = {
      dashboard: "boxes",
      "new-product": "package-plus",
      suppliers: "factory",
      upload: "file-up",
      settings: "sliders-horizontal",
      cart: "shopping-cart",
    };
    return `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand">
            <img class="brand-logo" src="./assets/logo-gr8.png" alt="GR8 Catalogo">
          </div>
          <nav>
            ${navButton("dashboard", "Produtos", navIcons.dashboard)}
            ${isEditor() ? navButton("new-product", "Novo produto", navIcons["new-product"]) : ""}
            ${isEditor() ? navButton("suppliers", "Fornecedores", navIcons.suppliers) : ""}
            ${isEditor() ? navButton("upload", "Upload PDF", navIcons.upload) : ""}
            ${isEditor() ? navButton("settings", "Configuracoes", navIcons.settings) : ""}
            ${navButton("cart", `Carrinho (${cartCount()})`, navIcons.cart)}
          </nav>
          ${authPanel()}
        </aside>
        <main class="content">
          <header class="topbar">
            <div><h1>${escapeHtml(pageTitle())}</h1></div>
            ${isEditor() ? `<button class="primary icon-only" data-view="new-product" title="Cadastrar produto" aria-label="Cadastrar produto">${iconOnly("package-plus", "Cadastrar produto")}</button>` : `<button class="primary icon-only" data-view="cart" title="Ver carrinho" aria-label="Ver carrinho">${iconOnly("shopping-cart", "Ver carrinho")}</button>`}
          </header>
          ${isClient() ? "" : currencyBar()}
          ${state.message ? `<div class="notice" data-clear-message>${escapeHtml(state.message)}</div>` : ""}
          ${content}
          ${editProductModal()}
        </main>
      </div>`;
  }

  function navButton(view, label, iconName) {
    return `<button class="${state.view === view ? "active" : ""}" data-view="${view}">${iconName ? icon(iconName) : ""}<span>${escapeHtml(label)}</span></button>`;
  }

  function currencyBar() {
    return `
      <section class="currency-bar" aria-label="Conversor de moedas">
        <div class="currency-rate">
          <small>Cotacao base</small>
          <strong>US$ 1 = R$ ${formatNumber(state.settings.usdToBrl)} · CN¥ ${formatNumber(state.settings.usdToCny)}</strong>
          <small>${state.ratesMeta.loading ? "Atualizando..." : `${state.ratesMeta.source}${state.ratesMeta.updatedAt ? ` · ${state.ratesMeta.updatedAt}` : ""}`}</small>
        </div>
        <label><span>Dolar</span><input data-converter="usd" type="number" step="0.01" value="${formatNumber(state.converter.usd)}"></label>
        <label><span>Real</span><input data-converter="brl" type="number" step="0.01" value="${formatNumber(state.converter.brl)}"></label>
        <label><span>Yuan</span><input data-converter="cny" type="number" step="0.01" value="${formatNumber(state.converter.cny)}"></label>
        <button class="icon-only" type="button" data-action="refresh-rates" title="${state.ratesMeta.loading ? "Atualizando" : "Atualizar API"}" aria-label="${state.ratesMeta.loading ? "Atualizando" : "Atualizar API"}">${iconOnly("refresh-cw", state.ratesMeta.loading ? "Atualizando" : "Atualizar API")}</button>
      </section>`;
  }

  function authPanel() {
    return `
      <div class="auth-box">
        <small>Perfil de acesso</small>
        <span class="role-pill">${roleLabel()}</span>
        <div class="profile-switch" role="group" aria-label="Selecionar perfil">
          ${profileOptions.map(([role, label]) => `<button type="button" class="${state.profileRole === role ? "active" : ""}" data-role-switch="${role}">${icon(role === "editor" ? "shield-check" : role === "viewer" ? "briefcase-business" : "user-round")}<span>${label}</span></button>`).join("")}
        </div>
      </div>`;
  }

  function dashboard() {
    const categories = unique(state.products.map((item) => item.category));
    const lines = unique(state.products.map((item) => item.subcategory));
    const tags = unique(state.products.flatMap((item) => productTags(item, { publicOnly: isClient() }))).sort((a, b) => a.localeCompare(b));
    return `
      <section class="search-zone">
        <span class="search-icon">${icon("search")}</span>
        <input id="search-input" value="${escapeHtml(state.query)}" placeholder="${isClient() ? "Buscar por nome, codigo, categoria ou tags" : "Buscar por nome, codigo, categoria, fornecedor, descricao ou tags"}">
        <p class="search-help">Busca contextual: experimente termos como extensora, flexora, banco, supino, anilhada, polia, peito, perna ou esteira.</p>
      </section>
      <section class="metrics">
        ${metric("Produtos", state.products.length, "boxes")}
        ${isClient() ? metric("Selecionados", cartCount(), "shopping-cart") : metric("Fornecedores", state.suppliers.length, "factory")}
        ${metric("Categorias", categories.length, "tags")}
        ${metric("Linhas", lines.length, "layers-3")}
      </section>
      <section class="filters">
        ${select("category", "Categoria", [["", "Categoria"], ...categories.map((item) => [item, item])], state.filters.category)}
        ${select("subcategory", "Linha", [["", "Linha"], ...lines.map((item) => [item, item])], state.filters.subcategory)}
        ${isClient() ? "" : select("supplier_id", "Fornecedor", [["", "Fornecedor"], ...state.suppliers.map((item) => [item.id, item.name])], state.filters.supplier_id)}
        ${select("status", "Status", [["", "Status"], ...statuses.map((item) => [item, item])], state.filters.status)}
        ${select("tag", "Tag", [["", "Tag"], ...tags.map((item) => [item, item])], state.filters.tag)}
        ${isClient() ? "" : `<input data-filter="min" value="${escapeHtml(state.filters.min)}" placeholder="Preco min.">
        <input data-filter="max" value="${escapeHtml(state.filters.max)}" placeholder="Preco max.">`}
      </section>
      <section class="product-area" id="product-results">
        ${productResults()}
      </section>`;
  }

  function productResults() {
    const products = getProducts();
    const total = state.products.length;
    return `
      <div class="product-toolbar">
        <div class="result-count">
          <strong>${products.length}</strong>
          <span>${products.length === 1 ? "item encontrado" : "itens encontrados"}${hasActiveProductFilters() ? " com os filtros atuais" : ` no catalogo de ${total}`}</span>
        </div>
        <div class="view-toggle" role="group" aria-label="Tipo de visualizacao">
          <button class="${state.productViewMode === "table" ? "active" : ""}" data-view-mode="table">${withIcon("list", "Linhas")}</button>
          <button class="${state.productViewMode === "cards" ? "active" : ""}" data-view-mode="cards">${withIcon("layout-grid", "Cards")}</button>
        </div>
      </div>
      ${state.productViewMode === "table" ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Produto</th><th>Categoria</th>${isClient() ? "" : "<th>Fornecedor</th><th>Preco original</th>"}<th>Status</th><th></th></tr></thead>
            <tbody>${products.map(productRow).join("")}</tbody>
          </table>
        </div>` : `
        <div class="card-grid">${products.map(productCard).join("")}</div>
      `}`;
  }

  function hasActiveProductFilters() {
    const filterKeys = isClient()
      ? ["category", "subcategory", "status", "tag"]
      : ["category", "subcategory", "supplier_id", "status", "tag", "min", "max"];
    return Boolean(state.query.trim()) || filterKeys.some((key) => Boolean(String(state.filters[key] || "").trim()));
  }

  function refreshProductResults() {
    const container = root.querySelector("#product-results");
    if (!container) return render();
    container.innerHTML = productResults();
    bindResultEvents(container);
    refreshIcons();
  }

  function scheduleProductResultsRefresh() {
    clearTimeout(productRefreshTimer);
    productRefreshTimer = setTimeout(refreshProductResults, 140);
  }

  function metric(label, value, iconName) {
    return `<article class="metric"><div class="metric-head"><span>${label}</span>${icon(iconName)}</div><strong>${value}</strong></article>`;
  }

  function select(name, label, options, value) {
    return `<select aria-label="${label}" data-filter="${name}">${options.map(([id, text]) => `<option value="${escapeHtml(id)}" ${String(id) === String(value) ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select>`;
  }

  function productRow(product) {
    const computed = calc(product);
    const thumb = product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}">` : `<span>${escapeHtml(product.name.slice(0, 2).toUpperCase())}</span>`;
    return `
      <tr>
        <td>
          <div class="product-cell">
            <div class="row-thumb">${thumb}</div>
            <div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.code)}</small></div>
          </div>
        </td>
        <td>${escapeHtml(product.category)}</td>
        ${isClient() ? "" : `<td>${escapeHtml(supplierName(product.supplier_id))}</td>
        <td>${money(computed.original_usd, "USD")}</td>`}
        <td><span class="status ${escapeHtml(product.status)}">${escapeHtml(product.status)}</span></td>
        <td><div class="row-actions"><button class="icon-only" data-product="${product.id}" title="Ver detalhes" aria-label="Ver detalhes">${iconOnly("eye", "Ver detalhes")}</button>${cartButton(product.id)}</div></td>
      </tr>`;
  }

  function productCard(product) {
    const computed = calc(product);
    const thumb = product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}">` : `<span>${escapeHtml(product.name.slice(0, 2).toUpperCase())}</span>`;
    return `
      <article class="product-card">
        <div class="thumb">${thumb}</div>
        <div class="product-card-info"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)}${isClient() ? "" : ` · ${escapeHtml(supplierName(product.supplier_id))}`}</small></div>
        <div class="price-line">${isClient() ? "<span>Orcamento</span>" : `<span>${money(computed.original_usd, "USD")}</span>`}<div class="row-actions"><button class="icon-only" data-product="${product.id}" title="Ver detalhes" aria-label="Ver detalhes">${iconOnly("eye", "Ver detalhes")}</button>${cartButton(product.id, "+ Carrinho")}</div></div>
      </article>`;
  }

  function cartButton(productId, label = "Adicionar") {
    const inCart = state.cart.find((item) => item.product_id === productId);
    const title = inCart ? `Adicionar mais uma unidade (${inCart.quantity} no carrinho)` : "Adicionar ao carrinho";
    return `<button class="cart-add-btn icon-only" data-cart-add="${productId}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${iconOnly("shopping-cart", title)}${inCart ? `<span class="cart-count">${inCart.quantity}</span>` : ""}</button>`;
  }

  function productPage() {
    const product = state.products.find((item) => item.id === state.selectedProductId) || state.products[0];
    if (!product) return `<section class="detail-panel"><h2>Nenhum produto cadastrado</h2></section>`;
    return productDetailContent(product);
  }

  function productDetailContent(product) {
    const computed = calc(product);
    const catalog = state.catalogs.find((item) => item.id === product.source_file_id);
    const thumb = product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}">` : `<span>${escapeHtml(product.name.slice(0, 2).toUpperCase())}</span>`;
    return `
      <section class="detail-layout">
        <div class="hero-image">${thumb}</div>
        <article class="detail-panel">
          <span class="status ${escapeHtml(product.status)}">${escapeHtml(product.status)}</span>
          <h2>${escapeHtml(product.name)}</h2>
          <p>${escapeHtml(product.description)}</p>
          <div class="detail-actions">
            ${isEditor() ? `<button class="primary icon-only" data-edit-product="${product.id}" title="Editar produto" aria-label="Editar produto">${iconOnly("pencil", "Editar produto")}</button>` : ""}
            ${cartButton(product.id, "Adicionar ao carrinho")}
            <button class="icon-only" data-view="cart" title="Ver carrinho" aria-label="Ver carrinho">${iconOnly("shopping-bag", "Ver carrinho")}</button>
          </div>
          <div class="info-grid">
            ${info("Codigo", product.code)}
            ${isClient() ? "" : info("Fornecedor", supplierName(product.supplier_id))}
            ${info("Categoria", `${product.category || "-"} / ${product.subcategory || "-"}`)}
            ${info("Medidas", product.dimensions)}
            ${info("Peso", product.weight ? `${product.weight} kg` : "-")}
            ${info("Material", product.material)}
            ${isClient() ? "" : `${info("Preco original USD", money(computed.original_usd, "USD"))}
            ${info("Conversao em reais", money(computed.original_brl, "BRL"))}
            ${info("Conversao em yuan", money(computed.original_cny, "CNY"))}
            ${info("Custo nacionalizado", money(computed.nationalized_cost_brl))}
            ${info("Preco sugerido", money(computed.suggested_sale_price))}`}
          </div>
          <h3>Especificacoes</h3>
          <p>${escapeHtml(product.technical_specs || "Sem especificacoes cadastradas.")}</p>
          <div class="tags">${productTags(product, { publicOnly: isClient() }).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
          ${product.gallery?.length ? `<div class="gallery-strip">${product.gallery.map((url) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(product.name)}">`).join("")}</div>` : ""}
          ${isClient() ? "" : `<p class="source">PDF original: ${escapeHtml(catalog?.file_name || "Nao vinculado")}</p>`}
        </article>
        <aside class="similar">
          <h3>Produtos semelhantes</h3>
          ${similarProducts(product).map((item) => `<button data-product="${item.id}">${icon("git-compare-arrows")}<span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)}</small></span></button>`).join("") || "<small>Nenhum semelhante ainda.</small>"}
        </aside>
      </section>`;
  }

  function productDetailsModal() {
    const product = state.products.find((item) => item.id === state.selectedProductId);
    if (!product) return "";
    return `
      <div class="modal-backdrop product-detail-modal" data-close-detail>
        <section class="modal-panel detail-modal-panel" data-detail-modal-panel>
          <header class="modal-head">
            <div><small>Detalhes do produto</small><h2>${escapeHtml(product.name)}</h2></div>
            <button class="icon-only" type="button" data-close-detail title="Fechar" aria-label="Fechar">${iconOnly("x", "Fechar")}</button>
          </header>
          ${productDetailContent(product)}
        </section>
      </div>`;
  }

  function editProductModal() {
    if (!state.editingProductId || !isEditor()) return "";
    const product = state.products.find((item) => item.id === state.editingProductId);
    if (!product) return "";
    const gallery = product.gallery || (product.image_url ? [product.image_url] : []);
    return `
      <div class="modal-backdrop" data-close-modal>
        <form class="modal-panel" id="edit-product-form" data-modal-panel>
          <header class="modal-head">
            <div><small>Editar produto</small><h2>${escapeHtml(product.code || product.name)}</h2></div>
            <button class="icon-only" type="button" data-close-modal title="Fechar" aria-label="Fechar">${iconOnly("x", "Fechar")}</button>
          </header>
          <div class="form-grid">
            ${field("name", "Nome do equipamento", "text", true, product.name)}
            ${field("code", "Codigo", "text", false, product.code)}
            ${selectField("supplier_id", "Fornecedor", state.suppliers.map((item) => [item.id, item.name]), product.supplier_id)}
            ${field("category", "Categoria", "text", false, product.category)}
            ${field("subcategory", "Subcategoria", "text", false, product.subcategory)}
            ${selectField("status", "Status", statuses.map((item) => [item, item]), product.status)}
            ${field("original_price", "Preco original", "number", false, product.original_price)}
            ${selectField("currency", "Moeda", currencies.map((item) => [item, item]), product.currency || "USD")}
            ${field("weight", "Peso kg", "number", false, product.weight)}
            ${field("dimensions", "Medidas", "text", false, product.dimensions)}
            ${field("material", "Material", "text", false, product.material)}
            ${selectField("source_file_id", "PDF origem", [["", "Sem PDF"], ...state.catalogs.map((item) => [item.id, item.file_name])], product.source_file_id || "")}
          </div>
          <label><span>Descricao</span><textarea name="description">${escapeHtml(product.description)}</textarea></label>
          <label><span>Especificacoes tecnicas</span><textarea name="technical_specs">${escapeHtml(product.technical_specs)}</textarea></label>
          <label><span>Tags separadas por virgula</span><input name="tags" value="${escapeHtml((product.tags || []).join(", "))}"></label>
          <label class="file-input"><span>Adicionar fotos</span><input type="file" name="images" accept="image/*" multiple></label>
          ${gallery.length ? `<div class="gallery-editor">${gallery.map((url, index) => `<div><img src="${escapeHtml(url)}" alt="${escapeHtml(product.name)}"><button class="icon-only" type="button" data-remove-photo="${index}" title="Remover" aria-label="Remover">${iconOnly("trash-2", "Remover")}</button></div>`).join("")}</div>` : '<p class="hint">Nenhuma foto adicional cadastrada.</p>'}
          <button class="primary icon-only" title="Salvar alteracoes" aria-label="Salvar alteracoes">${iconOnly("save", "Salvar alteracoes")}</button>
        </form>
      </div>`;
  }

  function info(label, value) {
    return `<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value || "-")}</strong></div>`;
  }

  function productForm() {
    if (!isEditor()) return accessDenied();
    return `
      <form class="form-panel" id="product-form">
        <h2>Cadastrar produto</h2>
        <div class="form-grid">
          ${field("name", "Nome", "", true)}
          ${field("code", "Codigo")}
          ${selectField("supplier_id", "Fornecedor", state.suppliers.map((item) => [item.id, item.name]))}
          ${field("category", "Categoria")}
          ${field("subcategory", "Subcategoria")}
          ${selectField("status", "Status", statuses.map((item) => [item, item]), "pendente")}
          ${field("original_price", "Preco original", "number")}
          ${selectField("currency", "Moeda", currencies.map((item) => [item, item]), "USD")}
          ${field("weight", "Peso kg", "number")}
          ${field("dimensions", "Dimensoes")}
          ${field("material", "Material")}
          ${selectField("source_file_id", "PDF origem", [["", "Sem PDF"], ...state.catalogs.map((item) => [item.id, item.file_name])])}
        </div>
        <label class="wide"><span>Descricao</span><textarea name="description"></textarea></label>
        <label class="wide"><span>Especificacoes tecnicas</span><textarea name="technical_specs"></textarea></label>
        ${field("tags", "Tags separadas por virgula")}
        <label class="file-input"><span>Imagem do produto</span><input type="file" name="image" accept="image/*"></label>
        <div class="calc-preview">${info("Custo nacionalizado", money(0))}${info("Preco sugerido", money(0))}</div>
        <button class="primary icon-only" title="Salvar produto" aria-label="Salvar produto">${iconOnly("save", "Salvar produto")}</button>
      </form>`;
  }

  function settingsPage() {
    if (!isEditor()) return accessDenied();
    return `
      <form class="form-panel settings-panel" id="settings-form">
        <h2>Configuracoes gerais</h2>
        <p class="hint">Esses valores alimentam os calculos do catalogo inteiro. Eles nao aparecem no detalhe do produto para o visualizador.</p>
        <div class="form-grid">
          ${field("usdToBrl", "Cambio USD/BRL", "number", true, state.settings.usdToBrl)}
          ${field("usdToCny", "Cambio USD/CNY", "number", true, state.settings.usdToCny)}
          ${field("multiplierFactor", "Fator nacionalizacao", "number", true, state.settings.multiplierFactor)}
          ${field("markupPercent", "Markup (%)", "number", true, state.settings.markupPercent)}
        </div>
        <button class="primary icon-only" title="Salvar configuracoes" aria-label="Salvar configuracoes">${iconOnly("save", "Salvar configuracoes")}</button>
      </form>`;
  }

  function field(name, label, type, required, value) {
    return `<label><span>${label}</span><input ${required ? "required" : ""} type="${type || "text"}" step="0.01" name="${name}" value="${escapeHtml(value || "")}"></label>`;
  }

  function selectField(name, label, options, value) {
    const selected = value ?? options[0]?.[0] ?? "";
    return `<label><span>${label}</span><select name="${name}">${options.map(([id, text]) => `<option value="${escapeHtml(id)}" ${id === selected ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select></label>`;
  }

  function suppliersPage() {
    if (!isEditor()) return accessDenied();
    return `
      <section class="two-column">
        <form class="form-panel" id="supplier-form">
          <h2>Novo fornecedor</h2>
          ${field("name", "Nome", "text", true)}
          ${field("country", "Pais")}
          ${field("contact_name", "Contato")}
          ${field("email", "Email", "email")}
          ${field("phone", "Telefone")}
          <label><span>Observacoes</span><textarea name="notes"></textarea></label>
          <button class="primary icon-only" title="Salvar fornecedor" aria-label="Salvar fornecedor">${iconOnly("save", "Salvar fornecedor")}</button>
        </form>
        <div class="list-panel">${state.suppliers.map((item) => `<article><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.country || "-")} · ${escapeHtml(item.email || "sem email")}</small></article>`).join("")}</div>
      </section>`;
  }

  function uploadPage() {
    if (!isEditor()) return accessDenied();
    return `
      <section class="two-column">
        <form class="form-panel" id="upload-form">
          <h2>Upload de PDF</h2>
          ${selectField("supplier_id", "Fornecedor", state.suppliers.map((item) => [item.id, item.name]))}
          <label class="file-input"><span>Catalogo PDF</span><input type="file" name="pdf" accept="application/pdf"></label>
          <button class="primary icon-only" title="Enviar PDF" aria-label="Enviar PDF">${iconOnly("file-up", "Enviar PDF")}</button>
          <p class="hint">O arquivo fica no Storage e o registro entra em catalog_files, pronto para extracao automatica futura.</p>
        </form>
        <div class="list-panel">${state.catalogs.map((item) => `<article><strong>${escapeHtml(item.file_name)}</strong><small>${escapeHtml(item.status || "uploaded")} · ${escapeHtml(item.file_path)}</small></article>`).join("")}</div>
      </section>`;
  }

  async function saveSupplier(form) {
    if (!isEditor()) return setMessage("Seu perfil permite apenas visualizar e montar carrinho.");
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name?.trim()) return;
    if (!client || !state.session) {
      state.suppliers.unshift({ ...data, id: uid() });
      state.message = "Fornecedor salvo no modo demo.";
      render();
      return;
    }
    const response = await client.from("suppliers").insert({ ...data, created_by: state.session.user.id });
    if (response.error) setMessage(response.error.message);
    else {
      state.message = "Fornecedor salvo.";
      await loadRemoteData();
    }
  }

  async function saveProduct(form) {
    if (!isEditor()) return setMessage("Seu perfil permite apenas visualizar e montar carrinho.");
    const data = Object.fromEntries(new FormData(form).entries());
    const imageFile = form.elements.image.files[0];
    let imageUrl = "";
    if (client && state.session && imageFile) {
      const path = `${state.session.user.id}/${uid()}-${imageFile.name}`;
      const upload = await client.storage.from(buckets.productImages).upload(path, imageFile);
      if (upload.error) {
        setMessage(upload.error.message);
        return;
      }
      imageUrl = client.storage.from(buckets.productImages).getPublicUrl(path).data.publicUrl;
    }
    const payload = {
      supplier_id: data.supplier_id || null,
      name: data.name,
      code: data.code,
      category: data.category,
      subcategory: data.subcategory,
      description: data.description,
      technical_specs: data.technical_specs,
      original_price: Number(data.original_price || 0),
      currency: data.currency,
      exchange_rate: Number(state.settings.usdToBrl || 0),
      multiplier_factor: Number(state.settings.multiplierFactor || 0),
      markup: 1 + Number(state.settings.markupPercent || 0) / 100,
      weight: data.weight ? Number(data.weight) : null,
      dimensions: data.dimensions,
      material: data.material,
      tags: splitTags(data.tags),
      source_file_id: data.source_file_id || null,
      status: data.status,
      image_url: imageUrl,
      created_by: state.session?.user?.id,
    };
    if (!client || !state.session) {
      const local = { ...payload, id: uid(), ...calc(payload) };
      state.products.unshift(local);
      state.selectedProductId = local.id;
      state.view = "product";
      state.message = "Produto salvo no modo demo.";
      render();
      return;
    }
    const response = await client.from("products").insert(payload).select().single();
    if (response.error) setMessage(response.error.message);
    else {
      state.selectedProductId = response.data.id;
      state.view = "product";
      state.message = "Produto salvo.";
      await loadRemoteData();
    }
  }

  async function uploadCatalog(form) {
    if (!isEditor()) return setMessage("Seu perfil permite apenas visualizar e montar carrinho.");
    const data = Object.fromEntries(new FormData(form).entries());
    const file = form.elements.pdf.files[0];
    if (!file || !data.supplier_id) return;
    if (!client || !state.session) {
      state.catalogs.unshift({ id: uid(), supplier_id: data.supplier_id, file_name: file.name, file_path: `demo/${file.name}`, status: "uploaded" });
      state.message = "PDF registrado no modo demo.";
      render();
      return;
    }
    const path = `${state.session.user.id}/${data.supplier_id}/${uid()}-${file.name}`;
    const upload = await client.storage.from(buckets.catalogs).upload(path, file);
    if (upload.error) {
      setMessage(upload.error.message);
      return;
    }
    const response = await client.from("catalog_files").insert({ supplier_id: data.supplier_id, file_name: file.name, file_path: path, mime_type: file.type, file_size: file.size, created_by: state.session.user.id });
    if (response.error) setMessage(response.error.message);
    else {
      state.message = "PDF importado e registrado.";
      await loadRemoteData();
    }
  }

  function switchProfile(role) {
    if (!profileOptions.some(([value]) => value === role)) return;
    state.profileRole = role;
    state.session = null;
    if (!isEditor() && ["new-product", "suppliers", "upload", "settings"].includes(state.view)) state.view = "dashboard";
    state.message = "";
    render();
  }

  function accessDenied() {
    return `<section class="detail-panel"><h2>Acesso somente leitura</h2><p>Este perfil pode visualizar produtos e montar carrinho para orcamento. Alteracoes no catalogo ficam restritas ao perfil Adm.</p><button class="primary icon-only" data-view="dashboard" title="Voltar ao catalogo" aria-label="Voltar ao catalogo">${iconOnly("arrow-left", "Voltar ao catalogo")}</button></section>`;
  }

  function cartCount() {
    return state.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  function addToCart(productId) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    const existing = state.cart.find((item) => item.product_id === productId);
    if (existing) existing.quantity += 1;
    else state.cart.push({ product_id: productId, quantity: 1, note: "" });
    state.message = `${product.code || product.name} adicionado ao carrinho.`;
    render();
  }

  function updateCart(productId, quantity) {
    const item = state.cart.find((cartItem) => cartItem.product_id === productId);
    if (!item) return;
    item.quantity = Math.max(1, Number(quantity || 1));
    render();
  }

  function removeFromCart(productId) {
    state.cart = state.cart.filter((item) => item.product_id !== productId);
    render();
  }

  function cartPage() {
    const rows = state.cart.map((item) => ({ ...item, product: state.products.find((product) => product.id === item.product_id) })).filter((item) => item.product);
    const totalUsd = rows.reduce((sum, item) => sum + calc(item.product).original_usd * item.quantity, 0);
    const totalBrl = rows.reduce((sum, item) => sum + calc(item.product).original_brl * item.quantity, 0);
    const clientMode = isClient();
    return `
      <section class="cart-layout">
        <article class="detail-panel">
          <h2>Carrinho de orcamento</h2>
          <p>${clientMode ? "Revise as maquinas selecionadas e copie a solicitacao para enviar ao atendimento. Valores e fornecedores serao tratados no retorno do orcamento." : "Itens selecionados para solicitar orcamento. Os valores sao referencia FOB original e conversao simples."}</p>
          ${rows.length ? `
            <div class="cart-list">
              ${rows.map(cartItem).join("")}
            </div>
          ` : '<p class="hint">Nenhum produto no carrinho ainda.</p>'}
        </article>
        <aside class="quote-summary">
          <h3>Resumo</h3>
          ${info("Itens", cartCount())}
          ${clientMode ? info("Valores", "Sob consulta") : `${info("Total USD", money(totalUsd, "USD"))}
          ${info("Conversao BRL", money(totalBrl, "BRL"))}`}
          ${clientMode ? "" : `<button class="primary icon-only" data-action="save-quote" title="Salvar orcamento" aria-label="Salvar orcamento" ${rows.length ? "" : "disabled"}>${iconOnly("save", "Salvar orcamento")}</button>`}
          <button class="primary icon-only" data-action="copy-quote" title="${clientMode ? "Copiar solicitacao" : "Copiar orcamento"}" aria-label="${clientMode ? "Copiar solicitacao" : "Copiar orcamento"}" ${rows.length ? "" : "disabled"}>${iconOnly("copy", clientMode ? "Copiar solicitacao" : "Copiar orcamento")}</button>
          <button class="icon-only" data-action="clear-cart" title="Limpar carrinho" aria-label="Limpar carrinho" ${rows.length ? "" : "disabled"}>${iconOnly("trash-2", "Limpar carrinho")}</button>
        </aside>
      </section>`;
  }

  function cartItem(item) {
    const product = item.product;
    const computed = calc(product);
    const thumb = product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}">` : `<span>${escapeHtml(product.name.slice(0, 2).toUpperCase())}</span>`;
    return `
      <article class="cart-item">
        <div class="row-thumb">${thumb}</div>
        <div><strong>${escapeHtml(product.code)} · ${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)}${isClient() ? "" : ` · ${money(computed.original_usd, "USD")} un.`}</small></div>
        <input type="number" min="1" value="${item.quantity}" data-cart-qty="${product.id}" aria-label="Quantidade">
        <strong>${isClient() ? "Orcar" : money(computed.original_usd * item.quantity, "USD")}</strong>
        <button class="icon-only" data-cart-remove="${product.id}" title="Remover" aria-label="Remover">${iconOnly("trash-2", "Remover")}</button>
      </article>`;
  }

  function quoteText() {
    const lines = [isClient() ? "Solicitacao de orcamento - itens selecionados" : "Orcamento - itens selecionados", ""];
    for (const item of state.cart) {
      const product = state.products.find((candidate) => candidate.id === item.product_id);
      if (!product) continue;
      const computed = calc(product);
      if (isClient()) lines.push(`${item.quantity}x ${product.code} - ${product.name} | ${product.category || "Sem categoria"}`);
      else lines.push(`${item.quantity}x ${product.code} - ${product.name} | ${money(computed.original_usd, "USD")} un. | ${money(computed.original_usd * item.quantity, "USD")} total`);
    }
    return lines.join("\n");
  }

  function saveSettings(form) {
    if (!isEditor()) return setMessage("Apenas o perfil Adm pode alterar configuracoes.");
    const data = Object.fromEntries(new FormData(form).entries());
    state.settings = {
      usdToBrl: Number(data.usdToBrl || state.settings.usdToBrl),
      usdToCny: Number(data.usdToCny || state.settings.usdToCny),
      multiplierFactor: Number(data.multiplierFactor || state.settings.multiplierFactor),
      markupPercent: Number(data.markupPercent || state.settings.markupPercent),
    };
    syncConverterFromUsd(state.converter.usd);
    window.localStorage?.setItem("catalogo-settings", JSON.stringify(state.settings));
    if (client && state.session) {
      const rows = Object.entries(state.settings).map(([key, value]) => ({ key, value }));
      client.from("catalog_settings").upsert(rows).then(({ error }) => {
        if (error) setMessage(error.message);
      });
    }
    setMessage("Configuracoes gerais atualizadas.");
  }

  function openEditProduct(productId) {
    state.editingProductId = productId;
    render();
  }

  function closeEditProduct() {
    state.editingProductId = "";
    render();
  }

  async function filesToDataUrls(files) {
    return Promise.all([...files].map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
  }

  async function saveEditedProduct(form) {
    if (!isEditor()) return setMessage("Apenas o perfil Adm pode editar produtos.");
    const product = state.products.find((item) => item.id === state.editingProductId);
    if (!product) return;
    const data = Object.fromEntries(new FormData(form).entries());
    const files = form.elements.images.files;
    let uploadedUrls = [];

    const imageRows = [];
    if (client && state.session && files.length) {
      for (const file of files) {
        const path = `${state.session.user.id}/${product.id}/${uid()}-${file.name}`;
        const upload = await client.storage.from(buckets.productImages).upload(path, file);
        if (upload.error) {
          setMessage(upload.error.message);
          return;
        }
        const publicUrl = client.storage.from(buckets.productImages).getPublicUrl(path).data.publicUrl;
        uploadedUrls.push(publicUrl);
        imageRows.push({ product_id: product.id, file_path: path, public_url: publicUrl, is_primary: false, created_by: state.session.user.id });
      }
    } else if (files.length) {
      uploadedUrls = await filesToDataUrls(files);
    }

    const gallery = [...(product.gallery || (product.image_url ? [product.image_url] : [])), ...uploadedUrls];
    product.name = data.name.trim();
    product.code = data.code.trim();
    product.supplier_id = data.supplier_id || null;
    product.category = data.category.trim();
    product.subcategory = data.subcategory.trim();
    product.description = data.description.trim();
    product.technical_specs = data.technical_specs.trim();
    product.original_price = Number(data.original_price || 0);
    product.currency = data.currency || "USD";
    product.weight = data.weight ? Number(data.weight) : null;
    product.dimensions = data.dimensions.trim();
    product.material = data.material.trim();
    product.source_file_id = data.source_file_id || "";
    product.status = data.status || "pendente";
    product.tags = splitTags(data.tags);
    product.gallery = gallery;
    product.image_url = gallery[0] || product.image_url || "";

    if (client && state.session) {
      const response = await client.from("products").update({
        name: product.name,
        code: product.code,
        supplier_id: product.supplier_id,
        category: product.category,
        subcategory: product.subcategory,
        description: product.description,
        technical_specs: product.technical_specs,
        original_price: product.original_price,
        currency: product.currency,
        weight: product.weight,
        dimensions: product.dimensions,
        material: product.material,
        source_file_id: product.source_file_id || null,
        status: product.status,
        tags: product.tags,
        image_url: product.image_url,
      }).eq("id", product.id);
      if (response.error) {
        setMessage(response.error.message);
        return;
      }
      if (imageRows.length) {
        const imageResponse = await client.from("product_images").insert(imageRows);
        if (imageResponse.error) {
          setMessage(imageResponse.error.message);
          return;
        }
      }
    }

    state.editingProductId = "";
    state.message = "Produto atualizado.";
    render();
  }

  function removeProductPhoto(index) {
    const product = state.products.find((item) => item.id === state.editingProductId);
    if (!product) return;
    const gallery = [...(product.gallery || (product.image_url ? [product.image_url] : []))];
    gallery.splice(index, 1);
    product.gallery = gallery;
    product.image_url = gallery[0] || "";
    render();
  }

  async function saveQuote() {
    if (!state.cart.length) return;
    if (!client || !state.session) {
      setMessage("Orcamento montado no modo demo. Conecte ao Supabase para salvar no banco.");
      return;
    }
    const quote = await client.from("quotes").insert({
      status: "draft",
      currency: "USD",
      notes: "Criado pelo carrinho do catalogo.",
      created_by: state.session.user.id,
    }).select().single();
    if (quote.error) {
      setMessage(quote.error.message);
      return;
    }
    const items = state.cart.map((item) => {
      const product = state.products.find((candidate) => candidate.id === item.product_id);
      const computed = calc(product || {});
      return {
        quote_id: quote.data.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price_usd: computed.original_usd,
        exchange_rate: product?.exchange_rate || null,
      };
    });
    const savedItems = await client.from("quote_items").insert(items);
    if (savedItems.error) {
      setMessage(savedItems.error.message);
      return;
    }
    state.cart = [];
    setMessage("Orcamento salvo no Supabase.");
  }

  function bindResultEvents(scope) {
    scope.querySelectorAll("[data-product]").forEach((button) => button.addEventListener("click", () => openProductDetails(button.dataset.product)));
    scope.querySelectorAll("[data-cart-add]").forEach((button) => button.addEventListener("click", () => addToCart(button.dataset.cartAdd)));
    scope.querySelectorAll("[data-edit-product]").forEach((button) => button.addEventListener("click", () => openEditProduct(button.dataset.editProduct)));
    scope.querySelectorAll("[data-view-mode]").forEach((button) => button.addEventListener("click", () => { state.productViewMode = button.dataset.viewMode; refreshProductResults(); }));
  }

  function openProductDetails(productId) {
    state.selectedProductId = productId;
    root.querySelector(".product-detail-modal")?.remove();
    root.insertAdjacentHTML("beforeend", productDetailsModal());
    bindDetailModalEvents();
    refreshIcons();
  }

  function closeProductDetails() {
    root.querySelector(".product-detail-modal")?.remove();
  }

  function bindDetailModalEvents() {
    const modal = root.querySelector(".product-detail-modal");
    if (!modal) return;
    modal.querySelectorAll("[data-close-detail]").forEach((element) => element.addEventListener("click", (event) => {
      if (event.target === element || element.tagName === "BUTTON") closeProductDetails();
    }));
    modal.querySelector("[data-detail-modal-panel]")?.addEventListener("click", (event) => event.stopPropagation());
    bindResultEvents(modal);
    modal.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { state.view = button.dataset.view; closeProductDetails(); render(); }));
  }

  function bindEvents() {
    root.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { state.view = button.dataset.view; render(); }));
    bindResultEvents(root);
    root.querySelectorAll("[data-cart-remove]").forEach((button) => button.addEventListener("click", () => removeFromCart(button.dataset.cartRemove)));
    root.querySelectorAll("[data-cart-qty]").forEach((input) => input.addEventListener("input", () => updateCart(input.dataset.cartQty, input.value)));
    root.querySelectorAll("[data-converter]").forEach((input) => input.addEventListener("input", () => updateConverter(input.dataset.converter, input.value)));
    root.querySelector("[data-action='refresh-rates']")?.addEventListener("click", () => refreshRates());
    root.querySelector("[data-clear-message]")?.addEventListener("click", () => { state.message = ""; render(); });
    root.querySelector("#search-input")?.addEventListener("input", (event) => { state.query = event.target.value; scheduleProductResultsRefresh(); });
    root.querySelectorAll("[data-filter]").forEach((input) => input.addEventListener("input", (event) => { state.filters[input.dataset.filter] = event.target.value; scheduleProductResultsRefresh(); }));
    root.querySelectorAll("[data-role-switch]").forEach((button) => button.addEventListener("click", () => switchProfile(button.dataset.roleSwitch)));
    root.querySelector("#supplier-form")?.addEventListener("submit", (event) => { event.preventDefault(); saveSupplier(event.currentTarget); });
    root.querySelector("#product-form")?.addEventListener("submit", (event) => { event.preventDefault(); saveProduct(event.currentTarget); });
    root.querySelector("#upload-form")?.addEventListener("submit", (event) => { event.preventDefault(); uploadCatalog(event.currentTarget); });
    root.querySelector("#settings-form")?.addEventListener("submit", (event) => { event.preventDefault(); saveSettings(event.currentTarget); });
    root.querySelector("#edit-product-form")?.addEventListener("submit", (event) => { event.preventDefault(); saveEditedProduct(event.currentTarget); });
    root.querySelectorAll("[data-remove-photo]").forEach((button) => button.addEventListener("click", () => removeProductPhoto(Number(button.dataset.removePhoto))));
    root.querySelectorAll("[data-close-modal]").forEach((element) => element.addEventListener("click", (event) => {
      if (event.target === element || element.tagName === "BUTTON") closeEditProduct();
    }));
    root.querySelector("[data-modal-panel]")?.addEventListener("click", (event) => event.stopPropagation());
    root.querySelector("[data-action='clear-cart']")?.addEventListener("click", () => { state.cart = []; render(); });
    root.querySelector("[data-action='save-quote']")?.addEventListener("click", saveQuote);
    root.querySelector("[data-action='copy-quote']")?.addEventListener("click", async () => {
      const text = quoteText();
      try {
        await navigator.clipboard.writeText(text);
        setMessage("Resumo do orcamento copiado.");
      } catch (_error) {
        setMessage(text);
      }
    });
  }

  function render() {
    const views = { dashboard, "new-product": productForm, suppliers: suppliersPage, upload: uploadPage, settings: settingsPage, product: productPage, cart: cartPage };
    root.innerHTML = shell((views[state.view] || dashboard)());
    bindEvents();
    refreshIcons();
  }

  render();
  initAuth();
  refreshRates({ silent: true });
})();
