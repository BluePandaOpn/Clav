import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { decryptWithLayers, encryptWithLayers } from "./multilayer-crypto.js";
import { signCredentialEntry, verifyCredentialEntry } from "./entry-signature.js";
import { createHybridSharePackage } from "./hybrid-share.js";
import { checkPasswordBreach } from "./breach-detection.js";
import { config } from "./config.js";
import { classifyEntryType } from "./entry-classification.js";
import {
  buildRotationPolicy,
  buildSshRotationNotes,
  computeNextRotationAt,
  createRotationMaterial,
  isRotationDue
} from "./auto-rotation.js";

const LEGACY_DB_FILE = new URL("./data/vault.json", import.meta.url);
const LEGACY_DB_FILE_PATH = fileURLToPath(LEGACY_DB_FILE);
const SHARD_DIR = fileURLToPath(new URL("./data/shards", import.meta.url));
const METADATA_FILE_PATH = join(SHARD_DIR, "metadata.json");
const ENTRIES_FILE_PATH = join(SHARD_DIR, "entries.json");
const CRYPTO_FILE_PATH = join(SHARD_DIR, "crypto.json");
const MAX_HISTORY_ENTRIES = 50;

async function ensureStore() {
  await mkdir(dirname(LEGACY_DB_FILE_PATH), { recursive: true });
  await mkdir(SHARD_DIR, { recursive: true });

  const hasAnyShard = await anyShardExists();
  if (!hasAnyShard) {
    const legacy = await readLegacyStoreIfExists();
    const seed = normalizeStore(legacy || {
      credentials: [],
      trustedDevices: [],
      auditLogs: [],
      sharedVaults: [],
      emergencyContacts: [],
      emergencyRequests: []
    });
    await writeShardsFromStore(seed, null);
    return;
  }

  const entries = await readJsonSafe(ENTRIES_FILE_PATH, {
    credentials: [],
    trustedDevices: [],
    auditLogs: [],
    sharedVaults: [],
    emergencyContacts: [],
    emergencyRequests: []
  });
  const crypto = await readJsonSafe(CRYPTO_FILE_PATH, { credentials: [] });
  const metadata = await readJsonSafe(METADATA_FILE_PATH, null);

  if (!(await fileExists(ENTRIES_FILE_PATH))) {
    await atomicWriteJson(ENTRIES_FILE_PATH, entries);
  }
  if (!(await fileExists(CRYPTO_FILE_PATH))) {
    await atomicWriteJson(CRYPTO_FILE_PATH, crypto);
  }
  if (!(await fileExists(METADATA_FILE_PATH))) {
    await atomicWriteJson(METADATA_FILE_PATH, buildMetadata(entries, crypto, metadata));
  }
}

export async function readStore() {
  await ensureStore();
  return readCombinedFromShards();
}

export async function writeStore(data) {
  await ensureStore();
  await writeShardsFromStore(normalizeStore(data), await readMetadataSafe());
}

async function readCombinedFromShards() {
  const entriesShard = await readJsonSafe(ENTRIES_FILE_PATH, {
    credentials: [],
    trustedDevices: [],
    auditLogs: [],
    sharedVaults: [],
    emergencyContacts: [],
    emergencyRequests: []
  });
  const cryptoShard = await readJsonSafe(CRYPTO_FILE_PATH, { credentials: [] });
  const entriesList = Array.isArray(entriesShard.credentials) ? entriesShard.credentials : [];
  const cryptoMap = new Map();

  const cryptoList = Array.isArray(cryptoShard.credentials) ? cryptoShard.credentials : [];
  for (const crypto of cryptoList) {
    if (!crypto?.id) continue;
    cryptoMap.set(crypto.id, crypto);
  }

  const credentials = entriesList.map((entry) => {
    const crypto = cryptoMap.get(entry.id) || {};
    return {
      ...entry,
      passwordEnc: crypto.passwordEnc,
      signature: crypto.signature || null,
      passwordHistory: Array.isArray(crypto.passwordHistory) ? crypto.passwordHistory : []
    };
  });

  return normalizeStore({
    credentials,
    trustedDevices: Array.isArray(entriesShard.trustedDevices) ? entriesShard.trustedDevices : [],
    auditLogs: Array.isArray(entriesShard.auditLogs) ? entriesShard.auditLogs : [],
    sharedVaults: Array.isArray(entriesShard.sharedVaults) ? entriesShard.sharedVaults : [],
    emergencyContacts: Array.isArray(entriesShard.emergencyContacts) ? entriesShard.emergencyContacts : [],
    emergencyRequests: Array.isArray(entriesShard.emergencyRequests) ? entriesShard.emergencyRequests : []
  });
}

