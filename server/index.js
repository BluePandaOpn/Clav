import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import {
  addAuditLog,
  addTrustedDevice,
  clearCredentials,
  createCredentialSharePackage,
  createCredential,
  deleteCredential,
  generateHoneyCredentials,
  getCredentialHistory,
  listShareTargets,
  listAuditLogs,
  listCredentials,
  listTrustedDevices,
  readStore,
  refreshCredentialBreachStatus,
  registerHoneyCredentialAccess,
  rotateCredentialSecret,
  rotateDueCredentials,
  scanAllCredentialsForBreaches,
  updateCredentialRotationPolicy,
  upsertDeviceEncryptionKey,
  updateCredential
} from "./store.js";
import { generatePassword, getStrength } from "./password.js";
import { approveQrChallenge, createQrChallenge, getQrChallengeStatus } from "./qr-unlock.js";
import { createSyncHub } from "./sync-hub.js";
import { createBackupService } from "./backup-service.js";
import { isRotationDue } from "./auto-rotation.js";

const app = express();
const api = express.Router();
const syncHub = createSyncHub();
const backupService = createBackupService({
  config,
  readStore,
  addAuditLog
});
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
  "/backup/config",
  asyncHandler(async (_req, res) => {
    res.json(backupService.getConfig());
  })
);

api.get(
  "/backup/local",
  asyncHandler(async (_req, res) => {
    const items = await backupService.listBackups();
    res.json({ items });
  })
);

api.post(
  "/backup/run",
  asyncHandler(async (req, res) => {
    const reason = String(req.body?.reason || "manual");
    const result = await backupService.triggerBackup(reason);
    return res.status(result.ok ? 201 : 200).json(result);
  })
);

api.get(
  "/credentials",
  asyncHandler(async (req, res) => {
  const q = req.query.q || "";
  const data = await listCredentials(String(q));
  res.json({ items: data });
  })
);

api.get("/sync/events", (req, res) => {
  syncHub.registerSseClient(req, res);
});

api.post(
  "/credentials",
  asyncHandler(async (req, res) => {
  const { service, username, password, category, notes, isSensitive, rotationPolicy } = req.body || {};
  if (!service || !password) {
    return res.status(400).json({ error: "service and password are required" });
  }
  const created = await createCredential({ service, username, password, category, notes, isSensitive, rotationPolicy });
  const item = (await refreshCredentialBreachStatus(created.id)) || created;
  await addAuditLog({
    type: "CREDENTIAL_CREATED",
    detail: service,
    ip: getIp(req),
    userAgent: getUa(req)
  });
  if (item?.breachStatus?.compromised) {
    await addAuditLog({
      type: "PASSWORD_BREACH_DETECTED",
      detail: `${item.id}:${item.service}:count=${item.breachStatus.pwnedCount}`,
      ip: getIp(req),
      userAgent: getUa(req)
    });
  }
  syncHub.publish({
    type: "credential.upsert",
    item
  });
  return res.status(201).json({ item });
  })
);

api.put(
  "/credentials/:id",
  asyncHandler(async (req, res) => {
  const updatedBase = await updateCredential(req.params.id, req.body || {});
  const updated = updatedBase ? await refreshCredentialBreachStatus(updatedBase.id) : null;
  if (!updated) {
    return res.status(404).json({ error: "credential not found" });
  }
  if (updated?.breachStatus?.compromised) {
    await addAuditLog({
      type: "PASSWORD_BREACH_DETECTED",
      detail: `${updated.id}:${updated.service}:count=${updated.breachStatus.pwnedCount}`,
      ip: getIp(req),
      userAgent: getUa(req)
    });
  }
  syncHub.publish({
    type: "credential.upsert",
    item: updated
  });
  return res.json({ item: updated });
  })
);

