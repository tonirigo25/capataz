import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;

export function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt-v1$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [version, saltText, hashText] = encoded.split("$");
  if (version !== "scrypt-v1" || !saltText || !hashText) return false;
  try {
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(hashText, "base64url");
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function validatePassword(password: string) {
  const errors: string[] = [];
  if (password.length < 12) errors.push("Usa al menos 12 caracteres.");
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) errors.push("Incluye mayúsculas y minúsculas.");
  if (!/\d/.test(password)) errors.push("Incluye al menos un número.");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Incluye al menos un símbolo.");
  return errors;
}
