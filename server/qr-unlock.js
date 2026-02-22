import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { config } from "./config.js";

const challenges = new Map();
const TTL_MS = 90 * 1000;

function signParts(cid, code, exp) {
  return createHmac("sha256", config.masterKey).update(`${cid}.${code}.${exp}`).digest("hex");
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
  const exp = Date.now() + TTL_MS;
  const sig = signParts(cid, code, exp);

  challenges.set(cid, {
    cid,
    code,
    exp,
    sig,
    status: "pending",
    createdAt: Date.now(),
    approvedAt: null,
    requesterIp,
    requesterUa,
    requesterDevice: deviceLabel,
    approverDevice: null
  });

  const query = new URLSearchParams({ cid, code, exp: String(exp), sig });
  const approvalUrl = `${config.appBaseUrl}/unlock-qr?${query.toString()}`;

  return {
    challengeId: cid,
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
    expiresAt: new Date(challenge.exp).toISOString(),
    approvedAt: challenge.approvedAt ? new Date(challenge.approvedAt).toISOString() : null
  };
}

export function approveQrChallenge({ cid, code, exp, sig, deviceLabel = "scanner-device" }) {
  const challenge = challenges.get(cid);
  if (!challenge) {
    const err = new Error("Challenge no encontrado.");
    err.statusCode = 404;
    throw err;
  }
  if (challenge.status === "approved") {
    return {
      challengeId: challenge.cid,
      requesterDevice: challenge.requesterDevice,
      approverDevice: challenge.approverDevice,
      approvedAt: new Date(challenge.approvedAt).toISOString(),
      alreadyApproved: true
    };
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

  const expectedSig = signParts(cid, code, Number(exp));
  if (sig !== expectedSig) {
    const err = new Error("Firma invalida.");
    err.statusCode = 401;
    throw err;
  }
  if (challenge.code !== code || challenge.exp !== Number(exp) || challenge.sig !== sig) {
    const err = new Error("Parametros de challenge invalidos.");
    err.statusCode = 400;
    throw err;
  }

  challenge.status = "approved";
  challenge.approvedAt = Date.now();
  challenge.approverDevice = deviceLabel;

  return {
    challengeId: challenge.cid,
    requesterDevice: challenge.requesterDevice,
    approverDevice: challenge.approverDevice,
    approvedAt: new Date(challenge.approvedAt).toISOString()
  };
}
