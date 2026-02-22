import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KEY_FILE = new URL("./data/signing-key.json", import.meta.url);
const KEY_FILE_PATH = fileURLToPath(KEY_FILE);
const SIGN_ALG = "ed25519";
const SIGN_KID = "vault-signing-ed25519-v1";

const { privateKey, publicKey } = loadOrCreateSigningKeyPair();

export function signCredentialEntry(entry) {
  const payload = Buffer.from(
    canonicalizeForSignature(entry, {
      includeSensitive: true,
      includeEntryType: true,
      includeRotationPolicy: true
    }),
    "utf8"
  );
  const signature = sign(null, payload, privateKey);
  return {
    alg: SIGN_ALG,
    kid: SIGN_KID,
    sig: signature.toString("base64")
  };
}

export function verifyCredentialEntry(entry) {
  if (!entry?.signature?.sig) return false;
  const signature = Buffer.from(entry.signature.sig, "base64");
  const v3Payload = Buffer.from(
    canonicalizeForSignature(entry, {
      includeSensitive: true,
      includeEntryType: true,
      includeRotationPolicy: true
    }),
    "utf8"
  );
  if (verify(null, v3Payload, publicKey, signature)) return true;

  const v25Payload = Buffer.from(
    canonicalizeForSignature(entry, {
      includeSensitive: true,
      includeEntryType: true,
      includeRotationPolicy: false
    }),
    "utf8"
  );
  if (verify(null, v25Payload, publicKey, signature)) return true;

  const v2Payload = Buffer.from(
    canonicalizeForSignature(entry, {
      includeSensitive: true,
      includeEntryType: false,
      includeRotationPolicy: false
    }),
    "utf8"
  );
  if (verify(null, v2Payload, publicKey, signature)) return true;

  const v1Payload = Buffer.from(
    canonicalizeForSignature(entry, {
      includeSensitive: false,
      includeEntryType: false,
      includeRotationPolicy: false
    }),
    "utf8"
  );
  return verify(null, v1Payload, publicKey, signature);
}

function canonicalizeForSignature(entry, options = {}) {
  const includeSensitive = options.includeSensitive !== false;
  const includeEntryType = options.includeEntryType !== false;
  const includeRotationPolicy = options.includeRotationPolicy !== false;
  const target = {
    id: entry.id,
    service: entry.service,
    username: entry.username || "",
    passwordEnc: entry.passwordEnc,
    category: entry.category || "General",
    notes: entry.notes || "",
    isHoney: Boolean(entry.isHoney),
    honeyTag: entry.honeyTag || "",
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
  if (includeEntryType) {
    target.entryType = entry.entryType || "LOGIN";
  }
  if (includeSensitive) {
    target.isSensitive = Boolean(entry.isSensitive);
  }
  if (includeRotationPolicy) {
    target.rotationPolicy = normalizeRotationPolicy(entry.rotationPolicy);
  }
  return stableStringify(target);
}

function normalizeRotationPolicy(value) {
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

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function loadOrCreateSigningKeyPair() {
  if (existsSync(KEY_FILE_PATH)) {
    const raw = readFileSync(KEY_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      privateKey: createPrivateKey(parsed.privateKeyPem),
      publicKey: createPublicKey(parsed.publicKeyPem)
    };
  }

  mkdirSync(dirname(KEY_FILE_PATH), { recursive: true });
  const generated = generateKeyPairSync("ed25519");
  const privateKeyPem = generated.privateKey.export({ type: "pkcs8", format: "pem" });
  const publicKeyPem = generated.publicKey.export({ type: "spki", format: "pem" });

  writeFileSync(
    KEY_FILE_PATH,
    JSON.stringify(
      {
        alg: SIGN_ALG,
        kid: SIGN_KID,
        privateKeyPem,
        publicKeyPem,
        createdAt: new Date().toISOString()
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    privateKey: createPrivateKey(privateKeyPem),
    publicKey: createPublicKey(publicKeyPem)
  };
}
