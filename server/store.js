import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { decryptWithLayers, encryptWithLayers } from "./multilayer-crypto.js";
import { signCredentialEntry, verifyCredentialEntry } from "./entry-signature.js";
import { createHybridSharePackage } from "./hybrid-share.js";
import { checkPasswordBreach } from "./breach-detection.js";
import { config } from "./config.js";

const DB_FILE = new URL("./data/vault.json", import.meta.url);
const DB_FILE_PATH = fileURLToPath(DB_FILE);
const MAX_HISTORY_ENTRIES = 50;

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
  let changed = false;

  if (config.breachAutoScanOnList) {
    changed = await refreshStaleBreachStatuses(db);
  }

  if (changed) {
    await writeStore(db);
  }

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
  const passwordEnc = encryptWithLayers(payload.password, id);
  const unsignedItem = {
    id,
    service: payload.service,
    username: payload.username || "",
    passwordEnc,
    category: payload.category || "General",
    notes: payload.notes || "",
    isSensitive: Boolean(payload.isSensitive),
    isHoney: Boolean(payload.isHoney),
    honeyTag: payload.honeyTag || "",
    honeyLastTriggeredAt: null,
    passwordVersion: 1,
    passwordHistory: [],
    changeLog: [
      {
        at: now,
        type: "CREATED",
        fields: ["service", "username", "password", "category", "notes", "isSensitive"]
      }
    ],
    breachStatus: payload.breachStatus || null,
    createdAt: now,
    updatedAt: now
  };
  const item = {
    ...unsignedItem,
    signature: signCredentialEntry(unsignedItem)
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
  const hasPasswordChange = typeof payload.password === "string" && payload.password.length > 0;
  const passwordEnc = hasPasswordChange ? encryptWithLayers(payload.password, id) : existing.passwordEnc;
  const fieldsChanged = getChangedFields(existing, payload, hasPasswordChange);
  const now = new Date().toISOString();
  const baseVersion = Number(existing.passwordVersion || 1);
  const nextVersion = hasPasswordChange ? baseVersion + 1 : baseVersion;
  const nextHistory = hasPasswordChange
    ? [
        {
          version: baseVersion,
          passwordEnc: existing.passwordEnc,
          changedAt: now
        },
        ...(Array.isArray(existing.passwordHistory) ? existing.passwordHistory : [])
      ].slice(0, MAX_HISTORY_ENTRIES)
    : Array.isArray(existing.passwordHistory)
      ? existing.passwordHistory
      : [];
  const nextChangeLog = fieldsChanged.length
    ? [
        {
          at: now,
          type: "UPDATED",
          fields: fieldsChanged
        },
        ...(Array.isArray(existing.changeLog) ? existing.changeLog : [])
      ].slice(0, MAX_HISTORY_ENTRIES)
    : Array.isArray(existing.changeLog)
      ? existing.changeLog
      : [];

  const updatedItem = {
    ...existing,
    service: payload.service ?? existing.service,
    username: payload.username ?? existing.username,
    category: payload.category ?? existing.category,
    notes: payload.notes ?? existing.notes,
    isSensitive:
      typeof payload.isSensitive === "boolean" ? payload.isSensitive : Boolean(existing.isSensitive),
    isHoney: typeof payload.isHoney === "boolean" ? payload.isHoney : Boolean(existing.isHoney),
    honeyTag: payload.honeyTag ?? existing.honeyTag ?? "",
    honeyLastTriggeredAt: existing.honeyLastTriggeredAt || null,
    passwordVersion: nextVersion,
    passwordHistory: nextHistory,
    changeLog: nextChangeLog,
    breachStatus: payload.breachStatus ?? existing.breachStatus ?? null,
    passwordEnc,
    updatedAt: now
  };
  db.credentials[index] = {
    ...updatedItem,
    signature: signCredentialEntry(updatedItem)
  };
  await writeStore(db);
  return materializeCredential(db.credentials[index]);
}

