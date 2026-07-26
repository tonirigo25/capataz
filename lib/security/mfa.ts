import { randomUUID } from "node:crypto";
import { generateSecret, generateURI, verify } from "otplib";
import type { PrismaClient } from "@prisma/client";
import { brandConfig } from "@/lib/config/brand";
import { decryptCredential, encryptCredential, loadEncryptionKeyring, type EncryptionKeyring } from "@/lib/platform/encryption";
import { appendSensitiveAuditLog } from "@/lib/security/audit-chain";

const MFA_MAX_AGE_MS = 12 * 60 * 60 * 1_000;

export async function startTotpEnrollment(input: { prisma: PrismaClient; userId: string; email: string; label?: string; keyring?: EncryptionKeyring }) {
  const keyring = input.keyring ?? loadEncryptionKeyring();
  const id = randomUUID();
  const secret = generateSecret();
  const envelope = encryptCredential(secret, factorAad(input.userId, id), keyring);
  const label = (input.label || "Autenticador principal").trim().slice(0, 80);
  await input.prisma.$transaction(async (transaction) => {
    await transaction.mfaFactor.updateMany({ where: { userId: input.userId, status: "PENDING" }, data: { status: "DISABLED", disabledAt: new Date() } });
    await transaction.mfaFactor.create({ data: { id, userId: input.userId, label, keyVersion: envelope.keyVersion, algorithm: envelope.algorithm, ciphertext: envelope.ciphertext, initializationVector: envelope.initializationVector, authenticationTag: envelope.authenticationTag } });
    await appendSensitiveAuditLog(transaction, { userActorId: input.userId, action: "security.mfa_enrollment_started", targetType: "MfaFactor", targetId: id, actorType: "user" });
  });
  return { factorId: id, uri: generateURI({ issuer: brandConfig.productName, label: input.email, secret }) };
}

export async function readPendingTotpEnrollment(input: { prisma: PrismaClient; userId: string; email: string; keyring?: EncryptionKeyring }) {
  const factor = await input.prisma.mfaFactor.findFirst({ where: { userId: input.userId, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  if (!factor) return null;
  const secret = decryptFactor(factor, input.keyring ?? loadEncryptionKeyring());
  return { factorId: factor.id, uri: generateURI({ issuer: brandConfig.productName, label: input.email, secret }) };
}

export async function confirmTotpEnrollment(input: { prisma: PrismaClient; userId: string; factorId: string; token: string; keyring?: EncryptionKeyring; now?: Date }) {
  const factor = await input.prisma.mfaFactor.findFirstOrThrow({ where: { id: input.factorId, userId: input.userId, status: "PENDING" } });
  const secret = decryptFactor(factor, input.keyring ?? loadEncryptionKeyring());
  const result = await verify({ secret, token: normalizeToken(input.token), epoch: input.now?.getTime() });
  if (!result.valid) throw new Error("MFA_TOKEN_INVALID");
  const now = input.now ?? new Date();
  await input.prisma.$transaction(async (transaction) => {
    await transaction.mfaFactor.updateMany({ where: { userId: input.userId, status: "ACTIVE" }, data: { status: "DISABLED", disabledAt: now } });
    await transaction.mfaFactor.update({ where: { id: factor.id }, data: { status: "ACTIVE", confirmedAt: now, lastUsedAt: now } });
    await appendSensitiveAuditLog(transaction, { userActorId: input.userId, action: "security.mfa_enrollment_confirmed", targetType: "MfaFactor", targetId: factor.id, actorType: "user" });
  });
}

export async function verifySessionSecondFactor(input: { prisma: PrismaClient; userId: string; sessionId: string; token: string; keyring?: EncryptionKeyring; now?: Date }) {
  const factor = await input.prisma.mfaFactor.findFirstOrThrow({ where: { userId: input.userId, status: "ACTIVE", disabledAt: null }, orderBy: { confirmedAt: "desc" } });
  const secret = decryptFactor(factor, input.keyring ?? loadEncryptionKeyring());
  const result = await verify({ secret, token: normalizeToken(input.token), epoch: input.now?.getTime() });
  if (!result.valid) throw new Error("MFA_TOKEN_INVALID");
  const now = input.now ?? new Date();
  await input.prisma.$transaction(async (transaction) => {
    const updated = await transaction.session.updateMany({ where: { id: input.sessionId, userId: input.userId, revokedAt: null, expiresAt: { gt: now } }, data: { secondFactorVerifiedAt: now } });
    if (updated.count !== 1) throw new Error("MFA_SESSION_INVALID");
    await transaction.mfaFactor.update({ where: { id: factor.id }, data: { lastUsedAt: now } });
    await appendSensitiveAuditLog(transaction, { userActorId: input.userId, action: "security.mfa_challenge_verified", targetType: "Session", targetId: input.sessionId, actorType: "user" });
  });
}

export function isSecondFactorFresh(verifiedAt: Date | null | undefined, now = new Date()) {
  return Boolean(verifiedAt && verifiedAt <= now && now.getTime() - verifiedAt.getTime() <= MFA_MAX_AGE_MS);
}

function decryptFactor(factor: { id: string; userId: string; keyVersion: string; algorithm: string; ciphertext: string; initializationVector: string; authenticationTag: string }, keyring: EncryptionKeyring) {
  return decryptCredential({ keyVersion: factor.keyVersion, algorithm: factor.algorithm as "aes-256-gcm", ciphertext: factor.ciphertext, initializationVector: factor.initializationVector, authenticationTag: factor.authenticationTag }, factorAad(factor.userId, factor.id), keyring);
}

function factorAad(userId: string, factorId: string) {
  return `mfa:${userId}:${factorId}`;
}

function normalizeToken(value: string) {
  const token = value.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(token)) throw new Error("MFA_TOKEN_INVALID");
  return token;
}
