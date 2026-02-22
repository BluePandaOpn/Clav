import { createCipheriv, createDecipheriv, publicEncrypt, randomBytes, privateDecrypt, constants } from "node:crypto";

function toBase64(value) {
  return Buffer.from(value).toString("base64");
}

function fromBase64(value) {
  return Buffer.from(value, "base64");
}

export function createHybridSharePackage(payload, targetPublicKeyPem, metadata = {}) {
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");

  const cipher = createCipheriv("aes-256-gcm", aesKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const encryptedKey = publicEncrypt(
    {
      key: targetPublicKeyPem,
      oaepHash: "sha256",
      padding: constants.RSA_PKCS1_OAEP_PADDING
    },
    aesKey
  );

  return {
    v: 1,
    kty: "rsa-oaep-256",
    enc: "aes-256-gcm",
    meta: metadata,
    encryptedKey: toBase64(encryptedKey),
    iv: toBase64(iv),
    tag: toBase64(tag),
    data: toBase64(ciphertext)
  };
}

export function decryptHybridSharePackage(pkg, privateKeyPem) {
  const aesKey = privateDecrypt(
    {
      key: privateKeyPem,
      oaepHash: "sha256",
      padding: constants.RSA_PKCS1_OAEP_PADDING
    },
    fromBase64(pkg.encryptedKey)
  );
  const decipher = createDecipheriv("aes-256-gcm", aesKey, fromBase64(pkg.iv));
  decipher.setAuthTag(fromBase64(pkg.tag));
  const plaintext = Buffer.concat([decipher.update(fromBase64(pkg.data)), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}
