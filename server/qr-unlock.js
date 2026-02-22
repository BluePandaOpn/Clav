import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, randomUUID, sign, verify } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const challenges = new Map();
const DEFAULT_TTL_MS = 90 * 1000;
const QR_SIGNING_KEY_FILE = new URL("./data/qr-signing-key.json", import.meta.url);
const QR_SIGNING_KEY_FILE_PATH = fileURLToPath(QR_SIGNING_KEY_FILE);
const { privateKey, publicKey } = loadOrCreateQrSigningKeyPair();

function signParts(cid, code, exp, token) {
  const payload = Buffer.from(`${cid}.${code}.${exp}.${token}`, "utf8");
  return sign(null, payload, privateKey).toString("base64url");
}

function verifyParts(cid, code, exp, token, signature) {
  const payload = Buffer.from(`${cid}.${code}.${exp}.${token}`, "utf8");
  return verify(null, payload, publicKey, Buffer.from(signature, "base64url"));
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, challenge] of challenges.entries()) {
    if (challenge.exp <= now || challenge.status !== "pending") {
      challenges.delete(key);
    }
  }
}

setInterval(cleanupExpired, 30 * 1000).unref();

export function createQrChallenge({ deviceLabel = "unknown-device", requesterIp = "n/a", requesterUa = "n/a" }) {
  const cid = randomUUID();
  const code = randomBytes(18).toString("hex");
  const token = randomBytes(20).toString("base64url");
  const ttlMs = computeDynamicTtlMs({ deviceLabel, requesterIp, requesterUa });
  const exp = Date.now() + ttlMs;
  const sig = signParts(cid, code, exp, token);

  challenges.set(cid, {
    cid,
    code,
    token,
    exp,
    sig,
    status: "pending",
    createdAt: Date.now(),
    approvedAt: null,
    requesterIp,
    requesterUa,
    requesterDevice: deviceLabel,
    approverDevice: null,
    ttlMs,
    consumedAt: null
  });

  const query = new URLSearchParams({ cid, code, exp: String(exp), sig, tok: token });
  const approvalUrl = `${config.appBaseUrl}/unlock-qr?${query.toString()}`;

  return {
    challengeId: cid,
    oneTimeToken: token,
    ttlSeconds: Math.round(ttlMs / 1000),
    expiresAt: new Date(exp).toISOString(),
    approvalUrl
  };
}

export function getQrChallengeStatus(cid) {
  const challenge = challenges.get(cid);
  if (!challenge) return { status: "not_found" };
  if (Date.now() > challenge.exp) return { status: "expired" };
  return {
    status: challenge.status,
    ttlSeconds: Math.round((challenge.ttlMs || DEFAULT_TTL_MS) / 1000),
    remainingSeconds: Math.max(0, Math.round((challenge.exp - Date.now()) / 1000)),
    expiresAt: new Date(challenge.exp).toISOString(),
    approvedAt: challenge.approvedAt ? new Date(challenge.approvedAt).toISOString() : null
  };
}

export function approveQrChallenge({ cid, code, exp, sig, token, deviceLabel = "scanner-device" }) {
  const challenge = challenges.get(cid);
  if (!challenge) {
    const err = new Error("Challenge no encontrado.");
    err.statusCode = 404;
    throw err;
  }
  if (challenge.status === "approved" || challenge.consumedAt) {
    const err = new Error("Challenge ya utilizado (token de un solo uso).");
    err.statusCode = 409;
    throw err;
  }
  if (challenge.status !== "pending") {
    const err = new Error("Challenge ya utilizado.");
    err.statusCode = 409;
    throw err;
  }
  if (Date.now() > challenge.exp) {
    challenge.status = "expired";
    const err = new Error("Challenge expirado.");
    err.statusCode = 410;
    throw err;
  }

  if (!verifyParts(cid, code, Number(exp), String(token || ""), sig)) {
    const err = new Error("Firma invalida.");
    err.statusCode = 401;
    throw err;
  }
  if (
    challenge.code !== code ||
    challenge.exp !== Number(exp) ||
    challenge.sig !== sig ||
    challenge.token !== String(token || "")
  ) {
    const err = new Error("Parametros de challenge invalidos.");
    err.statusCode = 400;
    throw err;
  }

  challenge.status = "approved";
  challenge.approvedAt = Date.now();
  challenge.consumedAt = challenge.approvedAt;
  challenge.approverDevice = deviceLabel;

  return {
    challengeId: challenge.cid,
    requesterDevice: challenge.requesterDevice,
    approverDevice: challenge.approverDevice,
    approvedAt: new Date(challenge.approvedAt).toISOString(),
    ttlSeconds: Math.round((challenge.ttlMs || DEFAULT_TTL_MS) / 1000)
  };
}

function computeDynamicTtlMs({ deviceLabel = "", requesterIp = "", requesterUa = "" } = {}) {
  let ttlMs = DEFAULT_TTL_MS;
  const label = String(deviceLabel || "").toLowerCase();
  const ua = String(requesterUa || "").toLowerCase();
  const ip = String(requesterIp || "").toLowerCase();

  if (/mobile|phone|scanner/.test(label) || /mobile|android|iphone/.test(ua)) {
    ttlMs += 30 * 1000;
  }
  if (isPrivateIp(ip) || ip.includes("localhost")) {
    ttlMs += 20 * 1000;
  }
  if (/curl|bot|script|headless/.test(ua)) {
    ttlMs -= 30 * 1000;
  }
  return Math.max(30 * 1000, Math.min(5 * 60 * 1000, ttlMs));
}

function isPrivateIp(ip) {
  return /^::1$/.test(ip) || /^127\./.test(ip) || /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

function loadOrCreateQrSigningKeyPair() {
  if (existsSync(QR_SIGNING_KEY_FILE_PATH)) {
    const raw = readFileSync(QR_SIGNING_KEY_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      privateKey: createPrivateKey(parsed.privateKeyPem),
      publicKey: createPublicKey(parsed.publicKeyPem)
    };
  }

  mkdirSync(dirname(QR_SIGNING_KEY_FILE_PATH), { recursive: true });
  const generated = generateKeyPairSync("ed25519");
  const privateKeyPem = generated.privateKey.export({ type: "pkcs8", format: "pem" });
  const publicKeyPem = generated.publicKey.export({ type: "spki", format: "pem" });
  writeFileSync(
    QR_SIGNING_KEY_FILE_PATH,
    JSON.stringify(
      {
        alg: "ed25519",
        kid: "qr-signing-ed25519-v2",
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
