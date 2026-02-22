import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export function createBackupService({ config, readStore, addAuditLog }) {
  const dirPath = resolve(process.cwd(), config.backupDir);
  let timer = null;

  const triggerBackup = async (reason = "manual") => {
    if (!config.backupEnabled) {
      return {
        ok: false,
        reason: "disabled"
      };
    }

    await mkdir(dirPath, { recursive: true });
    const snapshot = await readStore();
    const payload = encryptSnapshot(snapshot, config.masterKey);
    const fileName = buildBackupName(payload.createdAt, reason);
    const fullPath = resolve(dirPath, fileName);
    await writeFile(fullPath, JSON.stringify(payload, null, 2), "utf8");

    await enforceLocalRetention(config.backupRetention, dirPath);
    const cloud = await uploadToCloudIfConfigured(config, payload, fileName);

    await addAuditLog({
      type: "BACKUP_CREATED",
      detail: `reason=${reason};file=${fileName};cloud=${cloud.ok ? "ok" : "skip_or_error"}`
    });

    return {
      ok: true,
      reason,
      fileName,
      path: fullPath,
      createdAt: payload.createdAt,
      cloud
    };
  };

  const listBackups = async () => {
    await mkdir(dirPath, { recursive: true });
    const files = await readdir(dirPath);
    const entries = [];
    for (const name of files) {
      if (!name.endsWith(".enc.json")) continue;
      const fullPath = resolve(dirPath, name);
      const info = await stat(fullPath);
      entries.push({
        name,
        size: info.size,
        modifiedAt: info.mtime.toISOString()
      });
    }
    entries.sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt));
    return entries;
  };

  const start = async () => {
    if (!config.backupEnabled || !config.backupAutoEnabled) return;
    if (timer) return;

    if (config.backupRunOnStartup) {
      try {
        await triggerBackup("startup");
      } catch {
        // Non-fatal on startup.
      }
    }

    const intervalMs = config.backupIntervalMinutes * 60 * 1000;
    timer = setInterval(() => {
      triggerBackup("scheduled").catch(() => {
        // Non-fatal scheduled failure, logged through audit on success path.
      });
    }, intervalMs);
  };

  const stop = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  const getConfig = () => ({
    enabled: config.backupEnabled,
    dir: config.backupDir,
    retention: config.backupRetention,
    autoEnabled: config.backupAutoEnabled,
    intervalMinutes: config.backupIntervalMinutes,
    runOnStartup: config.backupRunOnStartup,
    cloudProvider: config.backupCloudProvider,
    cloudConfigured: Boolean(config.backupCloudUrl)
  });

  return {
    triggerBackup,
    listBackups,
    start,
    stop,
    getConfig
  };
}

function encryptSnapshot(data, masterKey) {
  const createdAt = new Date().toISOString();
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const iv = randomBytes(12);
  const key = deriveKey(masterKey);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: "3.4.0",
    createdAt,
    cipher: "AES-256-GCM",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64")
  };
}

function deriveKey(masterKey) {
  return createHash("sha256").update(String(masterKey || ""), "utf8").digest();
}

function buildBackupName(isoDate, reason) {
  const stamp = String(isoDate || new Date().toISOString()).replace(/[:.]/g, "-");
  const safeReason = String(reason || "manual")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
  return `vault-backup-${stamp}-${safeReason}.enc.json`;
}

async function enforceLocalRetention(retention, dirPath) {
  const files = await readdir(dirPath);
  const backupFiles = [];
  for (const name of files) {
    if (!name.endsWith(".enc.json")) continue;
    const fullPath = resolve(dirPath, name);
    const info = await stat(fullPath);
    backupFiles.push({ name, fullPath, mtimeMs: info.mtimeMs });
  }
  backupFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const toDelete = backupFiles.slice(retention);
  await Promise.all(toDelete.map((entry) => rm(entry.fullPath, { force: true })));
}

async function uploadToCloudIfConfigured(config, payload, fileName) {
  const provider = String(config.backupCloudProvider || "none").toLowerCase();
  const uploadUrl = String(config.backupCloudUrl || "").trim();
  if (!uploadUrl || provider === "none") {
    return {
      ok: false,
      skipped: true,
      provider
    };
  }

  const headers = {
    "Content-Type": "application/json",
    "X-Backup-File": fileName
  };
  if (config.backupCloudAuthHeader) {
    headers.Authorization = config.backupCloudAuthHeader;
  }
  if (provider === "azure") {
    headers["x-ms-blob-type"] = "BlockBlob";
  }

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      // Ignore text read failures.
    }
    return {
      ok: false,
      skipped: false,
      provider,
      status: response.status,
      error: body || `upload failed: ${response.status}`
    };
  }

  return {
    ok: true,
    skipped: false,
    provider,
    status: response.status
  };
}