async function writeShardsFromStore(store, previousMetadata) {
  const credentials = Array.isArray(store.credentials) ? store.credentials : [];
  const entryCredentials = credentials.map((item) => {
    const entry = { ...item };
    delete entry.passwordEnc;
    delete entry.signature;
    delete entry.passwordHistory;
    return entry;
  });
  const cryptoCredentials = credentials.map((item) => ({
    id: item.id,
    passwordEnc: item.passwordEnc,
    signature: item.signature || null,
    passwordHistory: Array.isArray(item.passwordHistory) ? item.passwordHistory : []
  }));

  const entriesShard = {
    credentials: entryCredentials,
    trustedDevices: Array.isArray(store.trustedDevices) ? store.trustedDevices : [],
    auditLogs: Array.isArray(store.auditLogs) ? store.auditLogs : [],
    sharedVaults: Array.isArray(store.sharedVaults) ? store.sharedVaults : [],
    emergencyContacts: Array.isArray(store.emergencyContacts) ? store.emergencyContacts : [],
    emergencyRequests: Array.isArray(store.emergencyRequests) ? store.emergencyRequests : []
  };
  const cryptoShard = {
    credentials: cryptoCredentials
  };
  const metadataShard = buildMetadata(entriesShard, cryptoShard, previousMetadata);

  await Promise.all([
    atomicWriteJson(ENTRIES_FILE_PATH, entriesShard),
    atomicWriteJson(CRYPTO_FILE_PATH, cryptoShard),
    atomicWriteJson(METADATA_FILE_PATH, metadataShard)
  ]);
}

function buildMetadata(entriesShard, cryptoShard, previousMetadata) {
  const now = new Date().toISOString();
  const prev = previousMetadata && typeof previousMetadata === "object" ? previousMetadata : {};
  return {
    schemaVersion: "3.2.0",
    shardMode: "metadata-crypto-entries",
    createdAt: prev.createdAt || now,
    updatedAt: now,
    stats: {
      credentialsEntries: Array.isArray(entriesShard.credentials) ? entriesShard.credentials.length : 0,
      credentialsCrypto: Array.isArray(cryptoShard.credentials) ? cryptoShard.credentials.length : 0,
      trustedDevices: Array.isArray(entriesShard.trustedDevices) ? entriesShard.trustedDevices.length : 0,
      auditLogs: Array.isArray(entriesShard.auditLogs) ? entriesShard.auditLogs.length : 0,
      sharedVaults: Array.isArray(entriesShard.sharedVaults) ? entriesShard.sharedVaults.length : 0,
      emergencyContacts: Array.isArray(entriesShard.emergencyContacts) ? entriesShard.emergencyContacts.length : 0,
      emergencyRequests: Array.isArray(entriesShard.emergencyRequests) ? entriesShard.emergencyRequests.length : 0
    }
  };
}

async function readMetadataSafe() {
  return readJsonSafe(METADATA_FILE_PATH, null);
}

