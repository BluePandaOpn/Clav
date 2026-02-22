import { useCallback, useState } from "react";

const SALT_KEY = "vault_master_salt_v1";
const CHECK_KEY = "vault_master_check_v1";
const DATA_KEY = "vault_local_encrypted_v1";
const DEVICE_ID_KEY = "vault_device_id_v1";
const DEVICE_KEYPAIR_KEY = "vault_device_keypair_enc_v1";
const CHECK_PLAINTEXT = "vault-check-ok";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i += 1) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64ToArrayBuffer(value) {
  return base64ToBytes(value).buffer;
}

function arrayBufferToBase64(value) {
  return bytesToBase64(new Uint8Array(value));
}

function toPem(type, base64) {
  const chunks = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${type}-----\n${chunks.join("\n")}\n-----END ${type}-----`;
}

function fromPem(pem) {
  return pem.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
}

async function deriveAesKey(password, saltBytes) {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveKey"
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 150000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptText(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(text)
  );
  return {
    iv: bytesToBase64(iv),
    data: bytesToBase64(cipher)
  };
}

async function decryptText(payload, key) {
  const iv = base64ToBytes(payload.iv);
  const data = base64ToBytes(payload.data);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return decoder.decode(plain);
}

export function useVaultSecurity() {
  const [cryptoKey, setCryptoKey] = useState(null);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(
    Boolean(localStorage.getItem(SALT_KEY) && localStorage.getItem(CHECK_KEY))
  );

  const setupMasterPassword = useCallback(async (password) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveAesKey(password, salt);
    const check = await encryptText(CHECK_PLAINTEXT, key);
    localStorage.setItem(SALT_KEY, bytesToBase64(salt));
    localStorage.setItem(CHECK_KEY, JSON.stringify(check));
    setConfigured(true);
    setCryptoKey(key);
    setReady(true);
  }, []);

  const unlock = useCallback(async (password) => {
    const saltRaw = localStorage.getItem(SALT_KEY);
    const checkRaw = localStorage.getItem(CHECK_KEY);
    if (!saltRaw || !checkRaw) {
      throw new Error("Configura una password maestra primero.");
    }
    const key = await deriveAesKey(password, base64ToBytes(saltRaw));
    const check = JSON.parse(checkRaw);
    const value = await decryptText(check, key);
    if (value !== CHECK_PLAINTEXT) {
      throw new Error("Password maestra invalida.");
    }
    setCryptoKey(key);
    setReady(true);
  }, []);

  const lock = useCallback(() => {
    setCryptoKey(null);
    setReady(false);
  }, []);

  const saveEncryptedVault = useCallback(
    async (items) => {
      if (!cryptoKey) return;
      const payload = await encryptText(JSON.stringify(items), cryptoKey);
      localStorage.setItem(DATA_KEY, JSON.stringify(payload));
    },
    [cryptoKey]
  );

  const loadEncryptedVault = useCallback(async () => {
    if (!cryptoKey) return [];
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return [];
    try {
      const payload = JSON.parse(raw);
      const text = await decryptText(payload, cryptoKey);
      const data = JSON.parse(text);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }, [cryptoKey]);

  const ensureDeviceKeyPair = useCallback(async () => {
    if (!cryptoKey) {
      throw new Error("Debes desbloquear la boveda para gestionar llaves de dispositivo.");
    }

    const savedRaw = localStorage.getItem(DEVICE_KEYPAIR_KEY);
    let publicKeyPem = "";

    if (savedRaw) {
      const payload = JSON.parse(savedRaw);
      const decoded = await decryptText(payload, cryptoKey);
      const stored = JSON.parse(decoded);
      publicKeyPem = stored.publicKeyPem;
    } else {
      const pair = await crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256"
        },
        true,
        ["encrypt", "decrypt"]
      );
      const publicKey = await crypto.subtle.exportKey("spki", pair.publicKey);
      const privateKey = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
      const packed = JSON.stringify({
        algorithm: "RSA-OAEP",
        publicKeyPem: toPem("PUBLIC KEY", arrayBufferToBase64(publicKey)),
        privateKeyPem: toPem("PRIVATE KEY", arrayBufferToBase64(privateKey)),
        createdAt: new Date().toISOString()
      });
      const encrypted = await encryptText(packed, cryptoKey);
      localStorage.setItem(DEVICE_KEYPAIR_KEY, JSON.stringify(encrypted));
      publicKeyPem = JSON.parse(packed).publicKeyPem;
    }

    if (!localStorage.getItem(DEVICE_ID_KEY)) {
      localStorage.setItem(DEVICE_ID_KEY, crypto.randomUUID());
    }

    return {
      deviceId: localStorage.getItem(DEVICE_ID_KEY),
      publicKeyPem
    };
  }, [cryptoKey]);

  const decryptSharedPackage = useCallback(
    async (pkg) => {
      if (!cryptoKey) {
        throw new Error("Debes desbloquear la boveda para importar comparticiones.");
      }
      const savedRaw = localStorage.getItem(DEVICE_KEYPAIR_KEY);
      if (!savedRaw) {
        throw new Error("Este dispositivo no tiene llaves registradas.");
      }

      const encrypted = JSON.parse(savedRaw);
      const decoded = await decryptText(encrypted, cryptoKey);
      const stored = JSON.parse(decoded);

      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        base64ToArrayBuffer(fromPem(stored.privateKeyPem)),
        {
          name: "RSA-OAEP",
          hash: "SHA-256"
        },
        false,
        ["decrypt"]
      );

      const aesKeyRaw = await crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        base64ToArrayBuffer(pkg.encryptedKey)
      );

      const aesKey = await crypto.subtle.importKey("raw", aesKeyRaw, { name: "AES-GCM" }, false, ["decrypt"]);
      const tag = base64ToBytes(pkg.tag);
      const data = base64ToBytes(pkg.data);
      const payload = new Uint8Array(data.length + tag.length);
      payload.set(data, 0);
      payload.set(tag, data.length);

      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(pkg.iv) },
        aesKey,
        payload
      );

      return JSON.parse(decoder.decode(plaintext));
    },
    [cryptoKey]
  );

  return {
    isConfigured: configured,
    isUnlocked: ready,
    setupMasterPassword,
    unlock,
    lock,
    saveEncryptedVault,
    loadEncryptedVault,
    ensureDeviceKeyPair,
    decryptSharedPackage
  };
}
