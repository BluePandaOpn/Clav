import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import {
  addAuditLog,
  addTrustedDevice,
  clearCredentials,
  createCredential,
  deleteCredential,
  listAuditLogs,
  listCredentials,
  listTrustedDevices,
  readStore,
  updateCredential
} from "./store.js";
import { generatePassword, getStrength } from "./password.js";
import { approveQrChallenge, createQrChallenge, getQrChallengeStatus } from "./qr-unlock.js";

const app = express();
const api = express.Router();
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

app.disable("x-powered-by");
app.use(
  cors({
    origin: config.corsOrigin
  })
);
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(express.json({ limit: "24kb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(config.apiBasePath, limiter);

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

api.get("/health", (_req, res) => {
  res.json({ ok: true, layers: config.encryptionLayers });
});

api.get(
  "/credentials",
  asyncHandler(async (req, res) => {
  const q = req.query.q || "";
  const data = await listCredentials(String(q));
  res.json({ items: data });
  })
);

api.post(
  "/credentials",
  asyncHandler(async (req, res) => {
  const { service, username, password, category, notes } = req.body || {};
  if (!service || !password) {
    return res.status(400).json({ error: "service and password are required" });
  }
  const item = await createCredential({ service, username, password, category, notes });
  await addAuditLog({
    type: "CREDENTIAL_CREATED",
    detail: service,
    ip: getIp(req),
    userAgent: getUa(req)
  });
  return res.status(201).json({ item });
  })
);

api.put(
  "/credentials/:id",
  asyncHandler(async (req, res) => {
  const updated = await updateCredential(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ error: "credential not found" });
  }
  return res.json({ item: updated });
  })
);

api.delete(
  "/credentials/:id",
  asyncHandler(async (req, res) => {
  const deleted = await deleteCredential(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "credential not found" });
  }
  await addAuditLog({
    type: "CREDENTIAL_DELETED",
    detail: req.params.id,
    ip: getIp(req),
    userAgent: getUa(req)
  });
  return res.status(204).send();
  })
);

api.delete(
  "/credentials",
  asyncHandler(async (_req, res) => {
  await clearCredentials();
  res.status(204).send();
  })
);

api.post(
  "/qr/challenge",
  asyncHandler(async (req, res) => {
  const deviceLabel = String(req.body?.deviceLabel || "desktop");
  const challenge = createQrChallenge({
    deviceLabel,
    requesterIp: getIp(req),
    requesterUa: getUa(req)
  });
  await addAuditLog({
    type: "QR_CHALLENGE_CREATED",
    detail: challenge.challengeId,
    ip: getIp(req),
    userAgent: getUa(req)
  });
  return res.status(201).json(challenge);
  })
);

api.get("/qr/challenge/:id", (req, res) => {
  const status = getQrChallengeStatus(req.params.id);
  return res.json(status);
});

api.post(
  "/qr/approve",
  asyncHandler(async (req, res) => {
  const { cid, code, exp, sig, deviceLabel } = req.body || {};
  if (!cid || !code || !exp || !sig) {
    return res.status(400).json({ error: "cid, code, exp and sig are required" });
  }
  const approved = approveQrChallenge({
    cid: String(cid),
    code: String(code),
    exp: Number(exp),
    sig: String(sig),
    deviceLabel: String(deviceLabel || "scanner")
  });

  const trustedDevice = approved.alreadyApproved
    ? null
    : await addTrustedDevice({
        label: approved.approverDevice,
        ip: getIp(req),
        userAgent: getUa(req),
        source: "qr_unlock"
      });

  if (!approved.alreadyApproved) {
    await addAuditLog({
      type: "QR_CHALLENGE_APPROVED",
      detail: approved.challengeId,
      ip: getIp(req),
      userAgent: getUa(req)
    });
  }

  return res.status(approved.alreadyApproved ? 200 : 201).json({ approved, trustedDevice });
  })
);

api.get(
  "/devices",
  asyncHandler(async (_req, res) => {
  const items = await listTrustedDevices();
  return res.json({ items });
  })
);

api.get(
  "/audit",
  asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit || 60);
  const items = await listAuditLogs(limit);
  return res.json({ items });
  })
);

api.get(
  "/stats",
  asyncHandler(async (_req, res) => {
  const db = await readStore();
  const total = db.credentials.length;
  const byCategory = db.credentials.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  res.json({ total, byCategory });
  })
);

api.get(
  "/export",
  asyncHandler(async (_req, res) => {
  const db = await readStore();
  res.setHeader("Content-Disposition", "attachment; filename=vault-export.json");
  res.json(db);
  })
);

api.post("/generate", (req, res) => {
  try {
    const {
      length = 16,
      lowercase = true,
      uppercase = true,
      numbers = true,
      symbols = true
    } = req.body || {};
    const password = generatePassword({
      length: Number(length),
      lowercase: Boolean(lowercase),
      uppercase: Boolean(uppercase),
      numbers: Boolean(numbers),
      symbols: Boolean(symbols)
    });
    res.json({ password, strength: getStrength(password) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.use(config.apiBasePath, api);

app.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});

app.use((error, _req, res, _next) => {
  const status = error?.statusCode || 500;
  res.status(status).json({ error: status === 500 ? "internal error" : error.message });
});

const server = app.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}${config.apiBasePath}`);
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`Port ${config.port} is already in use. Stop the existing process or change PORT.`);
    process.exit(1);
  }
  throw error;
});

function getIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "n/a");
}

function getUa(req) {
  return String(req.headers["user-agent"] || "n/a");
}