async function readLegacyStoreIfExists() {
  try {
    const raw = await readFile(LEGACY_DB_FILE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function anyShardExists() {
  return (
    (await fileExists(METADATA_FILE_PATH)) ||
    (await fileExists(ENTRIES_FILE_PATH)) ||
    (await fileExists(CRYPTO_FILE_PATH))
  );
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonSafe(path, fallback) {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function atomicWriteJson(path, value) {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await rename(tmp, path);
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
  const entryType = payload.entryType || classifyEntryType(payload);
  const rotationPolicy = buildRotationPolicy({
    existing: null,
    incoming: payload.rotationPolicy,
    credential: {
      service: payload.service,
      username: payload.username || "",
      notes: payload.notes || "",
      password: payload.password,
      entryType
    }
  });
  const unsignedItem = {
    id,
    service: payload.service,
    username: payload.username || "",
    passwordEnc,
    category: payload.category || "General",
    notes: payload.notes || "",
    entryType,
    rotationPolicy,
    isSensitive: Boolean(payload.isSensitive),
    isHoney: Boolean(payload.isHoney),
    honeyTag: payload.honeyTag || "",
    honeyLastTriggeredAt: null,
    crdt: resolveIncomingCrdt(payload._crdt),
    passwordVersion: 1,
    passwordHistory: [],
    changeLog: [
      {
        at: now,
        type: "CREATED",
        fields: ["service", "username", "password", "category", "notes", "isSensitive", "entryType", "rotationPolicy"]
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
  const existingCrdt = normalizeCrdt(existing.crdt);
  const incomingCrdt = resolveIncomingCrdt(payload._crdt);
  if (compareCrdt(existingCrdt, incomingCrdt) >= 0) {
    return materializeCredential(existing);
  }
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

  const nextService = payload.service ?? existing.service;
  const nextUsername = payload.username ?? existing.username;
  const nextNotes = payload.notes ?? existing.notes;
  const nextPassword = hasPasswordChange ? payload.password : decryptSafe(existing.passwordEnc, id);
  const entryType =
    payload.entryType ||
    classifyEntryType({
      service: nextService,
      username: nextUsername,
      notes: nextNotes,
      password: nextPassword
    });
  const rotationPolicy = buildRotationPolicy({
    existing: existing.rotationPolicy,
    incoming: payload.rotationPolicy,
    credential: {
      service: nextService,
      username: nextUsername,
      notes: nextNotes,
      password: nextPassword,
      entryType
    }
  });
  if (entryType !== existing.entryType && !fieldsChanged.includes("entryType")) {
    fieldsChanged.push("entryType");
  }
  if (hasRotationPolicyChanged(existing.rotationPolicy, rotationPolicy) && !fieldsChanged.includes("rotationPolicy")) {
    fieldsChanged.push("rotationPolicy");
  }

  const updatedItem = {
    ...existing,
    service: nextService,
    username: nextUsername,
    category: payload.category ?? existing.category,
    notes: nextNotes,
    entryType,
    rotationPolicy,
    isSensitive:
      typeof payload.isSensitive === "boolean" ? payload.isSensitive : Boolean(existing.isSensitive),
    isHoney: typeof payload.isHoney === "boolean" ? payload.isHoney : Boolean(existing.isHoney),
    honeyTag: payload.honeyTag ?? existing.honeyTag ?? "",
    honeyLastTriggeredAt: existing.honeyLastTriggeredAt || null,
    crdt: incomingCrdt,
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

export async function updateCredentialRotationPolicy(id, payload = {}) {
  const db = await readStore();
  const index = db.credentials.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const existing = db.credentials[index];
  const password = decryptSafe(existing.passwordEnc, existing.id);
  const rotationPolicy = buildRotationPolicy({
    existing: existing.rotationPolicy,
    incoming: payload,
    credential: {
      service: existing.service,
      username: existing.username || "",
      notes: existing.notes || "",
      password,
      entryType: existing.entryType
    }
  });

  if (hasRotationPolicyChanged(existing.rotationPolicy, rotationPolicy)) {
    const now = new Date().toISOString();
    const updated = {
      ...existing,
      rotationPolicy,
      crdt: makeServerCrdt(),
      changeLog: [
        {
          at: now,
          type: "UPDATED",
          fields: ["rotationPolicy"]
        },
        ...(Array.isArray(existing.changeLog) ? existing.changeLog : [])
      ].slice(0, MAX_HISTORY_ENTRIES),
      updatedAt: now
    };
    db.credentials[index] = {
      ...updated,
      signature: signCredentialEntry(updated)
    };
    await writeStore(db);
  }

  return materializeCredential(db.credentials[index]);
}

export async function rotateCredentialSecret(credentialId, reason = "manual") {
  const db = await readStore();
  const index = db.credentials.findIndex((item) => item.id === credentialId);
  if (index === -1) return null;
  const existing = db.credentials[index];
  if (existing.signature && !verifyCredentialEntry(existing)) {
    const err = new Error("Credential signature invalid. Rotation blocked.");
    err.statusCode = 409;
    throw err;
  }

  const currentPassword = decryptSafe(existing.passwordEnc, existing.id);
  const basePolicy = buildRotationPolicy({
    existing: existing.rotationPolicy,
    incoming: null,
    credential: {
      service: existing.service,
      username: existing.username || "",
      notes: existing.notes || "",
      password: currentPassword,
      entryType: existing.entryType
    }
  });
  if (!basePolicy.supported) {
    const err = new Error("Credential type does not support automatic rotation.");
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const material = createRotationMaterial(basePolicy.kind, existing.service);
  const nextPassword = material.password;
  const nextNotes =
    basePolicy.kind === "SSH_KEY"
      ? buildSshRotationNotes(existing.notes || "", material.metadata, now)
      : existing.notes || "";

  const nextPolicy = {
    ...basePolicy,
    lastRotatedAt: now,
    nextRotationAt: computeNextRotationAt(now, basePolicy.intervalDays),
    lastRotationStatus: "success",
    lastRotationError: null
  };
  const baseVersion = Number(existing.passwordVersion || 1);
  const updated = {
    ...existing,
    notes: nextNotes,
    passwordEnc: encryptWithLayers(nextPassword, existing.id),
    passwordVersion: baseVersion + 1,
    passwordHistory: [
      {
        version: baseVersion,
        passwordEnc: existing.passwordEnc,
        changedAt: now
      },
      ...(Array.isArray(existing.passwordHistory) ? existing.passwordHistory : [])
    ].slice(0, MAX_HISTORY_ENTRIES),
    rotationPolicy: nextPolicy,
    crdt: makeServerCrdt(),
    changeLog: [
      {
        at: now,
        type: "ROTATED",
        reason: String(reason || "manual"),
        fields: nextNotes !== (existing.notes || "") ? ["password", "rotationPolicy", "notes"] : ["password", "rotationPolicy"]
      },
      ...(Array.isArray(existing.changeLog) ? existing.changeLog : [])
    ].slice(0, MAX_HISTORY_ENTRIES),
    updatedAt: now
  };

  db.credentials[index] = {
    ...updated,
    signature: signCredentialEntry(updated)
  };
  await writeStore(db);
  const item = materializeCredential(db.credentials[index]);
  return {
    item,
    rotation: {
      kind: nextPolicy.kind,
      rotatedAt: now,
      nextRotationAt: nextPolicy.nextRotationAt,
      metadata: material.metadata || {}
    }
  };
}

export async function rotateDueCredentials(limit = 25) {
  const db = await readStore();
  const nowTs = Date.now();
  const dueIds = db.credentials
    .filter((item) => isRotationDue(item.rotationPolicy, nowTs))
    .slice(0, Math.max(1, Math.min(200, Number(limit) || 25)))
    .map((item) => item.id);
  const rotated = [];
  const failed = [];

  for (const id of dueIds) {
    try {
      const result = await rotateCredentialSecret(id, "auto_due");
      if (result?.item) rotated.push(result.item);
    } catch (error) {
      failed.push({ id, error: error.message });
    }
  }

  return {
    totalDue: dueIds.length,
    rotated: rotated.length,
    failed: failed.length,
    items: rotated,
    errors: failed
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
      crdt: makeServerCrdt(),
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
    crdt: makeServerCrdt(),
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
    crdt: makeServerCrdt(),
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
      crdt: makeServerCrdt(),
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

export async function listSharedVaults(actor = "owner") {
  const db = await readStore();
  const normalizedActor = String(actor || "owner").trim().toLowerCase();
  const now = Date.now();
  return (db.sharedVaults || [])
    .filter((vault) => canReadSharedVault(vault, normalizedActor, now))
    .map((vault) => materializeSharedVault(vault, db.credentials || [], normalizedActor, now));
}

export async function createSharedVault(payload = {}) {
  const db = await readStore();
  const now = new Date().toISOString();
  const audience = normalizeAudience(payload.audience);
  const owner = normalizeActor(payload.owner || "owner");
  const item = {
    id: randomUUID(),
    name: String(payload.name || `${audience.toLowerCase()} vault`),
    audience,
    owner,
    members: [
      {
        id: randomUUID(),
        actor: owner,
        permission: "WRITE",
        expiresAt: null,
        createdAt: now
      }
    ],
    credentialIds: [],
    createdAt: now,
    updatedAt: now
  };
  db.sharedVaults.unshift(item);
  await writeStore(db);
  return materializeSharedVault(item, db.credentials || [], owner, Date.now());
}

export async function addSharedVaultMember(vaultId, payload = {}) {
  const db = await readStore();
  const index = findSharedVaultIndex(db.sharedVaults, vaultId);
  if (index === -1) return null;
  const vault = db.sharedVaults[index];
  const actor = normalizeActor(payload.actor || payload.label);
  if (!actor) {
    const err = new Error("actor is required");
    err.statusCode = 400;
    throw err;
  }
  const permission = normalizeSharedPermission(payload.permission);
  const nowIso = new Date().toISOString();
  const expiresAt = permission === "TEMPORARY" ? resolveExpiresAt(payload.expiresAt, payload.expiresInHours) : null;
  if (permission === "TEMPORARY" && !expiresAt) {
    const err = new Error("temporary permission requires expiresAt or expiresInHours");
    err.statusCode = 400;
    throw err;
  }

  const existingIndex = (vault.members || []).findIndex((item) => normalizeActor(item.actor) === actor);
  const member = {
    id: existingIndex >= 0 ? vault.members[existingIndex].id : randomUUID(),
    actor,
    permission,
    expiresAt,
    createdAt: existingIndex >= 0 ? vault.members[existingIndex].createdAt : nowIso
  };
  const members = Array.isArray(vault.members) ? [...vault.members] : [];
  if (existingIndex >= 0) {
    members[existingIndex] = member;
  } else {
    members.push(member);
  }

  const updated = {
    ...vault,
    members,
    updatedAt: nowIso
  };
  db.sharedVaults[index] = updated;
  await writeStore(db);
  return materializeSharedVault(updated, db.credentials || [], actor, Date.now());
}

export async function removeSharedVaultMember(vaultId, memberId) {
  const db = await readStore();
  const index = findSharedVaultIndex(db.sharedVaults, vaultId);
  if (index === -1) return null;
  const vault = db.sharedVaults[index];
  const before = (vault.members || []).length;
  const members = (vault.members || []).filter((item) => item.id !== memberId);
  if (members.length === before) return null;
  const updated = {
    ...vault,
    members,
    updatedAt: new Date().toISOString()
  };
  db.sharedVaults[index] = updated;
  await writeStore(db);
  return materializeSharedVault(updated, db.credentials || [], "owner", Date.now());
}

export async function addCredentialToSharedVault(vaultId, credentialId, actor = "owner") {
  const db = await readStore();
  const index = findSharedVaultIndex(db.sharedVaults, vaultId);
  if (index === -1) return null;
  const vault = db.sharedVaults[index];
  const permission = resolvePermission(vault, actor, Date.now());
  if (!permission || permission === "READ") {
    const err = new Error("Insufficient permission for shared vault.");
    err.statusCode = 403;
    throw err;
  }
  const credential = db.credentials.find((item) => item.id === credentialId);
  if (!credential) {
    const err = new Error("Credential not found.");
    err.statusCode = 404;
    throw err;
  }
  if ((vault.credentialIds || []).includes(credentialId)) {
    return materializeSharedVault(vault, db.credentials || [], actor, Date.now());
  }
  const updated = {
    ...vault,
    credentialIds: [credentialId, ...(vault.credentialIds || [])],
    updatedAt: new Date().toISOString()
  };
  db.sharedVaults[index] = updated;
  await writeStore(db);
  return materializeSharedVault(updated, db.credentials || [], actor, Date.now());
}

export async function removeCredentialFromSharedVault(vaultId, credentialId, actor = "owner") {
  const db = await readStore();
  const index = findSharedVaultIndex(db.sharedVaults, vaultId);
  if (index === -1) return null;
  const vault = db.sharedVaults[index];
  const permission = resolvePermission(vault, actor, Date.now());
  if (!permission || permission === "READ") {
    const err = new Error("Insufficient permission for shared vault.");
    err.statusCode = 403;
    throw err;
  }
  const updated = {
    ...vault,
    credentialIds: (vault.credentialIds || []).filter((id) => id !== credentialId),
    updatedAt: new Date().toISOString()
  };
  db.sharedVaults[index] = updated;
  await writeStore(db);
  return materializeSharedVault(updated, db.credentials || [], actor, Date.now());
}

export async function listEmergencyContacts() {
  const db = await readStore();
  return (db.emergencyContacts || []).map((item) => ({
    id: item.id,
    label: item.label,
    waitDays: Number(item.waitDays || 7),
    note: item.note || "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));
}

export async function createEmergencyContact(payload = {}) {
  const db = await readStore();
  const label = String(payload.label || "").trim();
  if (!label) {
    const err = new Error("label is required");
    err.statusCode = 400;
    throw err;
  }
  const now = new Date().toISOString();
  const waitDays = clampEmergencyWaitDays(payload.waitDays);
  const existingIndex = (db.emergencyContacts || []).findIndex((item) => normalizeActor(item.label) === normalizeActor(label));
  const item = {
    id: existingIndex >= 0 ? db.emergencyContacts[existingIndex].id : randomUUID(),
    label,
    note: String(payload.note || ""),
    waitDays,
    createdAt: existingIndex >= 0 ? db.emergencyContacts[existingIndex].createdAt : now,
    updatedAt: now
  };
  if (existingIndex >= 0) {
    db.emergencyContacts[existingIndex] = item;
  } else {
    db.emergencyContacts.unshift(item);
  }
  await writeStore(db);
  return item;
}

export async function deleteEmergencyContact(contactId) {
  const db = await readStore();
  const before = (db.emergencyContacts || []).length;
  db.emergencyContacts = (db.emergencyContacts || []).filter((item) => item.id !== contactId);
  db.emergencyRequests = (db.emergencyRequests || []).filter((item) => item.contactId !== contactId);
  if ((db.emergencyContacts || []).length === before) return false;
  await writeStore(db);
  return true;
}

export async function listEmergencyRequests() {
  const db = await readStore();
  const contactsById = new Map((db.emergencyContacts || []).map((item) => [item.id, item]));
  return (db.emergencyRequests || [])
    .map((item) => materializeEmergencyRequest(item, contactsById))
    .sort((a, b) => Date.parse(b.requestedAt || 0) - Date.parse(a.requestedAt || 0));
}

export async function createEmergencyRequest(contactId, payload = {}) {
  const db = await readStore();
  const contact = (db.emergencyContacts || []).find((item) => item.id === contactId);
  if (!contact) {
    const err = new Error("emergency contact not found");
    err.statusCode = 404;
    throw err;
  }
  const requestedBy = normalizeActor(payload.requestedBy || contact.label);
  if (requestedBy !== normalizeActor(contact.label)) {
    const err = new Error("requestedBy does not match emergency contact");
    err.statusCode = 403;
    throw err;
  }
  const nowTs = Date.now();
  const expiresAt = new Date(nowTs + clampEmergencyWaitDays(contact.waitDays) * 24 * 60 * 60 * 1000).toISOString();
  const item = {
    id: randomUUID(),
    contactId: contact.id,
    requestedBy,
    status: "PENDING",
    requestedAt: new Date(nowTs).toISOString(),
    expiresAt,
    resolvedAt: null,
    decisionBy: null
  };
  db.emergencyRequests.unshift(item);
  db.emergencyRequests = db.emergencyRequests.slice(0, 300);
  await writeStore(db);
  return materializeEmergencyRequest(item, new Map([[contact.id, contact]]));
}

export async function resolveEmergencyRequest(requestId, payload = {}) {
  const db = await readStore();
  const index = (db.emergencyRequests || []).findIndex((item) => item.id === requestId);
  if (index === -1) return null;
  const existing = db.emergencyRequests[index];
  if (existing.status !== "PENDING") {
    return materializeEmergencyRequest(existing, new Map((db.emergencyContacts || []).map((item) => [item.id, item])));
  }
  const decision = String(payload.decision || "").trim().toUpperCase();
  if (decision !== "APPROVE" && decision !== "DENY") {
    const err = new Error("decision must be APPROVE or DENY");
    err.statusCode = 400;
    throw err;
  }
  const actor = normalizeActor(payload.actor || "owner");
  if (actor !== "owner") {
    const err = new Error("only owner can resolve emergency requests");
    err.statusCode = 403;
    throw err;
  }
  const updated = {
    ...existing,
    status: decision === "APPROVE" ? "APPROVED" : "DENIED",
    resolvedAt: new Date().toISOString(),
    decisionBy: actor
  };
  db.emergencyRequests[index] = updated;
  await writeStore(db);
  return materializeEmergencyRequest(updated, new Map((db.emergencyContacts || []).map((item) => [item.id, item])));
}

export async function processEmergencyAccessDeadlines(nowTs = Date.now()) {
  const db = await readStore();
  const requests = Array.isArray(db.emergencyRequests) ? db.emergencyRequests : [];
  let changed = false;
  for (let i = 0; i < requests.length; i += 1) {
    const item = requests[i];
    if (item.status !== "PENDING") continue;
    const expiresAt = Date.parse(item.expiresAt || "");
    if (Number.isNaN(expiresAt) || expiresAt > nowTs) continue;
    requests[i] = {
      ...item,
      status: "APPROVED_AUTO",
      resolvedAt: new Date(nowTs).toISOString(),
      decisionBy: "system"
    };
    changed = true;
  }
  if (changed) {
    db.emergencyRequests = requests;
    await writeStore(db);
  }
  return changed;
}

export async function getEmergencyAccessGrant(requestId, actor = "") {
  const db = await readStore();
  const request = (db.emergencyRequests || []).find((item) => item.id === requestId);
  if (!request) return null;
  if (request.status !== "APPROVED" && request.status !== "APPROVED_AUTO") {
    const err = new Error("emergency request is not approved");
    err.statusCode = 403;
    throw err;
  }
  const contact = (db.emergencyContacts || []).find((item) => item.id === request.contactId);
  if (!contact) {
    const err = new Error("emergency contact not found");
    err.statusCode = 404;
    throw err;
  }
  if (normalizeActor(actor) !== normalizeActor(contact.label)) {
    const err = new Error("actor does not match approved emergency contact");
    err.statusCode = 403;
    throw err;
  }
  return {
    requestId: request.id,
    status: request.status,
    grantedAt: request.resolvedAt || request.requestedAt,
    contact: {
      id: contact.id,
      label: contact.label
    },
    items: (db.credentials || []).map(materializeCredential)
  };
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
    entryType: item.entryType || classifyEntryType({ service: item.service, username: item.username, notes: item.notes, password }),
    rotationPolicy:
      item.rotationPolicy ||
      buildRotationPolicy({
        existing: null,
        incoming: null,
        credential: {
          service: item.service,
          username: item.username || "",
          notes: item.notes || "",
          password,
          entryType: item.entryType
        }
      }),
    isSensitive: Boolean(item.isSensitive),
    isHoney: Boolean(item.isHoney),
    honeyTag: item.honeyTag || "",
    honeyLastTriggeredAt: item.honeyLastTriggeredAt || null,
    crdt: normalizeCrdt(item.crdt),
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
  const sharedVaults = Array.isArray(db.sharedVaults) ? db.sharedVaults : [];
  const emergencyContacts = Array.isArray(db.emergencyContacts) ? db.emergencyContacts : [];
  const emergencyRequests = Array.isArray(db.emergencyRequests) ? db.emergencyRequests : [];
  return { credentials, trustedDevices, auditLogs, sharedVaults, emergencyContacts, emergencyRequests };
}

function getChangedFields(existing, payload, hasPasswordChange) {
  const changed = [];
  if (hasPasswordChange) changed.push("password");
  if (typeof payload.service === "string" && payload.service !== existing.service) changed.push("service");
  if (typeof payload.username === "string" && payload.username !== existing.username) changed.push("username");
  if (typeof payload.category === "string" && payload.category !== existing.category) changed.push("category");
  if (typeof payload.notes === "string" && payload.notes !== existing.notes) changed.push("notes");
  if (typeof payload.entryType === "string" && payload.entryType !== existing.entryType) changed.push("entryType");
  if (payload.rotationPolicy && hasRotationPolicyChanged(existing.rotationPolicy, payload.rotationPolicy)) {
    changed.push("rotationPolicy");
  }
  if (typeof payload.isSensitive === "boolean" && payload.isSensitive !== Boolean(existing.isSensitive)) {
    changed.push("isSensitive");
  }
  return changed;
}

function hasRotationPolicyChanged(existing, incoming) {
  const left = normalizeRotationSnapshot(existing);
  const right = normalizeRotationSnapshot(incoming);
  return stableSerialize(left) !== stableSerialize(right);
}

function normalizeRotationSnapshot(value) {
  const policy = value && typeof value === "object" ? value : {};
  return {
    supported: Boolean(policy.supported),
    kind: String(policy.kind || "NONE"),
    enabled: Boolean(policy.enabled),
    intervalDays: Number(policy.intervalDays || 0),
    lastRotatedAt: policy.lastRotatedAt ? String(policy.lastRotatedAt) : null,
    nextRotationAt: policy.nextRotationAt ? String(policy.nextRotationAt) : null,
    lastRotationStatus: policy.lastRotationStatus ? String(policy.lastRotationStatus) : null,
    lastRotationError: policy.lastRotationError ? String(policy.lastRotationError) : null
  };
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function decryptSafe(passwordEnc, id) {
  try {
    return decryptWithLayers(passwordEnc, id);
  } catch {
    return "";
  }
}

function makeServerCrdt() {
  const nowMs = Date.now();
  return {
    clientId: "server",
    counter: nowMs,
    ts: new Date(nowMs).toISOString()
  };
}

function resolveIncomingCrdt(value) {
  const normalized = normalizeCrdt(value);
  if (normalized.counter > 0) return normalized;
  return makeServerCrdt();
}

function normalizeCrdt(value) {
  const fallback = { clientId: "unknown", counter: 0, ts: new Date(0).toISOString() };
  if (!value || typeof value !== "object") return fallback;
  const clientId = String(value.clientId || "unknown");
  const counter = Number(value.counter || 0);
  const tsRaw = String(value.ts || "");
  const ts = Number.isNaN(Date.parse(tsRaw)) ? fallback.ts : new Date(tsRaw).toISOString();
  return {
    clientId,
    counter: Number.isFinite(counter) ? counter : 0,
    ts
  };
}

function compareCrdt(a, b) {
  const left = normalizeCrdt(a);
  const right = normalizeCrdt(b);
  if (left.counter !== right.counter) return left.counter - right.counter;
  const leftTs = Date.parse(left.ts);
  const rightTs = Date.parse(right.ts);
  if (leftTs !== rightTs) return leftTs - rightTs;
  if (left.clientId === right.clientId) return 0;
  return left.clientId > right.clientId ? 1 : -1;
}

function normalizeAudience(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "FAMILY" || raw === "TEAM" || raw === "COMPANY") return raw;
  return "TEAM";
}

function clampEmergencyWaitDays(value) {
  const days = Number(value);
  if (!Number.isFinite(days)) return 7;
  return Math.max(1, Math.min(365, Math.round(days)));
}

function normalizeSharedPermission(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "READ" || raw === "WRITE" || raw === "TEMPORARY") return raw;
  return "READ";
}

function normalizeActor(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function resolveExpiresAt(expiresAt, expiresInHours) {
  if (expiresAt && !Number.isNaN(Date.parse(String(expiresAt)))) {
    return new Date(String(expiresAt)).toISOString();
  }
  const hours = Number(expiresInHours);
  if (Number.isFinite(hours) && hours > 0) {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  }
  return null;
}

function findSharedVaultIndex(sharedVaults, vaultId) {
  return (Array.isArray(sharedVaults) ? sharedVaults : []).findIndex((vault) => vault.id === vaultId);
}

function resolvePermission(vault, actor, nowTs) {
  const normalizedActor = normalizeActor(actor || "owner");
  if (normalizedActor === normalizeActor(vault?.owner || "owner")) return "WRITE";
  const members = Array.isArray(vault?.members) ? vault.members : [];
  const member = members.find((item) => normalizeActor(item.actor) === normalizedActor);
  if (!member) return null;
  if (member.permission === "TEMPORARY") {
    const exp = Date.parse(member.expiresAt || "");
    if (Number.isNaN(exp) || exp < nowTs) return null;
    return "TEMPORARY";
  }
  return normalizeSharedPermission(member.permission);
}

function canReadSharedVault(vault, actor, nowTs) {
  const permission = resolvePermission(vault, actor, nowTs);
  return Boolean(permission);
}

function materializeSharedVault(vault, allCredentials, actor, nowTs) {
  const permission = resolvePermission(vault, actor, nowTs);
  const credentialsById = new Map((allCredentials || []).map((item) => [item.id, item]));
  const items = (vault.credentialIds || [])
    .map((id) => credentialsById.get(id))
    .filter(Boolean)
    .map(materializeCredential);
  return {
    id: vault.id,
    name: vault.name,
    audience: normalizeAudience(vault.audience),
    owner: vault.owner || "owner",
    permission: permission || null,
    members: (vault.members || []).map((member) => ({
      id: member.id,
      actor: member.actor,
      permission: normalizeSharedPermission(member.permission),
      expiresAt: member.expiresAt || null
    })),
    items,
    createdAt: vault.createdAt,
    updatedAt: vault.updatedAt
  };
}

function materializeEmergencyRequest(item, contactsById) {
  const contact = contactsById.get(item.contactId);
  return {
    id: item.id,
    contactId: item.contactId,
    contactLabel: contact?.label || "unknown",
    requestedBy: item.requestedBy || "",
    status: item.status || "PENDING",
    requestedAt: item.requestedAt,
    expiresAt: item.expiresAt,
    resolvedAt: item.resolvedAt || null,
    decisionBy: item.decisionBy || null
  };
}
