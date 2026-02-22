import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import { config } from "./config.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_BYTES = 32;

function deriveLayerKey(itemId, layer, version) {
  const salt = createHash("sha256")
    .update(`vault|${itemId}|${layer}|${version}`)
    .digest();
  return pbkdf2Sync(config.masterKey, salt, 220000 + layer * 2000, KEY_BYTES, "sha512");
}

export function encryptWithLayers(plaintext, itemId, version = 1) {
  if (typeof plaintext !== "string" || !plaintext.length) {
    throw new Error("Secret plaintext must be a non-empty string.");
  }

  let current = Buffer.from(plaintext, "utf8");
  const totalLayers = config.encryptionLayers;

  for (let layer = 1; layer <= totalLayers; layer += 1) {
    const key = deriveLayerKey(itemId, layer, version);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    cipher.setAAD(Buffer.from(`id=${itemId};layer=${layer};v=${version}`));

    const encrypted = Buffer.concat([cipher.update(current), cipher.final()]);
    const tag = cipher.getAuthTag();
    current = Buffer.concat([iv, tag, encrypted]);
  }

  return {
    v: version,
    l: totalLayers,
    alg: ALGORITHM,
    data: current.toString("base64")
  };
}

export function decryptWithLayers(payload, itemId) {
  if (!payload?.data || !payload?.l || !payload?.v) {
    throw new Error("Invalid encrypted payload.");
  }

  let current = Buffer.from(payload.data, "base64");
  for (let layer = payload.l; layer >= 1; layer -= 1) {
    if (current.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error("Corrupted encrypted data.");
    }

    const iv = current.subarray(0, IV_LENGTH);
    const tag = current.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = current.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const key = deriveLayerKey(itemId, layer, payload.v);
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    decipher.setAAD(Buffer.from(`id=${itemId};layer=${layer};v=${payload.v}`));
    decipher.setAuthTag(tag);
    current = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  return current.toString("utf8");
}
