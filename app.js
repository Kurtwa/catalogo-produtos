(function () {
  const config = window.CATALOGO_SUPABASE || {};
  const isConfigured = Boolean(config.url && config.anonKey && window.supabase);
  const client = isConfigured ? window.supabase.createClient(config.url, config.anonKey) : null;
  const isLocalDevelopment = ["file:", "http:"].includes(window.location.protocol)
    && ["", "localhost", "127.0.0.1"].includes(window.location.hostname);
  const allowDevProfileSwitcher = isLocalDevelopment && Boolean(config.devProfileSwitcher ?? true);
  const buckets = config.buckets || { productImages: "product-images" };
  const tables = {
    users: "catalog_users",
    userProfiles: "catalog_user_profiles",
    suppliers: "catalog_suppliers",
    settings: "catalog_settings",
    products: "catalog_products",
    priceRules: "catalog_price_rules",
    clientProducts: "catalog_client_products",
    images: "catalog_product_images",
    quotes: "catalog_quotes",
    quoteItems: "catalog_quote_items",
    ...(config.tables || {}),
  };
  let productRefreshTimer;
  let productLoadObserver;
  const productBatchSize = 60;
  const catalogCacheVersion = "20260603-v1";
  const defaultSettings = {
    usdToBrl: Number(config.usdToBrl || 5.25),
    usdToCny: Number(config.usdToCny || 7.24),
    multiplierFactor: Number(config.multiplierFactor || 1.6),
    markupPercent: Number(config.markupPercent || 100),
    percentualRepresentante: Number(config.percentualRepresentante || 0),
    percentualImportador: Number(config.percentualImportador || 0),
  };
  const adminEmails = (config.adminEmails || ["plyarte@gmail.com"]).map((email) => String(email).toLowerCase());
  const profileOptions = [
    ["admin", "Adm"],
    ["comercial_interno", "Vendedor"],
    ["representante", "Representante"],
    ["importador", "Importador"],
    ["cliente", "Cliente"],
  ];
  const roleLabels = {
    admin: "Adm",
    editor: "Adm",
    comercial_interno: "Vendedor",
    viewer: "Vendedor",
    representante: "Representante",
    importador: "Importador",
    cliente: "Cliente",
    client: "Cliente",
  };
  const rolePermissions = {
    admin: {
      canEdit: true,
      canViewSupplier: true,
      canViewInternalCosts: true,
      canViewInternalNotes: true,
      canViewStatus: true,
      canManageSettings: true,
      canManageUsers: true,
      priceMode: "full",
    },
    comercial_interno: {
      canEdit: false,
      canViewSupplier: true,
      canViewInternalCosts: true,
      canViewInternalNotes: true,
      canViewStatus: true,
      canManageSettings: false,
      canManageUsers: false,
      priceMode: "full",
    },
    cliente: {
      canEdit: false,
      canViewSupplier: false,
      canViewInternalCosts: false,
      canViewInternalNotes: false,
      canViewStatus: false,
      canManageSettings: false,
      canManageUsers: false,
      priceMode: "cliente",
    },
    representante: {
      canEdit: false,
      canViewSupplier: false,
      canViewInternalCosts: false,
      canViewInternalNotes: false,
      canViewStatus: false,
      canManageSettings: false,
      canManageUsers: false,
      priceMode: "representante",
    },
    importador: {
      canEdit: false,
      canViewSupplier: true,
      canViewInternalCosts: false,
      canViewInternalNotes: false,
      canViewStatus: false,
      canManageSettings: false,
      canManageUsers: false,
      priceMode: "importador",
    },
  };
  const catalogPermissionDefs = [
    ["show_images", "Imagens", "Mostra fotos dos produtos na lista, cards, detalhes e carrinho."],
    ["show_description", "Descricao comercial", "Mostra o texto comercial do produto."],
    ["show_technical_specs", "Especificacoes tecnicas", "Mostra o bloco de caracteristicas tecnicas."],
    ["show_dimensions", "Dimensoes", "Libera medidas quando houver campo estruturado."],
    ["show_weight", "Peso", "Libera peso quando houver campo estruturado."],
    ["show_material", "Material", "Libera material quando houver campo estruturado."],
    ["show_tags", "Tags", "Mostra tags publicas de busca no detalhe."],
    ["show_supplier", "Fornecedor", "Mostra nome do fornecedor e permite filtro por fornecedor."],
    ["show_china_cost", "Preco compra China", "Mostra preco original e conversoes de compra."],
    ["show_nationalized_cost", "Custo nacionalizado", "Mostra custo nacionalizado estimado."],
    ["show_final_price", "Preco venda Brasil", "Mostra preco final/sugerido de venda."],
    ["show_margin", "Margem e markup", "Mostra dados internos de margem e markup."],
    ["show_status", "Status de revisao", "Mostra e filtra status do produto."],
    ["can_add_to_cart", "Carrinho/orcamento", "Permite adicionar produtos ao carrinho."],
    ["can_edit_products", "Editar produtos", "Permite criar, editar e alterar status."],
    ["can_manage_users", "Gerenciar usuarios", "Reserva permissao para gestao de perfis."],
  ];
  const categoryOrder = ["Maquinas anilhada", "Bateria de peso", "Maquinas", "Esteira", "Bikes", "Eliptico", "Remo", "Escada", "Pilates", "Cardio"];
  const lineOrder = ["Cardio", "A7", "A7 Series", "A8(PANATTA)", "A8 Panatta", "A9", "A9 Series", "F", "F Series", "HY&HM", "HY&HM Series", "K1", "K1 Series", "K3", "K3 Series", "K5", "K5 Series", "K6", "K6 Series", "K8", "K8 Series", "P8", "P8 Series", "SQ", "SQ Series", "L", "L Series", "Pilates"];
  const naturalSorter = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
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
    authReady: !client,
    remoteLoading: Boolean(client),
    view: isConfigured ? "login" : "dashboard",
    productViewMode: "cards",
    productDisplayLimit: productBatchSize,
    query: "",
    filters: { category: "", line: "", supplier_id: "", status: "", tag: "", min: "", max: "" },
    selectedProductId: "prod-1",
    selectedDetailImage: "",
    profileRole: "cliente",
    devProfileRole: "",
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
    auth: { mode: "login", email: "", customerType: "usuario", loading: false },
    cart: [],
    savedQuotes: [],
    activeUserId: "",
    lastAddedProductId: "",
    message: "",
    roleRules: {},
    userProfiles: [],
    suppliers: [
      { id: "sup-1", name: "Ningbo Equipamentos", country: "China", contact_name: "Lina Zhou", email: "sales@ningbo.example" },
      { id: "sup-2", name: "Tecno Parts Europe", country: "Italia", contact_name: "Marco Bianchi", email: "export@tecnoparts.example" },
    ],
    products: [
      {
        id: "prod-1",
        supplier_id: "sup-1",
        name: "Valvula solenoide compacta",
        code: "NSV-220",
        category: "Automacao",
        line: "Valvulas",
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
        status: "pendente",
        image_url: "",
      },
      {
        id: "prod-2",
        supplier_id: "sup-2",
        name: "Sensor indutivo M18",
        code: "TP-SI18",
        category: "Sensores",
        line: "Indutivos",
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
        status: "revisado",
        image_url: "",
      },
    ],
  };

  if (window.CATALOGO_SEED_DATA) {
    state.suppliers = (window.CATALOGO_SEED_DATA.suppliers || state.suppliers).map(cleanSupplier);
    state.products = (window.CATALOGO_SEED_DATA.products || state.products).map(cleanProduct);
    state.selectedProductId = state.products[0]?.id || state.selectedProductId;
  }
  try {
    const savedSettings = JSON.parse(window.localStorage?.getItem("gr8-settings") || window.localStorage?.getItem("catalogo-settings") || "null");
    if (savedSettings) {
      if (savedSettings.markup && !savedSettings.markupPercent) savedSettings.markupPercent = (Number(savedSettings.markup) - 1) * 100;
      state.settings = { ...state.settings, ...savedSettings };
    }
  } catch (_error) {
    window.localStorage?.removeItem("gr8-settings");
  }
  syncConverterFromUsd(state.converter.usd);

  const root = document.getElementById("root");
  const statuses = ["pendente", "revisado", "arquivado"];
  const currencies = ["USD", "EUR", "BRL", "CNY"];
  const numericSettingKeys = ["usdToBrl", "usdToCny", "multiplierFactor", "markupPercent", "percentualRepresentante", "percentualImportador"];

  function isEditor() {
    return currentPermissions().canEdit;
  }

  function isClient() {
    return normalizedRole() === "cliente";
  }

  function normalizedRole(role = state.profileRole) {
    if (allowDevProfileSwitcher && state.devProfileRole && role === state.profileRole) return state.devProfileRole;
    if (role === "editor") return "admin";
    if (role === "viewer") return "comercial_interno";
    if (role === "client") return "cliente";
    return role || "cliente";
  }

  function canSeeCommercialData() {
    return currentPermissions().canViewInternalCosts;
  }

  function currentPermissions(role = normalizedRole()) {
    const base = rolePermissions[role] || rolePermissions.cliente;
    const rule = state.roleRules?.[role] || {};
    return {
      ...base,
      ...rule,
      show_images: Boolean(rule.show_images ?? true),
      show_description: Boolean(rule.show_description ?? true),
      show_technical_specs: Boolean(rule.show_technical_specs ?? true),
      show_dimensions: Boolean(rule.show_dimensions ?? true),
      show_weight: Boolean(rule.show_weight ?? true),
      show_material: Boolean(rule.show_material ?? true),
      show_tags: Boolean(rule.show_tags ?? true),
      show_supplier: Boolean(rule.show_supplier ?? base.canViewSupplier),
      show_china_cost: Boolean(rule.show_china_cost ?? base.canViewInternalCosts),
      show_nationalized_cost: Boolean(rule.show_nationalized_cost ?? base.canViewInternalCosts),
      show_final_price: Boolean(rule.show_final_price ?? true),
      show_margin: Boolean(rule.show_margin ?? false),
      show_status: Boolean(rule.show_status ?? base.canViewStatus),
      can_add_to_cart: Boolean(rule.can_add_to_cart ?? true),
      canEdit: Boolean(rule.can_edit_products ?? base.canEdit),
      canDeleteProducts: Boolean(rule.can_delete_products ?? base.canEdit),
      canViewSupplier: Boolean(rule.show_supplier ?? base.canViewSupplier),
      canViewInternalCosts: Boolean((rule.show_china_cost ?? base.canViewInternalCosts) || (rule.show_nationalized_cost ?? false) || (rule.show_margin ?? false)),
      canViewInternalNotes: Boolean(rule.can_view_audit ?? base.canViewInternalNotes),
      canViewStatus: Boolean(rule.show_status ?? base.canViewStatus),
      canManageSettings: Boolean(base.canManageSettings),
      canManageUsers: Boolean(rule.can_manage_users ?? base.canManageUsers),
      canAddToCart: Boolean(rule.can_add_to_cart ?? true),
      canViewImages: Boolean(rule.show_images ?? true),
      canViewDescription: Boolean(rule.show_description ?? true),
      canViewTechnicalSpecs: Boolean(rule.show_technical_specs ?? true),
      canViewDimensions: Boolean(rule.show_dimensions ?? true),
      canViewWeight: Boolean(rule.show_weight ?? true),
      canViewMaterial: Boolean(rule.show_material ?? true),
      canViewTags: Boolean(rule.show_tags ?? true),
      list_price_mode: rule.list_price_mode || defaultListPriceMode(role),
    };
  }

  function canViewSupplier() {
    return currentPermissions().canViewSupplier;
  }

  function canViewStatus() {
    return currentPermissions().canViewStatus;
  }

  function canManageSettings() {
    return currentPermissions().canManageSettings;
  }

  function canManageUsers() {
    return currentPermissions().canManageUsers;
  }

  function canDeleteProducts() {
    return currentPermissions().canDeleteProducts;
  }

  function publicTagMode() {
    return !canViewSupplier();
  }

  function canViewImages() {
    return currentPermissions().canViewImages;
  }

  function canAddToCart() {
    return currentPermissions().canAddToCart;
  }

  function roleIcon(role) {
    const value = normalizedRole(role);
    if (value === "admin") return "shield-check";
    if (value === "comercial_interno") return "briefcase-business";
    if (value === "representante") return "handshake";
    if (value === "importador") return "ship";
    return "user-round";
  }

  function isDemoMode() {
    return !client;
  }

  function isRemoteMode() {
    return Boolean(client);
  }

  function roleLabel() {
    return roleLabels[normalizedRole()] || roleLabels[state.profileRole] || "Cliente";
  }

  function fallbackRoleFromSession() {
    const email = String(state.session?.user?.email || "").toLowerCase();
    const meta = state.session?.user?.user_metadata || {};
    if (adminEmails.includes(email)) return "admin";
    return normalizedRole(meta.role || meta.requested_role || "cliente");
  }

  function isAuthRequired() {
    return isRemoteMode();
  }

  function canUseCatalog() {
    return !isAuthRequired() || Boolean(state.session);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  function fixTextEncoding(value) {
    const text = String(value ?? "");
    if (!/[ÃÂ]/.test(text) || typeof TextDecoder === "undefined") return text;
    try {
      const bytes = Uint8Array.from([...text].map((char) => char.charCodeAt(0) & 255));
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    } catch (_error) {
      return text;
    }
  }

  function cleanTextFields(record, fields) {
    return {
      ...record,
      ...Object.fromEntries(fields.map((field) => [field, fixTextEncoding(record?.[field])])),
    };
  }

  function cleanSupplier(record) {
    return cleanTextFields(record, ["name", "country", "contact_name", "email"]);
  }

  function cleanProduct(record) {
    return {
      ...cleanTextFields(record, ["name", "code", "category", "line", "subcategory", "description", "technical_specs", "dimensions", "material", "supplier_name", "visual_validation"]),
      tags: Array.isArray(record?.tags) ? record.tags.map(fixTextEncoding) : [],
    };
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

  function priceValueLabel(role = normalizedRole()) {
    if (role === "representante") return "Preco para representante";
    if (role === "importador") return "Preco para importador";
    if (role === "cliente") return "Preco de venda";
    return "Preco de venda Brasil";
  }

  function defaultListPriceMode(role = normalizedRole()) {
    if (role === "admin" || role === "comercial_interno") return "original_usd";
    if (role === "importador") return "profile_price";
    return "final_brl";
  }

  function finalPriceLabel(role = normalizedRole()) {
    if (role === "representante") return "Preco representante BRL";
    if (role === "cliente") return "Venda final BRL";
    return "Venda sugerida BRL";
  }

  function listPriceOptionsForRole(role, permissions = currentPermissions(role)) {
    const options = [];
    const add = (value, label) => {
      if (!options.some(([existing]) => existing === value)) options.push([value, label]);
    };

    if (permissions.show_china_cost) {
      if (role === "importador") add("profile_price", "Preco importador USD");
      add("original_usd", "Compra USD");
      add("original_brl", "Compra convertido BRL");
      add("original_cny", "Compra convertido CNY");
    }
    if (permissions.show_nationalized_cost) add("nationalized_cost_brl", "Custo nacionalizado BRL");
    if (permissions.show_final_price) add("final_brl", finalPriceLabel(role));

    return options.length ? options : [["none", "Sem preco exibido"]];
  }

  function normalizeListPriceMode(role, mode, permissions = currentPermissions(role)) {
    const options = listPriceOptionsForRole(role, permissions);
    return options.some(([value]) => value === mode) ? mode : options[0]?.[0] || "none";
  }

  function priceInfoByMode(product, mode, role = normalizedRole()) {
    const computed = calc(product);
    if (mode === "none") return { value: 0, currency: "BRL", label: "Sem preco", hasPrice: false };
    if (mode === "profile_price" || mode === "final_brl") return getDisplayPriceInfo(product, role);
    if (mode === "original_brl") return { value: computed.original_brl, currency: "BRL", label: "Compra BRL", hasPrice: Number(computed.original_brl || 0) > 0 };
    if (mode === "original_cny") return { value: computed.original_cny, currency: "CNY", label: "Compra CNY", hasPrice: Number(computed.original_cny || 0) > 0 };
    if (mode === "nationalized_cost_brl") return { value: computed.nationalized_cost_brl, currency: "BRL", label: "Nacionalizado BRL", hasPrice: Number(computed.nationalized_cost_brl || 0) > 0 };
    return { value: computed.original_usd, currency: "USD", label: "Compra USD", hasPrice: Number(computed.original_usd || 0) > 0 };
  }

  function getDisplayPriceInfo(product, role = normalizedRole()) {
    const computed = calc(product);
    const salePrice = Number(product.suggested_sale_price || computed.suggested_sale_price || 0);
    const visible = Number(product.visible_price || 0);
    const visibleLabel = normalizeText(product.visible_price_label);
    const importerBase = Number(product.original_price || computed.original_usd || 0);

    if (role === "importador") {
      const apiValueIsImporterPrice = visible && (visibleLabel.includes("importador") || visibleLabel.includes("china"));
      const value = apiValueIsImporterPrice ? visible : (importerBase ? importerBase * (1 + Number(state.settings.percentualImportador || 0) / 100) : 0);
      return { value, currency: product.currency || "USD", label: priceValueLabel(role), hasPrice: value > 0 };
    }

    if (role === "representante") {
      const base = salePrice || visible;
      const value = base ? base * (1 + Number(state.settings.percentualRepresentante || 0) / 100) : 0;
      return { value, currency: "BRL", label: priceValueLabel(role), hasPrice: value > 0 };
    }

    const value = salePrice || visible;
    return { value, currency: "BRL", label: priceValueLabel(role), hasPrice: value > 0 };
  }

  function productDisplayPrice(product) {
    const display = getDisplayPriceInfo(product);
    if (!display.hasPrice) return canSeeCommercialData() ? "Preco nao cadastrado" : "Consulte valor";
    return money(display.value, display.currency);
  }

  function productListPrice(product) {
    const role = normalizedRole();
    const permissions = currentPermissions(role);
    const mode = normalizeListPriceMode(role, permissions.list_price_mode, permissions);
    const display = priceInfoByMode(product, mode, role);
    if (!display.hasPrice && Number(display.value || 0) <= 0) return canSeeCommercialData() ? "Preco nao cadastrado" : "Consulte valor";
    return money(display.value, display.currency);
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
    window.localStorage?.setItem("gr8-settings", JSON.stringify(state.settings));
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

  function validateSignupPassword(password) {
    const value = String(password || "");
    if (value.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
    if (!/[A-Z]/.test(value)) return "A senha precisa ter pelo menos uma letra maiuscula.";
    if (!/[a-z]/.test(value)) return "A senha precisa ter pelo menos uma letra minuscula.";
    if (!/[0-9]/.test(value)) return "A senha precisa ter pelo menos um numero.";
    return "";
  }

  function passwordRuleState(password) {
    const value = String(password || "");
    return {
      length: value.length >= 8,
      upper: /[A-Z]/.test(value),
      lower: /[a-z]/.test(value),
      number: /[0-9]/.test(value),
    };
  }

  function productLine(product) {
    const line = String(product.line || "").trim();
    if (line && line !== "-") return line;
    const subcategory = String(product.subcategory || "").trim();
    if (subcategory && subcategory !== "-") return subcategory;
    return String(product.category || "").trim() || "Sem linha";
  }

  function productCategory(product) {
    const rawCategory = normalizeText(product.category);
    const text = normalizeText([
      product.name,
      product.code,
      product.category,
      product.line,
      product.subcategory,
      product.description,
      product.technical_specs,
      ...(product.tags || []),
    ].join(" "));

    if (text.includes("pilates")) return "Pilates";
    if (text.includes("treadmill") || text.includes("esteira")) return "Esteira";
    if (text.includes("stair") || text.includes("stepmill") || text.includes("climber") || text.includes("escada")) return "Escada";
    if (text.includes("elliptical") || text.includes("eliptico") || text.includes("cross trainer")) return "Eliptico";
    if (text.includes("bike") || text.includes("cycle") || text.includes("bicicleta") || text.includes("spinning") || text.includes("upright") || text.includes("recumbent")) return "Bikes";
    if (rawCategory === "cardio" && (text.includes("rower") || text.includes("rowing") || text.includes("row machine") || text.includes("remo"))) return "Remo";
    if (text.includes("plate loaded") || text.includes("plate-loaded") || text.includes("anilhada") || text.includes("olympic")) return "Maquinas anilhada";
    if (text.includes("rack") || text.includes("bench") || text.includes("dumbbell") || text.includes("barbell")) return "Maquinas";
    if (rawCategory === "strength" || text.includes("weight stack") || text.includes("selectorized") || text.includes("bateria")) return "Bateria de peso";
    return "Maquinas";
  }

  function lineSortIndex(line) {
    const normalized = normalizeText(line);
    const index = lineOrder.findIndex((item) => normalizeText(item) === normalized);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  }

  function compareByCatalogOrder(a, b) {
    const lineA = productLine(a);
    const lineB = productLine(b);
    const lineIndexA = lineSortIndex(lineA);
    const lineIndexB = lineSortIndex(lineB);
    if (lineIndexA !== lineIndexB) return lineIndexA - lineIndexB;
    const lineCompare = naturalSorter.compare(lineA, lineB);
    if (lineCompare) return lineCompare;
    const codeCompare = naturalSorter.compare(String(a.code || ""), String(b.code || ""));
    if (codeCompare) return codeCompare;
    return naturalSorter.compare(String(a.name || ""), String(b.name || ""));
  }

  function authErrorMessage(error) {
    const message = String(error?.message || "Nao foi possivel concluir a solicitacao.");
    const code = String(error?.code || error?.error_code || "").toLowerCase();
    const normalized = message.toLowerCase();
    if (code === "email_address_invalid" || normalized.includes("email address") || normalized.includes("invalid email")) return "Este provedor de email nao foi aceito. Use um email real e ativo, como Gmail, Outlook ou email profissional.";
    if (normalized.includes("already") || normalized.includes("registered")) return "Este email ja possui cadastro. Use Entrar ou recupere a senha.";
    if (normalized.includes("invalid login")) return "Email ou senha incorretos.";
    if (normalized.includes("email not confirmed") || normalized.includes("not confirmed")) return "Confirme seu email antes de entrar. Verifique sua caixa de entrada e spam.";
    if (normalized.includes("email")) return "Verifique se o email foi digitado corretamente.";
    if (normalized.includes("password")) return "A senha nao atende aos requisitos de seguranca.";
    return message;
  }

  function authRedirectUrl() {
    try {
      if (window.location.protocol === "file:") return undefined;
      return new URL("./", window.location.href).href;
    } catch (_error) {
      return undefined;
    }
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
    const text = normalizeText([product.name, product.category, product.line, product.subcategory, product.description, product.technical_specs, ...(product.tags || [])].join(" "));
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
      product.line,
      product.subcategory,
      product.description,
      product.technical_specs,
      product.material,
      product.dimensions,
      ...(canViewSupplier() ? [supplierName(product.supplier_id), product.supplier_name] : []),
      ...productTags(product, { publicOnly: publicTagMode() }),
    ].join(" "));
  }

  function scoreProduct(product, terms) {
    if (!terms.length) return 1;
    const text = productSearchText(product);
    const tags = normalizeText(productTags(product, { publicOnly: publicTagMode() }).join(" "));
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
    return publicTagMode()
      ? "Selecione as maquinas para montar seu orcamento. Fornecedores e dados internos ficam protegidos."
      : "Produtos com campos liberados conforme o perfil de acesso.";
  }

  function pageTitle() {
    const titles = {
      dashboard: "Produtos",
      "new-product": "Novo produto",
      suppliers: "Fornecedores",
      users: "Usuarios",
      settings: "Configuracoes",
      product: "Produto",
      cart: "Carrinho",
      login: "Entrar",
    };
    return titles[state.view] || "Produtos";
  }

  function getProducts() {
    const terms = expandSearchTerms(state.query);
    return state.products.map((product, index) => ({ ...product, _searchScore: scoreProduct(product, terms), _searchIndex: index })).filter((product) => {
      return (!terms.length || product._searchScore > 0) &&
        (!state.filters.category || productCategory(product) === state.filters.category) &&
        (!state.filters.line || productLine(product) === state.filters.line) &&
        (!canViewSupplier() || !state.filters.supplier_id || product.supplier_id === state.filters.supplier_id) &&
        (!state.filters.status || product.status === state.filters.status);
    }).sort((a, b) => terms.length ? ((b._searchScore - a._searchScore) || compareByCatalogOrder(a, b)) : compareByCatalogOrder(a, b));
  }

  function similarProducts(product) {
    if (!product) return [];
    const baseTags = new Set(productTags(product, { publicOnly: publicTagMode() }));
    const baseTerms = new Set(expandSearchTerms([product.name, product.category, product.line, product.subcategory, product.description, product.technical_specs, ...productTags(product, { publicOnly: publicTagMode() })].join(" ")));
    return state.products
      .filter((item) => item.id !== product.id)
      .map((item) => {
        const itemTags = productTags(item, { publicOnly: publicTagMode() });
        const itemTerms = expandSearchTerms([item.name, item.category, item.line, item.subcategory, item.description, item.technical_specs, ...itemTags].join(" "));
        const semanticOverlap = itemTerms.filter((term) => baseTerms.has(term)).length;
        const tagOverlap = itemTags.filter((tag) => baseTags.has(tag)).length;
        return { ...item, score: (productCategory(item) === productCategory(product) ? 4 : 0) + (productLine(item) === productLine(product) ? 2 : 0) + (tagOverlap * 3) + semanticOverlap };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  function setMessage(message) {
    state.message = message;
    render();
  }

  function showConfirmDialog(options = {}) {
    return new Promise((resolve) => {
      const title = options.title || "Confirmar acao";
      const message = options.message || "Deseja continuar?";
      const confirmLabel = options.confirmLabel || "Confirmar";
      const cancelLabel = options.cancelLabel || "Cancelar";
      const danger = Boolean(options.danger);
      root.querySelector(".confirm-modal")?.remove();
      root.insertAdjacentHTML("beforeend", `
        <div class="modal-backdrop confirm-modal" data-confirm-cancel>
          <section class="confirm-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div>
              <small>${escapeHtml(options.kicker || "Confirmacao")}</small>
              <h2 id="confirm-title">${escapeHtml(title)}</h2>
              <p>${escapeHtml(message)}</p>
            </div>
            <div class="confirm-actions">
              <button type="button" data-confirm-cancel>${escapeHtml(cancelLabel)}</button>
              <button type="button" class="${danger ? "danger-action" : "primary"}" data-confirm-ok>${escapeHtml(confirmLabel)}</button>
            </div>
          </section>
        </div>`);
      const modal = root.querySelector(".confirm-modal");
      const close = (value) => {
        modal?.remove();
        document.removeEventListener("keydown", onKeydown);
        resolve(value);
      };
      const onKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close(false);
        }
      };
      modal.querySelector("[data-confirm-ok]")?.addEventListener("click", () => close(true));
      modal.querySelectorAll("[data-confirm-cancel]").forEach((element) => element.addEventListener("click", (event) => {
        if (event.target === element || element.tagName === "BUTTON") close(false);
      }));
      modal.querySelector(".confirm-panel")?.addEventListener("click", (event) => event.stopPropagation());
      document.addEventListener("keydown", onKeydown);
      modal.querySelector("[data-confirm-ok]")?.focus();
    });
  }

  function withTimeout(promise, timeoutMs, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => window.setTimeout(() => reject(new Error(`${label} demorou para responder.`)), timeoutMs)),
    ]);
  }

  function catalogCacheKey() {
    if (!state.session?.user?.id) return "";
    return `gr8-catalog-cache:${catalogCacheVersion}:${state.session.user.id}:${normalizedRole()}`;
  }

  function readCatalogCache() {
    try {
      const key = catalogCacheKey();
      if (!key) return null;
      const cached = JSON.parse(window.localStorage?.getItem(key) || "null");
      if (!cached?.products?.length) return null;
      return cached;
    } catch (error) {
      console.warn("Falha ao ler cache do catalogo", error);
      return null;
    }
  }

  function writeCatalogCache() {
    try {
      const key = catalogCacheKey();
      if (!key) return;
      const payload = {
        cachedAt: Date.now(),
        suppliers: state.suppliers,
        products: state.products,
        roleRules: state.roleRules,
        settings: state.settings,
      };
      window.localStorage?.setItem(key, JSON.stringify(payload));
    } catch (error) {
      console.warn("Falha ao salvar cache do catalogo", error);
    }
  }

  function hydrateCatalogFromCache(cached) {
    if (!cached?.products?.length) return false;
    state.suppliers = (cached.suppliers || []).map(cleanSupplier);
    state.roleRules = cached.roleRules || {};
    if (cached.settings) {
      state.settings = { ...state.settings, ...cached.settings };
      syncConverterFromUsd(state.converter.usd);
    }
    state.products = (cached.products || []).map((product) => {
      const galleryItems = product.galleryItems?.length
        ? product.galleryItems
        : (product.gallery || []).map((url) => ({ url, path: url }));
      const primaryImage = galleryItems[0]?.url || product.image_url || "";
      return {
        ...cleanProduct(product),
        gallery: galleryItems.map((item) => item.url),
        galleryItems,
        image_url: primaryImage,
      };
    });
    resetProductDisplayLimit();
    return true;
  }

  function showCatalogCacheIfAvailable() {
    const cached = readCatalogCache();
    const usedCache = hydrateCatalogFromCache(cached);
    if (!usedCache) return false;
    state.remoteLoading = false;
    render();
    return true;
  }

  async function loadRemoteData() {
    if (!client) return;
    const isAuthenticated = Boolean(state.session);
    state.remoteLoading = isAuthenticated && !state.products.length;
    if (!isAuthenticated) {
      state.profileRole = "cliente";
      state.devProfileRole = "";
      state.suppliers = [];
      state.products = [];
      state.cart = [];
      state.savedQuotes = [];
      state.activeUserId = "";
      state.remoteLoading = false;
      return;
    }
    const currentUserId = state.session.user.id;
    if (state.activeUserId && state.activeUserId !== currentUserId) {
      state.cart = [];
      state.savedQuotes = [];
    }
    state.activeUserId = currentUserId;
    if (isAuthenticated) {
      try {
        const profile = await withTimeout(client.from(tables.userProfiles).select("role, is_active").eq("id", state.session.user.id).maybeSingle(), 8000, "A verificacao do perfil");
        if (profile.data && profile.data.is_active === false) {
          await client.auth.signOut();
          state.session = null;
          state.profileRole = "cliente";
          state.devProfileRole = "";
          state.view = "login";
          state.message = "Seu acesso ao catalogo esta desativado. Fale com um administrador.";
          state.remoteLoading = false;
          render();
          return;
        }
        if (profile.data?.role) state.profileRole = profile.data.role;
        else {
          const legacyProfile = await withTimeout(client.from(tables.users).select("role").eq("id", state.session.user.id).maybeSingle(), 8000, "A verificacao do perfil legado");
          state.profileRole = legacyProfile.data?.role || fallbackRoleFromSession();
        }
      } catch (error) {
        console.warn("Falha ao carregar perfil", error);
        state.profileRole = fallbackRoleFromSession();
        state.message = state.message || "Perfil carregado em modo temporario. Os dados continuam sendo atualizados.";
      }
    } else {
      state.profileRole = "cliente";
    }

    showCatalogCacheIfAvailable();

    const [suppliers, productsRpc, images, priceRules, userProfiles] = await Promise.all([
      canViewSupplier() ? client.from(tables.suppliers).select("*").order("name") : Promise.resolve({ data: [], error: null }),
      client.rpc("get_visible_products_for_current_user"),
      client.from(tables.images).select("product_id, file_path, public_url, is_primary, created_at").order("is_primary", { ascending: false }).order("created_at", { ascending: true }),
      client.from(tables.priceRules).select("*").order("role"),
      canManageUsers() ? client.from(tables.userProfiles).select("id, email, full_name, phone, company_name, customer_type, role, is_active, created_at, updated_at").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    ]);
    const products = productsRpc.error
      ? await client.from(isAuthenticated ? tables.products : tables.clientProducts).select("*").order("updated_at", { ascending: false })
      : productsRpc;
    const settings = await client.from(tables.settings).select("key, value").in("key", numericSettingKeys);
    if (settings.data?.length) {
      for (const item of settings.data) {
        state.settings[item.key] = Number(item.value ?? state.settings[item.key]);
      }
      syncConverterFromUsd(state.converter.usd);
    }
    const error = suppliers.error || products.error || images.error || settings.error || priceRules.error || userProfiles.error;
    if (error) {
      state.remoteLoading = false;
      setMessage(error.message);
      return;
    }
    const galleryByProduct = new Map();
    for (const image of images.data || []) {
      if (!image.public_url) continue;
      if (!galleryByProduct.has(image.product_id)) galleryByProduct.set(image.product_id, []);
      galleryByProduct.get(image.product_id).push({ url: image.public_url, path: image.file_path || image.public_url });
    }
    state.suppliers = (suppliers.data || []).map(cleanSupplier);
    state.roleRules = Object.fromEntries((priceRules.data || []).map((rule) => [rule.role, rule]));
    state.userProfiles = userProfiles.data || [];
    state.products = (products.data || []).map((product) => {
      const gallery = galleryByProduct.get(product.id) || [];
      const galleryItems = gallery.length ? gallery : (product.image_url ? [{ url: product.image_url, path: product.image_url }] : []);
      const primaryImage = galleryItems[0]?.url || product.image_url || "";
      return {
        ...cleanProduct(product),
        gallery: galleryItems.map((item) => item.url),
        galleryItems,
        image_url: primaryImage,
      };
    });
    await loadSavedQuotes();
    writeCatalogCache();
    state.remoteLoading = false;
    render();
  }

  async function loadSavedQuotes() {
    if (!client || !state.session) {
      state.savedQuotes = [];
      return;
    }
    const quotes = await client.from(tables.quotes)
      .select("id, quote_number, customer_name, customer_contact, notes, status, currency, created_at, updated_at")
      .eq("created_by", state.session.user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (quotes.error) {
      state.savedQuotes = [];
      return;
    }
    const quoteIds = (quotes.data || []).map((quote) => quote.id);
    const items = quoteIds.length
      ? await client.from(tables.quoteItems).select("quote_id, product_id, quantity, unit_price_usd, exchange_rate, notes, created_at").in("quote_id", quoteIds)
      : { data: [], error: null };
    if (items.error) {
      state.savedQuotes = [];
      return;
    }
    const itemsByQuote = new Map();
    for (const item of items.data || []) {
      if (!itemsByQuote.has(item.quote_id)) itemsByQuote.set(item.quote_id, []);
      itemsByQuote.get(item.quote_id).push(item);
    }
    state.savedQuotes = (quotes.data || []).map((quote) => ({
      ...quote,
      items: (itemsByQuote.get(quote.id) || []).map(savedQuoteItem),
    }));
  }

  async function ensureUserProfile() {
    if (!client || !state.session) return;
    const existing = await client.from(tables.userProfiles).select("id, role, is_active").eq("id", state.session.user.id).maybeSingle();
    if (existing.data) {
      state.profileRole = existing.data.role || "cliente";
      return;
    }
    const meta = state.session.user.user_metadata || {};
    await client.from(tables.users).upsert({
      id: state.session.user.id,
      email: state.session.user.email,
      full_name: meta.full_name || meta.name || null,
      role: "cliente",
    });
    await client.from(tables.userProfiles).insert({
      id: state.session.user.id,
      email: state.session.user.email,
      full_name: meta.full_name || meta.name || null,
      phone: meta.phone || null,
      company_name: meta.company_name || null,
      customer_type: meta.customer_type || "usuario",
      role: "cliente",
    });
    state.profileRole = "cliente";
  }

  async function initAuth() {
    if (!client) {
      state.authReady = true;
      render();
      return;
    }
    try {
      const session = await withTimeout(client.auth.getSession(), 8000, "A verificacao de sessao");
      state.session = session.data.session;
      if (state.session) {
        state.profileRole = fallbackRoleFromSession();
        if (state.view === "login") state.view = "dashboard";
        state.authReady = true;
        if (!showCatalogCacheIfAvailable()) {
          state.remoteLoading = true;
          render();
        }
        await withTimeout(ensureUserProfile(), 12000, "A verificacao do perfil");
      } else {
        state.profileRole = "cliente";
        state.devProfileRole = "";
        state.view = "login";
        state.remoteLoading = false;
      }
      await withTimeout(loadRemoteData(), 12000, "O carregamento dos produtos");
    } catch (error) {
      console.warn("Falha ao iniciar autenticacao", error);
      state.remoteLoading = false;
      if (state.session) {
        state.profileRole = fallbackRoleFromSession();
        state.view = "dashboard";
        state.message = `${error.message || "Nao foi possivel carregar todos os dados."} Continue tentando atualizar.`;
      } else {
        state.profileRole = "cliente";
        state.devProfileRole = "";
        state.view = "login";
        state.message = `${error.message || "Nao foi possivel verificar a sessao."} Tente entrar novamente.`;
      }
    } finally {
      state.authReady = true;
      render();
    }
    client.auth.onAuthStateChange(async (_event, sessionValue) => {
      try {
        state.session = sessionValue;
        if (sessionValue) {
          state.profileRole = fallbackRoleFromSession();
          if (state.view === "login") state.view = "dashboard";
          state.authReady = true;
          if (!showCatalogCacheIfAvailable()) {
            state.remoteLoading = true;
            render();
          }
          await withTimeout(ensureUserProfile(), 12000, "A verificacao do perfil");
        } else {
          state.profileRole = "cliente";
          state.devProfileRole = "";
          state.view = "login";
          state.remoteLoading = false;
        }
        await withTimeout(loadRemoteData(), 12000, "O carregamento dos produtos");
      } catch (error) {
        console.warn("Falha ao atualizar autenticacao", error);
        state.remoteLoading = false;
        if (state.session) {
          state.profileRole = fallbackRoleFromSession();
          state.view = "dashboard";
          state.message = `${error.message || "Nao foi possivel atualizar todos os dados."} Continue tentando atualizar.`;
        } else {
          state.profileRole = "cliente";
          state.devProfileRole = "";
          state.view = "login";
          state.message = `${error.message || "Nao foi possivel atualizar a sessao."} Tente entrar novamente.`;
        }
      } finally {
        state.authReady = true;
        render();
      }
    });
  }

  function remoteLoadingPage() {
    return `
      <section class="remote-loading-card" aria-live="polite">
        <small>Catalogo</small>
        <h2>Preparando seus produtos</h2>
        <p>Estamos carregando as informacoes mais recentes para sua conta.</p>
      </section>`;
  }

  function shell(content) {
    const navIcons = {
      dashboard: "boxes",
      "new-product": "package-plus",
      suppliers: "factory",
      users: "user-cog",
      settings: "sliders-horizontal",
      cart: "shopping-cart",
      login: "log-in",
    };
    return `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand">
            <img class="brand-logo" src="./assets/logo-gr8.png" alt="GR8">
          </div>
          <nav>
            ${canUseCatalog() ? navButton("dashboard", "Produtos", navIcons.dashboard) : ""}
            ${canUseCatalog() && isEditor() ? navButton("new-product", "Novo produto", navIcons["new-product"]) : ""}
            ${canUseCatalog() && isEditor() ? navButton("suppliers", "Fornecedores", navIcons.suppliers) : ""}
            ${canUseCatalog() && canManageUsers() ? navButton("users", "Usuarios", navIcons.users) : ""}
            ${canUseCatalog() && isEditor() ? navButton("settings", "Configuracoes", navIcons.settings) : ""}
            ${canUseCatalog() && canAddToCart() ? navButton("cart", `Carrinho (${cartCount()})`, navIcons.cart) : ""}
            ${isRemoteMode() && !state.session ? navButton("login", "Entrar", navIcons.login) : ""}
          </nav>
          ${authPanel()}
        </aside>
        <main class="content">
          <header class="topbar">
            <div><h1>${escapeHtml(pageTitle())}</h1></div>
            ${isEditor() ? `<button class="primary icon-only" data-view="new-product" title="Cadastrar produto" aria-label="Cadastrar produto">${iconOnly("package-plus", "Cadastrar produto")}</button>` : ""}
          </header>
          ${canUseCatalog() && canSeeCommercialData() ? currencyBar() : ""}
          ${state.message ? `<div class="notice" data-clear-message>${escapeHtml(state.message)}</div>` : ""}
          ${content}
          ${editProductModal()}
          ${floatingCartButton()}
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
    if (isRemoteMode()) {
      if (state.session) {
        return `
          <div class="auth-box">
            <small>Conta conectada</small>
            <span class="role-pill">${roleLabel()}</span>
            <strong class="auth-email">${escapeHtml(state.session.user.email || "Usuario")}</strong>
            ${devProfileSwitcher()}
            <button type="button" data-action="logout">${withIcon("log-out", "Sair")}</button>
          </div>`;
      }
      return `
        <div class="auth-box">
          <small>Acesso restrito</small>
          <span class="role-pill">Login obrigatorio</span>
          <button type="button" data-view="login">${withIcon("log-in", "Entrar")}</button>
        </div>`;
    }
    return `
      <div class="auth-box">
        <small>Perfil de acesso</small>
        <span class="role-pill">${roleLabel()}</span>
        ${devProfileSwitcher()}
      </div>`;
  }

  function devProfileSwitcher() {
    if (!allowDevProfileSwitcher) return "";
    return `
      <div class="dev-profile-switch">
        <small>Dev: simular perfil</small>
        <div class="profile-switch" role="group" aria-label="Simular perfil temporario">
          ${profileOptions.map(([role, label]) => `<button type="button" class="${normalizedRole() === role ? "active" : ""}" data-role-switch="${role}">${icon(roleIcon(role))}<span>${label}</span></button>`).join("")}
        </div>
      </div>`;
  }

  function loginPage() {
    if (!state.authReady) {
      return `<section class="login-page"><article class="login-card login-status-card"><small>Acesso restrito</small><h2>Verificando sessao</h2><p>Aguarde enquanto confirmamos se existe uma conta conectada.</p></article></section>`;
    }
    if (!isRemoteMode()) {
      return `<section class="login-page"><article class="login-card login-status-card"><small>Modo demo</small><h2>Login indisponivel</h2><p>Configure a autenticacao para usar contas reais.</p><button class="primary" data-view="dashboard">${withIcon("arrow-left", "Voltar")}</button></article></section>`;
    }
    if (state.session) {
      return `<section class="login-page"><article class="login-card login-status-card"><small>Conta conectada</small><h2>${escapeHtml(roleLabel())}</h2><p>${escapeHtml(state.session.user.email || "")}</p><button class="primary" data-view="dashboard">${withIcon("boxes", "Ir para produtos")}</button></article></section>`;
    }
    const isSignup = state.auth.mode === "signup";
    const customerType = state.auth.customerType || "usuario";
    const organizationLabel = customerType === "academia"
      ? "Nome da academia"
      : customerType === "estudio"
        ? "Nome do estudio"
        : "Nome da empresa";
    const organizationRequired = customerType !== "usuario";
    const passwordRules = "Minimo de 8 caracteres, com letra maiuscula, letra minuscula e numero.";
    const passwordChecklist = `
      <ul class="password-rules" data-password-rules>
        <li data-password-rule="length">8 caracteres</li>
        <li data-password-rule="upper">Letra maiuscula</li>
        <li data-password-rule="lower">Letra minuscula</li>
        <li data-password-rule="number">Numero</li>
      </ul>`;
    return `
      <section class="login-page">
        <article class="login-card login-card-auth">
          <div class="login-main">
            <div class="login-brand-row">
              <img src="./assets/logo-gr8.png" alt="GR8">
            </div>
            ${state.message ? `<div class="notice login-notice" data-clear-message>${escapeHtml(state.message)}</div>` : ""}
            <div class="login-copy">
              <small>Acesso aos produtos</small>
              <h2>${isSignup ? "Crie sua conta" : "Entre na sua conta"}</h2>
              <p>${isSignup ? "Cadastre-se para selecionar equipamentos e montar seu orcamento." : "Acesse para pesquisar equipamentos e continuar seu orcamento."}</p>
            </div>
            <div class="auth-mode-toggle" role="group" aria-label="Escolher acesso">
              <button type="button" class="${!isSignup ? "active" : ""}" data-auth-mode="login">Entrar</button>
              <button type="button" class="${isSignup ? "active" : ""}" data-auth-mode="signup">Criar conta</button>
            </div>
            <form id="login-form" class="login-form login-form-page">
              ${isSignup ? `
                <label><span>Nome</span><input name="full_name" type="text" autocomplete="name" placeholder="Seu nome" required></label>
                <label><span>Tipo de cadastro</span>
                  <select name="customer_type" data-auth-customer-type>
                    <option value="usuario" ${customerType === "usuario" ? "selected" : ""}>Usuario individual</option>
                    <option value="academia" ${customerType === "academia" ? "selected" : ""}>Academia</option>
                    <option value="estudio" ${customerType === "estudio" ? "selected" : ""}>Estudio</option>
                    <option value="empresa" ${customerType === "empresa" ? "selected" : ""}>Empresa</option>
                  </select>
                </label>
                <label><span>Telefone</span><input name="phone" type="tel" autocomplete="tel" placeholder="Telefone para contato"></label>
                <label><span>${organizationRequired ? organizationLabel : "Empresa, academia ou estudio"}</span><input name="company_name" type="text" autocomplete="organization" placeholder="${organizationRequired ? organizationLabel : "Opcional"}" ${organizationRequired ? "required" : ""}></label>
              ` : ""}
              <label><span>Email</span><input name="email" type="email" autocomplete="email" placeholder="seu@email.com" value="${escapeHtml(state.auth.email)}" required></label>
              <label class="${isSignup ? "password-field" : ""}"><span>Senha</span><span class="password-control"><input name="password" type="password" autocomplete="${isSignup ? "new-password" : "current-password"}" placeholder="${isSignup ? "Crie uma senha" : "Sua senha"}" minlength="${isSignup ? "8" : "6"}" title="${isSignup ? passwordRules : ""}" required><button class="password-toggle" type="button" data-password-toggle="password" title="Mostrar senha" aria-label="Mostrar senha">${iconOnly("eye", "Mostrar senha")}</button></span>${isSignup ? passwordChecklist : ""}</label>
              ${isSignup ? `<label class="password-field"><span>Confirmar senha</span><span class="password-control"><input name="password_confirm" type="password" autocomplete="new-password" placeholder="Digite a senha novamente" minlength="8" title="${passwordRules}" required><button class="password-toggle" type="button" data-password-toggle="password_confirm" title="Mostrar senha" aria-label="Mostrar senha">${iconOnly("eye", "Mostrar senha")}</button></span><small class="password-hint">${passwordRules}</small><small class="password-match-hint" data-password-match>As senhas nao conferem.</small></label>` : ""}
              <button class="primary" type="submit" ${state.auth.loading ? "disabled" : ""}>${withIcon(isSignup ? "user-plus" : "log-in", state.auth.loading ? "Aguarde" : (isSignup ? "Criar conta" : "Entrar"))}</button>
            </form>
          </div>
        </article>
      </section>`;
  }

  function dashboard() {
    const categories = unique(state.products.map(productCategory)).sort((a, b) => {
      const ai = categoryOrder.indexOf(a);
      const bi = categoryOrder.indexOf(b);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.localeCompare(b);
    });
    const lines = unique(state.products.map(productLine)).sort((a, b) => {
      const lineIndexA = lineSortIndex(a);
      const lineIndexB = lineSortIndex(b);
      if (lineIndexA !== lineIndexB) return lineIndexA - lineIndexB;
      return naturalSorter.compare(a, b);
    });
    const categoryCounts = countByValue(state.products, productCategory);
    const lineCounts = countByValue(state.products, productLine);
    return `
      <section class="search-zone">
        <span class="search-icon">${icon("search")}</span>
        <input id="search-input" value="${escapeHtml(state.query)}" placeholder="${canViewSupplier() ? "Buscar por nome, codigo, categoria, fornecedor, descricao ou tags" : "Buscar por nome, codigo, categoria ou tags"}">
        <p class="search-help">Busca contextual: experimente termos como extensora, flexora, banco, supino, anilhada, polia, peito, perna ou esteira.</p>
      </section>
      <section class="product-summary" aria-label="Resumo dos produtos">
        <span><strong>${state.products.length}</strong> produtos</span>
        <span><strong>${lines.length}</strong> linhas</span>
        <span><strong>${categories.length}</strong> categorias</span>
        <span><strong>${cartCount()}</strong> selecionados</span>
      </section>
      <section class="filters">
        ${select("line", "Linha", [["", "Linha"], ...lines.map((item) => [item, `${item} (${lineCounts.get(item) || 0})`])], state.filters.line)}
        ${select("category", "Categoria", [["", "Categoria"], ...categories.map((item) => [item, `${item} (${categoryCounts.get(item) || 0})`])], state.filters.category)}
        ${canViewSupplier() ? select("supplier_id", "Fornecedor", [["", "Fornecedor"], ...state.suppliers.map((item) => [item.id, item.name])], state.filters.supplier_id) : ""}
        ${canViewStatus() ? select("status", "Status", [["", "Status"], ...statuses.map((item) => [item, item])], state.filters.status) : ""}
        <button class="filter-clear" type="button" data-clear-filters ${hasActiveProductFilters() ? "" : "disabled"}>${withIcon("x", "Limpar")}</button>
      </section>
      <section class="product-area" id="product-results">
        ${productResults()}
      </section>`;
  }

  function productResults() {
    const products = getProducts();
    const total = state.products.length;
    const displayLimit = Math.min(Math.max(Number(state.productDisplayLimit || productBatchSize), productBatchSize), products.length);
    const visibleProducts = products.slice(0, displayLimit);
    const hasMoreProducts = visibleProducts.length < products.length;
    return `
      <div class="product-toolbar">
        <div class="result-count">
          <strong>${products.length}</strong>
          <span>${products.length === 1 ? "item encontrado" : "itens encontrados"}${hasActiveProductFilters() ? " com os filtros atuais" : ` de ${total}`}${products.length ? ` · exibindo ${visibleProducts.length}` : ""}</span>
        </div>
        <div class="view-toggle" role="group" aria-label="Tipo de visualizacao">
          <button class="${state.productViewMode === "table" ? "active" : ""}" data-view-mode="table">${withIcon("list", "Linhas")}</button>
          <button class="${state.productViewMode === "cards" ? "active" : ""}" data-view-mode="cards">${withIcon("layout-grid", "Cards")}</button>
        </div>
      </div>
      ${activeFilterChips()}
      ${state.productViewMode === "table" ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Produto</th><th>Categoria</th><th>Linha</th>${canViewSupplier() ? "<th>Fornecedor</th>" : ""}<th>Preco</th>${canViewStatus() ? "<th>Status</th>" : ""}<th class="actions-col"></th></tr></thead>
            <tbody>${visibleProducts.map(productRow).join("")}</tbody>
          </table>
        </div>` : `
        <div class="card-grid">${visibleProducts.map(productCard).join("")}</div>
      `}
      ${hasMoreProducts ? `
        <div class="load-more-products" data-load-more-sentinel>
          <button type="button" data-load-more-products>${withIcon("plus", `Carregar mais ${Math.min(productBatchSize, products.length - visibleProducts.length)}`)}</button>
          <small>${visibleProducts.length} de ${products.length} produtos exibidos</small>
        </div>` : ""}`;
  }

  function resetProductDisplayLimit() {
    state.productDisplayLimit = productBatchSize;
  }

  function loadMoreProducts() {
    const total = getProducts().length;
    if (state.productDisplayLimit >= total) return;
    state.productDisplayLimit = Math.min(total, Number(state.productDisplayLimit || productBatchSize) + productBatchSize);
    refreshProductResults();
  }

  function hasActiveProductFilters() {
    const filterKeys = ["line", "category", ...(canViewSupplier() ? ["supplier_id"] : []), ...(canViewStatus() ? ["status"] : [])];
    return Boolean(state.query.trim()) || filterKeys.some((key) => Boolean(String(state.filters[key] || "").trim()));
  }

  function refreshProductResults() {
    const container = root.querySelector("#product-results");
    if (!container) return render();
    container.innerHTML = productResults();
    const clearButton = root.querySelector("[data-clear-filters]");
    if (clearButton) clearButton.disabled = !hasActiveProductFilters();
    bindResultEvents(container);
    refreshIcons();
    setupProductLoadObserver();
  }

  function scheduleProductResultsRefresh() {
    clearTimeout(productRefreshTimer);
    productRefreshTimer = setTimeout(refreshProductResults, 140);
  }

  function metric(label, value, iconName) {
    return `<article class="metric"><div class="metric-head"><span>${label}</span>${icon(iconName)}</div><strong>${value}</strong></article>`;
  }

  function countBy(items, key) {
    const counts = new Map();
    for (const item of items) {
      const value = item[key];
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return counts;
  }

  function countByValue(items, getter) {
    const counts = new Map();
    for (const item of items) {
      const value = getter(item);
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return counts;
  }

  function countTags(items) {
    const counts = new Map();
    for (const item of items) {
      for (const tag of productTags(item, { publicOnly: publicTagMode() })) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return counts;
  }

  function filterLabel(key, value) {
    if (!value) return "";
    if (key === "query") return `Busca: ${value}`;
    if (key === "supplier_id") return supplierName(value);
    return value;
  }

  function activeFilterChips() {
    const keys = ["line", "category", ...(canViewSupplier() ? ["supplier_id"] : []), ...(canViewStatus() ? ["status"] : [])];
    const chips = state.query.trim()
      ? [`<button type="button" data-clear-filter="query"><span>${escapeHtml(filterLabel("query", state.query.trim()))}</span>${icon("x")}</button>`]
      : [];
    chips.push(...keys
      .filter((key) => String(state.filters[key] || "").trim())
      .map((key) => `<button type="button" data-clear-filter="${key}"><span>${escapeHtml(filterLabel(key, state.filters[key]))}</span>${icon("x")}</button>`));
    return chips.length ? `<div class="active-filters" aria-label="Filtros ativos">${chips.join("")}</div>` : "";
  }

  function clearFilters() {
    state.filters = { category: "", line: "", supplier_id: "", status: "", tag: "", min: "", max: "" };
    state.query = "";
    resetProductDisplayLimit();
    render();
  }

  function clearFilter(key) {
    if (key === "query") {
      state.query = "";
      resetProductDisplayLimit();
      render();
      return;
    }
    if (!(key in state.filters)) return;
    state.filters[key] = "";
    resetProductDisplayLimit();
    render();
  }

  function select(name, label, options, value) {
    return `<select aria-label="${label}" data-filter="${name}">${options.map(([id, text]) => `<option value="${escapeHtml(id)}" ${String(id) === String(value) ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select>`;
  }

  function productThumb(product) {
    if (canViewImages() && product.image_url) {
      return `<span class="image-fit" role="img" aria-label="${escapeHtml(product.name)}" style="background-image: url('${escapeHtml(product.image_url)}');"></span>`;
    }
    return `<span>${escapeHtml(String(product.name || product.code || "?").slice(0, 2).toUpperCase())}</span>`;
  }

  function statusControl(product) {
    if (!isEditor()) return `<span class="status ${escapeHtml(product.status)}">${escapeHtml(product.status)}</span>`;
    return `
      <label class="status-control">
        <span class="sr-only">Alterar status de ${escapeHtml(product.name)}</span>
        <select data-status-product="${product.id}" aria-label="Alterar status de ${escapeHtml(product.name)}">
          ${statuses.map((item) => `<option value="${escapeHtml(item)}" ${item === product.status ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}
        </select>
      </label>`;
  }

  function productRow(product) {
    const thumb = productThumb(product);
    const supplier = product.supplier_name || supplierName(product.supplier_id);
    return `
      <tr>
        <td>
          <div class="product-cell">
            <div class="row-thumb">${thumb}</div>
            <div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.code)}</small></div>
          </div>
        </td>
        <td>${escapeHtml(productCategory(product))}</td>
        <td>${escapeHtml(productLine(product))}</td>
        ${canViewSupplier() ? `<td>${escapeHtml(supplier)}</td>` : ""}
        <td>${escapeHtml(productListPrice(product))}</td>
        ${canViewStatus() ? `<td>${statusControl(product)}</td>` : ""}
        <td><div class="row-actions"><button class="icon-only" data-product="${product.id}" title="Ver detalhes" aria-label="Ver detalhes">${iconOnly("eye", "Ver detalhes")}</button>${cartButton(product.id)}</div></td>
      </tr>`;
  }

  function productCard(product) {
    const thumb = productThumb(product);
    const supplier = product.supplier_name || supplierName(product.supplier_id);
    return `
      <article class="product-card">
        <div class="thumb">${thumb}</div>
        <div class="product-card-info">
          <span class="product-code">${escapeHtml(product.code || "Sem codigo")}</span>
          <strong>${escapeHtml(product.name)}</strong>
          <small>${escapeHtml(productCategory(product))} · ${escapeHtml(productLine(product))}${canViewSupplier() ? ` · ${escapeHtml(supplier)}` : ""}</small>
        </div>
        <div class="price-line"><span>${escapeHtml(productListPrice(product))}</span><div class="row-actions"><button class="icon-only" data-product="${product.id}" title="Ver detalhes" aria-label="Ver detalhes">${iconOnly("eye", "Ver detalhes")}</button>${cartButton(product.id, "+ Carrinho")}</div></div>
      </article>`;
  }

  function cartButton(productId, label = "Adicionar") {
    if (!canAddToCart()) return "";
    const inCart = state.cart.find((item) => item.product_id === productId);
    const title = inCart ? `Adicionar mais uma unidade (${inCart.quantity} no carrinho)` : "Adicionar ao carrinho";
    return `<button class="cart-add-btn icon-only" data-cart-add="${productId}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${iconOnly("shopping-cart", title)}${inCart ? `<span class="cart-count">${inCart.quantity}</span>` : ""}</button>`;
  }

  function priceCard(label, value, variant = "") {
    return `<div class="price-card ${variant}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;
  }

  function specItem(label, value) {
    return `<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value || "-")}</strong></div>`;
  }

  function similarThumb(item) {
    const thumb = canViewImages() && item.image_url
      ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}">`
      : `<span>${escapeHtml(item.name.slice(0, 2).toUpperCase())}</span>`;
    return `<button class="similar-thumb" data-product="${item.id}" title="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">${thumb}</button>`;
  }

  function formattedSpecs(value) {
    const text = String(value || "").trim();
    if (!text) return "<p>Sem especificacoes cadastradas.</p>";
    const formatted = text
      .replace(/\s+(N\.W\s*\/\s*G\.W|N\.W|G\.W|DIM|CTN|Display|Input|Power|Speed|Incline|Running Belt|Running Board|Running Area|Motor|Voltage|Max User Weight):/gi, "\n$1:")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (formatted.length <= 1) return `<p>${escapeHtml(text)}</p>`;
    return `<div class="spec-lines">${formatted.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>`;
  }

  function productPage() {
    const product = state.products.find((item) => item.id === state.selectedProductId) || state.products[0];
    if (!product) return `<section class="detail-panel"><h2>Nenhum produto cadastrado</h2></section>`;
    return productDetailContent(product);
  }

  function productDetailContent(product) {
    const computed = calc(product);
    const thumb = productThumb(product);
    const supplier = product.supplier_name || supplierName(product.supplier_id);
    const permissions = currentPermissions();
    const gallery = productGallery(product);
    const activeImage = gallery.includes(state.selectedDetailImage) ? state.selectedDetailImage : gallery[0] || product.image_url || "";
    const activeThumb = activeImage
      ? `<img src="${escapeHtml(activeImage)}" alt="${escapeHtml(product.name)}">`
      : thumb;
    const heroImage = canViewImages() && activeImage
      ? `<div class="detail-media">
          <button class="hero-image image-zoom-trigger" type="button" data-image-zoom="${escapeHtml(activeImage)}" data-image-title="${escapeHtml(product.name)}" title="Ampliar imagem" aria-label="Ampliar imagem de ${escapeHtml(product.name)}">${activeThumb}</button>
          ${gallery.length > 1 ? `<div class="detail-thumbs" aria-label="Fotos do produto">${gallery.map((url, index) => `
            <button class="${url === activeImage ? "is-active" : ""}" type="button" data-detail-thumb="${escapeHtml(url)}" title="Ver foto ${index + 1}" aria-label="Ver foto ${index + 1}">
              <img src="${escapeHtml(url)}" alt="${escapeHtml(product.name)} foto ${index + 1}">
            </button>`).join("")}</div>` : ""}
        </div>`
      : `<div class="detail-media"><div class="hero-image">${thumb}</div></div>`;
    return `
      <section class="detail-layout">
        ${heroImage}
        <article class="detail-panel">
          <div class="detail-headline">
            <div>
              ${canViewStatus() ? statusControl(product) : ""}
              <h2>${escapeHtml(product.name)}</h2>
              <p>${escapeHtml(product.code)} · ${escapeHtml(productCategory(product))} / ${escapeHtml(productLine(product))}</p>
            </div>
            <div class="detail-actions">
              ${isEditor() ? `<button class="primary icon-only" data-edit-product="${product.id}" title="Editar produto" aria-label="Editar produto">${iconOnly("pencil", "Editar produto")}</button>` : ""}
              ${canDeleteProducts() ? `<button class="icon-only danger-action" data-delete-product="${product.id}" title="Excluir produto" aria-label="Excluir produto">${iconOnly("trash-2", "Excluir produto")}</button>` : ""}
              ${cartButton(product.id, "Adicionar ao carrinho")}
              ${canAddToCart() ? `<button class="icon-only" data-view="cart" title="Ver carrinho" aria-label="Ver carrinho">${iconOnly("shopping-bag", "Ver carrinho")}${cartCount() ? `<span class="cart-count">${cartCount()}</span>` : ""}</button>` : ""}
            </div>
          </div>
          ${permissions.canViewDescription ? `<p class="detail-description">${escapeHtml(product.description)}</p>` : ""}
          ${productPricePanel(product, computed, permissions)}
          <section class="product-facts">
            <h3>Dados do equipamento</h3>
            <div class="facts-grid">
              ${canViewSupplier() ? specItem("Fornecedor", supplier) : ""}
              ${specItem("Linha", productLine(product))}
              ${specItem("Categoria", productCategory(product))}
              ${permissions.canViewDimensions && product.dimensions ? specItem("Medidas", product.dimensions) : ""}
              ${permissions.canViewWeight && product.weight ? specItem("Peso", `${formatNumber(product.weight).replace(".00", "")} kg`) : ""}
              ${permissions.canViewMaterial && product.material ? specItem("Material", product.material) : ""}
            </div>
          </section>
          ${permissions.canViewTechnicalSpecs ? `<section class="spec-panel">
            <h3>Caracteristicas tecnicas</h3>
            ${formattedSpecs(product.technical_specs)}
          </section>` : ""}
          ${permissions.canViewTags ? `<div class="tags">${productTags(product, { publicOnly: publicTagMode() }).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        </article>
        <aside class="similar">
          <h3>Produtos semelhantes</h3>
          <div class="similar-grid">
            ${similarProducts(product).map(similarThumb).join("") || "<small>Nenhum semelhante ainda.</small>"}
          </div>
        </aside>
      </section>`;
  }

  function productPricePanel(product, computed, permissions = currentPermissions()) {
    const displayPrice = productDisplayPrice(product);
    const displayInfo = getDisplayPriceInfo(product);
    const role = normalizedRole();
    const purchaseUsd = role === "importador" ? Number(displayInfo.value || 0) : Number(computed.original_usd || 0);
    const purchaseBrl = purchaseUsd * Number(state.settings.usdToBrl || computed.exchange_rate || 0);
    const purchaseCny = purchaseUsd * Number(state.settings.usdToCny || 0);
    const purchaseLabel = role === "importador" ? "Preco importador China" : "Preco de compra China";
    const purchaseGroup = permissions.show_china_cost ? `
      <div class="purchase-price-group">
        <div class="price-group-head">
          <small>${escapeHtml(purchaseLabel)}</small>
          <strong>Conversoes</strong>
        </div>
        <div class="conversion-grid">
          ${priceCard("USD", money(purchaseUsd, "USD"))}
          ${priceCard("BRL", money(purchaseBrl, "BRL"))}
          ${priceCard("CNY", money(purchaseCny, "CNY"))}
        </div>
      </div>` : "";
    const valueCards = [
      permissions.show_nationalized_cost ? priceCard("Custo nacionalizado estimado", money(computed.nationalized_cost_brl), "emphasis-price") : "",
      permissions.show_final_price && displayPrice !== "Consulte valor" ? priceCard(displayInfo.label, displayPrice, "primary-price") : "",
    ].filter(Boolean).join("");
    if (!purchaseGroup && !valueCards) return "";
    return `<section class="price-panel">${purchaseGroup}${valueCards ? `<div class="price-grid">${valueCards}</div>` : ""}</section>`;
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
    const gallery = productGallery(product);
    const lineValue = productLine(product);
    const categoryValue = productCategory(product);
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
            ${field("line", "Linha", "text", false, lineValue)}
            ${selectField("category", "Categoria", categoryOrder.map((item) => [item, item]), categoryValue)}
            ${selectField("status", "Status", statuses.map((item) => [item, item]), product.status)}
            ${field("original_price", "Preco original", "number", false, product.original_price)}
            ${selectField("currency", "Moeda", currencies.map((item) => [item, item]), product.currency || "USD")}
            ${field("weight", "Peso kg", "number", false, product.weight)}
            ${field("dimensions", "Medidas", "text", false, product.dimensions)}
            ${field("material", "Material", "text", false, product.material)}
          </div>
          <label><span>Descricao</span><textarea name="description">${escapeHtml(product.description)}</textarea></label>
          <label><span>Especificacoes tecnicas</span><textarea name="technical_specs">${escapeHtml(product.technical_specs)}</textarea></label>
          <label><span>Tags separadas por virgula</span><input name="tags" value="${escapeHtml((product.tags || []).join(", "))}"></label>
          <section class="photo-editor">
            <div class="photo-upload-row">
              <label class="file-input"><span>Fotos do equipamento</span><input type="file" name="images" accept="image/*" multiple></label>
              <label><span>Ao salvar</span><select name="image_mode">
                <option value="append">Adicionar como novas fotos</option>
                <option value="replace_primary">Substituir foto principal</option>
              </select></label>
            </div>
            ${gallery.length ? `<div class="gallery-editor">${gallery.map((url, index) => `
              <div class="${index === 0 ? "is-primary" : ""}">
                <img src="${escapeHtml(url)}" alt="${escapeHtml(product.name)}">
                <span>${index === 0 ? "Principal" : `Foto ${index + 1}`}</span>
                <div class="gallery-actions">
                  ${index === 0 ? "" : `<button class="icon-only" type="button" data-primary-photo="${index}" title="Definir como principal" aria-label="Definir foto como principal">${iconOnly("star", "Definir como principal")}</button>`}
                  <button class="icon-only danger-action" type="button" data-remove-photo="${index}" title="Remover foto" aria-label="Remover foto">${iconOnly("trash-2", "Remover foto")}</button>
                </div>
              </div>`).join("")}</div>` : '<p class="hint">Nenhuma foto cadastrada. Envie uma imagem para criar a galeria.</p>'}
          </section>
          <footer class="modal-actions">
            <button type="button" data-close-modal>${withIcon("x", "Cancelar")}</button>
            <button class="primary" type="submit">${withIcon("save", "Salvar alteracoes")}</button>
          </footer>
        </form>
      </div>`;
  }

  function info(label, value, variant = "") {
    return `<div class="${escapeHtml(variant)}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value || "-")}</strong></div>`;
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
          ${field("line", "Linha")}
          ${selectField("category", "Categoria", categoryOrder.map((item) => [item, item]))}
          ${selectField("status", "Status", statuses.map((item) => [item, item]), "pendente")}
          ${field("original_price", "Preco original", "number")}
          ${selectField("currency", "Moeda", currencies.map((item) => [item, item]), "USD")}
          ${field("weight", "Peso kg", "number")}
          ${field("dimensions", "Dimensoes")}
          ${field("material", "Material")}
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
    if (!canManageSettings()) return accessDenied();
    return `
      <form class="form-panel settings-panel" id="settings-form">
        <h2>Configuracoes gerais</h2>
        <p class="hint">Esses valores alimentam os calculos de precificacao. Eles nao aparecem no detalhe do produto para o visualizador.</p>
        <div class="form-grid">
          ${field("usdToBrl", "Cambio USD/BRL", "number", true, state.settings.usdToBrl)}
          ${field("usdToCny", "Cambio USD/CNY", "number", true, state.settings.usdToCny)}
          ${field("multiplierFactor", "Fator nacionalizacao", "number", true, state.settings.multiplierFactor)}
          ${field("markupPercent", "Markup (%)", "number", true, state.settings.markupPercent)}
        </div>
        <h3>Regras de preco por perfil</h3>
        <p class="hint">Representante usa ajuste sobre o preco de venda Brasil. Importador usa markup sobre o preco de compra China.</p>
        <div class="form-grid">
          ${field("percentualRepresentante", "Percentual representante (%)", "number", true, state.settings.percentualRepresentante)}
          ${field("percentualImportador", "Percentual importador (%)", "number", true, state.settings.percentualImportador)}
        </div>
        <h3>Permissoes de acesso por perfil</h3>
        <p class="hint">Marque o que cada perfil pode ver ou fazer no catalogo. Esses controles tambem sao usados pelo Supabase para filtrar dados sensiveis.</p>
        ${permissionsMatrix()}
        <button class="primary icon-only" title="Salvar configuracoes" aria-label="Salvar configuracoes">${iconOnly("save", "Salvar configuracoes")}</button>
      </form>`;
  }

  function permissionsMatrix() {
    return `<div class="permission-matrix">
      ${profileOptions.map(([role, label]) => permissionRoleCard(role, label)).join("")}
    </div>`;
  }

  function permissionRoleCard(role, label) {
    const permissions = currentPermissions(role);
    const disabled = role === "admin" ? "disabled" : "";
    const priceOptions = listPriceOptionsForRole(role, permissions);
    const listPriceMode = normalizeListPriceMode(role, permissions.list_price_mode, permissions);
    const priceChoice = `
      <label class="permission-price-choice">
        <span>
          <strong>Preco nas listas/cards</strong>
          <small>Mostra apenas opcoes liberadas nas permissoes deste perfil.</small>
        </span>
        <select name="list_price_mode.${escapeHtml(role)}">
          ${priceOptions.map(([value, text]) => `<option value="${escapeHtml(value)}" ${value === listPriceMode ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}
        </select>
      </label>`;
    const rows = catalogPermissionDefs.map(([key, text, help]) => {
      const checked = permissions[key] ? "checked" : "";
      return `<label class="permission-row" title="${escapeHtml(help)}">
        <span><strong>${escapeHtml(text)}</strong><small>${escapeHtml(help)}</small></span>
        <input type="checkbox" name="perm.${escapeHtml(role)}.${escapeHtml(key)}" ${checked} ${disabled}>
      </label>`;
    }).join("");
    return `<details class="permission-card" ${role === "cliente" || role === "representante" || role === "importador" ? "open" : ""}>
      <summary>
        <span>${icon(roleIcon(role))}<strong>${escapeHtml(label)}</strong></span>
        <small>${escapeHtml(role)}</small>
      </summary>
      <div class="permission-list">
        ${role === "admin" ? `<p class="hint">Adm permanece com acesso total para evitar travar a administracao do sistema.</p>` : ""}
        ${priceChoice}
        ${rows}
      </div>
    </details>`;
  }

  function field(name, label, type, required, value) {
    return `<label><span>${label}</span><input ${required ? "required" : ""} type="${type || "text"}" step="0.01" name="${name}" value="${escapeHtml(value ?? "")}"></label>`;
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

  async function saveSupplier(form) {
    if (!isEditor()) return setMessage("Seu perfil permite apenas visualizar e montar carrinho.");
    if (isRemoteMode() && !state.session) return setMessage("Entre como Adm para salvar fornecedores no banco.");
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name?.trim()) return;
    if (!client || !state.session) {
      state.suppliers.unshift({ ...data, id: uid() });
      state.message = "Fornecedor salvo no modo demo.";
      render();
      return;
    }
    const response = await client.from(tables.suppliers).insert({ ...data, created_by: state.session.user.id });
    if (response.error) setMessage(response.error.message);
    else {
      state.message = "Fornecedor salvo.";
      await loadRemoteData();
    }
  }

  function usersPage() {
    if (!canManageUsers()) return accessDenied();
    const rows = state.userProfiles || [];
    return `
      <section class="form-panel users-panel">
        <div class="section-head">
          <div>
            <h2>Usuarios cadastrados</h2>
            <p class="hint">Controle quem acessa o catalogo. Novos cadastros entram como Cliente e podem ser promovidos pelo Adm.</p>
          </div>
          <button type="button" data-action="reload-users">${withIcon("refresh-cw", "Atualizar")}</button>
        </div>
        <div class="table-wrap users-table-wrap">
          <table class="users-table">
            <thead>
              <tr><th>Usuario</th><th>Tipo</th><th>Perfil</th><th>Status</th><th class="actions-col"></th></tr>
            </thead>
            <tbody>
              ${rows.map(userRow).join("") || `<tr><td colspan="5">Nenhum usuario cadastrado ainda.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function userRow(user) {
    const isSelf = user.id === state.session?.user?.id;
    const active = user.is_active !== false;
    const typeLabel = user.customer_type || (user.company_name ? "empresa" : "usuario");
    return `
      <tr class="${active ? "" : "is-disabled"}">
        <td>
          <div class="user-cell">
            <strong>${escapeHtml(user.full_name || user.email || "Usuario")}</strong>
            <small>${escapeHtml(user.email || "-")}${user.phone ? ` · ${escapeHtml(user.phone)}` : ""}</small>
            ${user.company_name ? `<small>${escapeHtml(user.company_name)}</small>` : ""}
          </div>
        </td>
        <td>${escapeHtml(typeLabel)}</td>
        <td>
          <label class="compact-select">
            <span class="sr-only">Perfil de ${escapeHtml(user.email || user.full_name || "usuario")}</span>
            <select data-user-role="${escapeHtml(user.id)}" ${isSelf ? "disabled" : ""}>
              ${profileOptions.map(([role, label]) => `<option value="${escapeHtml(role)}" ${role === user.role ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
            </select>
          </label>
        </td>
        <td><span class="status ${active ? "revisado" : "arquivado"}">${active ? "ativo" : "desativado"}</span></td>
        <td>
          <div class="row-actions">
            <button class="icon-only" data-user-save="${escapeHtml(user.id)}" title="Salvar perfil" aria-label="Salvar perfil" ${isSelf ? "disabled" : ""}>${iconOnly("save", "Salvar perfil")}</button>
            ${active
              ? `<button class="icon-only danger-action" data-user-deactivate="${escapeHtml(user.id)}" title="Desativar acesso" aria-label="Desativar acesso" ${isSelf ? "disabled" : ""}>${iconOnly("user-x", "Desativar acesso")}</button>`
              : `<button class="icon-only" data-user-activate="${escapeHtml(user.id)}" title="Reativar acesso" aria-label="Reativar acesso">${iconOnly("user-check", "Reativar acesso")}</button>`}
          </div>
        </td>
      </tr>`;
  }

  async function updateUserProfile(userId, changes) {
    if (!canManageUsers()) return setMessage("Apenas o perfil Adm pode gerenciar usuarios.");
    if (!client || !state.session) return setMessage("Entre como Adm para gerenciar usuarios no banco.");
    if (userId === state.session?.user?.id && (changes.is_active === false || (changes.role && changes.role !== "admin"))) {
      return setMessage("Para evitar bloqueio acidental, sua propria conta Adm nao pode ser rebaixada ou desativada por aqui.");
    }
    const payload = { ...changes, updated_at: new Date().toISOString() };
    if (payload.role) {
      const rule = state.roleRules?.[payload.role];
      if (rule?.id) payload.price_rule_id = rule.id;
    }
    const response = await client.from(tables.userProfiles).update(payload).eq("id", userId);
    if (response.error) return setMessage(response.error.message);
    state.message = "Usuario atualizado.";
    await loadRemoteData();
  }

  function selectedUserRole(userId) {
    return [...root.querySelectorAll("[data-user-role]")].find((input) => input.dataset.userRole === userId)?.value || "cliente";
  }

  async function saveProduct(form) {
    if (!isEditor()) return setMessage("Seu perfil permite apenas visualizar e montar carrinho.");
    if (isRemoteMode() && !state.session) return setMessage("Entre como Adm para cadastrar produtos no banco.");
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
      line: data.line,
      subcategory: data.line,
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
    const response = await client.from(tables.products).insert(payload).select().single();
    if (response.error) setMessage(response.error.message);
    else {
      state.selectedProductId = response.data.id;
      state.view = "product";
      state.message = "Produto salvo.";
      await loadRemoteData();
    }
  }

  function switchProfile(role) {
    if (!profileOptions.some(([value]) => value === role)) return;
    if (!allowDevProfileSwitcher) {
      state.message = "Migrador de perfil disponivel apenas no ambiente de desenvolvimento.";
      render();
      return;
    }
    if (isRemoteMode() && !state.session) {
      state.message = "Entre com email e senha antes de simular perfis no ambiente de desenvolvimento.";
      render();
      return;
    }
    state.devProfileRole = normalizedRole(role) === state.profileRole ? "" : normalizedRole(role);
    if (isDemoMode()) state.session = null;
    if (!isEditor() && ["new-product", "suppliers", "settings", "users"].includes(state.view)) state.view = "dashboard";
    state.message = "";
    render();
  }

  async function login(form) {
    if (!client) return;
    const data = Object.fromEntries(new FormData(form).entries());
    state.auth.email = data.email || "";
    state.auth.loading = true;
    render();
    try {
      const response = await withTimeout(client.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      }), 15000, "O login");
      state.auth.loading = false;
      if (response.error) {
        setMessage(authErrorMessage(response.error));
        return;
      }
      state.session = response.data.session;
      state.profileRole = fallbackRoleFromSession();
      state.view = "dashboard";
      state.message = "";
      render();
      try {
        await withTimeout(ensureUserProfile(), 12000, "A verificacao do perfil");
        await withTimeout(loadRemoteData(), 15000, "O carregamento dos produtos");
      } catch (error) {
        console.warn("Falha ao carregar dados apos login", error);
        state.profileRole = fallbackRoleFromSession();
        setMessage(`${error.message || "Nao foi possivel carregar todos os dados."} Voce ja esta conectado; tente atualizar em alguns segundos.`);
      }
    } catch (error) {
      state.auth.loading = false;
      setMessage(`${error.message || "Nao foi possivel entrar."} Tente novamente.`);
    } finally {
      state.auth.loading = false;
      state.authReady = true;
      render();
    }
  }

  async function signup(form) {
    if (!client) return;
    const data = Object.fromEntries(new FormData(form).entries());
    state.auth.email = data.email || "";
    if (data.password !== data.password_confirm) {
      setMessage("As senhas nao conferem.");
      return;
    }
    const passwordError = validateSignupPassword(data.password);
    if (passwordError) {
      setMessage(passwordError);
      return;
    }
    state.auth.loading = true;
    render();
    const response = await client.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: authRedirectUrl(),
        data: {
          full_name: data.full_name || "",
          company_name: data.company_name || "",
          customer_type: data.customer_type || "usuario",
          phone: data.phone || "",
          requested_role: "cliente",
        },
      },
    });
    state.auth.loading = false;
    if (response.error) {
      setMessage(authErrorMessage(response.error));
      return;
    }
    if (response.data.session) {
      state.session = response.data.session;
      await ensureUserProfile();
      await client.auth.signOut();
      state.session = null;
      state.profileRole = "cliente";
      state.devProfileRole = "";
      state.auth.mode = "login";
      state.message = "Conta criada com sucesso. Entre com seu email e senha.";
      await loadRemoteData();
      return;
    }
    state.auth.mode = "login";
    setMessage("Cadastro recebido. Verifique seu email para confirmar o acesso.");
  }

  async function logout() {
    if (!client) return;
    await client.auth.signOut();
    state.session = null;
    state.profileRole = "cliente";
    state.devProfileRole = "";
    if (["new-product", "suppliers", "settings", "users"].includes(state.view)) state.view = "dashboard";
    await loadRemoteData();
  }

  function accessDenied() {
    return `<section class="detail-panel"><h2>Acesso somente leitura</h2><p>Este perfil pode visualizar produtos e montar carrinho para orcamento. Alteracoes ficam restritas ao perfil Adm.</p><button class="primary icon-only" data-view="dashboard" title="Voltar aos produtos" aria-label="Voltar aos produtos">${iconOnly("arrow-left", "Voltar aos produtos")}</button></section>`;
  }

  function cartCount() {
    return state.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  function addToCart(productId) {
    if (!canAddToCart()) return setMessage("Este perfil nao possui permissao para montar carrinho.");
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    const existing = state.cart.find((item) => item.product_id === productId);
    if (existing) existing.quantity += 1;
    else state.cart.push({ product_id: productId, quantity: 1, note: "" });
    state.lastAddedProductId = productId;
    state.message = `${product.code || product.name} adicionado ao carrinho.`;
    render();
    window.setTimeout(() => {
      if (state.lastAddedProductId !== productId) return;
      state.lastAddedProductId = "";
      root.querySelectorAll(".cart-item.just-added").forEach((item) => item.classList.remove("just-added"));
    }, 900);
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
    if (!canAddToCart()) return accessDenied();
    const rows = state.cart.map((item) => ({ ...item, product: state.products.find((product) => product.id === item.product_id) })).filter((item) => item.product);
    const totalUsd = rows.reduce((sum, item) => sum + calc(item.product).original_usd * item.quantity, 0);
    const totalNationalized = rows.reduce((sum, item) => sum + calc(item.product).nationalized_cost_brl * item.quantity, 0);
    const totalSuggested = rows.reduce((sum, item) => sum + calc(item.product).suggested_sale_price * item.quantity, 0);
    const displayTotal = cartDisplayTotal(rows);
    const internalMode = canSeeCommercialData();
    return `
      <section class="cart-layout">
        <article class="detail-panel cart-panel">
          <header class="cart-head">
            <div>
              <h2>Carrinho de orcamento</h2>
              <p>${internalMode ? "Revise quantidades e valores antes de salvar, imprimir ou gerar PDF do orcamento." : "Revise as maquinas selecionadas e gere uma solicitacao para enviar ao atendimento."}</p>
            </div>
            <button type="button" data-view="dashboard">${withIcon("package-plus", "Adicionar itens")}</button>
          </header>
          ${rows.length ? `
            <div class="cart-list">
              ${rows.map(cartItem).join("")}
            </div>
          ` : '<p class="hint">Nenhum produto no carrinho ainda.</p>'}
        </article>
        <aside class="quote-summary">
          <h3>Resumo</h3>
          ${info("Itens", cartCount())}
          ${internalMode ? `${info("Total USD", money(totalUsd, "USD"))}
          ${isEditor() ? info("Nacionalizado", money(totalNationalized, "BRL")) : ""}
          ${info("Venda sugerida", money(totalSuggested, "BRL"), "summary-final")}` : info(displayTotal.label, displayTotal.hasPrice ? money(displayTotal.value, displayTotal.currency) : "Consulte valor", "summary-final")}
          <div class="summary-actions">
            <button class="primary icon-only" data-action="save-quote" title="Salvar orcamento" aria-label="Salvar orcamento" ${rows.length ? "" : "disabled"}>${iconOnly("save", "Salvar orcamento")}</button>
            <button class="primary icon-only" data-action="print-quote" title="Imprimir ou salvar PDF" aria-label="Imprimir ou salvar PDF" ${rows.length ? "" : "disabled"}>${iconOnly("printer", "Imprimir ou salvar PDF")}</button>
            <button class="icon-only danger-action" data-action="clear-cart" title="Limpar carrinho" aria-label="Limpar carrinho" ${rows.length ? "" : "disabled"}>${iconOnly("trash-2", "Limpar carrinho")}</button>
          </div>
        </aside>
      </section>
      ${savedQuotesPanel()}`;
  }

  function cartDisplayTotal(rows) {
    const prices = rows.map((item) => ({ ...getDisplayPriceInfo(item.product), quantity: item.quantity }));
    const first = prices[0];
    const sameCurrency = prices.every((item) => item.currency === first?.currency);
    return {
      label: first?.label || "Total",
      currency: sameCurrency ? first?.currency || "BRL" : "BRL",
      hasPrice: Boolean(rows.length) && prices.every((item) => item.hasPrice),
      value: sameCurrency ? prices.reduce((sum, item) => sum + item.value * item.quantity, 0) : 0,
    };
  }

  function quoteItemSnapshot(product, quantity) {
    const computed = calc(product);
    const display = getDisplayPriceInfo(product);
    return {
      code: product.code || "",
      name: product.name || "",
      category: productCategory(product),
      line: productLine(product),
      image_url: product.image_url || "",
      original_usd: computed.original_usd,
      nationalized_cost_brl: computed.nationalized_cost_brl,
      suggested_sale_price: computed.suggested_sale_price,
      display_value: display.value,
      display_currency: display.currency,
      display_label: display.label,
      quantity,
    };
  }

  function parseQuoteItemSnapshot(notes) {
    try {
      const parsed = JSON.parse(notes || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function savedQuoteItem(item) {
    const product = state.products.find((candidate) => candidate.id === item.product_id);
    const snapshot = parseQuoteItemSnapshot(item.notes);
    return {
      ...item,
      product,
      snapshot,
      quantity: Number(item.quantity || snapshot.quantity || 1),
    };
  }

  function quoteTotals(items = []) {
    return items.reduce((totals, item) => {
      const product = item.product;
      const snapshot = item.snapshot || {};
      const quantity = Number(item.quantity || 1);
      const computed = product ? calc(product) : {};
      totals.quantity += quantity;
      totals.usd += Number(item.unit_price_usd ?? snapshot.original_usd ?? computed.original_usd ?? 0) * quantity;
      totals.nationalized += Number(snapshot.nationalized_cost_brl ?? computed.nationalized_cost_brl ?? 0) * quantity;
      totals.sale += Number(snapshot.suggested_sale_price ?? computed.suggested_sale_price ?? 0) * quantity;
      return totals;
    }, { quantity: 0, usd: 0, nationalized: 0, sale: 0 });
  }

  function quoteTitle(quote) {
    return quote.quote_number || `Orcamento ${new Date(quote.created_at).toLocaleDateString("pt-BR")}`;
  }

  function savedQuotesPanel() {
    if (!state.session) return "";
    const quotes = state.savedQuotes || [];
    return `
      <article class="detail-panel saved-quotes-panel">
        <div class="section-head">
          <div>
            <h2>Orcamentos salvos</h2>
            <p class="hint">Cada usuario visualiza apenas os orcamentos vinculados a sua propria conta.</p>
          </div>
          <button type="button" data-action="reload-quotes">${withIcon("refresh-cw", "Atualizar")}</button>
        </div>
        ${quotes.length ? `<div class="saved-quotes-list">${quotes.map(savedQuoteCard).join("")}</div>` : `<p class="hint">Nenhum orcamento salvo ainda.</p>`}
      </article>`;
  }

  function savedQuoteCard(quote) {
    const totals = quoteTotals(quote.items);
    const firstItems = quote.items.slice(0, 3).map((item) => {
      const product = item.product;
      const snapshot = item.snapshot || {};
      return `${item.quantity}x ${snapshot.code || product?.code || "-"} ${snapshot.name || product?.name || "Produto"}`;
    });
    return `
      <article class="saved-quote-card">
        <div>
          <small>${new Date(quote.created_at).toLocaleString("pt-BR")}</small>
          <strong>${escapeHtml(quoteTitle(quote))}</strong>
          <p>${escapeHtml(firstItems.join(" · ") || "Sem itens")}${quote.items.length > 3 ? ` · +${quote.items.length - 3}` : ""}</p>
        </div>
        <div class="saved-quote-metrics">
          <span>${totals.quantity} itens</span>
          <span>${money(totals.usd, "USD")}</span>
          ${isEditor() ? `<span>${money(totals.sale, "BRL")}</span>` : ""}
        </div>
        <div class="row-actions">
          <button class="icon-only" data-quote-open="${escapeHtml(quote.id)}" title="Reabrir no carrinho" aria-label="Reabrir no carrinho">${iconOnly("shopping-cart", "Reabrir no carrinho")}</button>
          <button class="icon-only" data-quote-print="${escapeHtml(quote.id)}" title="Imprimir ou salvar PDF" aria-label="Imprimir ou salvar PDF">${iconOnly("printer", "Imprimir ou salvar PDF")}</button>
          <button class="icon-only danger-action" data-quote-delete="${escapeHtml(quote.id)}" title="Excluir orcamento salvo" aria-label="Excluir orcamento salvo">${iconOnly("trash-2", "Excluir orcamento salvo")}</button>
        </div>
      </article>`;
  }

  function floatingCartButton() {
    if (!canAddToCart() || !cartCount() || state.view === "cart") return "";
    return `<button class="floating-cart icon-only" data-view="cart" title="Ver carrinho" aria-label="Ver carrinho">${iconOnly("shopping-cart", "Ver carrinho")}<span class="cart-count">${cartCount()}</span></button>`;
  }

  function cartItem(item) {
    const product = item.product;
    const computed = calc(product);
    const thumb = productThumb(product);
    return `
      <article class="cart-item ${state.lastAddedProductId === product.id ? "just-added" : ""}">
        <div class="row-thumb">${thumb}</div>
        <div class="cart-product-info">
          <strong><span>${escapeHtml(product.code)}</span>${escapeHtml(product.name)}</strong>
          <div class="cart-meta">
            <span>${escapeHtml(productCategory(product))}</span>
            <span>${escapeHtml(productLine(product))}</span>
            <span>${canSeeCommercialData() ? `${money(computed.original_usd, "USD")} un.` : escapeHtml(productDisplayPrice(product))}</span>
          </div>
        </div>
        <label class="qty-control"><span>Qtd</span><input type="number" min="1" value="${item.quantity}" data-cart-qty="${product.id}" aria-label="Quantidade"></label>
        <div class="cart-total">
          <small>Total</small>
          <strong>${canSeeCommercialData() ? money(computed.original_usd * item.quantity, "USD") : escapeHtml(getDisplayPriceInfo(product).hasPrice ? money(getDisplayPriceInfo(product).value * item.quantity, getDisplayPriceInfo(product).currency) : productDisplayPrice(product))}</strong>
          ${isEditor() ? `<small>Nacionalizado ${money(computed.nationalized_cost_brl * item.quantity, "BRL")}</small>` : ""}
        </div>
        <div class="cart-item-actions">
          <button class="icon-only" data-product="${product.id}" title="Ver detalhes" aria-label="Ver detalhes">${iconOnly("eye", "Ver detalhes")}</button>
          <button class="icon-only" data-cart-remove="${product.id}" title="Remover" aria-label="Remover">${iconOnly("trash-2", "Remover")}</button>
        </div>
      </article>`;
  }

  function quoteText() {
    const lines = [!canSeeCommercialData() ? "Solicitacao de orcamento - itens selecionados" : "Orcamento - itens selecionados", ""];
    for (const item of state.cart) {
      const product = state.products.find((candidate) => candidate.id === item.product_id);
      if (!product) continue;
      const computed = calc(product);
      if (!canSeeCommercialData()) lines.push(`${item.quantity}x ${product.code} - ${product.name} | ${productCategory(product)} | ${productDisplayPrice(product)}`);
      else lines.push(`${item.quantity}x ${product.code} - ${product.name} | ${money(computed.original_usd, "USD")} un. | ${money(computed.original_usd * item.quantity, "USD")} total`);
    }
    return lines.join("\n");
  }

  function quoteRowsFromCart() {
    return state.cart.map((item) => {
      const product = state.products.find((candidate) => candidate.id === item.product_id);
      if (!product) return null;
      return {
        product,
        quantity: item.quantity,
        snapshot: quoteItemSnapshot(product, item.quantity),
      };
    }).filter(Boolean);
  }

  function quoteRowsFromSaved(quote) {
    return (quote?.items || []).map((item) => ({
      product: item.product,
      quantity: item.quantity,
      snapshot: item.snapshot || {},
      unit_price_usd: item.unit_price_usd,
    }));
  }

  function printQuote(title, rows) {
    if (!rows.length) return;
    const totals = quoteTotals(rows.map((row) => ({
      product: row.product,
      quantity: row.quantity,
      unit_price_usd: row.unit_price_usd ?? row.snapshot?.original_usd,
      snapshot: row.snapshot,
    })));
    const htmlRows = rows.map((row) => {
      const product = row.product;
      const snapshot = row.snapshot || {};
      const code = snapshot.code || product?.code || "-";
      const name = snapshot.name || product?.name || "Produto";
      const category = snapshot.category || (product ? productCategory(product) : "-");
      const line = snapshot.line || (product ? productLine(product) : "-");
      const unitUsd = Number(row.unit_price_usd ?? snapshot.original_usd ?? (product ? calc(product).original_usd : 0));
      return `<tr><td>${escapeHtml(code)}</td><td>${escapeHtml(name)}<br><small>${escapeHtml(category)} · ${escapeHtml(line)}</small></td><td>${row.quantity}</td><td>${money(unitUsd, "USD")}</td><td>${money(unitUsd * row.quantity, "USD")}</td></tr>`;
    }).join("");
    const popup = window.open("", "_blank", "width=980,height=760");
    if (!popup) return setMessage("O navegador bloqueou a janela de impressao. Libere pop-ups para imprimir ou salvar PDF.");
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>
      body{font-family:Arial,"Segoe UI",sans-serif;color:#101820;margin:32px}
      h1{margin:0 0 6px;font-size:24px} p{color:#526174;margin:0 0 22px}
      table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #d8e1e6;padding:10px;text-align:left;vertical-align:top}
      th{font-size:12px;text-transform:uppercase;color:#526174} td:nth-child(3),td:nth-child(4),td:nth-child(5){white-space:nowrap}
      small{color:#687789}.totals{margin-top:22px;display:grid;gap:8px;justify-content:end}.totals div{border:1px solid #d8e1e6;padding:10px 14px;border-radius:8px;min-width:240px}
      strong{font-size:18px}@media print{body{margin:18mm}.no-print{display:none}}
    </style></head><body><h1>${escapeHtml(title)}</h1><p>Gerado em ${new Date().toLocaleString("pt-BR")}</p><table><thead><tr><th>Codigo</th><th>Produto</th><th>Qtd</th><th>Unit. USD</th><th>Total USD</th></tr></thead><tbody>${htmlRows}</tbody></table><section class="totals"><div><small>Itens</small><br><strong>${totals.quantity}</strong></div><div><small>Total USD</small><br><strong>${money(totals.usd, "USD")}</strong></div>${isEditor() ? `<div><small>Venda sugerida</small><br><strong>${money(totals.sale, "BRL")}</strong></div>` : ""}</section><button class="no-print" onclick="window.print()">Imprimir / salvar PDF</button><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
    popup.document.close();
  }

  async function saveSettings(form) {
    if (!canManageSettings()) return setMessage("Apenas o perfil Adm pode alterar configuracoes.");
    if (isRemoteMode() && !state.session) return setMessage("Entre como Adm para alterar configuracoes no banco.");
    const data = Object.fromEntries(new FormData(form).entries());
    const percentualRepresentante = Number(data.percentualRepresentante || 0);
    const percentualImportador = Number(data.percentualImportador || 0);
    if (percentualRepresentante <= -100) return setMessage("O percentual do Representante precisa manter o preco acima de zero.");
    if (percentualImportador < 0) return setMessage("O percentual do Importador nao pode ser negativo.");
    state.settings = {
      usdToBrl: Number(data.usdToBrl || state.settings.usdToBrl),
      usdToCny: Number(data.usdToCny || state.settings.usdToCny),
      multiplierFactor: Number(data.multiplierFactor || state.settings.multiplierFactor),
      markupPercent: Number(data.markupPercent || state.settings.markupPercent),
      percentualRepresentante,
      percentualImportador,
    };
    const permissionRows = collectPermissionRows(form);
    state.roleRules = { ...state.roleRules, ...Object.fromEntries(permissionRows.map((row) => [row.role, { ...(state.roleRules[row.role] || {}), ...row }])) };
    syncConverterFromUsd(state.converter.usd);
    window.localStorage?.setItem("gr8-settings", JSON.stringify(state.settings));
    if (client && state.session) {
      const numericRows = numericSettingKeys.map((key) => ({ key, value: state.settings[key] }));
      const [settingsResponse, rulesResponse] = await Promise.all([
        client.from(tables.settings).upsert(numericRows),
        client.from(tables.priceRules).upsert(permissionRows, { onConflict: "role" }),
      ]);
      if (settingsResponse.error) return setMessage(settingsResponse.error.message);
      if (rulesResponse.error) return setMessage(rulesResponse.error.message);
    }
    setMessage("Configuracoes gerais atualizadas.");
  }

  function collectPermissionRows(form) {
    return profileOptions.map(([role, label]) => {
      const current = currentPermissions(role);
      const row = {
        role,
        name: `${label} Padrao`,
        updated_at: new Date().toISOString(),
      };
      for (const [key] of catalogPermissionDefs) {
        const input = form.querySelector(`[name="perm.${role}.${key}"]`);
        row[key] = input ? input.checked : Boolean(current[key]);
      }
      const nextPermissions = { ...current, ...row };
      const modeInput = form.querySelector(`[name="list_price_mode.${role}"]`);
      row.list_price_mode = normalizeListPriceMode(role, modeInput?.value || current.list_price_mode, nextPermissions);
      row.show_resale_price = role === "representante" ? row.show_final_price : Boolean(current.show_resale_price);
      row.can_delete_products = role === "admin" && row.can_edit_products;
      row.can_approve_imports = role === "admin";
      row.can_view_audit = role === "admin" || role === "comercial_interno";
      return row;
    });
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

  function productGallery(product) {
    return productGalleryItems(product).map((item) => item.url);
  }

  function normalizeGallery(gallery) {
    return [...new Set((gallery || []).filter(Boolean))];
  }

  function productGalleryItems(product) {
    const sourceItems = Array.isArray(product?.galleryItems) && product.galleryItems.length
      ? product.galleryItems
      : (product?.gallery || []).map((url) => ({ url, path: url }));
    const items = [...sourceItems, product?.image_url ? { url: product.image_url, path: product.image_url } : null]
      .filter((item) => item?.url);
    const seen = new Set();
    return items.filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
  }

  function normalizeGalleryItems(items) {
    const seen = new Set();
    return (items || []).filter((item) => {
      if (!item?.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
  }

  function safeStorageFileName(name) {
    const fallback = "produto.jpg";
    return String(name || fallback)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || fallback;
  }

  async function syncProductImages(productId, galleryItems) {
    if (!client || !state.session) return;
    const payload = normalizeGalleryItems(galleryItems).map((item, index) => ({
      public_url: item.url,
      file_path: item.path || item.url,
      is_primary: index === 0,
    }));
    const response = await client.rpc("catalog_sync_product_images", {
      p_product_id: productId,
      p_images: payload,
    });
    if (response.error) throw response.error;
  }

  async function saveEditedProduct(form) {
    if (!isEditor()) return setMessage("Apenas o perfil Adm pode editar produtos.");
    if (isRemoteMode() && !state.session) return setMessage("Entre como Adm para editar produtos no banco.");
    const product = state.products.find((item) => item.id === state.editingProductId);
    if (!product) return;
    const data = Object.fromEntries(new FormData(form).entries());
    const files = [...(form.elements.images?.files || [])];
    const canSave = await showConfirmDialog({
      title: "Salvar alteracoes?",
      message: `As alteracoes de ${product.code || product.name} serao aplicadas ao produto.`,
      confirmLabel: "Salvar alteracoes",
    });
    if (!canSave) return;
    let uploadedImageItems = [];

    if (client && state.session && files.length) {
      for (const file of files) {
        const path = `${state.session.user.id}/${product.id}/${uid()}-${safeStorageFileName(file.name)}`;
        const upload = await client.storage.from(buckets.productImages).upload(path, file);
        if (upload.error) {
          setMessage(`Falha ao enviar foto: ${upload.error.message}`);
          return;
        }
        const publicUrl = client.storage.from(buckets.productImages).getPublicUrl(path).data.publicUrl;
        uploadedImageItems.push({ url: publicUrl, path });
      }
    } else if (files.length) {
      uploadedImageItems = (await filesToDataUrls(files)).map((url) => ({ url, path: url }));
    }

    const currentGalleryItems = productGalleryItems(product);
    const galleryItems = normalizeGalleryItems(data.image_mode === "replace_primary" && uploadedImageItems.length
      ? [...uploadedImageItems, ...currentGalleryItems.slice(1)]
      : [...currentGalleryItems, ...uploadedImageItems]);
    const gallery = galleryItems.map((item) => item.url);
    product.name = data.name.trim();
    product.code = data.code.trim();
    product.supplier_id = data.supplier_id || null;
    product.category = data.category.trim();
    product.line = data.line.trim();
    product.subcategory = data.line.trim();
    product.description = data.description.trim();
    product.technical_specs = data.technical_specs.trim();
    product.original_price = Number(data.original_price || 0);
    product.currency = data.currency || "USD";
    product.weight = data.weight ? Number(data.weight) : null;
    product.dimensions = data.dimensions.trim();
    product.material = data.material.trim();
    product.status = data.status || "pendente";
    product.tags = splitTags(data.tags);
    product.gallery = gallery;
    product.galleryItems = galleryItems;
    product.image_url = gallery[0] || product.image_url || "";

    if (client && state.session) {
      const response = await client.from(tables.products).update({
        name: product.name,
        code: product.code,
        supplier_id: product.supplier_id,
        category: product.category,
        line: product.line,
        subcategory: product.line,
        description: product.description,
        technical_specs: product.technical_specs,
        original_price: product.original_price,
        currency: product.currency,
        weight: product.weight,
        dimensions: product.dimensions,
        material: product.material,
        status: product.status,
        tags: product.tags,
        image_url: product.image_url,
      }).eq("id", product.id);
      if (response.error) {
        setMessage(response.error.message);
        return;
      }
      try {
        await syncProductImages(product.id, galleryItems);
      } catch (error) {
        setMessage(`Produto salvo, mas a galeria nao foi sincronizada: ${error.message}`);
        return;
      }
    }

    state.editingProductId = "";
    state.message = `${product.code || product.name} atualizado com sucesso.${uploadedImageItems.length ? ` ${uploadedImageItems.length} foto(s) adicionada(s).` : ""}`;
    render();
  }

  function removeProductPhoto(index) {
    const product = state.products.find((item) => item.id === state.editingProductId);
    if (!product) return;
    const galleryItems = productGalleryItems(product);
    galleryItems.splice(index, 1);
    product.galleryItems = normalizeGalleryItems(galleryItems);
    product.gallery = product.galleryItems.map((item) => item.url);
    product.image_url = product.gallery[0] || "";
    render();
  }

  function setPrimaryProductPhoto(index) {
    const product = state.products.find((item) => item.id === state.editingProductId);
    if (!product) return;
    const gallery = productGalleryItems(product);
    const [selected] = gallery.splice(index, 1);
    if (!selected) return;
    product.galleryItems = normalizeGalleryItems([selected, ...gallery]);
    product.gallery = product.galleryItems.map((item) => item.url);
    product.image_url = product.gallery[0] || "";
    render();
  }

  async function updateProductStatus(productId, status, control) {
    if (!isEditor()) return setMessage("Apenas Adm pode alterar status.");
    if (!statuses.includes(status)) return;
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    const previousStatus = product.status;
    if (status === previousStatus) return;
    const confirmed = await showConfirmDialog({
      title: "Alterar status?",
      message: `Alterar ${product.code || product.name} de "${previousStatus}" para "${status}"?`,
      confirmLabel: "Alterar status",
    });
    if (!confirmed) {
      if (control) control.value = previousStatus;
      return;
    }
    product.status = status;
    if (client && state.session) {
      const response = await client.from(tables.products).update({ status, updated_at: new Date().toISOString() }).eq("id", productId);
      if (response.error) {
        product.status = previousStatus;
        setMessage(response.error.message);
        return;
      }
    }
    state.message = `Status de ${product.code || product.name} alterado para ${status}.`;
    render();
  }

  async function deleteProduct(productId) {
    if (!canDeleteProducts()) return setMessage("Apenas Adm pode excluir produtos.");
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    const confirmed = await showConfirmDialog({
      title: "Excluir produto?",
      message: `${product.code || product.name} sera arquivado e deixara de aparecer nas listas, cards, buscas e carrinho.`,
      confirmLabel: "Excluir produto",
      danger: true,
    });
    if (!confirmed) return;

    if (client && state.session) {
      const response = await client.from(tables.products).update({
        status: "arquivado",
        updated_at: new Date().toISOString(),
      }).eq("id", productId);
      if (response.error) {
        setMessage(response.error.message);
        return;
      }
    }

    state.products = state.products.filter((item) => item.id !== productId);
    state.cart = state.cart.filter((item) => item.product_id !== productId);
    if (state.selectedProductId === productId) state.selectedProductId = state.products[0]?.id || "";
    closeProductDetails();
    state.message = `${product.code || product.name} excluido do catalogo.`;
    render();
  }

  async function saveQuote() {
    if (!state.cart.length) return;
    if (!client || !state.session) {
      setMessage(client ? "Entre na sua conta para salvar o orcamento." : "Orcamento montado no modo demo. Conecte ao Supabase para salvar no banco.");
      return;
    }
    const quoteNumber = `ORC-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
    const rows = quoteRowsFromCart();
    const totals = quoteTotals(rows.map((row) => ({ product: row.product, quantity: row.quantity, snapshot: row.snapshot, unit_price_usd: row.snapshot.original_usd })));
    const quote = await client.from(tables.quotes).insert({
      quote_number: quoteNumber,
      status: "draft",
      currency: "USD",
      notes: `Itens: ${totals.quantity}. Total USD: ${totals.usd.toFixed(2)}. Criado pelo carrinho de produtos.`,
      created_by: state.session.user.id,
    }).select().single();
    if (quote.error) {
      setMessage(quote.error.message);
      return;
    }
    const items = rows.map((row) => {
      const product = row.product;
      const computed = calc(product);
      return {
        quote_id: quote.data.id,
        product_id: product.id,
        quantity: row.quantity,
        unit_price_usd: computed.original_usd,
        exchange_rate: product?.exchange_rate || null,
        notes: JSON.stringify(row.snapshot),
      };
    });
    const savedItems = await client.from(tables.quoteItems).insert(items);
    if (savedItems.error) {
      setMessage(savedItems.error.message);
      return;
    }
    state.cart = [];
    await loadSavedQuotes();
    state.message = `${quoteNumber} salvo no Supabase.`;
    render();
  }

  async function reopenSavedQuote(quoteId) {
    const quote = state.savedQuotes.find((item) => item.id === quoteId);
    if (!quote) return;
    if (state.cart.length) {
      const confirmed = await showConfirmDialog({
        title: "Substituir carrinho?",
        message: "O carrinho atual sera substituido pelos itens deste orcamento salvo.",
        confirmLabel: "Substituir carrinho",
      });
      if (!confirmed) return;
    }
    const restored = quote.items
      .filter((item) => item.product || state.products.some((product) => product.id === item.product_id))
      .map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity || 1),
      }));
    state.cart = restored;
    state.message = `${quoteTitle(quote)} reaberto no carrinho.`;
    render();
  }

  function printSavedQuote(quoteId) {
    const quote = state.savedQuotes.find((item) => item.id === quoteId);
    if (!quote) return;
    printQuote(quoteTitle(quote), quoteRowsFromSaved(quote));
  }

  async function deleteSavedQuote(quoteId) {
    const quote = state.savedQuotes.find((item) => item.id === quoteId);
    if (!quote) return;
    const confirmed = await showConfirmDialog({
      title: "Excluir orcamento salvo?",
      message: `${quoteTitle(quote)} e seus itens salvos serao removidos.`,
      confirmLabel: "Excluir orcamento",
      danger: true,
    });
    if (!confirmed) return;
    if (!client || !state.session) return setMessage("Entre na sua conta para excluir orcamentos salvos.");
    const response = await client.from(tables.quotes).delete().eq("id", quoteId).eq("created_by", state.session.user.id);
    if (response.error) return setMessage(response.error.message);
    state.savedQuotes = state.savedQuotes.filter((item) => item.id !== quoteId);
    state.message = `${quoteTitle(quote)} excluido.`;
    render();
  }

  function bindResultEvents(scope) {
    scope.querySelectorAll("[data-product]").forEach((button) => button.addEventListener("click", () => openProductDetails(button.dataset.product)));
    scope.querySelectorAll("[data-cart-add]").forEach((button) => button.addEventListener("click", () => addToCart(button.dataset.cartAdd)));
    scope.querySelectorAll("[data-edit-product]").forEach((button) => button.addEventListener("click", () => openEditProduct(button.dataset.editProduct)));
    scope.querySelectorAll("[data-delete-product]").forEach((button) => button.addEventListener("click", () => deleteProduct(button.dataset.deleteProduct)));
    scope.querySelectorAll("[data-status-product]").forEach((selectEl) => selectEl.addEventListener("change", (event) => {
      event.stopPropagation();
      updateProductStatus(selectEl.dataset.statusProduct, selectEl.value, selectEl);
    }));
    scope.querySelectorAll("[data-view-mode]").forEach((button) => button.addEventListener("click", () => { state.productViewMode = button.dataset.viewMode; refreshProductResults(); }));
    scope.querySelectorAll("[data-clear-filter]").forEach((button) => button.addEventListener("click", () => clearFilter(button.dataset.clearFilter)));
    scope.querySelectorAll("[data-load-more-products]").forEach((button) => button.addEventListener("click", loadMoreProducts));
  }

  function setupProductLoadObserver() {
    productLoadObserver?.disconnect();
    const sentinel = root.querySelector("[data-load-more-sentinel]");
    if (!sentinel || !("IntersectionObserver" in window)) return;
    productLoadObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreProducts();
    }, { rootMargin: "640px 0px" });
    productLoadObserver.observe(sentinel);
  }

  function openProductDetails(productId, detailImage = "") {
    state.selectedProductId = productId;
    state.selectedDetailImage = detailImage;
    closeProductDetails();
    root.insertAdjacentHTML("beforeend", productDetailsModal());
    document.addEventListener("keydown", handleDetailModalKeydown);
    bindDetailModalEvents();
    refreshIcons();
  }

  function closeProductDetails() {
    root.querySelector(".product-detail-modal")?.remove();
    document.removeEventListener("keydown", handleDetailModalKeydown);
  }

  function handleDetailModalKeydown(event) {
    if (event.key !== "Escape") return;
    if (root.querySelector(".image-zoom-modal")) {
      event.preventDefault();
      closeImageZoom();
      return;
    }
    if (!root.querySelector(".product-detail-modal")) return;
    event.preventDefault();
    closeProductDetails();
  }

  function openImageZoom(src, title) {
    if (!src) return;
    closeImageZoom();
    root.insertAdjacentHTML("beforeend", `
      <div class="modal-backdrop image-zoom-modal" data-close-image-zoom>
        <section class="image-zoom-panel" aria-label="Imagem ampliada">
          <button class="icon-only image-zoom-close" type="button" data-close-image-zoom title="Fechar imagem" aria-label="Fechar imagem">${iconOnly("x", "Fechar imagem")}</button>
          <img src="${escapeHtml(src)}" alt="${escapeHtml(title || "Imagem do produto")}">
        </section>
      </div>`);
    refreshIcons();
    root.querySelectorAll("[data-close-image-zoom]").forEach((element) => element.addEventListener("click", (event) => {
      if (event.target === element || element.tagName === "BUTTON") closeImageZoom();
    }));
    document.addEventListener("keydown", handleImageZoomKeydown);
  }

  function closeImageZoom() {
    root.querySelector(".image-zoom-modal")?.remove();
    document.removeEventListener("keydown", handleImageZoomKeydown);
  }

  function handleImageZoomKeydown(event) {
    if (event.key !== "Escape") return;
    if (!root.querySelector(".image-zoom-modal")) return;
    event.preventDefault();
    closeImageZoom();
  }

  function updateImageZoomAvailability(scope) {
    scope.querySelectorAll("[data-image-zoom]").forEach((button) => {
      const img = button.querySelector("img");
      if (!img) return;
      const check = () => {
        const canZoom = img.naturalWidth > button.clientWidth + 8 || img.naturalHeight > button.clientHeight + 8;
        button.classList.toggle("can-zoom", canZoom);
        button.classList.toggle("no-zoom", !canZoom);
        button.title = canZoom ? "Ampliar imagem" : "Imagem ja esta no tamanho disponivel";
      };
      if (img.complete) check();
      else img.addEventListener("load", check, { once: true });
    });
  }

  function bindDetailModalEvents() {
    const modal = root.querySelector(".product-detail-modal");
    if (!modal) return;
    modal.querySelectorAll("[data-close-detail]").forEach((element) => element.addEventListener("click", (event) => {
      if (event.target === element || element.tagName === "BUTTON") closeProductDetails();
    }));
    modal.querySelector("[data-detail-modal-panel]")?.addEventListener("click", (event) => event.stopPropagation());
    bindResultEvents(modal);
    updateImageZoomAvailability(modal);
    modal.querySelectorAll("[data-image-zoom]").forEach((button) => button.addEventListener("click", () => {
      if (button.classList.contains("no-zoom")) return;
      openImageZoom(button.dataset.imageZoom, button.dataset.imageTitle);
    }));
    modal.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { state.view = button.dataset.view; closeProductDetails(); render(); }));
    modal.querySelectorAll("[data-detail-thumb]").forEach((button) => button.addEventListener("click", () => {
      openProductDetails(state.selectedProductId, button.dataset.detailThumb);
    }));
  }

  function bindEvents() {
    root.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { state.view = button.dataset.view; render(); }));
    bindResultEvents(root);
    root.querySelectorAll("[data-cart-remove]").forEach((button) => button.addEventListener("click", () => removeFromCart(button.dataset.cartRemove)));
    root.querySelectorAll("[data-cart-qty]").forEach((input) => input.addEventListener("input", () => updateCart(input.dataset.cartQty, input.value)));
    root.querySelectorAll("[data-converter]").forEach((input) => input.addEventListener("input", () => updateConverter(input.dataset.converter, input.value)));
    root.querySelector("[data-action='refresh-rates']")?.addEventListener("click", () => refreshRates());
    root.querySelector("[data-action='reload-users']")?.addEventListener("click", () => loadRemoteData());
    root.querySelector("[data-action='reload-quotes']")?.addEventListener("click", async () => { await loadSavedQuotes(); render(); });
    root.querySelectorAll("[data-user-save]").forEach((button) => button.addEventListener("click", () => updateUserProfile(button.dataset.userSave, { role: selectedUserRole(button.dataset.userSave), is_active: true })));
    root.querySelectorAll("[data-user-deactivate]").forEach((button) => button.addEventListener("click", () => updateUserProfile(button.dataset.userDeactivate, { is_active: false })));
    root.querySelectorAll("[data-user-activate]").forEach((button) => button.addEventListener("click", () => updateUserProfile(button.dataset.userActivate, { role: selectedUserRole(button.dataset.userActivate), is_active: true })));
    root.querySelector("[data-clear-message]")?.addEventListener("click", () => { state.message = ""; render(); });
    root.querySelector("#search-input")?.addEventListener("input", (event) => { state.query = event.target.value; resetProductDisplayLimit(); scheduleProductResultsRefresh(); });
    root.querySelectorAll("[data-filter]").forEach((input) => input.addEventListener("input", (event) => { state.filters[input.dataset.filter] = event.target.value; resetProductDisplayLimit(); scheduleProductResultsRefresh(); }));
    root.querySelector("[data-clear-filters]")?.addEventListener("click", clearFilters);
    root.querySelectorAll("[data-role-switch]").forEach((button) => button.addEventListener("click", () => switchProfile(button.dataset.roleSwitch)));
    root.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => {
      state.auth.mode = button.dataset.authMode;
      state.message = "";
      render();
    }));
    root.querySelector("[data-auth-customer-type]")?.addEventListener("input", (event) => {
      state.auth.customerType = event.target.value || "usuario";
      render();
    });
    const passwordInput = root.querySelector("input[name='password']");
    const passwordConfirmInput = root.querySelector("input[name='password_confirm']");
    const passwordMatchHint = root.querySelector("[data-password-match]");
    const passwordRules = root.querySelector("[data-password-rules]");
    function updatePasswordRules() {
      if (!passwordInput || !passwordRules) return;
      const rules = passwordRuleState(passwordInput.value);
      const hasValue = Boolean(passwordInput.value);
      Object.entries(rules).forEach(([rule, passed]) => {
        const item = passwordRules.querySelector(`[data-password-rule="${rule}"]`);
        item?.classList.toggle("passed", passed);
        item?.classList.toggle("missing", hasValue && !passed);
      });
      const invalid = hasValue && Object.values(rules).some((passed) => !passed);
      passwordInput.setCustomValidity(invalid ? validateSignupPassword(passwordInput.value) : "");
      passwordInput.classList.toggle("field-error", invalid);
    }
    function updatePasswordMatch() {
      if (!passwordInput || !passwordConfirmInput || !passwordMatchHint) return;
      const mismatch = Boolean(passwordConfirmInput.value) && passwordInput.value !== passwordConfirmInput.value;
      passwordConfirmInput.setCustomValidity(mismatch ? "As senhas nao conferem." : "");
      passwordConfirmInput.classList.toggle("field-error", mismatch);
      passwordMatchHint.classList.toggle("visible", mismatch);
    }
    passwordInput?.addEventListener("input", () => {
      updatePasswordRules();
      updatePasswordMatch();
    });
    passwordConfirmInput?.addEventListener("input", updatePasswordMatch);
    updatePasswordRules();
    root.querySelectorAll("[data-password-toggle]").forEach((button) => button.addEventListener("click", () => {
      const input = root.querySelector(`input[name="${button.dataset.passwordToggle}"]`);
      if (!input) return;
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      button.title = isHidden ? "Ocultar senha" : "Mostrar senha";
      button.setAttribute("aria-label", button.title);
    }));
    root.querySelector("#login-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.auth.mode === "signup") signup(event.currentTarget);
      else login(event.currentTarget);
    });
    root.querySelector("[data-action='logout']")?.addEventListener("click", logout);
    root.querySelector("#supplier-form")?.addEventListener("submit", (event) => { event.preventDefault(); saveSupplier(event.currentTarget); });
    root.querySelector("#product-form")?.addEventListener("submit", (event) => { event.preventDefault(); saveProduct(event.currentTarget); });
    root.querySelector("#settings-form")?.addEventListener("submit", (event) => { event.preventDefault(); saveSettings(event.currentTarget); });
    root.querySelector("#edit-product-form")?.addEventListener("submit", (event) => { event.preventDefault(); saveEditedProduct(event.currentTarget); });
    root.querySelectorAll("[data-remove-photo]").forEach((button) => button.addEventListener("click", () => removeProductPhoto(Number(button.dataset.removePhoto))));
    root.querySelectorAll("[data-primary-photo]").forEach((button) => button.addEventListener("click", () => setPrimaryProductPhoto(Number(button.dataset.primaryPhoto))));
    updateImageZoomAvailability(root);
    root.querySelectorAll("[data-image-zoom]").forEach((button) => button.addEventListener("click", () => {
      if (button.classList.contains("no-zoom")) return;
      openImageZoom(button.dataset.imageZoom, button.dataset.imageTitle);
    }));
    root.querySelectorAll("[data-close-modal]").forEach((element) => element.addEventListener("click", (event) => {
      if (event.target === element || element.tagName === "BUTTON") closeEditProduct();
    }));
    root.querySelector("[data-modal-panel]")?.addEventListener("click", (event) => event.stopPropagation());
    root.querySelector("[data-action='clear-cart']")?.addEventListener("click", () => { state.cart = []; render(); });
    root.querySelector("[data-action='save-quote']")?.addEventListener("click", saveQuote);
    root.querySelector("[data-action='print-quote']")?.addEventListener("click", () => printQuote("Orcamento do carrinho", quoteRowsFromCart()));
    root.querySelectorAll("[data-quote-open]").forEach((button) => button.addEventListener("click", () => reopenSavedQuote(button.dataset.quoteOpen)));
    root.querySelectorAll("[data-quote-print]").forEach((button) => button.addEventListener("click", () => printSavedQuote(button.dataset.quotePrint)));
    root.querySelectorAll("[data-quote-delete]").forEach((button) => button.addEventListener("click", () => deleteSavedQuote(button.dataset.quoteDelete)));
  }

  function render() {
    const views = { dashboard, login: loginPage, "new-product": productForm, suppliers: suppliersPage, users: usersPage, settings: settingsPage, product: productPage, cart: cartPage };
    if (isAuthRequired() && !state.session && state.view !== "login") state.view = "login";
    const content = state.remoteLoading && state.session && state.view !== "login"
      ? remoteLoadingPage()
      : (views[state.view] || dashboard)();
    root.innerHTML = state.view === "login" && !state.session ? content : shell(content);
    bindEvents();
    refreshIcons();
    setupProductLoadObserver();
  }

  render();
  initAuth();
  refreshRates({ silent: true });
})();
