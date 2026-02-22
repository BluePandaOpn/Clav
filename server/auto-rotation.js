import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";

const ROTATION_DEFAULT_INTERVAL_DAYS = {
  GITHUB_TOKEN: 30,
  API_KEY: 90,
  SSH_KEY: 180
};

export function detectRotationKind({ service = "", notes = "", password = "", entryType = "" } = {}) {
  const serviceText = String(service || "").toLowerCase();
  const notesText = String(notes || "").toLowerCase();
  const passwordText = String(password || "");
  const typeText = String(entryType || "").toUpperCase();
  const merged = `${serviceText} ${notesText}`.trim();

  if (isSshKeyMaterial(passwordText, merged) || typeText === "SSH_KEY") return "SSH_KEY";
  if (isGithubToken(passwordText, merged)) return "GITHUB_TOKEN";
  if (typeText === "API_KEY" || isGenericApiKey(passwordText, merged)) return "API_KEY";
  return "NONE";
}

export function buildRotationPolicy({ existing, incoming, credential }) {
  const kind = detectRotationKind(credential);
  const supported = kind !== "NONE";
  const normalizedExisting = normalizeExistingPolicy(existing);
  const normalizedIncoming = normalizeIncomingPolicy(incoming);
  const defaultInterval = ROTATION_DEFAULT_INTERVAL_DAYS[kind] || 90;
  const intervalDays = clampIntervalDays(
    normalizedIncoming.intervalDays ?? normalizedExisting.intervalDays ?? defaultInterval
  );
  const enabledRaw = normalizedIncoming.enabled ?? normalizedExisting.enabled ?? false;
  const enabled = supported ? Boolean(enabledRaw) : false;
  const lastRotatedAt = normalizedExisting.lastRotatedAt || null;
  const nextRotationAt =
    normalizedIncoming.nextRotationAt ??
    normalizedExisting.nextRotationAt ??
    (lastRotatedAt ? addDays(lastRotatedAt, intervalDays) : null);

  return {
    supported,
    kind,
    enabled,
    intervalDays,
    lastRotatedAt,
    nextRotationAt,
    lastRotationStatus: normalizedExisting.lastRotationStatus || null,
    lastRotationError: normalizedExisting.lastRotationError || null
  };
}

export function isRotationDue(rotationPolicy, now = Date.now()) {
  const policy = rotationPolicy && typeof rotationPolicy === "object" ? rotationPolicy : null;
  if (!policy?.supported || !policy?.enabled || !policy?.nextRotationAt) return false;
  const dueAt = Date.parse(policy.nextRotationAt);
  if (Number.isNaN(dueAt)) return false;
  return dueAt <= now;
}

export function createRotationMaterial(kind, service = "") {
  const normalizedKind = String(kind || "").toUpperCase();
  if (normalizedKind === "GITHUB_TOKEN") {
    return {
      password: `ghp_${randomToken(36)}`,
      metadata: {}
    };
  }
  if (normalizedKind === "API_KEY") {
    const prefix = slugifyService(service);
    return {
      password: `ak_${prefix}_${randomToken(32)}`,
      metadata: {}
    };
  }
  if (normalizedKind === "SSH_KEY") {
    const generated = generateKeyPairSync("ed25519");
    const privatePem = generated.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const publicPem = generated.publicKey.export({ type: "spki", format: "pem" }).toString();
    const fingerprint = createHash("sha256").update(publicPem).digest("base64");
    return {
      password: privatePem,
      metadata: {
        publicKey: publicPem,
        fingerprint
      }
    };
  }
  throw unsupportedRotationError();
}

export function buildSshRotationNotes(existingNotes, metadata, rotatedAtIso) {
  if (!metadata?.publicKey) return String(existingNotes || "");
  const stamp = new Date(rotatedAtIso).toISOString();
  const block = [
    "",
    "[AUTO_ROTATION_SSH]",
    `rotatedAt=${stamp}`,
    `fingerprint=SHA256:${metadata.fingerprint || "unknown"}`,
    "publicKey:",
    metadata.publicKey.trim()
  ].join("\n");
  const base = String(existingNotes || "").trimEnd();
  return `${base}${block}\n`;
}

export function computeNextRotationAt(fromIso, intervalDays) {
  return addDays(fromIso, clampIntervalDays(intervalDays));
}

function clampIntervalDays(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 90;
  return Math.max(1, Math.min(365, Math.round(num)));
}

function normalizeExistingPolicy(value) {
  if (!value || typeof value !== "object") return {};
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : undefined,
    intervalDays: Number.isFinite(Number(value.intervalDays)) ? Number(value.intervalDays) : undefined,
    lastRotatedAt: isValidIso(value.lastRotatedAt) ? new Date(value.lastRotatedAt).toISOString() : null,
    nextRotationAt: isValidIso(value.nextRotationAt) ? new Date(value.nextRotationAt).toISOString() : null,
    lastRotationStatus: value.lastRotationStatus ? String(value.lastRotationStatus) : null,
    lastRotationError: value.lastRotationError ? String(value.lastRotationError) : null
  };
}

function normalizeIncomingPolicy(value) {
  if (!value || typeof value !== "object") return {};
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : undefined,
    intervalDays: Number.isFinite(Number(value.intervalDays)) ? Number(value.intervalDays) : undefined,
    nextRotationAt: isValidIso(value.nextRotationAt) ? new Date(value.nextRotationAt).toISOString() : undefined
  };
}

function isSshKeyMaterial(password, mergedText) {
  const value = String(password || "");
  if (value.includes("BEGIN OPENSSH PRIVATE KEY")) return true;
  if (value.includes("BEGIN PRIVATE KEY")) return true;
  if (/(\bssh\b|\bopenssh\b|\bkey pair\b|\bprivate key\b)/i.test(mergedText)) return true;
  return false;
}

function isGithubToken(password, mergedText) {
  const value = String(password || "").trim();
  if (/^gh[pousr]_[a-z0-9]{20,}$/i.test(value)) return true;
  if (/^github_pat_[a-z0-9_]{40,}$/i.test(value)) return true;
  if (/(\bgithub\b).*(\btoken\b|\bpat\b)|(\btoken\b|\bpat\b).*(\bgithub\b)/i.test(mergedText)) {
    return /^[A-Za-z0-9_]{20,}$/.test(value);
  }
  return false;
}

function isGenericApiKey(password, mergedText) {
  const value = String(password || "").trim();
  if (!value || /\s/.test(value)) return false;
  if (/(api|token|secret|access key|api key|credential)/i.test(mergedText)) {
    return /^[A-Za-z0-9_.=:+/-]{20,}$/.test(value);
  }
  return false;
}

function addDays(baseIso, days) {
  const baseTs = Date.parse(baseIso);
  const start = Number.isNaN(baseTs) ? Date.now() : baseTs;
  return new Date(start + days * 24 * 60 * 60 * 1000).toISOString();
}

function randomToken(length) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function slugifyService(service) {
  const value = String(service || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return value || "service";
}

function unsupportedRotationError() {
  const error = new Error("Credential does not support auto-rotation.");
  error.statusCode = 400;
  return error;
}

function isValidIso(value) {
  if (!value) return false;
  return !Number.isNaN(Date.parse(String(value)));
}
