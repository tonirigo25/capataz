import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedEnvelope = {
  keyVersion: string;
  algorithm: "aes-256-gcm";
  ciphertext: string;
  initializationVector: string;
  authenticationTag: string;
};

export type EncryptionKeyring = {
  activeVersion: string;
  keys: ReadonlyMap<string, Buffer>;
};

export function loadEncryptionKeyring(env: NodeJS.ProcessEnv = process.env): EncryptionKeyring {
  const activeVersion = env.APP_ACTIVE_KEY_VERSION?.trim();
  const entries = env.APP_ENCRYPTION_KEYS?.split(",").map((entry) => entry.trim()).filter(Boolean) ?? [];
  const keys = new Map<string, Buffer>();
  for (const entry of entries) {
    const separator = entry.indexOf(":");
    if (separator < 1) throw new Error("INVALID_ENCRYPTION_KEYRING");
    const version = entry.slice(0, separator);
    const key = Buffer.from(entry.slice(separator + 1), "base64");
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(version) || key.length !== 32) throw new Error("INVALID_ENCRYPTION_KEYRING");
    keys.set(version, key);
  }
  if (!activeVersion || !keys.has(activeVersion)) throw new Error("ACTIVE_ENCRYPTION_KEY_NOT_CONFIGURED");
  return { activeVersion, keys };
}

export function encryptCredential(plaintext: string, associatedData: string, keyring = loadEncryptionKeyring()): EncryptedEnvelope {
  if (!plaintext || !associatedData) throw new Error("ENCRYPTION_INPUT_REQUIRED");
  const key = keyring.keys.get(keyring.activeVersion)!;
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, initializationVector);
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    keyVersion: keyring.activeVersion,
    algorithm: "aes-256-gcm",
    ciphertext: ciphertext.toString("base64"),
    initializationVector: initializationVector.toString("base64"),
    authenticationTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptCredential(envelope: EncryptedEnvelope, associatedData: string, keyring = loadEncryptionKeyring()): string {
  if (envelope.algorithm !== "aes-256-gcm") throw new Error("UNSUPPORTED_ENCRYPTION_ALGORITHM");
  const key = keyring.keys.get(envelope.keyVersion);
  if (!key) throw new Error("ENCRYPTION_KEY_VERSION_UNAVAILABLE");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.initializationVector, "base64"));
  decipher.setAAD(Buffer.from(associatedData, "utf8"));
  decipher.setAuthTag(Buffer.from(envelope.authenticationTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
