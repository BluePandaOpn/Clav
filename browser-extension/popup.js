const apiBaseInput = document.getElementById("apiBase");
const queryInput = document.getElementById("queryInput");
const saveBtn = document.getElementById("saveBtn");
const refreshBtn = document.getElementById("refreshBtn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

let currentApiBase = "";
let currentItems = [];

init().catch((error) => setStatus(error.message, true));

saveBtn.addEventListener("click", async () => {
  const apiBase = normalizeApiBase(apiBaseInput.value);
  if (!apiBase) {
    setStatus("API base invalida.", true);
    return;
  }

  const res = await runtimeMessage({
    type: "SAVE_SETTINGS",
    apiBase
  });
  if (!res.ok) {
    setStatus(res.error || "No se pudo guardar.", true);
    return;
  }
  currentApiBase = apiBase;
  setStatus("Configuracion guardada.");
});

refreshBtn.addEventListener("click", async () => {
  await loadCredentials();
});

queryInput.addEventListener("input", async () => {
  await loadCredentials();
});

async function init() {
  const defaults = await runtimeMessage({ type: "GET_DEFAULTS" });
  currentApiBase = normalizeApiBase(defaults.apiBase);
  apiBaseInput.value = currentApiBase;

  const [tab] = await queryActiveTab();
  const hostname = safeHostname(tab?.url || "");
  queryInput.value = hostname;

  await loadCredentials();
}

async function loadCredentials() {
  setStatus("Buscando...");
  const query = String(queryInput.value || "").trim();
  const apiBase = normalizeApiBase(apiBaseInput.value);
  if (!apiBase) {
    setStatus("Configura API base valida.", true);
    return;
  }

  const res = await runtimeMessage({
    type: "LIST_CREDENTIALS",
    apiBase,
    query
  });

  if (!res.ok) {
    setStatus(res.error || "Error al listar credenciales.", true);
    renderResults([]);
    return;
  }

  currentApiBase = apiBase;
  currentItems = Array.isArray(res.items) ? res.items : [];
  renderResults(currentItems);
  setStatus(`${currentItems.length} credencial(es) lista(s).`);
}

function renderResults(items) {
  resultsEl.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.className = "item";
    li.textContent = "Sin coincidencias.";
    resultsEl.appendChild(li);
    return;
  }

  for (const item of items.slice(0, 30)) {
    const li = document.createElement("li");
    li.className = "item";

    const title = document.createElement("strong");
    title.textContent = item.service || "Servicio";

    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = item.username || "Sin usuario";

    const actions = document.createElement("div");
    actions.className = "actions";

    const fillBtn = document.createElement("button");
    fillBtn.className = "primary";
    fillBtn.textContent = "Autocompletar";
    fillBtn.addEventListener("click", () => autofill(item));

    actions.appendChild(fillBtn);
    li.append(title, sub, actions);
    resultsEl.appendChild(li);
  }
}

async function autofill(item) {
  const res = await runtimeMessage({
    type: "AUTOFILL_ACTIVE_TAB",
    apiBase: currentApiBase,
    credential: item
  });

  if (!res.ok) {
    setStatus(res.error || "No se pudo autocompletar.", true);
    return;
  }

  setStatus("Autocompletado aplicado.");
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", Boolean(isError));
}

function normalizeApiBase(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function runtimeMessage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: "Sin respuesta de extension." });
    });
  });
}

function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => resolve(tabs || []));
  });
}
