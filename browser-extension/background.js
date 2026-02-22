const DEFAULT_API_BASE = "http://localhost:4000/api/v1/vault-x9f3k7s2m1q8n4z6t0p5r2d7c9";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;

  if (message.type === "GET_DEFAULTS") {
    storageGet(["apiBase"], (data) => {
      sendResponse({
        apiBase: data.apiBase || DEFAULT_API_BASE
      });
    });
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    const apiBase = String(message.apiBase || "").trim();
    if (!apiBase) {
      sendResponse({ ok: false, error: "API base requerida." });
      return false;
    }
    storageSet({ apiBase }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "LIST_CREDENTIALS") {
    listCredentials(message)
      .then((items) => sendResponse({ ok: true, items }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "AUTOFILL_ACTIVE_TAB") {
    autofillActiveTab(message)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function listCredentials(message) {
  const apiBase = await resolveApiBase(message.apiBase);
  const q = String(message.query || "").trim();
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  const res = await fetch(`${apiBase}/credentials${query}`);
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || "No se pudieron listar credenciales.");
  if (!Array.isArray(data.items)) return [];
  return data.items.filter((item) => item?.integrity !== "tampered");
}

async function autofillActiveTab(message) {
  const credential = message.credential;
  if (!credential || typeof credential !== "object") {
    throw new Error("Credencial invalida.");
  }

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error("No se encontro una pestana activa.");

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tab.id,
      {
        type: "AUTOFILL_CREDENTIAL",
        credential: {
          service: credential.service || "",
          username: credential.username || "",
          password: credential.password || ""
        }
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || "No se pudo autocompletar."));
          return;
        }
        resolve(response);
      }
    );
  });
}

async function resolveApiBase(inlineApiBase) {
  const provided = String(inlineApiBase || "").trim();
  if (provided) return stripTrailingSlash(provided);

  const data = await storageGetPromise(["apiBase"]);
  const saved = String(data.apiBase || "").trim();
  if (saved) return stripTrailingSlash(saved);
  return stripTrailingSlash(DEFAULT_API_BASE);
}

function stripTrailingSlash(input) {
  return input.replace(/\/+$/, "");
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function storageGet(keys, done) {
  chrome.storage.local.get(keys, (data) => done(data || {}));
}

function storageSet(payload, done) {
  chrome.storage.local.set(payload, () => done());
}

function storageGetPromise(keys) {
  return new Promise((resolve) => {
    storageGet(keys, (data) => resolve(data));
  });
}
