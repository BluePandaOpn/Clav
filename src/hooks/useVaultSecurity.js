import { useCallback, useState } from "react";

const SALT_KEY = "vault_master_salt_v1";
const CHECK_KEY = "vault_master_check_v1";
const DATA_KEY = "vault_local_encrypted_v1";
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

  return {
    isConfigured: configured,
    isUnlocked: ready,
    setupMasterPassword,
    unlock,
    lock,
    saveEncryptedVault,
    loadEncryptedVault
  };
}
