import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const DB_FILE = new URL("./data/vault.json", import.meta.url);
const DB_FILE_PATH = fileURLToPath(DB_FILE);

async function ensureStore() {
  const dir = dirname(DB_FILE_PATH);
  await mkdir(dir, { recursive: true });
  try {
    await readFile(DB_FILE_PATH, "utf8");
  } catch {
    await writeFile(DB_FILE_PATH, JSON.stringify({ credentials: [] }, null, 2), "utf8");
  }
}

export async function readStore() {
  await ensureStore();
  const raw = await readFile(DB_FILE_PATH, "utf8");
  return JSON.parse(raw);
}

export async function writeStore(data) {
  await ensureStore();
  await writeFile(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function listCredentials(query = "") {
  const db = await readStore();
  const q = query.trim().toLowerCase();
  if (!q) return db.credentials;
  return db.credentials.filter((item) => {
    return (
      item.service.toLowerCase().includes(q) ||
      item.username.toLowerCase().includes(q) ||
      item.notes.toLowerCase().includes(q)
    );
  });
}

export async function createCredential(payload) {
  const db = await readStore();
  const now = new Date().toISOString();
  const item = {
    id: randomUUID(),
    service: payload.service,
    username: payload.username || "",
    password: payload.password,
    category: payload.category || "General",
    notes: payload.notes || "",
    createdAt: now,
    updatedAt: now
  };
  db.credentials.unshift(item);
  await writeStore(db);
  return item;
}

export async function updateCredential(id, payload) {
  const db = await readStore();
  const index = db.credentials.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const existing = db.credentials[index];
  db.credentials[index] = {
    ...existing,
    ...payload,
    updatedAt: new Date().toISOString()
  };
  await writeStore(db);
  return db.credentials[index];
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
  await writeStore({ credentials: [] });
}
