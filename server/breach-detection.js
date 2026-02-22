import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "./config.js";

const DEFAULT_LOCAL_BREACHED = new Set([
  "123456",
  "password",
  "qwerty",
  "12345678",
  "111111",
  "abc123",
  "password1",
  "123123",
  "admin",
  "letmein"
]);

const hibpCache = new Map();
let localLeakedSetPromise = null;

export async function checkPasswordBreach(password) {
  const value = String(password || "");
  if (!value) {
    return {
      compromised: false,
      pwnedCount: 0,
      sources: [],
      checkedAt: new Date().toISOString(),
      hibpError: null
    };
  }

  const localSet = await getLocalLeakedSet();
  const normalized = value.toLowerCase();
  const inLocalList = localSet.has(normalized);

  let pwnedCount = 0;
  let hibpError = null;

  if (config.hibpEnabled) {
    try {
      pwnedCount = await queryHibpPwnedCount(value);
    } catch (error) {
      hibpError = error.message;
    }
  }

  const sources = [];
  if (inLocalList) sources.push("local_leaked_db");
  if (pwnedCount > 0) sources.push("hibp");

  return {
    compromised: inLocalList || pwnedCount > 0,
    pwnedCount,
    sources,
    checkedAt: new Date().toISOString(),
    hibpError
  };
}

async function getLocalLeakedSet() {
  if (!localLeakedSetPromise) {
    localLeakedSetPromise = loadLocalLeakedSet();
  }
  return localLeakedSetPromise;
}

async function loadLocalLeakedSet() {
  const merged = new Set(DEFAULT_LOCAL_BREACHED);
  const path = resolve(process.cwd(), config.leakedPasswordsFile);

  try {
    const raw = await readFile(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const value = line.trim().toLowerCase();
      if (!value || value.startsWith("#")) continue;
      merged.add(value);
    }
  } catch {
    // Fall back to defaults when file is missing or inaccessible.
  }

  return merged;
}

async function queryHibpPwnedCount(password) {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const rangeData = await fetchRange(prefix);
  return rangeData.get(suffix) || 0;
}

async function fetchRange(prefix) {
  const cached = hibpCache.get(prefix);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.hibpTimeoutMs);

  let response;
  try {
    response = await fetch(`${config.hibpRangeBaseUrl}/${prefix}`, {
      method: "GET",
      headers: {
        "Add-Padding": "true",
        "User-Agent": "Password-Manager-Pro-BreachCheck/0.1.5"
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`HIBP request failed with status ${response.status}`);
  }

  const text = await response.text();
  const parsed = parseRangeResponse(text);
  hibpCache.set(prefix, {
    data: parsed,
    expiresAt: Date.now() + 15 * 60 * 1000
  });
  return parsed;
}

function parseRangeResponse(text) {
  const map = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const [suffix, countRaw] = line.split(":");
    if (!suffix || !countRaw) continue;
    const count = Number(countRaw);
    if (!Number.isFinite(count)) continue;
    map.set(suffix.toUpperCase(), count);
  }
  return map;
}
