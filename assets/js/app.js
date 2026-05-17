const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS2R3O4d67rRnfVkau6dRZlFxdjttwUsLDbNBVgaCU5dHWaNdQhYLcW1i1qw5xhCQ/pub?gid=1018114951&single=true&output=csv";
const FALLBACK_CSV_URL = "data/preisliste.csv";

const DEFAULT_CONFIG = {
  locations: {
    offenbach: {
      label: "Offenbach",
      phone: "4915238242082",
      map: "https://www.google.com/maps/search/?api=1&query=tradestation%20Offenbach%20am%20Main",
    },
    kassel: {
      label: "Kassel",
      phone: "491772897314",
      map: "https://www.google.com/maps/search/?api=1&query=tradestation%20Kassel",
    },
    goettingen: {
      label: "Göttingen",
      phone: "",
      map: "https://www.google.com/maps/search/?api=1&query=tradestation%20G%C3%B6ttingen",
    },
  },
};

const state = {
  products: [],
  filteredProducts: [],
  groups: [],
  cart: new Map(),
  closedModels: new Set(),
  query: "",
  activeGroup: "Alle",
  config: DEFAULT_CONFIG,
  selectedLocation: "offenbach",
  lastWhatsappUrl: "",
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindEvents();
  renderLoading();

  try {
    const { text } = await loadCsvText();
    const rows = parseCsv(text);
    const mappedRows = mapRows(rows);
    state.config = readConfig(mappedRows);
    state.products = readProducts(mappedRows);
    state.groups = getProductGroups(state.products);
    state.filteredProducts = filterProducts();

    renderConfig();
    renderGroupFilters();
    renderProducts();
    renderCart();
    updateDataStatus();
    els.priceListPdfButton.disabled = false;
  } catch (error) {
    renderError(error);
  }
}

function bindElements() {
  [
    "activeFilterLabel",
    "cartBar",
    "cartCount",
    "cartTotal",
    "checkoutDialog",
    "checkoutForm",
    "checkoutItems",
    "checkoutTotal",
    "clearSearchButton",
    "companyInput",
    "customerMessageInput",
    "dataStatus",
    "groupFilters",
    "locationNotice",
    "locationOptions",
    "nameInput",
    "offerBanner",
    "offerBannerButton",
    "offerBannerCta",
    "offerBannerText",
    "openCheckoutButton",
    "orderPdfButton",
    "priceListPdfButton",
    "printNotice",
    "productList",
    "resultCount",
    "searchInput",
    "sendWhatsappButton",
    "whatsappFallbackLink",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });

  els.closeCheckoutButton = document.getElementById("closeCheckoutButton");
}

function bindEvents() {
  els.searchInput.addEventListener("input", () => {
    state.query = els.searchInput.value.trim();
    applyFilters();
  });

  els.clearSearchButton.addEventListener("click", () => {
    state.query = "";
    els.searchInput.value = "";
    applyFilters();
    els.searchInput.focus();
  });

  els.groupFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.activeGroup = button.dataset.filter;
    applyFilters();
    renderGroupFilters();
  });

  els.productList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const { action, id, model } = button.dataset;
    if (action === "toggle-model") {
      toggleModel(model);
      return;
    }

    if (!id) return;
    if (action === "increase") updateCart(id, 1);
    if (action === "decrease") updateCart(id, -1);
    if (action === "direct") {
      if (!state.cart.get(id)) state.cart.set(id, 1);
      renderProducts();
      renderCart();
      openCheckout();
    }
  });

  els.checkoutItems.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const { action, id } = button.dataset;
    if (action === "increase") updateCart(id, 1);
    if (action === "decrease") updateCart(id, -1);
    renderCheckout();
  });

  els.openCheckoutButton.addEventListener("click", openCheckout);
  els.closeCheckoutButton.addEventListener("click", () => els.checkoutDialog.close());
  els.locationOptions.addEventListener("change", () => {
    const location = getSelectedLocationKey();
    state.selectedLocation = location;
    updateLocationNotice();
  });

  els.checkoutForm.addEventListener("submit", handleCheckoutSubmit);

  els.orderPdfButton.addEventListener("click", () => {
    if (!validateCheckout({ requirePhone: false })) return;
    openOrderPdf();
  });

  els.priceListPdfButton.addEventListener("click", openPriceListPdf);

  els.offerBannerButton.addEventListener("click", () => {
    const target = els.offerBannerButton.dataset.target || "";
    if (!target) return;
    state.query = target;
    els.searchInput.value = target;
    applyFilters();
    window.scrollTo({ top: 0, behavior: "smooth" });
    els.searchInput.focus();
  });
}