api.get(
  "/credentials/:id/history",
  asyncHandler(async (req, res) => {
    const history = await getCredentialHistory(String(req.params.id));
    if (!history) {
      return res.status(404).json({ error: "credential not found" });
    }
    return res.json(history);
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
  syncHub.publish({
    type: "credential.delete",
    id: req.params.id
  });
  return res.status(204).send();
  })
);

api.delete(
  "/credentials",
  asyncHandler(async (_req, res) => {
  await clearCredentials();
  syncHub.publish({
    type: "credential.clear"
  });
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

api.post(
  "/devices/register-key",
  asyncHandler(async (req, res) => {
    const { deviceId, label, publicKeyPem } = req.body || {};
    if (!deviceId || !publicKeyPem) {
      return res.status(400).json({ error: "deviceId and publicKeyPem are required" });
    }

    const item = await upsertDeviceEncryptionKey({
      deviceId: String(deviceId),
      label: String(label || "device"),
      publicKeyPem: String(publicKeyPem),
      ip: getIp(req),
      userAgent: getUa(req)
    });

    await addAuditLog({
      type: "DEVICE_KEY_REGISTERED",
      detail: item.id,
      ip: getIp(req),
      userAgent: getUa(req)
    });

    return res.status(201).json({ item });
  })
);

api.get(
  "/devices/share-targets",
  asyncHandler(async (_req, res) => {
    const items = await listShareTargets();
    return res.json({ items });
  })
);

api.post(
  "/share/credential",
  asyncHandler(async (req, res) => {
    const { credentialId, targetDeviceId } = req.body || {};
    if (!credentialId || !targetDeviceId) {
      return res.status(400).json({ error: "credentialId and targetDeviceId are required" });
    }

    const pkg = await createCredentialSharePackage(String(credentialId), String(targetDeviceId));
    await addAuditLog({
      type: "CREDENTIAL_SHARED_PACKAGE_CREATED",
      detail: `${credentialId}->${targetDeviceId}`,
      ip: getIp(req),
      userAgent: getUa(req)
    });

    return res.status(201).json({ package: pkg });
  })
);

api.post(
  "/honey/generate",
  asyncHandler(async (req, res) => {
    const count = Number(req.body?.count || 3);
    const items = await generateHoneyCredentials(count);
    await addAuditLog({
      type: "HONEY_PASSWORDS_GENERATED",
      detail: `count:${items.length}`,
      ip: getIp(req),
      userAgent: getUa(req)
    });
    syncHub.publish({
      type: "credential.batch_upsert",
      items
    });
    return res.status(201).json({ items });
  })
);

api.post(
  "/honey/trigger",
  asyncHandler(async (req, res) => {
    const credentialId = String(req.body?.credentialId || "");
    const action = String(req.body?.action || "access");
    if (!credentialId) {
      return res.status(400).json({ error: "credentialId is required" });
    }
    const data = await registerHoneyCredentialAccess(credentialId, action, {
      ip: getIp(req),
      userAgent: getUa(req)
    });
    if (!data) {
      return res.status(404).json({ error: "honey credential not found" });
    }
    if (data.item) {
      syncHub.publish({
        type: "credential.upsert",
        item: data.item
      });
    }
    return res.status(201).json(data);
  })
);

api.post(
  "/breach/check/:id",
  asyncHandler(async (req, res) => {
    const item = await refreshCredentialBreachStatus(String(req.params.id));
    if (!item) {
      return res.status(404).json({ error: "credential not found" });
    }
    if (item?.breachStatus?.compromised) {
      await addAuditLog({
        type: "PASSWORD_BREACH_DETECTED",
        detail: `${item.id}:${item.service}:count=${item.breachStatus.pwnedCount}`,
        ip: getIp(req),
        userAgent: getUa(req)
      });
    }
    syncHub.publish({
      type: "credential.upsert",
      item
    });
    return res.json({ item });
  })
);

api.post(
  "/breach/scan",
  asyncHandler(async (req, res) => {
    const result = await scanAllCredentialsForBreaches();
    await addAuditLog({
      type: "PASSWORD_BREACH_SCAN_COMPLETED",
      detail: `total=${result.total};compromised=${result.compromised}`,
      ip: getIp(req),
      userAgent: getUa(req)
    });
    if (result.compromised > 0) {
      await addAuditLog({
        type: "PASSWORD_BREACH_DETECTED",
        detail: `bulk_scan_compromised=${result.compromised}`,
        ip: getIp(req),
        userAgent: getUa(req)
      });
    }
    syncHub.publish({
      type: "credential.batch_upsert",
      items: result.items
    });
    return res.json(result);
  })
);

api.put(
  "/credentials/:id/rotation-policy",
  asyncHandler(async (req, res) => {
    const item = await updateCredentialRotationPolicy(String(req.params.id), req.body || {});
    if (!item) {
      return res.status(404).json({ error: "credential not found" });
    }
    await addAuditLog({
      type: "CREDENTIAL_ROTATION_POLICY_UPDATED",
      detail: `${item.id}:${item.rotationPolicy?.kind || "NONE"}:${item.rotationPolicy?.enabled ? "enabled" : "disabled"}`,
      ip: getIp(req),
      userAgent: getUa(req)
    });
    syncHub.publish({
      type: "credential.upsert",
      item
    });
    return res.json({ item });
  })
);

api.post(
  "/credentials/:id/rotate",
  asyncHandler(async (req, res) => {
    const reason = String(req.body?.reason || "manual");
    const result = await rotateCredentialSecret(String(req.params.id), reason);
    if (!result) {
      return res.status(404).json({ error: "credential not found" });
    }
    await addAuditLog({
      type: "CREDENTIAL_ROTATED",
      detail: `${result.item.id}:${result.rotation.kind}:${reason}`,
      ip: getIp(req),
      userAgent: getUa(req)
    });
    syncHub.publish({
      type: "credential.upsert",
      item: result.item
    });
    return res.status(201).json(result);
  })
);

api.post(
  "/rotation/run-due",
  asyncHandler(async (req, res) => {
    const limit = Number(req.body?.limit || 25);
    const result = await rotateDueCredentials(limit);
    await addAuditLog({
      type: "CREDENTIAL_ROTATION_DUE_RUN",
      detail: `due=${result.totalDue};rotated=${result.rotated};failed=${result.failed}`,
      ip: getIp(req),
      userAgent: getUa(req)
    });
    if (Array.isArray(result.items) && result.items.length > 0) {
      syncHub.publish({
        type: "credential.batch_upsert",
        items: result.items
      });
    }
    return res.json(result);
  })
);

api.get(
  "/rotation/due",
  asyncHandler(async (_req, res) => {
    const items = await listCredentials("");
    const due = items.filter((item) => isRotationDue(item.rotationPolicy));
    return res.json({
      total: due.length,
      items: due
    });
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

app.use((error, _req, res) => {
  const status = error?.statusCode || 500;
  res.status(status).json({ error: status === 500 ? "internal error" : error.message });
});

const server = app.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}${config.apiBasePath}`);
});
syncHub.attachWebSocketServer(server, `${config.apiBasePath}/sync/ws`);
backupService.start().catch(() => {
  // Non-fatal scheduler startup failure.
});
startRotationScheduler();

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

function startRotationScheduler() {
  const intervalMs = 10 * 60 * 1000;
  const run = async () => {
    try {
      const result = await rotateDueCredentials(50);
      if (result.rotated > 0) {
        await addAuditLog({
          type: "CREDENTIAL_ROTATION_AUTO_COMPLETED",
          detail: `rotated=${result.rotated};failed=${result.failed}`,
          ip: "server",
          userAgent: "rotation-scheduler"
        });
        syncHub.publish({
          type: "credential.batch_upsert",
          items: result.items
        });
      }
    } catch {
      // Non-fatal auto-rotation scheduler failure.
    }
  };
  run().catch(() => {
    // Ignore startup errors; scheduler keeps running.
  });
  setInterval(run, intervalMs).unref?.();
}
