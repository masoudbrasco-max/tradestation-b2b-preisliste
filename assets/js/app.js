(function () {
  "use strict";

  const config = window.APP_CONFIG;
  const storageKeys = {
    theme: "tradestation-theme",
    cart: "tradestation-cart"
  };

  const state = {
    products: [],
    settings: {},
    filters: {
      search: "",
      category: "all",
      model: "all",
      group: "all",
      quality: "all"
    },
    cart: loadCart(),
    dataSource: ""
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    applySavedTheme();
    bindEvents();
    renderLocations();
    renderLocationCards();
    renderCart();
    setStatus("Preise werden geladen...");
    await loadPriceList();
    refreshIcons();
  }

  function cacheElements() {
    Object.assign(els, {
      themeToggle: document.getElementById("themeToggle"),
      openCart: document.getElementById("openCart"),
      closeCart: document.getElementById("closeCart"),
      cartBackdrop: document.getElementById("cartBackdrop"),
      cartCount: document.getElementById("cartCount"),
      dataStatus: document.getElementById("dataStatus"),
      reloadData: document.getElementById("reloadData"),
      promoBanner: document.getElementById("promoBanner"),
      searchInput: document.getElementById("searchInput"),
      categoryFilter: document.getElementById("categoryFilter"),
      modelFilter: document.getElementById("modelFilter"),
      groupFilter: document.getElementById("groupFilter"),
      qualityFilter: document.getElementById("qualityFilter"),
      resetFilters: document.getElementById("resetFilters"),
      visibleCount: document.getElementById("visibleCount"),
      pricedCount: document.getElementById("pricedCount"),
      stockCount: document.getElementById("stockCount"),
      resultSummary: document.getElementById("resultSummary"),
      emptyState: document.getElementById("emptyState"),
      productList: document.getElementById("productList"),
      notFoundWhatsApp: document.getElementById("notFoundWhatsApp"),
      cartLines: document.getElementById("cartLines"),
      cartTotal: document.getElementById("cartTotal"),
      cartPriceNote: document.getElementById("cartPriceNote"),
      locationOptions: document.getElementById("locationOptions"),
      customerName: document.getElementById("customerName"),
      customerCompany: document.getElementById("customerCompany"),
      customerMessage: document.getElementById("customerMessage"),
      sendWhatsApp: document.getElementById("sendWhatsApp"),
      downloadPdf: document.getElementById("downloadPdf"),
      freeInquiry: document.getElementById("freeInquiry"),
      freeInquiryButton: document.getElementById("freeInquiryButton"),
      locationCards: document.getElementById("locationCards")
    });
  }

  function bindEvents() {
    els.themeToggle.addEventListener("click", toggleTheme);
    els.reloadData.addEventListener("click", loadPriceList);
    els.searchInput.addEventListener("input", () => {
      state.filters.search = els.searchInput.value.trim();
      renderProducts();
    });

    [
      ["category", els.categoryFilter],
      ["model", els.modelFilter],
      ["group", els.groupFilter],
      ["quality", els.qualityFilter]
    ].forEach(([key, element]) => {
      element.addEventListener("change", () => {
        state.filters[key] = element.value;
        renderProducts();
      });
    });

    els.resetFilters.addEventListener("click", resetFilters);
    els.productList.addEventListener("click", handleProductClick);
    els.cartLines.addEventListener("click", handleCartClick);
    els.openCart.addEventListener("click", openCartPanel);
    els.closeCart.addEventListener("click", closeCartPanel);
    els.cartBackdrop.addEventListener("click", closeCartPanel);
    els.sendWhatsApp.addEventListener("click", sendOrderToWhatsApp);
    els.downloadPdf.addEventListener("click", createOrderPdf);
    els.notFoundWhatsApp.addEventListener("click", () => sendInquiry(els.searchInput.value));
    els.freeInquiryButton.addEventListener("click", () => sendInquiry(els.freeInquiry.value));
  }

  async function loadPriceList() {
    setStatus("Preise werden geladen...");
    try {
      const text = await fetchCsv();
      const rows = parseCsv(text);
      const { products, settings } = normalizeRows(rows);

      state.products = products;
      state.settings = settings;
      syncSettingsFromPriceList(settings);
      populateFilters(products);
      renderBanner(settings);
      renderProducts();
      renderLocations();
      renderLocationCards();
      renderCart();
      setStatus(`Preise aktualisiert (${products.length} Artikel).`);
    } catch (error) {
      console.error(error);
      setStatus("Preisdaten konnten nicht geladen werden. Bitte später erneut versuchen.");
      els.productList.innerHTML = "";
      els.emptyState.classList.remove("is-hidden");
    }
  }

  async function fetchCsv() {
    const sources = [
      { label: "primary", url: cacheBust(config.priceListUrl) },
      { label: "secondary", url: config.fallbackPriceListUrl }
    ];

    let lastError;
    for (const source of sources) {
      try {
        const response = await fetchWithTimeout(source.url, 3500);
        if (!response.ok) {
          throw new Error(`${source.label}: HTTP ${response.status}`);
        }
        state.dataSource = source.label;
        return await response.text();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Preisdaten nicht erreichbar.");
  }

  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { cache: "no-store", signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function cacheBust(url) {
    if (!url) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}_=${Date.now()}`;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(value);
        value = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      } else {
        value += char;
      }
    }

    if (value.length || row.length) {
      row.push(value);
      rows.push(row);
    }

    const headers = rows.shift().map((header) => header.trim());
    return rows
      .filter((cells) => cells.some((cell) => cell.trim() !== ""))
      .map((cells) =>
        headers.reduce((entry, header, index) => {
          entry[header] = (cells[index] || "").trim();
          return entry;
        }, {})
      );
  }

  function normalizeRows(rows) {
    const settings = rows.find((row) => row.WhatsAppOffenbach || row.AngebotsbannerText) || {};
    const products = rows
      .filter((row) => isYes(row.Aktiv) && row.Modell && row.Artikelgruppe && row.QualitaetVariante)
      .map((row) => {
        const product = {
          id: createProductId(row),
          category: clean(row.Kategorie),
          brand: clean(row.Marke),
          model: clean(row.Modell),
          group: clean(row.Artikelgruppe),
          quality: clean(row.QualitaetVariante),
          price: parseEuro(row.Preis),
          priceRaw: clean(row.Preis),
          stock: clean(row.BestandStatus) || "Auf Anfrage",
          isOffer: isYes(row.Angebotsartikel),
          note: clean(row.Hinweis),
          sort: Number.parseInt(row.Sortierung, 10) || 999999,
          raw: row
        };

        product.title = `${product.model} ${product.quality}`;
        product.searchText = [
          product.category,
          product.brand,
          product.model,
          product.group,
          product.quality,
          product.stock,
          product.note
        ]
          .join(" ")
          .toLowerCase();

        return product;
      })
      .filter(passesBusinessRules)
      .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title, "de"));

    return { products, settings };
  }

  function createProductId(row) {
    return [
      row.Kategorie,
      row.Marke,
      row.Modell,
      row.Artikelgruppe,
      row.QualitaetVariante,
      row.Sortierung
    ]
      .join("|")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function passesBusinessRules(product) {
    const isOled = product.group.toLowerCase() === "display" && product.quality.toLowerCase().includes("oled");
    if (isOled && config.hiddenDisplayModelsForOled.includes(product.model)) {
      return false;
    }

    const isDiagnosticBattery = product.quality.toLowerCase().includes("diagnostic");
    if (isDiagnosticBattery) {
      return getNumericIphoneModel(product.model) >= config.diagnosticBatteryMinimumModel;
    }

    return true;
  }

  function getNumericIphoneModel(model) {
    const match = model.match(/iPhone\s+(\d+)/i);
    return match ? Number.parseInt(match[1], 10) : 0;
  }

  function syncSettingsFromPriceList(settings) {
    config.locations.forEach((location) => {
      const phone = clean(settings[location.whatsappField]);
      const maps = clean(settings[location.mapsField]);
      if (phone) {
        location.whatsapp = phone;
      } else {
        delete location.whatsapp;
      }
      if (maps) location.mapsUrl = maps;
    });
  }

  function populateFilters(products) {
    fillSelect(els.categoryFilter, "Alle Kategorien", unique(products.map((p) => p.category)));
    fillSelect(els.modelFilter, "Alle Modelle", unique(products.map((p) => p.model)));
    fillSelect(els.groupFilter, "Alle Artikeltypen", unique(products.map((p) => p.group)));
    fillSelect(els.qualityFilter, "Alle Qualitäten", unique(products.map((p) => p.quality)));

    els.categoryFilter.value = state.filters.category;
    els.modelFilter.value = state.filters.model;
    els.groupFilter.value = state.filters.group;
    els.qualityFilter.value = state.filters.quality;
  }

  function fillSelect(select, allLabel, options) {
    const current = select.value || "all";
    select.innerHTML = [
      `<option value="all">${escapeHtml(allLabel)}</option>`,
      ...options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
    ].join("");
    select.value = options.includes(current) ? current : "all";
  }

  function renderBanner(settings) {
    const active = isYes(settings.AngebotsbannerAktiv);
    const text = clean(settings.AngebotsbannerText);
    const button = clean(settings.AngebotsbannerButton) || "Jetzt ansehen";
    const target = clean(settings.AngebotsbannerZiel);
    const inDateRange = isInDateRange(settings.AngebotsbannerStart, settings.AngebotsbannerEnde);

    if (!active || !text || !inDateRange) {
      els.promoBanner.classList.add("is-hidden");
      els.promoBanner.innerHTML = "";
      return;
    }

    els.promoBanner.classList.remove("is-hidden");
    els.promoBanner.innerHTML = `
      <div>
        <span class="banner-kicker">B2B-Angebot</span>
        <strong>${escapeHtml(text)}</strong>
      </div>
      ${
        target
          ? `<button class="banner-button" type="button" data-banner-target="${escapeHtml(target)}">${escapeHtml(button)}</button>`
          : ""
      }
    `;

    const bannerButton = els.promoBanner.querySelector("[data-banner-target]");
    if (bannerButton) {
      bannerButton.addEventListener("click", () => {
        const value = bannerButton.dataset.bannerTarget || "";
        if (/^https?:\/\//i.test(value)) {
          window.open(value, "_blank", "noopener");
        } else {
          els.searchInput.value = value;
          state.filters.search = value;
          renderProducts();
          document.getElementById("produkte").scrollIntoView({ behavior: "smooth" });
        }
      });
    }
  }

  function isInDateRange(start, end) {
    const now = new Date();
    const startDate = parseOptionalDate(start);
    const endDate = parseOptionalDate(end);
    return (!startDate || now >= startDate) && (!endDate || now <= endDate);
  }

  function parseOptionalDate(value) {
    const cleaned = clean(value);
    if (!cleaned) return null;
    const parsed = new Date(cleaned);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function renderProducts() {
    const filtered = getFilteredProducts();
    const priced = filtered.filter((product) => product.price !== null).length;
    const stocked = filtered.filter(isOrderableProduct).length;

    els.visibleCount.textContent = filtered.length;
    els.pricedCount.textContent = priced;
    els.stockCount.textContent = stocked;
    els.resultSummary.textContent = `${filtered.length} von ${state.products.length} Artikeln`;
    els.emptyState.classList.toggle("is-hidden", filtered.length > 0);

    els.productList.innerHTML = groupProductsByModel(filtered).map(renderProductGroup).join("");
    refreshIcons();
  }

  function getFilteredProducts() {
    const tokens = state.filters.search
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return state.products.filter((product) => {
      if (state.filters.category !== "all" && product.category !== state.filters.category) return false;
      if (state.filters.model !== "all" && product.model !== state.filters.model) return false;
      if (state.filters.group !== "all" && product.group !== state.filters.group) return false;
      if (state.filters.quality !== "all" && product.quality !== state.filters.quality) return false;
      return tokens.every((token) => product.searchText.includes(token));
    });
  }

  function groupProductsByModel(products) {
    const groups = new Map();
    products.forEach((product) => {
      const key = `${product.brand}|${product.model}`;
      if (!groups.has(key)) {
        groups.set(key, {
          brand: product.brand,
          model: product.model,
          category: product.category,
          products: []
        });
      }
      groups.get(key).products.push(product);
    });
    return [...groups.values()];
  }

  function renderProductGroup(group) {
    return `
      <article class="product-card product-group">
        <div class="product-group-head">
          <div>
            <div class="product-meta">
              <span>${escapeHtml(group.brand)}</span>
              <span>${escapeHtml(group.category)}</span>
            </div>
            <h3>${escapeHtml(group.model)}</h3>
          </div>
        </div>
        <div class="variant-list">
          ${group.products.map(renderProductVariant).join("")}
        </div>
      </article>
    `;
  }

  function renderProductVariant(product) {
    const cartItem = state.cart[product.id];
    const quantityInCart = cartItem ? cartItem.quantity : 0;
    const priceText = product.price === null ? "Auf Anfrage" : formatMoney(product.price);
    const stockClass = getStockClass(product.stock);
    const orderable = isOrderableProduct(product);
    const actionLabel = orderable ? "Hinzufügen" : "Anfragen";
    const selectedLabel = orderable ? `${quantityInCart} in Auswahl` : `${quantityInCart} angefragt`;

    return `
      <div class="variant-row ${orderable ? "is-orderable" : "is-inquiry"}">
        <div class="variant-info">
          <strong>${escapeHtml(product.group)} · ${escapeHtml(product.quality)}</strong>
          <span class="variant-type">${orderable ? "Bestellposition" : "Anfrageposition"}</span>
          ${product.note ? `<span>${escapeHtml(product.note)}</span>` : ""}
        </div>
        <div class="product-price">
          <strong>${escapeHtml(priceText)}</strong>
          <span class="stock-badge ${stockClass}">${escapeHtml(product.stock)}</span>
        </div>
        <div class="product-actions">
          <label class="quantity-field">
            <span>Menge</span>
            <input type="number" min="1" max="99" value="1" inputmode="numeric" data-qty="${escapeHtml(product.id)}">
          </label>
          <button class="${orderable ? "secondary-button" : "secondary-button inquiry-button"} add-button" type="button" data-add="${escapeHtml(product.id)}">
            <i data-lucide="${orderable ? "plus" : "message-circle"}" aria-hidden="true"></i>
            ${quantityInCart ? selectedLabel : actionLabel}
          </button>
        </div>
      </div>
    `;
  }

  function handleProductClick(event) {
    const button = event.target.closest("[data-add]");
    if (!button) return;

    const id = button.dataset.add;
    const quantityInput = els.productList.querySelector(`[data-qty="${cssEscape(id)}"]`);
    const quantity = clampQuantity(quantityInput ? quantityInput.value : 1);
    addToCart(id, quantity);
  }

  function addToCart(productId, quantity) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    if (quantity <= 0) return;

    const existing = state.cart[productId];
    state.cart[productId] = {
      productId,
      quantity: (existing ? existing.quantity : 0) + quantity
    };

    saveCart();
    renderCart();
    renderProducts();
  }

  function renderCart() {
    const items = getCartItems();
    const totals = calculateTotals(items);
    const sections = splitCartItems(items);

    els.cartCount.textContent = items.reduce((sum, item) => sum + item.quantity, 0);
    els.cartTotal.textContent = formatMoney(totals.total);
    els.cartPriceNote.classList.toggle("is-hidden", sections.inquiryItems.length === 0);
    els.sendWhatsApp.disabled = items.length === 0;
    els.downloadPdf.disabled = items.length === 0;

    if (!items.length) {
      els.cartLines.innerHTML = `<p class="muted">Noch keine Artikel ausgewählt.</p>`;
      return;
    }

    els.cartLines.innerHTML = [
      renderCartSection("Bestellpositionen", sections.orderItems, "order"),
      renderCartSection("Anfragepositionen", sections.inquiryItems, "inquiry")
    ].join("");

    refreshIcons();
  }

  function renderCartSection(title, items, type) {
    if (!items.length) return "";
    return `
      <section class="cart-section cart-section-${type}">
        <h3>${escapeHtml(title)}</h3>
        ${items.map((item) => renderCartLine(item, type)).join("")}
      </section>
    `;
  }

  function renderCartLine({ product, quantity }, type) {
    const orderable = type === "order";
    const subtotal = orderable ? formatMoney(product.price * quantity) : "Anfrage";
    const unitPrice = product.price === null ? "Preis auf Anfrage" : `${formatMoney(product.price)} / Stück`;
    return `
      <article class="cart-line ${orderable ? "cart-line-order" : "cart-line-inquiry"}">
        <div>
          <strong>${escapeHtml(product.model)}</strong>
          <span>${escapeHtml(product.group)} · ${escapeHtml(product.quality)}</span>
          <small>${escapeHtml(unitPrice)}${orderable ? "" : ` · ${escapeHtml(product.stock)}`}</small>
        </div>
        <div class="cart-line-actions">
          <button type="button" class="mini-button" data-decrease="${escapeHtml(product.id)}" aria-label="Menge reduzieren">
            <i data-lucide="minus" aria-hidden="true"></i>
          </button>
          <span>${quantity}</span>
          <button type="button" class="mini-button" data-increase="${escapeHtml(product.id)}" aria-label="Menge erhöhen">
            <i data-lucide="plus" aria-hidden="true"></i>
          </button>
        </div>
        <div class="cart-line-total">
          <strong>${escapeHtml(subtotal)}</strong>
          <button type="button" class="text-button danger" data-remove="${escapeHtml(product.id)}">Entfernen</button>
        </div>
      </article>
    `;
  }

  function handleCartClick(event) {
    const increase = event.target.closest("[data-increase]");
    const decrease = event.target.closest("[data-decrease]");
    const remove = event.target.closest("[data-remove]");

    if (increase) updateCartQuantity(increase.dataset.increase, 1);
    if (decrease) updateCartQuantity(decrease.dataset.decrease, -1);
    if (remove) removeCartItem(remove.dataset.remove);
  }

  function updateCartQuantity(productId, delta) {
    const item = state.cart[productId];
    if (!item) return;

    item.quantity = clampQuantity(item.quantity + delta);
    if (item.quantity <= 0) delete state.cart[productId];

    saveCart();
    renderCart();
    renderProducts();
  }

  function removeCartItem(productId) {
    delete state.cart[productId];
    saveCart();
    renderCart();
    renderProducts();
  }

  function getCartItems() {
    return Object.values(state.cart)
      .map((item) => {
        const product = state.products.find((entry) => entry.id === item.productId);
        return product ? { product, quantity: item.quantity } : null;
      })
      .filter(Boolean);
  }

  function splitCartItems(items) {
    return items.reduce(
      (groups, item) => {
        if (isOrderableProduct(item.product)) {
          groups.orderItems.push(item);
        } else {
          groups.inquiryItems.push(item);
        }
        return groups;
      },
      { orderItems: [], inquiryItems: [] }
    );
  }

  function calculateTotals(items) {
    return items.reduce(
      (summary, item) => {
        if (isOrderableProduct(item.product)) {
          summary.total += item.product.price * item.quantity;
        } else {
          summary.hasInquiry = true;
        }
        return summary;
      },
      { total: 0, hasInquiry: false }
    );
  }

  function renderLocations() {
    const selected = document.querySelector('input[name="location"]:checked');
    const selectedValue = selected ? selected.value : config.defaultLocation;

    els.locationOptions.innerHTML = config.locations
      .map((location) => {
        const checked = location.name === selectedValue ? "checked" : "";
        return `
          <label>
            <input type="radio" name="location" value="${escapeHtml(location.name)}" ${checked}>
            <span>${escapeHtml(location.name)}</span>
          </label>
        `;
      })
      .join("");
  }

  function renderLocationCards() {
    if (!els.locationCards) return;

    els.locationCards.innerHTML = config.locations
      .map((location) => {
        const mapsUrl = clean(location.mapsUrl);
        return `
          <article class="location-card">
            <div class="location-card-icon">
              <i data-lucide="map-pin" aria-hidden="true"></i>
            </div>
            <div>
              <h3>tradestation ${escapeHtml(location.city || location.name)}</h3>
              <p>${escapeHtml(location.city || location.name)}</p>
              <span>Abholung nach Bestätigung möglich</span>
            </div>
            <a class="secondary-button" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener">
              <i data-lucide="map" aria-hidden="true"></i>
              Google Maps öffnen
            </a>
          </article>
        `;
      })
      .join("");
  }

  function sendOrderToWhatsApp() {
    const items = getCartItems();
    if (!items.length) return;

    const message = buildOrderMessage(items);
    const phone = getLocationPhone(getSelectedLocation());
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  function buildOrderMessage(items) {
    const customer = getOrderDetails();
    const totals = calculateTotals(items);
    const sections = splitCartItems(items);
    const kind = getRequestKind(sections);
    const lines = [
      "Hallo tradestation Team,",
      "",
      `ich möchte folgende ${kind} senden:`,
      "",
      "Kundendaten:",
      `Name: ${customer.name || "Nicht angegeben"}`,
      `Firma: ${customer.company || "Nicht angegeben"}`,
      ...formatLocationLines(customer.location),
      `Lieferart: ${customer.delivery}`,
      ""
    ];

    if (sections.orderItems.length) {
      lines.push("Bestellpositionen:");
      sections.orderItems.forEach(({ product, quantity }, index) => {
        lines.push(`${index + 1}. ${quantity}x ${product.model} · ${product.group} · ${product.quality}`);
        lines.push(`Einzelpreis: ${formatMoney(product.price)}`);
        lines.push(`Summe: ${formatMoney(product.price * quantity)}`);
        lines.push("");
      });
    }

    if (sections.inquiryItems.length) {
      lines.push("Anfragepositionen:");
      sections.inquiryItems.forEach(({ product, quantity }, index) => {
        lines.push(`${index + 1}. ${quantity}x ${product.model} · ${product.group} · ${product.quality}`);
        lines.push(`Status: ${product.stock}`);
        lines.push(`Preis: ${product.price === null ? "auf Anfrage" : formatMoney(product.price)}`);
        lines.push("");
      });
    }

    if (sections.orderItems.length) {
      lines.push("Gesamtsumme bestellbarer Artikel:");
      lines.push(formatMoney(totals.total));
      lines.push("");
    }

    lines.push("Nachricht:");
    lines.push(customer.message || "Keine Nachricht angegeben.");
    lines.push("");
    lines.push("Bitte Verfügbarkeit und finale Konditionen bestätigen.");

    return lines.join("\n");
  }

  function createOrderPdf() {
    const items = getCartItems();
    if (!items.length) return;
    openPrintableSummary(items);
  }

  function openPrintableSummary(items) {
    const customer = getOrderDetails();
    const totals = calculateTotals(items);
    const sections = splitCartItems(items);
    const printWindow = window.open("", "_blank", "noopener");
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html lang="de">
        <head>
          <meta charset="utf-8">
          <title>Bestellzusammenfassung</title>
          <style>
            @page { size: A4; margin: 16mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #17211c; font-family: Arial, sans-serif; line-height: 1.45; }
            .doc { max-width: 190mm; margin: 0 auto; }
            .doc-header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; border-bottom: 3px solid #d71920; padding-bottom: 16px; margin-bottom: 18px; }
            .brand { font-size: 24px; font-weight: 800; letter-spacing: 0; }
            .brand .trade { color: #d71920; }
            .brand .station { color: #17211c; }
            .brand .b2b { color: #66736c; font-size: 14px; }
            .doc-title { margin: 10px 0 0; font-size: 18px; }
            .meta { color: #66736c; text-align: right; font-size: 12px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 18px; }
            .box { border: 1px solid #d9e0da; border-radius: 8px; padding: 12px; }
            h2 { margin: 0 0 8px; font-size: 14px; }
            p { margin: 0 0 8px; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0 18px; font-size: 12px; }
            th, td { border-bottom: 1px solid #d9e0da; padding: 8px 6px; text-align: left; vertical-align: top; }
            td small { color: #66736c; }
            th { background: #f4f6f4; font-size: 11px; text-transform: uppercase; }
            .num { text-align: right; white-space: nowrap; }
            .total { display: flex; justify-content: flex-end; gap: 16px; font-size: 16px; font-weight: 800; margin: 8px 0 18px; }
            .note { border-left: 4px solid #d71920; background: #fff1f1; padding: 10px 12px; }
            .message { white-space: pre-wrap; }
            @media print { button { display: none; } .doc { max-width: none; } }
            @media (max-width: 720px) { body { padding: 14px; } .doc-header, .info-grid { grid-template-columns: 1fr; display: grid; } .meta { text-align: left; } table { font-size: 11px; } }
          </style>
        </head>
        <body>
          <main class="doc">
            <header class="doc-header">
              <div>
                <div class="brand"><span class="trade">trade</span><span class="station">station</span> <span class="b2b">b2b</span></div>
                <h1 class="doc-title">Bestellzusammenfassung</h1>
              </div>
              <div class="meta">Datum<br><strong>${escapeHtml(formatDate(new Date()))}</strong></div>
            </header>

            <section class="info-grid">
              <div class="box">
                <h2>Kundendaten</h2>
                <p>Name: ${escapeHtml(customer.name || "Nicht angegeben")}</p>
                <p>Firma: ${escapeHtml(customer.company || "Nicht angegeben")}</p>
                ${formatLocationLines(customer.location).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
                <p>Lieferart: ${escapeHtml(customer.delivery)}</p>
              </div>
              <div class="box">
                <h2>Hinweis</h2>
                <p>Preise und Verfügbarkeit vorbehaltlich finaler Bestätigung.</p>
              </div>
            </section>

            ${renderPrintTable("Bestellpositionen", sections.orderItems, true)}
            ${renderPrintTable("Anfragepositionen", sections.inquiryItems, false)}

            ${
              sections.orderItems.length
                ? `<div class="total">
                    <span>Gesamtsumme bestellbarer Artikel</span>
                    <span>${escapeHtml(formatMoney(totals.total))}</span>
                  </div>`
                : ""
            }

            <section class="box">
              <h2>Nachricht</h2>
              <p class="message">${escapeHtml(customer.message || "Keine Nachricht angegeben.")}</p>
            </section>
          </main>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  function renderPrintTable(title, items, orderable) {
    if (!items.length) return "";

    return `
      <section>
        <h2>${escapeHtml(title)}</h2>
        <table>
          <thead>
            <tr>
              <th>Menge</th>
              <th>Artikel</th>
              <th>Variante</th>
              <th class="num">Einzelpreis</th>
              <th class="num">Summe</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(({ product, quantity }) => {
                const price = product.price === null ? "auf Anfrage" : formatMoney(product.price);
                const sum = orderable ? formatMoney(product.price * quantity) : "Anfrage";
                return `
                  <tr>
                    <td>${quantity}</td>
                    <td>${escapeHtml(product.model)}</td>
                    <td>${escapeHtml(`${product.group} · ${product.quality}`)}${orderable ? "" : `<br><small>Status: ${escapeHtml(product.stock)}</small>`}</td>
                    <td class="num">${escapeHtml(price)}</td>
                    <td class="num">${escapeHtml(sum)}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </section>
    `;
  }

  function sendInquiry(rawText) {
    const query = clean(rawText) || "Artikel nicht gefunden";
    const location = getSelectedLocation();
    const phone = getLocationPhone(location);
    const message = [
      "Hallo tradestation Team,",
      "",
      "ich möchte eine Anfrage senden:",
      "",
      `Gesuchter Artikel: ${query}`,
      ...formatLocationLines(location),
      "",
      "Bitte Verfügbarkeit und finale Konditionen bestätigen."
    ].join("\n");

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  function getOrderDetails() {
    const form = document.getElementById("orderForm");
    const formData = new FormData(form);
    return {
      name: clean(formData.get("name")),
      company: clean(formData.get("company")),
      location: getSelectedLocation(),
      delivery: clean(formData.get("delivery")) || "Abholung",
      message: clean(formData.get("message"))
    };
  }

  function getSelectedLocation() {
    const checked = document.querySelector('input[name="location"]:checked');
    return checked ? checked.value : config.defaultLocation;
  }

  function getLocationPhone(locationName) {
    const location = getLocationEntry(locationName);
    return clean(location.whatsapp || location.fallbackWhatsApp).replace(/\D/g, "");
  }

  function getLocationEntry(locationName) {
    return config.locations.find((entry) => entry.name === locationName) || config.locations[0];
  }

  function locationUsesFallbackPhone(location) {
    return Boolean(location.fallbackLocationName && !clean(location.whatsapp));
  }

  function formatLocationLines(locationName) {
    const location = getLocationEntry(locationName);
    if (locationUsesFallbackPhone(location)) {
      return [`Standortwunsch: ${location.name}`];
    }
    return [`Standort: ${location.name}`];
  }

  function getRequestKind(sections) {
    if (sections.orderItems.length && sections.inquiryItems.length) return "Bestellung + Anfrage";
    if (sections.orderItems.length) return "Bestellung";
    return "Anfrage";
  }

  function resetFilters() {
    state.filters = {
      search: "",
      category: "all",
      model: "all",
      group: "all",
      quality: "all"
    };
    els.searchInput.value = "";
    populateFilters(state.products);
    renderProducts();
  }

  function openCartPanel() {
    document.body.classList.add("cart-open");
    els.cartBackdrop.hidden = false;
  }

  function closeCartPanel() {
    document.body.classList.remove("cart-open");
    els.cartBackdrop.hidden = true;
  }

  function applySavedTheme() {
    const saved = localStorage.getItem(storageKeys.theme);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    updateThemeButton(theme);
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(storageKeys.theme, next);
    updateThemeButton(next);
  }

  function updateThemeButton(theme) {
    const icon = theme === "dark" ? "moon" : "sun-medium";
    els.themeToggle.innerHTML = `<i data-lucide="${icon}" aria-hidden="true"></i>`;
    refreshIcons();
  }

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(storageKeys.cart)) || {};
    } catch (error) {
      return {};
    }
  }

  function saveCart() {
    localStorage.setItem(storageKeys.cart, JSON.stringify(state.cart));
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function isYes(value) {
    return ["ja", "yes", "true", "1"].includes(clean(value).toLowerCase());
  }

  function parseEuro(value) {
    const cleaned = clean(value);
    if (!cleaned) return null;
    const numeric = Number.parseFloat(cleaned.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: config.currency,
      minimumFractionDigits: 2
    }).format(amount || 0);
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat(config.locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function clampQuantity(value) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return 1;
    return Math.max(0, Math.min(99, number));
  }

  function isOrderableProduct(product) {
    const stock = normalizeStock(product.stock);
    return product.price !== null && (stock.includes("viel bestand") || stock.includes("wenig bestand"));
  }

  function normalizeStock(stock) {
    return clean(stock)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function isStockLikelyAvailable(stock) {
    const value = normalizeStock(stock);
    return value.includes("viel") || value.includes("wenig");
  }

  function getStockClass(stock) {
    const value = normalizeStock(stock);
    if (value.includes("viel")) return "stock-good";
    if (value.includes("wenig")) return "stock-low";
    if (value.includes("kurze") || value.includes("kuerze")) return "stock-soon";
    return "stock-request";
  }

  function setStatus(message) {
    els.dataStatus.textContent = message;
  }

  function escapeHtml(value) {
    return clean(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(value);
    return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
})();
