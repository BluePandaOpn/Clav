import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { decryptWithLayers, encryptWithLayers } from "./multilayer-crypto.js";

const DB_FILE = new URL("./data/vault.json", import.meta.url);
const DB_FILE_PATH = fileURLToPath(DB_FILE);

async function ensureStore() {
  const dir = dirname(DB_FILE_PATH);
  await mkdir(dir, { recursive: true });
  try {
    await readFile(DB_FILE_PATH, "utf8");
  } catch {
    await writeFile(
      DB_FILE_PATH,
      JSON.stringify({ credentials: [], trustedDevices: [], auditLogs: [] }, null, 2),
      "utf8"
    );
  }
}

export async function readStore() {
  await ensureStore();
  const raw = await readFile(DB_FILE_PATH, "utf8");
  return normalizeStore(JSON.parse(raw));
}

export async function writeStore(data) {
  await ensureStore();
  await writeFile(DB_FILE_PATH, JSON.stringify(normalizeStore(data), null, 2), "utf8");
}

export async function listCredentials(query = "") {
  const db = await readStore();
  const normalized = db.credentials.map(materializeCredential);
  const q = query.trim().toLowerCase();
  if (!q) return normalized;
  return normalized.filter((item) => {
    return (
      (item.service || "").toLowerCase().includes(q) ||
      (item.username || "").toLowerCase().includes(q) ||
      (item.notes || "").toLowerCase().includes(q)
    );
  });
}

export async function createCredential(payload) {
  const db = await readStore();
  const now = new Date().toISOString();
  const id = randomUUID();
  const item = {
    id,
    service: payload.service,
    username: payload.username || "",
    passwordEnc: encryptWithLayers(payload.password, id),
    category: payload.category || "General",
    notes: payload.notes || "",
    createdAt: now,
    updatedAt: now
  };
  db.credentials.unshift(item);
  await writeStore(db);
  return materializeCredential(item);
}

export async function updateCredential(id, payload) {
  const db = await readStore();
  const index = db.credentials.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const existing = db.credentials[index];
  const passwordEnc =
    typeof payload.password === "string" && payload.password.length
      ? encryptWithLayers(payload.password, id)
      : existing.passwordEnc;

  db.credentials[index] = {
    ...existing,
    service: payload.service ?? existing.service,
    username: payload.username ?? existing.username,
    category: payload.category ?? existing.category,
    notes: payload.notes ?? existing.notes,
    passwordEnc,
    updatedAt: new Date().toISOString()
  };
  await writeStore(db);
  return materializeCredential(db.credentials[index]);
}

export async function deleteCredential(id) {
  const db = await readStore();
  const before = db.credentials.length;
  db.credentials = db.credentials.filter((item) => item.id !== id);
  if (db.credentials.length === before) return false;
  await writeStore(db);
  return true;
}

export async function clearCredentials() {
  const db = await readStore();
  db.credentials = [];
  await writeStore(db);
}

export async function listTrustedDevices() {
  const db = await readStore();
  return db.trustedDevices;
}

export async function addTrustedDevice(payload) {
  const db = await readStore();
  const now = new Date().toISOString();
  const item = {
    id: randomUUID(),
    label: payload.label || "device",
    ip: payload.ip || "n/a",
    userAgent: payload.userAgent || "n/a",
    source: payload.source || "qr_unlock",
    createdAt: now
  };
  db.trustedDevices.unshift(item);
  db.trustedDevices = db.trustedDevices.slice(0, 100);
  await writeStore(db);
  return item;
}

export async function addAuditLog(payload) {
  const db = await readStore();
  const item = {
    id: randomUUID(),
    type: payload.type || "EVENT",
    detail: payload.detail || "",
    ip: payload.ip || "n/a",
    userAgent: payload.userAgent || "n/a",
    createdAt: new Date().toISOString()
  };
  db.auditLogs.unshift(item);
  db.auditLogs = db.auditLogs.slice(0, 500);
  await writeStore(db);
  return item;
}

export async function listAuditLogs(limit = 60) {
  const db = await readStore();
  return db.auditLogs.slice(0, Math.max(1, Math.min(300, Number(limit) || 60)));
}

function materializeCredential(item) {
  if (!item) return item;
  if (!item.passwordEnc && typeof item.password === "string") {
    return item;
  }

  let password = "";
  try {
    password = decryptWithLayers(item.passwordEnc, item.id);
  } catch {
    password = "[DECRYPTION_ERROR]";
  }

  return {
    id: item.id,
    service: item.service,
    username: item.username || "",
    password,
    category: item.category || "General",
    notes: item.notes || "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function normalizeStore(input) {
  const db = input && typeof input === "object" ? input : {};
  const credentials = Array.isArray(db.credentials) ? db.credentials : [];
  const trustedDevices = Array.isArray(db.trustedDevices) ? db.trustedDevices : [];
  const auditLogs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  return { credentials, trustedDevices, auditLogs };
}
