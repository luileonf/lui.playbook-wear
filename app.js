const {
  sheetUrl: SHEET_URL,
  sheetName: SHEET_NAME,
  storageKey: STORAGE_KEY,
  settingsKey: SETTINGS_KEY,
  summaryKey: SUMMARY_KEY,
  savingsGoal: SAVINGS_GOAL,
  categories,
  initialTransactions,
  defaultSummary,
} = window.luiWalletConfig;
const iconSvg = window.luiIconSvg || (() => "");

const state = {
  activeTab: "home",
  query: "",
  selectedCategory: "fun",
  transactions: load(STORAGE_KEY, initialTransactions),
  settings: load(SETTINGS_KEY, { webhookUrl: "", monthlyBudget: 10500, monthlyGoal: SAVINGS_GOAL, theme: "dark" }),
  summary: load(SUMMARY_KEY, defaultSummary),
};

const moneyFormatter = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 2 });
const compactFormatter = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", notation: "compact", maximumFractionDigits: 1 });
const root = document.querySelector("#root");

function load(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function persist() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  window.localStorage.setItem(SUMMARY_KEY, JSON.stringify(state.summary));
}

function numberOr(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function formatMoney(value) {
  return moneyFormatter.format(numberOr(value)).replace("GTQ", "Q");
}

function shortMoney(value) {
  return compactFormatter.format(numberOr(value)).replace("GTQ", "Q");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthName(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  return new Intl.DateTimeFormat("es-GT", { month: "long" }).format(date).replace(/^\w/, (letter) => letter.toUpperCase());
}

function prettyDate(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  return new Intl.DateTimeFormat("es-GT", { day: "numeric", month: "short" }).format(date);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function makeId(prefix = "tx") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getMonthTransactions() {
  return state.transactions
    .filter((transaction) => transaction.date.startsWith("2026-09"))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getTotals() {
  const summary = { ...defaultSummary, ...state.summary, categoryTotals: { ...defaultSummary.categoryTotals, ...(state.summary.categoryTotals || {}) } };
  const totalReceived = numberOr(summary.totalReceived, 0);
  const totalExpenses = numberOr(summary.totalExpenses, 0);
  const saldoAlDia = numberOr(summary.saldoAlDia, 0);
  const ahorro = numberOr(summary.ahorro, state.settings.monthlyGoal || SAVINGS_GOAL);
  const budgetProgress = totalReceived > 0 ? clamp((totalReceived - saldoAlDia) / totalReceived) : 0;
  const goalProgress = clamp(saldoAlDia / (state.settings.monthlyGoal || SAVINGS_GOAL));
  const byCategory = categories.map((category) => {
    const spent = numberOr(summary.categoryTotals[category.key], 0);
    const progress = totalExpenses > 0 ? clamp(spent / totalExpenses) : 0;
    return { ...category, spent, progress };
  });
  const credits = Array.isArray(summary.credits) ? summary.credits : defaultSummary.credits;

  return {
    income: totalReceived,
    spent: totalExpenses,
    available: saldoAlDia,
    ahorro,
    budgetProgress,
    goalProgress,
    byCategory,
    credits,
    month: summary.month || "Septiembre",
  };
}

function getFilteredTransactions() {
  const terms = normalizeText(state.query).split(/\s+/).filter(Boolean);
  const monthTransactions = getMonthTransactions();
  if (!terms.length) return monthTransactions;

  return monthTransactions.filter((transaction) => {
    const meta = categoryMeta(transaction.category);
    const haystack = normalizeText([
      transaction.description,
      transaction.account,
      transaction.category,
      meta.label,
      transaction.note || "",
      prettyDate(transaction.date),
      formatMoney(transaction.amount),
    ].join(" "));

    return terms.every((term) => haystack.includes(term));
  });
}

function getIncomeTransactions() {
  return state.transactions
    .filter((transaction) => transaction.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

function budgetCopy(tone) {
  if (tone === "danger") return "Ojo, revisa antes de gastar más";
  if (tone === "warning") return "Vas cerca del límite";
  return "Vas con buen margen";
}

function budgetMessage(totals) {
  if (totals.budgetProgress >= 0.9) return `Ya usaste casi todo el margen. Saldo al día: ${formatMoney(totals.available)}.`;
  if (totals.budgetProgress >= 0.7) return `Vas bien, pero conviene bajar el ritmo. Saldo al día: ${formatMoney(totals.available)}.`;
  return `Vas bien, aún tienes margen. Saldo al día: ${formatMoney(totals.available)}.`;
}

function getAiAdvice(totals) {
  const highest = totals.byCategory.slice().sort((a, b) => b.spent - a.spent)[0];
  if (totals.budgetProgress >= 0.9) return `Prioriza pagos fijos y pausa extras: tu saldo al día bajó a ${formatMoney(totals.available)}.`;
  if (totals.budgetProgress >= 0.7) return `Cuida ${highest.label.toLowerCase()}: es donde más se está moviendo el gasto este mes.`;
  if (totals.available >= SAVINGS_GOAL) return `Buen ritmo: tienes margen para proteger tu meta de ${formatMoney(SAVINGS_GOAL)}.`;
  return "Vas estable; si hoy evitas gastos pequeños, el ahorro sube más rápido.";
}

function categoryMeta(categoryKey) {
  if (categoryKey === "income") return { label: "Ingreso", accent: "#a3ff12", icon: "+" };
  const category = categories.find((item) => item.key === categoryKey) || categories[0];
  return { label: category.label, accent: category.accent, icon: category.icon };
}

function render() {
  const totals = getTotals();
  const filteredTransactions = getFilteredTransactions();
  const incomeTransactions = getIncomeTransactions();
  const queueCount = state.transactions.filter((item) => item.syncState === "queued" || item.syncState === "failed").length;
  const budgetTone = totals.budgetProgress >= 0.9 ? "danger" : totals.budgetProgress >= 0.7 ? "warning" : "good";

  root.innerHTML = `
    <main class="app-canvas" data-theme="${state.settings.theme}">
      <section class="phone-shell" aria-label="LUI wallet app">
        <div class="screen">
          <header class="topbar">
            <div>
              <p class="eyebrow">Gastos 2026</p>
              <h1>Lui Wallet</h1>
            </div>
            <div class="top-actions">
              <button class="refresh-button" type="button" data-action="refresh-app" aria-label="Refrescar dashboard">${iconSvg("refresh")}</button>
            </div>
          </header>

          ${renderActiveTab({ totals, filteredTransactions, incomeTransactions, queueCount, budgetTone })}

          <nav class="bottom-nav" aria-label="Navegacion principal">
            ${navButton("home", "Home", "home")}
            ${navButton("activity", "Gastos", "list")}
            <button class="fab" type="button" data-action="open-composer" aria-label="Agregar gasto">+</button>
            ${navButton("insights", "Insights", "chart")}
            ${navButton("settings", "Ajustes", "settings")}
          </nav>
        </div>
      </section>

      <aside class="desktop-summary" aria-label="Resumen del dashboard">
        <p class="eyebrow">Personal finance</p>
        <h2>${getAiAdvice(totals)}</h2>
        <p>${budgetCopy(budgetTone)}. El flujo del mes marca ${formatMoney(totals.income)} recibido y ${formatMoney(totals.spent)} gastado.</p>
        <div class="desktop-kpis">
          <span>${formatMoney(totals.available)} saldo al día</span>
          <span>${formatMoney(totals.ahorro)} ahorro</span>
          <span>${Math.round(totals.budgetProgress * 100)}% usado</span>
          <span>${queueCount} pendientes</span>
        </div>
      </aside>

      <div id="modal-root"></div>
      <div id="toast-root"></div>
    </main>
  `;

  bindEvents();
}

function renderActiveTab({ totals, filteredTransactions, incomeTransactions, queueCount, budgetTone }) {
  if (state.activeTab === "activity") {
    return `
      <div class="view-stack">
        <div class="search-row">
          ${iconSvg("search")}
          <input data-action="search" value="${escapeHtml(state.query)}" placeholder="Buscar por palabra, cuenta, fecha o monto" />
          <button class="filter-button" type="button" data-action="clear-search" aria-label="Limpiar búsqueda">${state.query ? "X" : iconSvg("sliders")}</button>
        </div>
        <section class="activity-panel activity-panel--full">
          <div class="section-title">
            <div>
              <p class="eyebrow">${totals.month}</p>
              <h2>${filteredTransactions.length} movimientos</h2>
            </div>
            <button class="sync-button" type="button" data-action="refresh-app" aria-label="Refrescar movimientos">Sync</button>
          </div>
          ${transactionList(filteredTransactions)}
        </section>
      </div>
    `;
  }

  if (state.activeTab === "insights") {
    return `
      <div class="view-stack">
        <section class="insight-hero">
          <span>AI</span>
          <p>${getAiAdvice(totals)}</p>
        </section>
        <section class="credit-list" aria-label="Créditos">
          <div class="section-title">
            <div>
              <p class="eyebrow">Créditos</p>
              <h2>Nombre - monto</h2>
            </div>
          </div>
          ${totals.credits.map(creditRow).join("")}
        </section>
        <section class="goal-card">
          <div>
            <p class="eyebrow">Meta de ahorro</p>
            <h2>${formatMoney(totals.available)} / ${formatMoney(SAVINGS_GOAL)}</h2>
          </div>
          <div class="ring" style="--ring: ${totals.goalProgress * 360}deg">${Math.round(totals.goalProgress * 100)}%</div>
        </section>
      </div>
    `;
  }

  if (state.activeTab === "settings") {
    return `
      <div class="view-stack">
        <section class="settings-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Sync</p>
              <h2>Google Sheets</h2>
            </div>
            <button class="sync-button" type="button" data-action="refresh-app">Sync</button>
          </div>
          <label>
            Webhook Apps Script
            <input data-action="setting" data-setting="webhookUrl" value="${escapeHtml(state.settings.webhookUrl)}" placeholder="https://script.google.com/macros/s/..." />
          </label>
          <a href="${SHEET_URL}" target="_blank" rel="noreferrer">Abrir Gastos 2026</a>
        </section>
        <section class="settings-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Apariencia</p>
              <h2>Versión ${state.settings.theme === "light" ? "white" : "black"}</h2>
            </div>
          </div>
          <div class="segmented segmented--two" aria-label="Tema">
            <button type="button" class="${state.settings.theme === "dark" ? "active" : ""}" data-theme-choice="dark">Black</button>
            <button type="button" class="${state.settings.theme === "light" ? "active" : ""}" data-theme-choice="light">White</button>
          </div>
        </section>
        <section class="settings-panel">
          <div class="section-title">
            <div>
              <p class="eyebrow">Controles</p>
              <h2>Límites del mes</h2>
            </div>
          </div>
          <label>
            Límite de gastos al mes
            <input type="number" data-action="setting-number" data-setting="monthlyBudget" value="${state.settings.monthlyBudget}" />
          </label>
          <label>
            Meta de ahorro
            <input type="number" data-action="setting-number" data-setting="monthlyGoal" value="${state.settings.monthlyGoal}" />
          </label>
        </section>
      </div>
    `;
  }

  return `
    <div class="view-stack">
      <section class="wallet-card" aria-label="Saldo al día">
        <div class="wallet-card__glow"></div>
        <div class="wallet-card__head">
          <span>${totals.month}</span>
          <div class="wallet-card__head-actions">
            <button class="sync-pill add-pill" type="button" data-action="open-composer" aria-label="Agregar movimiento">+</button>
          </div>
        </div>
        <p class="wallet-label">Saldo al día</p>
        <strong>${formatMoney(totals.available)}</strong>
        <div class="quick-kpis" aria-label="Resumen rápido del mes">
          <div><span>Ahorros</span><b>${formatMoney(totals.ahorro)}</b></div>
          <div><span>Recibido</span><b>${formatMoney(totals.income)}</b></div>
          <div><span>Gastado</span><b>${formatMoney(totals.spent)}</b></div>
        </div>
      </section>

      <section class="budget-panel" aria-label="Progreso de presupuesto">
        <div class="section-title">
          <div>
            <p class="eyebrow">Presupuesto</p>
            <h2>${budgetCopy(budgetTone)}</h2>
          </div>
          <span>${Math.round(totals.budgetProgress * 100)}%</span>
        </div>
        <div class="mega-progress mega-progress--${budgetTone}">
          <span style="width: ${totals.budgetProgress * 100}%"></span>
        </div>
        <p class="budget-note">${budgetMessage(totals)}</p>
      </section>

      <section class="category-section" aria-label="División de gastos">
        <div class="section-title section-title--plain">
          <div>
            <p class="eyebrow">Resumen</p>
            <h2>División de gastos</h2>
          </div>
        </div>
        <div class="category-grid">
          ${totals.byCategory.map(categoryCard).join("")}
        </div>
      </section>

      <section class="activity-panel" aria-label="Ingresos">
        <div class="section-title">
          <div>
            <p class="eyebrow">Ingresos y pagos</p>
            <h2>Ingresos</h2>
          </div>
        </div>
        ${transactionList(incomeTransactions)}
      </section>
    </div>
  `;
}

function navButton(tab, label, icon) {
  return `<button class="${state.activeTab === tab ? "active" : ""}" type="button" data-tab="${tab}" aria-label="${label}">${iconSvg(icon)}</button>`;
}

function categoryCard(category) {
  return `
    <article class="category-card">
      <div class="category-card__top">
        <span class="category-icon" style="color: ${category.accent}; background-color: ${category.accent}24">${category.icon}</span>
        <span>${Math.round(category.progress * 100)}%</span>
      </div>
      <h3>${category.label}</h3>
      <strong>${formatMoney(category.spent)}</strong>
      <div class="mini-progress"><span style="width: ${category.progress * 100}%; background-color: ${category.accent}"></span></div>
    </article>
  `;
}

function creditRow(credit) {
  const name = escapeHtml(credit.name || "Crédito");
  return `
    <article class="credit-row">
      <span class="category-icon">${iconSvg("credit")}</span>
      <div>
        <h3>${name} - ${formatMoney(credit.amount)}</h3>
      </div>
    </article>
  `;
}

function transactionList(transactions) {
  if (!transactions.length) return `<p class="empty-state">No hay movimientos con ese filtro.</p>`;

  return `
    <div class="transaction-list">
      ${transactions
        .map((transaction) => {
          const meta = categoryMeta(transaction.category);
          return `
            <article class="transaction-row">
              <span class="transaction-icon" style="color: ${meta.accent}; background-color: ${meta.accent}22">${transaction.amount > 0 ? "+" : meta.icon}</span>
              <div>
                <h3>${escapeHtml(transaction.description)}</h3>
                <p>${meta.label} · ${escapeHtml(transaction.account)} · ${prettyDate(transaction.date)}</p>
              </div>
              <strong class="${transaction.amount > 0 ? "positive" : ""}">${formatMoney(transaction.amount)}</strong>
              <span class="sync-dot sync-dot--${transaction.syncState}"></span>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function composerTemplate() {
  const allCategories = [...categories, { key: "income", label: "Ingreso" }];
  return `
    <div class="modal-backdrop" role="presentation">
      <form class="composer" data-action="save-transaction">
        <div class="composer__head">
          <div>
            <p class="eyebrow">Nuevo movimiento</p>
            <h2>Agregar gasto</h2>
          </div>
          <button type="button" data-action="close-composer" aria-label="Cerrar">X</button>
        </div>

        <label>
          Descripción
          <input name="description" placeholder="Super, gasolina, cafe..." required />
        </label>

        <div class="form-grid">
          <label>
            Monto
            <input name="amount" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" required />
          </label>
          <label>
            Fecha
            <input name="date" type="date" value="${today()}" required />
          </label>
        </div>

        <div class="segmented" aria-label="Categoria">
          ${allCategories
            .map((category) => `<button type="button" class="${state.selectedCategory === category.key ? "active" : ""}" data-category="${category.key}">${category.label}</button>`)
            .join("")}
        </div>

        <label>
          Cuenta
          <select name="account">
            <option>Debito</option>
            <option>Tarjeta Q</option>
            <option>Tarjeta $</option>
            <option>Efectivo</option>
            <option>GYT</option>
            <option>Ingreso</option>
          </select>
        </label>

        <label>
          Nota
          <textarea name="note" placeholder="Opcional"></textarea>
        </label>

        <button class="submit-button" type="submit">Guardar movimiento</button>
      </form>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      render();
    });
  });

  document.querySelectorAll("[data-action='open-composer']").forEach((button) => {
    button.addEventListener("click", openComposer);
  });

  document.querySelectorAll("[data-action='refresh-app']").forEach((button) => {
    button.addEventListener("click", refreshApp);
  });

  const clearSearch = document.querySelector("[data-action='clear-search']");
  if (clearSearch) {
    clearSearch.addEventListener("click", () => {
      state.query = "";
      render();
    });
  }

  const search = document.querySelector("[data-action='search']");
  if (search) {
    search.addEventListener("input", (event) => {
      state.query = event.target.value;
      render();
    });
  }

  document.querySelectorAll("[data-action='setting']").forEach((input) => {
    input.addEventListener("input", (event) => {
      state.settings[event.target.dataset.setting] = event.target.value;
      persist();
    });
  });

  document.querySelectorAll("[data-action='setting-number']").forEach((input) => {
    input.addEventListener("input", (event) => {
      state.settings[event.target.dataset.setting] = Number(event.target.value);
      persist();
      render();
    });
  });

  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.theme = button.dataset.themeChoice;
      persist();
      render();
    });
  });
}

function openComposer() {
  document.querySelector("#modal-root").innerHTML = composerTemplate();
  document.querySelector("[data-action='close-composer']").addEventListener("click", closeComposer);
  document.querySelector("[data-action='save-transaction']").addEventListener("submit", saveTransaction);
  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCategory = button.dataset.category;
      document.querySelectorAll("[data-category]").forEach((item) => item.classList.toggle("active", item === button));
    });
  });
}

function closeComposer() {
  document.querySelector("#modal-root").innerHTML = "";
}

async function saveTransaction(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const amount = Number(form.get("amount"));
  const description = String(form.get("description") || "").trim();

  if (!description || Number.isNaN(amount) || amount <= 0) {
    showToast("Revisa descripción y monto");
    return;
  }

  const transaction = {
    id: makeId(),
    date: String(form.get("date")),
    description,
    amount: state.selectedCategory === "income" ? amount : -amount,
    category: state.selectedCategory,
    account: String(form.get("account")),
    note: String(form.get("note") || "").trim(),
    syncState: state.settings.webhookUrl ? "syncing" : "queued",
  };

  state.transactions = [transaction, ...state.transactions];
  persist();
  closeComposer();
  render();

  try {
    const synced = await postToSheet(transaction);
    updateSyncState(transaction.id, synced ? "synced" : "queued");
    showToast(synced ? "Agregado y enviado a Sheets" : "Guardado en cola local");
    if (synced) window.setTimeout(refreshSummary, 900);
  } catch {
    updateSyncState(transaction.id, "failed");
    showToast("Guardado, falta reintentar sync");
  }
}

function updateSyncState(id, syncState) {
  state.transactions = state.transactions.map((transaction) => (transaction.id === id ? { ...transaction, syncState } : transaction));
  persist();
  render();
}

async function refreshApp() {
  const pending = state.transactions.filter((item) => item.syncState === "queued" || item.syncState === "failed");
  if (pending.length) await retrySync(false);
  await refreshSummary();
}

async function retrySync(showDoneToast = true) {
  const pending = state.transactions.filter((item) => item.syncState === "queued" || item.syncState === "failed");
  if (!state.settings.webhookUrl) {
    showToast("Agrega el webhook de Google Sheets");
    return;
  }
  if (!pending.length) {
    if (showDoneToast) showToast("Todo está sincronizado");
    return;
  }

  for (const transaction of pending) {
    updateSyncState(transaction.id, "syncing");
    try {
      const synced = await postToSheet(transaction);
      updateSyncState(transaction.id, synced ? "synced" : "failed");
    } catch {
      updateSyncState(transaction.id, "failed");
    }
  }

  if (showDoneToast) showToast("Sync terminado");
}

async function postToSheet(transaction) {
  if (!state.settings.webhookUrl.trim()) return false;

  const response = await fetch(state.settings.webhookUrl.trim(), {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      sheetUrl: SHEET_URL,
      month: monthName(transaction.date),
      category: transaction.category,
      date: transaction.date,
      description: transaction.description,
      amount: Math.abs(transaction.amount),
      account: transaction.account,
      note: transaction.note || "",
      createdAt: new Date().toISOString(),
    }),
  });

  return response.type === "opaque" || response.ok;
}

async function refreshSummary() {
  try {
    const { summary, transactions } = await getSummaryFromSheet();
    state.summary = {
      ...defaultSummary,
      ...summary,
      categoryTotals: { ...defaultSummary.categoryTotals, ...(summary.categoryTotals || {}) },
      updatedAt: new Date().toISOString(),
    };
    const pending = state.transactions.filter((item) => item.syncState === "queued" || item.syncState === "failed" || item.syncState === "syncing");
    state.transactions = [...pending, ...transactions];
    persist();
    render();
    showToast("Dashboard actualizado");
  } catch {
    showToast("No pude leer Sheets todavía");
  }
}

async function getSummaryFromSheet() {
  const [table, saldoAlDia, totalReceived, totalExpenses, ahorro, fixed, necessary, fun, outflow] = await Promise.all([
    getSheetTable("A1:Z80"),
    getSheetCell("H20"),
    getSheetCell("H17"),
    getSheetCell("O3"),
    getSheetCell("D20"),
    getSheetCell("N5"),
    getSheetCell("R5"),
    getSheetCell("V5"),
    getSheetCell("Z5"),
  ]);

  return {
    summary: {
      month: SHEET_NAME,
      saldoAlDia,
      totalReceived,
      totalExpenses,
      ahorro,
      categoryTotals: { fixed, necessary, fun, outflow },
      credits: [],
    },
    transactions: sheetTransactions(table.rows || []),
  };
}

async function getSheetCell(range) {
  const table = await getSheetTable(range);
  return numberOr(table.rows?.[0]?.c?.[0]?.v);
}

function getSheetTable(range) {
  return new Promise((resolve, reject) => {
    const sheetId = SHEET_URL.match(/\/d\/([^/]+)/)?.[1];
    if (!sheetId) return reject(new Error("Missing spreadsheet ID"));
    const callbackName = `luiWalletSheet_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");

    window[callbackName] = (payload) => {
      cleanup();
      if (payload?.status !== "ok" || !payload?.table) {
        reject(new Error("Invalid Sheets response"));
        return;
      }
      resolve(payload.table);
    };

    const cleanup = () => {
      script.remove();
      delete window[callbackName];
      window.clearTimeout(timer);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Summary request timed out"));
    }, 10000);

    script.onerror = () => {
      cleanup();
      reject(new Error("Summary request failed"));
    };

    const params = new URLSearchParams({
      sheet: SHEET_NAME,
      range,
      headers: "0",
      tqx: `responseHandler:${callbackName}`,
    });
    script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${params}`;
    document.body.appendChild(script);
  });
}

function sheetTransactions(rows) {
  const transactions = [];
  const cell = (row, column) => rows[row]?.c?.[column]?.v;
  const dateValue = (value) => {
    const match = String(value || "").match(/^Date\((\d+),(\d+),(\d+)\)$/);
    if (!match) return "";
    const [, year, month, day] = match;
    return `${year}-${String(Number(month) + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const blocks = [
    { category: "fixed", date: 10, description: 11, amount: 12 },
    { category: "necessary", date: 14, description: 15, amount: 16 },
    { category: "fun", date: 18, description: 19, amount: 20 },
    { category: "outflow", date: 22, description: 23, amount: 24 },
  ];

  blocks.forEach((block) => {
    rows.forEach((row, rowIndex) => {
      const date = dateValue(cell(rowIndex, block.date));
      const description = String(cell(rowIndex, block.description) || "").trim();
      const amount = numberOr(cell(rowIndex, block.amount));
      if (!date || !description || amount <= 0) return;
      transactions.push({
        id: `sheet-${block.category}-${rowIndex}`,
        date,
        description,
        amount: -amount,
        category: block.category,
        account: "Google Sheets",
        syncState: "synced",
      });
    });
  });

  let incomeSectionEnded = false;
  rows.forEach((row, rowIndex) => {
    const description = String(cell(rowIndex, 1) || "").trim();
    const amount = numberOr(cell(rowIndex, 3));
    if (/total recibido/i.test(description)) {
      incomeSectionEnded = true;
      return;
    }
    if (incomeSectionEnded || !description || amount <= 0) return;
    transactions.push({
      id: `sheet-income-${rowIndex}`,
      date: "2026-09-01",
      description,
      amount,
      category: "income",
      account: "Ingreso",
      syncState: "synced",
    });
  });

  return transactions.sort((a, b) => b.date.localeCompare(a.date));
}

function showToast(message) {
  const toastRoot = document.querySelector("#toast-root");
  toastRoot.innerHTML = `<div class="toast">${escapeHtml(message)}</div>`;
  window.setTimeout(() => {
    toastRoot.innerHTML = "";
  }, 2200);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => undefined);
    refreshSummary();
  });
}

render();