export async function getCredentialHistory(credentialId) {
  const db = await readStore();
  const item = db.credentials.find((entry) => entry.id === credentialId);
  if (!item) return null;

  const materialized = materializeCredential(item);
  if (materialized.integrity === "tampered") {
    return {
      credentialId: item.id,
      integrity: materialized.integrity,
      createdAt: item.createdAt,
      currentVersion: Number(item.passwordVersion || 1),
      changes: Array.isArray(item.changeLog) ? item.changeLog : [],
      previousVersions: []
    };
  }

  const previousVersions = Array.isArray(item.passwordHistory)
    ? item.passwordHistory.map((entry) => {
        let password = "[DECRYPTION_ERROR]";
        try {
          password = decryptWithLayers(entry.passwordEnc, item.id);
        } catch {
          // Keep placeholder for corrupted history entries.
        }
        return {
          version: Number(entry.version || 0),
          changedAt: entry.changedAt || item.updatedAt,
          password
        };
      })
    : [];

  return {
    credentialId: item.id,
    integrity: materialized.integrity,
    createdAt: item.createdAt,
    currentVersion: Number(item.passwordVersion || 1),
    changes: Array.isArray(item.changeLog) ? item.changeLog : [],
    previousVersions
  };
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

export async function generateHoneyCredentials(count = 3) {
  const safeCount = Math.max(1, Math.min(20, Number(count) || 3));
  const db = await readStore();
  const now = new Date().toISOString();
  const templates = [
    { service: "CorpVPN", username: "ops.admin" },
    { service: "Payroll-Internal", username: "finance.audit" },
    { service: "Prod-Database", username: "db.readonly" },
    { service: "Root-Console", username: "sys.root" },
    { service: "AWS-Billing", username: "billing.ops" },
    { service: "CRM-Backoffice", username: "support.agent" }
  ];

  const created = [];
  for (let i = 0; i < safeCount; i += 1) {
    const tpl = templates[i % templates.length];
    const id = randomUUID();
    const itemBase = {
      id,
      service: tpl.service,
      username: `${tpl.username}.${Math.floor(Math.random() * 900 + 100)}`,
      passwordEnc: encryptWithLayers(generateHoneyPassword(), id),
      category: "Work",
      notes: "Honey password (monitorizado)",
      isSensitive: false,
      isHoney: true,
      honeyTag: "v0.1.4",
      honeyLastTriggeredAt: null,
      passwordVersion: 1,
      passwordHistory: [],
      changeLog: [
        {
          at: now,
          type: "CREATED",
          fields: ["service", "username", "password", "category", "notes", "isSensitive", "isHoney"]
        }
      ],
      createdAt: now,
      updatedAt: now
    };
    const item = {
      ...itemBase,
      signature: signCredentialEntry(itemBase)
    };
    db.credentials.unshift(item);
    created.push(materializeCredential(item));
  }

  await writeStore(db);
  return created;
}

export async function registerHoneyCredentialAccess(credentialId, action, meta = {}) {
  const db = await readStore();
  const index = db.credentials.findIndex((item) => item.id === credentialId);
  if (index === -1) return null;

  const current = db.credentials[index];
  if (!current.isHoney) return null;

  const updated = {
    ...current,
    honeyLastTriggeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.credentials[index] = {
    ...updated,
    signature: signCredentialEntry(updated)
  };

  const log = {
    id: randomUUID(),
    type: "HONEY_PASSWORD_ACCESSED",
    detail: `${action}:${current.service}:${current.id}`,
    ip: meta.ip || "n/a",
    userAgent: meta.userAgent || "n/a",
    createdAt: new Date().toISOString()
  };
  db.auditLogs.unshift(log);
  db.auditLogs = db.auditLogs.slice(0, 500);

  await writeStore(db);
  return { log, item: materializeCredential(db.credentials[index]) };
}

export async function refreshCredentialBreachStatus(credentialId) {
  const db = await readStore();
  const index = db.credentials.findIndex((item) => item.id === credentialId);
  if (index === -1) return null;

  const target = db.credentials[index];
  let breachStatus;
  try {
    const password = decryptWithLayers(target.passwordEnc, target.id);
    breachStatus = await checkPasswordBreach(password);
  } catch (error) {
    breachStatus = {
      compromised: false,
      pwnedCount: 0,
      sources: [],
      checkedAt: new Date().toISOString(),
      hibpError: `scan_error:${error.message}`
    };
  }

  db.credentials[index] = {
    ...target,
    breachStatus
  };
  await writeStore(db);
  return materializeCredential(db.credentials[index]);
}

export async function scanAllCredentialsForBreaches() {
  const db = await readStore();
  const updated = [];
  let compromised = 0;

  for (let i = 0; i < db.credentials.length; i += 1) {
    const item = db.credentials[i];
    let breachStatus;
    try {
      const password = decryptWithLayers(item.passwordEnc, item.id);
      breachStatus = await checkPasswordBreach(password);
    } catch (error) {
      breachStatus = {
        compromised: false,
        pwnedCount: 0,
        sources: [],
        checkedAt: new Date().toISOString(),
        hibpError: `scan_error:${error.message}`
      };
    }
    db.credentials[i] = {
      ...item,
      breachStatus
    };
    const materialized = materializeCredential(db.credentials[i]);
    if (breachStatus.compromised) compromised += 1;
    updated.push(materialized);
  }

  await writeStore(db);
  return {
    total: updated.length,
    compromised,
    items: updated
  };
}

async function refreshStaleBreachStatuses(db) {
  let changed = false;
  for (let i = 0; i < db.credentials.length; i += 1) {
    const item = db.credentials[i];
    if (!needsBreachRefresh(item)) continue;

    const breachStatus = await computeBreachStatusSafe(item);
    db.credentials[i] = {
      ...item,
      breachStatus
    };
    changed = true;
  }
  return changed;
}

function needsBreachRefresh(item) {
  if (!item?.breachStatus?.checkedAt) return true;
  const checkedAtTs = Date.parse(item.breachStatus.checkedAt);
  if (Number.isNaN(checkedAtTs)) return true;

  const ttlMs = Math.max(1, Number(config.breachStatusTtlHours || 24)) * 60 * 60 * 1000;
  return Date.now() - checkedAtTs >= ttlMs;
}

async function computeBreachStatusSafe(item) {
  try {
    const password = decryptWithLayers(item.passwordEnc, item.id);
    return await checkPasswordBreach(password);
  } catch (error) {
    return {
      compromised: false,
      pwnedCount: 0,
      sources: [],
      checkedAt: new Date().toISOString(),
      hibpError: `scan_error:${error.message}`
    };
  }
}

export async function listTrustedDevices() {
  const db = await readStore();
  return db.trustedDevices;
}

export async function upsertDeviceEncryptionKey(payload) {
  if (!payload?.publicKeyPem || !payload?.deviceId) {
    throw new Error("deviceId and publicKeyPem are required.");
  }

  const db = await readStore();
  const now = new Date().toISOString();
  const index = db.trustedDevices.findIndex((item) => item.id === payload.deviceId);
  const current = index >= 0 ? db.trustedDevices[index] : null;

  const merged = {
    id: payload.deviceId,
    label: payload.label || current?.label || "device",
    ip: payload.ip || current?.ip || "n/a",
    userAgent: payload.userAgent || current?.userAgent || "n/a",
    source: current?.source || "device_key",
    createdAt: current?.createdAt || now,
    updatedAt: now,
    encryptionPublicKeyPem: payload.publicKeyPem
  };

  if (index >= 0) {
    db.trustedDevices[index] = merged;
  } else {
    db.trustedDevices.unshift(merged);
  }

  db.trustedDevices = db.trustedDevices.slice(0, 100);
  await writeStore(db);

  return {
    id: merged.id,
    label: merged.label,
    createdAt: merged.createdAt,
    updatedAt: merged.updatedAt
  };
}

export async function listShareTargets() {
  const db = await readStore();
  return db.trustedDevices
    .filter((item) => Boolean(item.encryptionPublicKeyPem))
    .map((item) => ({
      id: item.id,
      label: item.label,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt || item.createdAt
    }));
}

export async function createCredentialSharePackage(credentialId, targetDeviceId) {
  const db = await readStore();
  const target = db.trustedDevices.find((item) => item.id === targetDeviceId);
  if (!target?.encryptionPublicKeyPem) {
    const err = new Error("Target device does not have a registered encryption key.");
    err.statusCode = 404;
    throw err;
  }

  const credential = db.credentials.find((item) => item.id === credentialId);
  if (!credential) {
    const err = new Error("Credential not found.");
    err.statusCode = 404;
    throw err;
  }

  if (credential.signature && !verifyCredentialEntry(credential)) {
    const err = new Error("Credential signature invalid. Sharing blocked.");
    err.statusCode = 409;
    throw err;
  }

  const password = decryptWithLayers(credential.passwordEnc, credential.id);
  const packagePayload = {
    id: credential.id,
    service: credential.service,
    username: credential.username || "",
    password,
    category: credential.category || "General",
    notes: credential.notes || "",
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt
  };

  return createHybridSharePackage(packagePayload, target.encryptionPublicKeyPem, {
    credentialId: credential.id,
    targetDeviceId: target.id,
    createdAt: new Date().toISOString()
  });
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

  const hasSignature = Boolean(item.signature?.sig);
  const signatureValid = hasSignature ? verifyCredentialEntry(item) : null;
  const integrity = !hasSignature ? "legacy_unsigned" : signatureValid ? "verified" : "tampered";

  let password = "";
  if (integrity === "tampered") {
    password = "[SIGNATURE_INVALID]";
  } else {
    try {
      password = decryptWithLayers(item.passwordEnc, item.id);
    } catch {
      password = "[DECRYPTION_ERROR]";
    }
  }

  return {
    id: item.id,
    service: item.service,
    username: item.username || "",
    password,
    category: item.category || "General",
    notes: item.notes || "",
    isSensitive: Boolean(item.isSensitive),
    isHoney: Boolean(item.isHoney),
    honeyTag: item.honeyTag || "",
    honeyLastTriggeredAt: item.honeyLastTriggeredAt || null,
    passwordVersion: Number(item.passwordVersion || 1),
    previousVersionCount: Array.isArray(item.passwordHistory) ? item.passwordHistory.length : 0,
    breachStatus: item.breachStatus || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    integrity
  };
}

function generateHoneyPassword(length = 20) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function normalizeStore(input) {
  const db = input && typeof input === "object" ? input : {};
  const credentials = Array.isArray(db.credentials) ? db.credentials : [];
  const trustedDevices = Array.isArray(db.trustedDevices) ? db.trustedDevices : [];
  const auditLogs = Array.isArray(db.auditLogs) ? db.auditLogs : [];
  return { credentials, trustedDevices, auditLogs };
}

function getChangedFields(existing, payload, hasPasswordChange) {
  const changed = [];
  if (hasPasswordChange) changed.push("password");
  if (typeof payload.service === "string" && payload.service !== existing.service) changed.push("service");
  if (typeof payload.username === "string" && payload.username !== existing.username) changed.push("username");
  if (typeof payload.category === "string" && payload.category !== existing.category) changed.push("category");
  if (typeof payload.notes === "string" && payload.notes !== existing.notes) changed.push("notes");
  if (typeof payload.isSensitive === "boolean" && payload.isSensitive !== Boolean(existing.isSensitive)) {
    changed.push("isSensitive");
  }
  return changed;
}
