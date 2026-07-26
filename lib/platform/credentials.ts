import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { decryptCredential, encryptCredential, loadEncryptionKeyring, type EncryptionKeyring } from "@/lib/platform/encryption";

export async function storeEncryptedCredential(input: {
  prisma: PrismaClient;
  companyId: string;
  purpose: string;
  plaintext: string;
  integrationConnectionId?: string;
  keyring?: EncryptionKeyring;
}) {
  const purpose = normalizePurpose(input.purpose);
  const keyring = input.keyring ?? loadEncryptionKeyring();
  const associatedData = credentialAad(input.companyId, purpose, input.integrationConnectionId);
  const envelope = encryptCredential(input.plaintext, associatedData, keyring);
  return input.prisma.encryptedCredential.upsert({
    where: { companyId_purpose_keyVersion: { companyId: input.companyId, purpose, keyVersion: envelope.keyVersion } },
    update: { integrationConnectionId: input.integrationConnectionId, algorithm: envelope.algorithm, ciphertext: envelope.ciphertext, initializationVector: envelope.initializationVector, authenticationTag: envelope.authenticationTag, fingerprint: fingerprint(input.plaintext), rotatedAt: new Date() },
    create: { companyId: input.companyId, integrationConnectionId: input.integrationConnectionId, purpose, keyVersion: envelope.keyVersion, algorithm: envelope.algorithm, ciphertext: envelope.ciphertext, initializationVector: envelope.initializationVector, authenticationTag: envelope.authenticationTag, fingerprint: fingerprint(input.plaintext) },
  });
}

export async function readEncryptedCredential(input: {
  prisma: PrismaClient;
  companyId: string;
  purpose: string;
  integrationConnectionId?: string;
  keyring?: EncryptionKeyring;
}) {
  const purpose = normalizePurpose(input.purpose);
  const keyring = input.keyring ?? loadEncryptionKeyring();
  const record = await input.prisma.encryptedCredential.findFirstOrThrow({ where: { companyId: input.companyId, purpose, integrationConnectionId: input.integrationConnectionId }, orderBy: { updatedAt: "desc" } });
  return decryptCredential({ keyVersion: record.keyVersion, algorithm: "aes-256-gcm", ciphertext: record.ciphertext, initializationVector: record.initializationVector, authenticationTag: record.authenticationTag }, credentialAad(input.companyId, purpose, input.integrationConnectionId), keyring);
}

function credentialAad(companyId: string, purpose: string, integrationConnectionId?: string) {
  return `${companyId}:${integrationConnectionId ?? "company"}:${purpose}`;
}

function normalizePurpose(value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._:-]{1,100}$/.test(normalized)) throw new Error("INVALID_CREDENTIAL_PURPOSE");
  return normalized;
}

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