async function loadCsvText() {
  const liveUrl = `${SHEET_CSV_URL}&_=${Date.now()}`;

  try {
    const response = await fetch(liveUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Preisliste Antwort ${response.status}`);
    return { text: await response.text() };
  } catch (liveError) {
    const fallback = await fetch(FALLBACK_CSV_URL, { cache: "no-store" });
    if (!fallback.ok) throw liveError;
    return { text: await fallback.text() };
  }
}

function parseCsv(text) {
  const cleanText = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < cleanText.length; index += 1) {
    const char = cleanText[index];
    const nextChar = cleanText[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function mapRows(rows) {
  const headers = rows[0]?.map((header) => header.trim()) || [];
  return rows.slice(1).map((row) => {
    const mapped = {};
    headers.forEach((header, index) => {
      mapped[header] = (row[index] || "").trim();
    });
    return mapped;
  });
}

function readConfig(rows) {
  const configRow =
    rows.find(
      (row) =>
        row.AngebotsbannerText ||
        row.WhatsAppOffenbach ||
        row.WhatsAppKassel ||
        row.StandortOffenbachGoogleMaps,
    ) || {};

  const bannerText = configRow.AngebotsbannerText || "";
  const bannerActiveValue = normalizeText(configRow.AngebotsbannerAktiv);

  return {
    banner: {
      active: bannerText ? bannerActiveValue !== "nein" : false,
      text: bannerText,
      button: configRow.AngebotsbannerButton || "Ansehen",
      target: configRow.AngebotsbannerZiel || bannerText,
    },
    locations: {
      offenbach: {
        label: "Offenbach",
        phone: normalizePhone(configRow.WhatsAppOffenbach) || DEFAULT_CONFIG.locations.offenbach.phone,
        map: configRow.StandortOffenbachGoogleMaps || DEFAULT_CONFIG.locations.offenbach.map,
      },
      kassel: {
        label: "Kassel",
        phone: normalizePhone(configRow.WhatsAppKassel) || DEFAULT_CONFIG.locations.kassel.phone,
        map: configRow.StandortKasselGoogleMaps || DEFAULT_CONFIG.locations.kassel.map,
      },
      goettingen: {
        label: "Göttingen",
        phone: normalizePhone(configRow.WhatsAppGoettingen) || "",
        map: configRow.StandortGoettingenGoogleMaps || DEFAULT_CONFIG.locations.goettingen.map,
      },
    },
  };
}

function readProducts(rows) {
  return rows
    .filter((row) => isYes(row.Aktiv) && row.Modell && row.Artikelgruppe)
    .map((row, index) => {
      const price = parsePrice(row.Preis);
      const product = {
        id: [
          row.Marke,
          row.Modell,
          row.Artikelgruppe,
          row.QualitaetVariante,
          row.Sortierung || index,
        ].join("|"),
        category: row.Kategorie || "",
        brand: row.Marke || "",
        model: row.Modell || "",
        group: row.Artikelgruppe || "",
        quality: row.QualitaetVariante || "",
        price,
        rawPrice: row.Preis || "",
        stock: row.BestandStatus || "",
        note: row.Hinweis || "",
        offer: isYes(row.Angebotsartikel),
        sort: Number.parseInt(row.Sortierung, 10) || index,
      };
      product.orderLabel = buildOrderLabel(product);
      product.cardTitle = buildCardTitle(product);
      product.searchText = normalizeText(
        [product.category, product.brand, product.model, product.group, product.quality, product.stock, product.note].join(" "),
      );
      return product;
    })
    .sort((a, b) => a.sort - b.sort || a.orderLabel.localeCompare(b.orderLabel, "de"));
}

function renderConfig() {
  const banner = state.config.banner;
  if (banner.active && banner.text) {
    els.offerBannerText.textContent = banner.text;
    els.offerBannerCta.textContent = banner.button;
    els.offerBannerButton.dataset.target = banner.target;
    els.offerBanner.classList.remove("is-hidden");
  } else {
    els.offerBanner.classList.add("is-hidden");
  }

  renderLocations();
}

function renderLocations() {
  const entries = Object.entries(state.config.locations);
  const selected =
    state.selectedLocation && state.config.locations[state.selectedLocation]
      ? state.selectedLocation
      : entries.find(([, location]) => location.phone)?.[0] || entries[0][0];
  state.selectedLocation = selected;

  els.locationOptions.innerHTML = entries
    .map(([key, location]) => {
      const checked = key === selected ? "checked" : "";
      const status = location.phone ? "WhatsApp aktiv" : "Nummer folgt";
      return `
        <label class="location-option">
          <input type="radio" name="location" value="${escapeAttr(key)}" ${checked}>
          <span>
            ${escapeHtml(location.label)}
            <small>${escapeHtml(status)}</small>
          </span>
        </label>
      `;
    })
    .join("");

  updateLocationNotice();
}

function renderGroupFilters() {
  const filters = ["Alle", ...state.groups];
  els.groupFilters.innerHTML = filters
    .map((filter) => {
      const isActive = filter === state.activeGroup ? "is-active" : "";
      return `<button class="filter-button ${isActive}" type="button" data-filter="${escapeAttr(filter)}">${escapeHtml(filter)}</button>`;
    })
    .join("");
}

function renderProducts() {
  const products = state.filteredProducts;
  els.resultCount.textContent = `${products.length} ${products.length === 1 ? "Artikel" : "Artikel"}`;
  els.activeFilterLabel.textContent =
    state.activeGroup === "Alle" ? "Alle Gruppen" : `${state.activeGroup}`;

  if (!state.products.length) {
    els.productList.innerHTML = `<p class="empty-state">Noch keine aktiven Artikel gefunden.</p>`;
    return;
  }

  if (!products.length) {
    els.productList.innerHTML = `<p class="empty-state">Keine Treffer. Suche kürzen oder Gruppe wechseln.</p>`;
    return;
  }

  const grouped = groupBy(products, (product) => product.model);
  els.productList.innerHTML = Object.entries(grouped)
    .map(([model, modelProducts]) => renderModelGroup(model, modelProducts))
    .join("");
}

function renderModelGroup(model, products) {
  const closed = state.closedModels.has(model) && !state.query;
  const productCards = products.map(renderProductCard).join("");
  const groups = [...new Set(products.map((product) => product.group).filter(Boolean))].join(" / ");

  return `
    <section class="model-group">
      <button class="model-summary" type="button" data-action="toggle-model" data-model="${escapeAttr(model)}">
        <span>
          <strong>${escapeHtml(model)}</strong>
          <span>${escapeHtml(groups)} · ${products.length} ${products.length === 1 ? "Artikel" : "Artikel"}</span>
        </span>
        <span class="model-summary__toggle" aria-hidden="true">${closed ? "+" : "-"}</span>
      </button>
      <div class="product-grid ${closed ? "is-hidden" : ""}">
        ${productCards}
      </div>
    </section>
  `;
}

function renderProductCard(product) {
  const qty = state.cart.get(product.id) || 0;
  const priceText = product.price === null ? "Auf Anfrage" : `${formatEuro(product.price)} netto`;
  const stockClass = getStockClass(product.stock);
  const selectedClass = qty > 0 ? "is-selected" : "";
  const actionLabel = isDirectOrderProduct(product) ? "Bestellen" : "Anfragen";

  return `
    <article class="product-card">
      <div class="product-card__main">
        <h3>${escapeHtml(product.cardTitle)}</h3>
        <div class="product-card__meta">
          <span class="chip chip--price">${escapeHtml(priceText)}</span>
          ${product.stock ? `<span class="chip ${stockClass}">${escapeHtml(product.stock)}</span>` : ""}
          ${product.offer ? `<span class="chip chip--warning">Angebot</span>` : ""}
        </div>
      </div>
      <div class="product-card__actions">
        <div class="qty-stepper" aria-label="Menge ${escapeAttr(product.orderLabel)}">
          <button type="button" data-action="decrease" data-id="${escapeAttr(product.id)}" aria-label="Menge verringern">-</button>
          <output>${qty}</output>
          <button type="button" data-action="increase" data-id="${escapeAttr(product.id)}" aria-label="Menge erhöhen">+</button>
        </div>
        <button class="direct-button ${selectedClass}" type="button" data-action="direct" data-id="${escapeAttr(product.id)}">${actionLabel}</button>
      </div>
    </article>
  `;
}

function renderCart() {
  const summary = getCartSummary();
  els.cartCount.textContent = `${summary.count} ${summary.count === 1 ? "Artikel" : "Artikel"}`;
  els.cartTotal.textContent = summary.unknownCount && summary.knownCount
    ? `${formatEuro(summary.total)} bekannte Preise`
    : summary.unknownCount
      ? "Preis auf Anfrage"
    : `${formatEuro(summary.total)} netto`;
  els.cartBar.classList.toggle("is-hidden", summary.count === 0);
}

function renderCheckout() {
  const items = getCartItems();

  if (!items.length) {
    els.checkoutItems.innerHTML = `<p class="empty-state">Noch keine Artikel ausgewählt.</p>`;
    els.checkoutTotal.textContent = "0 €";
    return;
  }

  els.checkoutItems.innerHTML = items
    .map(({ product, qty }) => {
      const line = isDirectOrderProduct(product) ? `${formatEuro(product.price * qty)} netto` : "Preis auf Anfrage";
      const unit = isDirectOrderProduct(product) ? `${formatEuro(product.price)} netto` : "Auf Anfrage";
      return `
        <div class="checkout-item">
          <div>
            <strong>${escapeHtml(product.orderLabel)}</strong>
            <span class="checkout-item__price">${escapeHtml(unit)} · Position: ${escapeHtml(line)}</span>
          </div>
          <div class="qty-stepper" aria-label="Menge ${escapeAttr(product.orderLabel)}">
            <button type="button" data-action="decrease" data-id="${escapeAttr(product.id)}" aria-label="Menge verringern">-</button>
            <output>${qty}</output>
            <button type="button" data-action="increase" data-id="${escapeAttr(product.id)}" aria-label="Menge erhöhen">+</button>
          </div>
        </div>
      `;
    })
    .join("");

  const summary = getCartSummary();
  els.checkoutTotal.textContent = summary.unknownCount && summary.knownCount
    ? `${formatEuro(summary.total)} bekannte Preise`
    : summary.unknownCount
      ? "Preis auf Anfrage"
    : formatEuro(summary.total);
  updateLocationNotice();
}

function renderLoading() {
  els.productList.innerHTML = `<p class="empty-state">Preisliste wird geladen...</p>`;
}

function renderError(error) {
  els.dataStatus.textContent = "Preisliste konnte nicht geladen werden";
  els.productList.innerHTML = `
    <div class="error-state">
      <strong>Preisliste konnte nicht geladen werden.</strong>
      <p>Bitte später erneut versuchen oder direkt per WhatsApp Kontakt aufnehmen.</p>
    </div>
  `;
}

function updateDataStatus() {
  const count = state.products.length;
  els.dataStatus.textContent = `Aktuelle Preisliste geladen · ${count} ${count === 1 ? "Artikel" : "Artikel"}`;
}

function applyFilters() {
  state.filteredProducts = filterProducts();
  renderProducts();
}

function filterProducts() {
  const query = normalizeText(state.query);
  return state.products.filter((product) => {
    const matchesGroup = state.activeGroup === "Alle" || product.group === state.activeGroup;
    const matchesQuery = !query || product.searchText.includes(query);
    return matchesGroup && matchesQuery;
  });
}

function getProductGroups(products) {
  return [...new Set(products.map((product) => product.group).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "de"),
  );
}

function toggleModel(model) {
  if (state.closedModels.has(model)) {
    state.closedModels.delete(model);
  } else {
    state.closedModels.add(model);
  }
  renderProducts();
}

function updateCart(id, delta) {
  const current = state.cart.get(id) || 0;
  const next = Math.max(0, Math.min(999, current + delta));
  if (next === 0) state.cart.delete(id);
  else state.cart.set(id, next);

  renderProducts();
  renderCart();
  if (els.checkoutDialog.open) renderCheckout();
}

function openCheckout() {
  if (!getCartSummary().count) return;
  renderCheckout();
  els.whatsappFallbackLink.classList.add("is-hidden");
  els.printNotice.classList.add("is-hidden");
  if (typeof els.checkoutDialog.showModal === "function") {
    els.checkoutDialog.showModal();
  } else {
    els.checkoutDialog.setAttribute("open", "");
  }
}

function handleCheckoutSubmit(event) {
  event.preventDefault();
  if (!validateCheckout({ requirePhone: true })) return;

  const mode = new FormData(els.checkoutForm).get("sendMode");
  if (mode === "whatsapp-pdf") openOrderPdf();
  openWhatsapp();
}

function validateCheckout({ requirePhone }) {
  if (!getCartSummary().count) return false;
  if (!els.checkoutForm.reportValidity()) return false;

  if (requirePhone) {
    const location = getSelectedLocation();
    if (!location.phone) {
      updateLocationNotice();
      return false;
    }
  }

  return true;
}

function updateLocationNotice() {
  const location = getSelectedLocation();
  if (!location) return;

  if (!location.phone) {
    els.locationNotice.textContent = `${location.label} ist vorbereitet. Sobald die WhatsApp-Nummer hinterlegt ist, kann dieser Standort senden.`;
    els.locationNotice.classList.remove("is-hidden");
    els.sendWhatsappButton.disabled = true;
  } else {
    els.locationNotice.textContent = "";
    els.locationNotice.classList.add("is-hidden");
    els.sendWhatsappButton.disabled = false;
  }
}

function getSelectedLocationKey() {
  return new FormData(els.checkoutForm).get("location") || state.selectedLocation || "offenbach";
}

function getSelectedLocation() {
  return state.config.locations[getSelectedLocationKey()];
}

function openWhatsapp() {
  const location = getSelectedLocation();
  const message = buildWhatsappMessage();
  const url = `https://wa.me/${location.phone}?text=${encodeURIComponent(message)}`;
  state.lastWhatsappUrl = url;

  els.whatsappFallbackLink.href = url;
  const opened = window.open(url, "_blank", "noopener");
  if (!opened) {
    els.whatsappFallbackLink.classList.remove("is-hidden");
  }
}

function buildWhatsappMessage() {
  const order = collectOrderData();
  const orderMode = getOrderMode(order.items);
  const lines = [
    `Hallo, ich möchte folgende ${orderMode} senden:`,
    "",
    `Firma: ${formatOptional(order.company)}`,
    `Name: ${formatOptional(order.name)}`,
    `Standort: ${order.location.label}`,
    "",
    `${orderMode}:`,
    "",
  ];

  order.items.forEach(({ product, qty }) => {
    if (!isDirectOrderProduct(product)) {
      lines.push(`* ${qty}x ${product.orderLabel} - Preis auf Anfrage`);
      return;
    }

    lines.push(
      `* ${qty}x ${product.orderLabel} ${formatEuro(product.price)} netto = ${formatEuro(product.price * qty)} netto`,
    );
  });

  lines.push("");
  if (order.summary.unknownCount && order.summary.knownCount) {
    lines.push(`Gesamtsumme bekannte Preise netto: ${formatEuro(order.summary.total)}`);
    lines.push("Weitere Positionen: Preis auf Anfrage");
  } else if (order.summary.unknownCount) {
    lines.push("Gesamtsumme: Preis auf Anfrage");
  } else {
    lines.push(`Gesamtsumme netto: ${formatEuro(order.summary.total)}`);
  }

  lines.push("", "Bitte Verfügbarkeit und finale Konditionen bestätigen.");

  if (order.message) {
    lines.push("", "Nachricht:", order.message);
  }

  return lines.join("\n");
}

function collectOrderData() {
  return {
    company: els.companyInput.value.trim(),
    name: els.nameInput.value.trim(),
    message: els.customerMessageInput.value.trim(),
    location: getSelectedLocation(),
    items: getCartItems(),
    summary: getCartSummary(),
    date: new Date(),
  };
}

function openOrderPdf() {
  const order = collectOrderData();
  if (!openPrintableDocument("tradestation b2b Bestellung", buildOrderPdfHtml(order))) {
    showPrintNotice("Das PDF-Fenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben und erneut versuchen.");
  }
}

function openPriceListPdf() {
  if (!openPrintableDocument("tradestation b2b Preisliste", buildPriceListPdfHtml(state.products))) {
    showPrintNotice("Das PDF-Fenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben und erneut versuchen.");
  }
}

function buildOrderPdfHtml(order) {
  const orderMode = getOrderMode(order.items);
  const rows = order.items
    .map(({ product, qty }) => {
      const unit = isDirectOrderProduct(product) ? `${formatEuro(product.price)} netto` : "Auf Anfrage";
      const line = isDirectOrderProduct(product) ? `${formatEuro(product.price * qty)} netto` : "Auf Anfrage";
      return `
        <tr>
          <td>${escapeHtml(product.orderLabel)}</td>
          <td class="num">${qty}</td>
          <td class="num money">${escapeHtml(unit)}</td>
          <td class="num money">${escapeHtml(line)}</td>
        </tr>
      `;
    })
    .join("");

  const totalLabel = order.summary.unknownCount && order.summary.knownCount
    ? `${formatEuro(order.summary.total)} bekannte Preise netto`
    : order.summary.unknownCount
      ? "Preis auf Anfrage"
    : `${formatEuro(order.summary.total)} netto`;

  return `
    <header class="print-header">
      <div class="print-brand"><span>trade</span>station <small>b2b</small></div>
      <h1>${escapeHtml(orderMode)}</h1>
      <p>Preise netto zzgl. gesetzlicher Umsatzsteuer</p>
    </header>
    <section class="print-meta">
      <p><strong>Firma:</strong> ${escapeHtml(formatOptional(order.company))}</p>
      <p><strong>Name:</strong> ${escapeHtml(formatOptional(order.name))}</p>
      <p><strong>Standort:</strong> ${escapeHtml(order.location.label)}</p>
      <p><strong>Datum:</strong> ${formatDate(order.date)}</p>
    </section>
    <table>
      <thead>
        <tr>
          <th>Artikel</th>
          <th class="num">Menge</th>
          <th class="num">Einzelpreis</th>
          <th class="num">Summe</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3">Gesamtsumme</td>
          <td class="num money">${escapeHtml(totalLabel)}</td>
        </tr>
      </tfoot>
    </table>
    ${
      order.message
        ? `<section class="print-note"><h2>Nachricht</h2><p>${escapeHtml(order.message)}</p></section>`
        : ""
    }
  `;
}

function buildPriceListPdfHtml(products) {
  const grouped = groupBy(products, (product) => product.model);
  const groupsHtml = Object.entries(grouped)
    .map(([model, modelProducts]) => {
      const rows = modelProducts
        .map((product) => `
          <tr>
            <td>${escapeHtml(product.cardTitle)}</td>
            <td>${escapeHtml(product.stock || "-")}</td>
            <td class="num money">${escapeHtml(product.price === null ? "Auf Anfrage" : `${formatEuro(product.price)} netto`)}</td>
          </tr>
        `)
        .join("");

      return `
        <section class="price-group">
          <h2>${escapeHtml(model)}</h2>
          <table>
            <thead>
              <tr>
                <th>Artikel</th>
                <th>Bestand</th>
                <th class="num">Preis</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      `;
    })
    .join("");

  return `
    <header class="print-header">
      <div class="print-brand"><span>trade</span>station <small>b2b</small></div>
      <h1>Preisliste</h1>
      <p>Stand: ${formatDate(new Date())} · Preise netto zzgl. gesetzlicher Umsatzsteuer · ${products.length} Artikel</p>
    </header>
    ${groupsHtml}
  `;
}

function openPrintableDocument(title, contentHtml) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;
  try {
    printWindow.opener = null;
  } catch (error) {
    // Some browsers disallow clearing opener on a just-opened print window.
  }

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #111;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            line-height: 1.28;
          }
          .print-page {
            width: min(100%, 880px);
            margin: 0 auto;
            padding: 22px;
          }
          .print-header {
            border-bottom: 2px solid #111;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }
          .print-brand {
            font-size: 21px;
            font-weight: 900;
            margin-bottom: 7px;
          }
          .print-brand span { color: #df1f2d; }
          .print-brand small {
            color: #555;
            font-size: 11px;
            text-transform: uppercase;
          }
          h1 {
            margin: 0;
            font-size: 21px;
          }
          h2 {
            margin: 12px 0 5px;
            font-size: 13px;
          }
          p { margin: 0 0 4px; }
          .print-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px 18px;
            margin-bottom: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            page-break-inside: auto;
          }
          tr { page-break-inside: avoid; }
          th,
          td {
            border-bottom: 1px solid #ddd;
            padding: 5px 6px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f3f3f3;
            font-size: 10px;
            text-transform: uppercase;
          }
          tfoot td {
            font-weight: 900;
            border-top: 2px solid #111;
          }
          .num { text-align: right; white-space: nowrap; }
          .money { font-weight: 700; }
          .price-group { page-break-inside: avoid; }
          .print-note {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
          }
          @page { margin: 10mm; }
          @media print {
            .print-page { width: auto; padding: 0; }
          }
        </style>
      </head>
      <body>
        <main class="print-page">${contentHtml}</main>
        <script>
          window.addEventListener("load", () => {
            setTimeout(() => {
              try {
                window.focus();
                window.print();
              } catch (error) {
                document.body.insertAdjacentHTML("afterbegin", "<p style='padding:12px;background:#fff3cd;border:1px solid #ffe08a'>Druckdialog konnte nicht automatisch geöffnet werden. Bitte Strg+P verwenden.</p>");
              }
            }, 250);
          });
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
  return true;
}

function showPrintNotice(message) {
  if (els.printNotice && els.checkoutDialog?.open) {
    els.printNotice.textContent = message;
    els.printNotice.classList.remove("is-hidden");
  } else {
    alert(message);
  }
}

function getCartItems() {
  return [...state.cart.entries()]
    .map(([id, qty]) => ({
      product: state.products.find((product) => product.id === id),
      qty,
    }))
    .filter((item) => item.product && item.qty > 0)
    .sort((a, b) => a.product.sort - b.product.sort);
}

function getCartSummary() {
  return getCartItems().reduce(
    (summary, { product, qty }) => {
      summary.count += qty;
      if (!isDirectOrderProduct(product)) {
        summary.unknownCount += 1;
      } else {
        summary.knownCount += 1;
        summary.total += product.price * qty;
      }
      return summary;
    },
    { count: 0, total: 0, knownCount: 0, unknownCount: 0 },
  );
}

function isDirectOrderProduct(product) {
  if (product.price === null) return false;
  const stock = normalizeText(product.stock);
  return stock.includes("viel bestand") || stock.includes("wenig bestand");
}

function getOrderMode(items) {
  const hasDirect = items.some(({ product }) => isDirectOrderProduct(product));
  const hasInquiry = items.some(({ product }) => !isDirectOrderProduct(product));
  if (hasDirect && hasInquiry) return "Bestellung / Anfrage";
  return hasDirect ? "Bestellung" : "Anfrage";
}

function formatOptional(value) {
  return value || "nicht angegeben";
}

function buildCardTitle(product) {
  return buildProductTypeLabel(product);
}

function buildOrderLabel(product) {
  const labelParts = [product.model, buildProductTypeLabel(product)];
  return labelParts.join(" ");
}

function buildProductTypeLabel(product) {
  const quality = product.quality.trim();
  const group = product.group.trim();
  if (!quality) return group || "Artikel";
  if (!group) return quality;

  const normalizedQuality = normalizeText(quality);
  const normalizedGroup = normalizeText(group);
  if (normalizedQuality === normalizedGroup || normalizedQuality.endsWith(normalizedGroup)) return quality;
  return `${quality} ${group}`;
}

function parsePrice(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function formatEuro(value) {
  const cents = Math.round(value * 100) % 100;
  return `${new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: cents === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)} €`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getStockClass(stock) {
  const normalized = normalizeText(stock);
  if (normalized.includes("viel")) return "chip--success";
  if (normalized.includes("wenig") || normalized.includes("kurze") || normalized.includes("kürze")) return "chip--warning";
  return "";
}

function isYes(value) {
  return ["ja", "yes", "true", "1", "x"].includes(normalizeText(value));
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function groupBy(items, keyGetter) {
  return items.reduce((groups, item) => {
    const key = keyGetter(item) || "Weitere";
    groups[key] ||= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
