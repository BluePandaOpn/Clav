import "dotenv/config";
import { randomBytes } from "node:crypto";

const DEV_DEFAULT_NAMESPACE = "dev-local-vault-route-29af4c8e71b5";

function inProduction() {
  return process.env.NODE_ENV === "production";
}

function getApiNamespace() {
  const raw = process.env.API_NAMESPACE?.trim();
  if (raw && raw.length >= 24) return raw;
  if (inProduction()) {
    throw new Error("API_NAMESPACE must be defined with at least 24 characters in production.");
  }
  console.warn("[security] API_NAMESPACE missing. Using development fallback namespace.");
  return DEV_DEFAULT_NAMESPACE;
}

function getMasterKey() {
  const raw = process.env.MASTER_ENCRYPTION_KEY?.trim();
  if (raw && raw.length >= 64) return raw;
  if (inProduction()) {
    throw new Error("MASTER_ENCRYPTION_KEY must be defined with at least 64 characters in production.");
  }
  const generated = randomBytes(64).toString("hex");
  console.warn("[security] MASTER_ENCRYPTION_KEY missing. Using ephemeral development key.");
  return generated;
}

const apiNamespace = getApiNamespace();
const masterKey = getMasterKey();
const encryptionLayers = Number(process.env.ENCRYPTION_LAYERS || 10);

if (!Number.isInteger(encryptionLayers) || encryptionLayers < 3 || encryptionLayers > 10) {
  throw new Error("ENCRYPTION_LAYERS must be an integer between 3 and 10.");
}

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const port = Number(process.env.PORT || 4000);
const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
const hibpEnabled = String(process.env.HIBP_ENABLED || "true").toLowerCase() !== "false";
const hibpTimeoutMs = Number(process.env.HIBP_TIMEOUT_MS || 4500);
const hibpRangeBaseUrl = process.env.HIBP_RANGE_BASE_URL || "https://api.pwnedpasswords.com/range";
const leakedPasswordsFile = process.env.LEAKED_PASSWORDS_FILE || "server/data/leaked-passwords.txt";
const breachAutoScanOnList = String(process.env.BREACH_AUTO_SCAN_ON_LIST || "true").toLowerCase() !== "false";
const breachStatusTtlHours = Number(process.env.BREACH_STATUS_TTL_HOURS || 24);
const backupEnabled = String(process.env.BACKUP_ENABLED || "true").toLowerCase() !== "false";
const backupDir = process.env.BACKUP_DIR || "server/data/backups";
const backupRetention = Math.max(1, Number(process.env.BACKUP_RETENTION || 30));
const backupAutoEnabled = String(process.env.BACKUP_AUTO_ENABLED || "true").toLowerCase() !== "false";
const backupIntervalMinutes = Math.max(1, Number(process.env.BACKUP_INTERVAL_MINUTES || 60));
const backupRunOnStartup = String(process.env.BACKUP_RUN_ON_STARTUP || "false").toLowerCase() === "true";
const backupCloudProvider = String(process.env.BACKUP_CLOUD_PROVIDER || "none").toLowerCase();
const backupCloudUrl = process.env.BACKUP_CLOUD_URL || "";
const backupCloudAuthHeader = process.env.BACKUP_CLOUD_AUTH_HEADER || "";

export const config = {
  apiNamespace,
  apiBasePath: `/api/v1/${apiNamespace}`,
  masterKey,
  encryptionLayers,
  corsOrigin,
  port,
  appBaseUrl,
  hibpEnabled,
  hibpTimeoutMs,
  hibpRangeBaseUrl,
  leakedPasswordsFile,
  breachAutoScanOnList,
  breachStatusTtlHours,
  backupEnabled,
  backupDir,
  backupRetention,
  backupAutoEnabled,
  backupIntervalMinutes,
  backupRunOnStartup,
  backupCloudProvider,
  backupCloudUrl,
  backupCloudAuthHeader
};
