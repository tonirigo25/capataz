import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProviderReceipt, StorageProvider } from "@/lib/platform/providers/contracts";
import { S3StorageProvider } from "@/lib/platform/providers/production";
import { FailClosedMalwareScanner, HttpMalwareScanner, LocalDeterministicMalwareScanner, type MalwareScanner, type MalwareScanVerdict } from "@/lib/security/malware-scanner";
import {
  acquireEntitlementLimitLock,
  assertStorageMutationAllowed,
} from "@/lib/commercial/usage";

export const companyAssetMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;

export class PrivateStorageService {
  constructor(private readonly db: PrismaClient, private readonly provider: StorageProvider, private readonly bucket: string, private readonly signingSecret: string, private readonly scanner: MalwareScanner = new LocalDeterministicMalwareScanner()) {
    if (signingSecret.length < 32) throw new Error("STORAGE_SIGNING_SECRET_REQUIRED");
  }

  async put(input: { companyId: string; bytes: Uint8Array; originalName: string; mimeType: string; classification: string; idempotencyKey: string }) {
    if (!input.bytes.byteLength || input.bytes.byteLength > 5 * 1024 * 1024) throw new Error("STORAGE_ASSET_SIZE_INVALID");
    if (!companyAssetMimeTypes.includes(input.mimeType as (typeof companyAssetMimeTypes)[number])) throw new Error("STORAGE_ASSET_MIME_FORBIDDEN");
    if (!matchesImageSignature(input.bytes, input.mimeType)) throw new Error("STORAGE_ASSET_CONTENT_MISMATCH");
    const safeName = sanitizeFilename(input.originalName);
    const extension = input.mimeType === "image/png" ? "png" : input.mimeType === "image/jpeg" ? "jpg" : "webp";
    const expectedHash = createHash("sha256").update(input.bytes).digest("hex");
    const objectKey = `assets/${createHash("sha256").update(`${input.companyId}:${input.idempotencyKey}`).digest("hex").slice(0, 40)}.${extension}`;
    const stored = await this.db.$transaction(
      async (transaction) => {
        await acquireEntitlementLimitLock(
          transaction,
          input.companyId,
          "storage_bytes",
        );
        const existing = await transaction.storedObject.findFirst({
          where: {
            companyId: input.companyId,
            provider: this.provider.name,
            bucket: this.bucket,
            objectKey,
            deletedAt: null,
          },
        });
        if (existing) {
          if (
            existing.sha256 !== expectedHash ||
            existing.sizeBytes !== BigInt(input.bytes.byteLength) ||
            existing.mimeType !== input.mimeType
          )
            throw new Error("STORAGE_IDEMPOTENCY_CONFLICT");
          return { object: existing, replayed: true };
        }
        await assertStorageMutationAllowed(transaction, {
          companyId: input.companyId,
          sizeBytes: input.bytes.byteLength,
          origin: "private_storage",
          targetId: objectKey,
        });
        const receipt = await this.provider.put({
          companyId: input.companyId,
          objectKey,
          bytes: input.bytes,
          contentType: input.mimeType,
          idempotencyKey: input.idempotencyKey,
        });
        if (receipt.sha256 !== expectedHash)
          throw new Error("STORAGE_PROVIDER_HASH_MISMATCH");
        const created = await transaction.storedObject.create({
          data: {
            companyId: input.companyId,
            provider: this.provider.name,
            bucket: this.bucket,
            objectKey,
            versionId: receipt.reference,
            providerVersion: receipt.reference,
            originalName: input.originalName.slice(0, 255),
            safeName,
            mimeType: input.mimeType,
            sizeBytes: BigInt(input.bytes.byteLength),
            sha256: expectedHash,
            classification: input.classification,
            encryption: "provider-managed",
            contentDisposition: `attachment; filename=\"${safeName}\"`,
            status: "QUARANTINED",
          },
        });
        return { object: created, replayed: false };
      },
      { isolationLevel: "Serializable" },
    );
    const { object } = stored;
    if (stored.replayed) {
      if (object.status !== "READY")
        throw new Error(`STORAGE_OBJECT_QUARANTINED:${object.id}`);
      return object;
    }
    const scan = await this.db.uploadScan.create({ data: { companyId: input.companyId, storedObjectId: object.id, engine: "pending", status: "SCANNING" } });
    const verdict: MalwareScanVerdict = await this.scanner.scan({ bytes: input.bytes, sha256: expectedHash, mimeType: input.mimeType, filename: safeName }).catch(() => ({ status: "ERROR", engine: "scanner-error", engineVersion: "unknown", reference: expectedHash.slice(0, 24) }));
    const ready = verdict.status === "CLEAN";
    const updated = await this.db.$transaction(async (transaction) => {
      await transaction.uploadScan.update({ where: { id: scan.id }, data: { engine: verdict.engine, engineVersion: verdict.engineVersion, status: verdict.status, result: { reference: verdict.reference, signature: verdict.signature ?? null }, scannedAt: new Date() } });
      return transaction.storedObject.update({ where: { id: object.id }, data: { status: ready ? "READY" : verdict.status === "INFECTED" ? "BLOCKED" : "QUARANTINED", quarantineReason: ready ? null : verdict.status } });
    });
    if (!ready) throw new Error(`STORAGE_OBJECT_QUARANTINED:${object.id}`);
    return updated;
  }

  async readVerified(input: { companyId: string; objectId: string }) {
    const object = await this.db.storedObject.findFirstOrThrow({ where: { id: input.objectId, companyId: input.companyId, deletedAt: null, status: "READY" } });
    const bytes = await this.provider.get({ companyId: input.companyId, objectKey: object.objectKey });
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== object.sha256 || BigInt(bytes.byteLength) !== object.sizeBytes) throw new Error("STORAGE_OBJECT_INTEGRITY_FAILED");
    return { object, bytes };
  }

  createSignedGrant(input: { companyId: string; objectId: string; expiresInSeconds?: number; now?: Date }) {
    const now = input.now ?? new Date();
    const ttl = Math.max(30, Math.min(input.expiresInSeconds ?? 300, 900));
    const payload = Buffer.from(JSON.stringify({ v: 1, companyId: input.companyId, objectId: input.objectId, exp: Math.floor(now.getTime() / 1_000) + ttl })).toString("base64url");
    const signature = createHmac("sha256", this.signingSecret).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  }

  async authorizeDownload(input: { companyId: string; objectId: string; baseUrl: string; expiresInSeconds?: number; now?: Date }) {
    await this.db.storedObject.findFirstOrThrow({ where: { id: input.objectId, companyId: input.companyId, deletedAt: null, status: "READY" }, select: { id: true } });
    const base = new URL(input.baseUrl);
    if (process.env.NODE_ENV === "production" && base.protocol !== "https:") throw new Error("STORAGE_DOWNLOAD_BASE_URL_MUST_BE_HTTPS");
    const grant = this.createSignedGrant(input);
    return new URL(`/api/storage/${encodeURIComponent(input.objectId)}?grant=${encodeURIComponent(grant)}`, base).href;
  }

  verifySignedGrant(token: string, input: { expectedObjectId?: string; now?: Date } = {}) {
    const [payload, provided] = token.split(".");
    if (!payload || !provided) throw new Error("STORAGE_GRANT_INVALID");
    const expected = createHmac("sha256", this.signingSecret).update(payload).digest();
    const actual = Buffer.from(provided, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("STORAGE_GRANT_INVALID");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { v?: number; companyId?: string; objectId?: string; exp?: number };
    if (claims.v !== 1 || !claims.companyId || !claims.objectId || !Number.isInteger(claims.exp)) throw new Error("STORAGE_GRANT_INVALID");
    if (claims.exp! <= Math.floor((input.now ?? new Date()).getTime() / 1_000)) throw new Error("STORAGE_GRANT_EXPIRED");
    if (input.expectedObjectId && claims.objectId !== input.expectedObjectId) throw new Error("STORAGE_GRANT_OBJECT_MISMATCH");
    return claims as { v: 1; companyId: string; objectId: string; exp: number };
  }
}

export class LocalPrivateStorageProvider implements StorageProvider {
  readonly name = "local-private";
  readonly mode = "sandbox" as const;
  constructor(private readonly root = resolve(process.env.PRIVATE_STORAGE_ROOT || ".capataz-private-storage")) {}
  async put(input: { companyId: string; objectKey: string; bytes: Uint8Array; contentType: string; idempotencyKey: string }) {
    const target = this.target(input.companyId, input.objectKey);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await mkdir(dirname(target), { recursive: true });
    try { await writeFile(temporary, input.bytes, { flag: "wx", mode: 0o600 }); await rename(temporary, target); }
    catch (error) { await rm(temporary, { force: true }).catch(() => undefined); throw error; }
    return { provider: this.name, mode: this.mode, reference: createHash("sha256").update(`${input.companyId}:${input.objectKey}:${input.idempotencyKey}`).digest("hex").slice(0, 32), idempotencyKey: input.idempotencyKey, acceptedAt: new Date().toISOString(), sha256: createHash("sha256").update(input.bytes).digest("hex") } satisfies ProviderReceipt & { sha256: string };
  }
  async get(input: { companyId: string; objectKey: string }) { return new Uint8Array(await readFile(this.target(input.companyId, input.objectKey))); }
  async delete(input: { companyId: string; objectKey: string; idempotencyKey: string }) {
    await rm(this.target(input.companyId, input.objectKey), { force: true });
    return { provider: this.name, mode: this.mode, reference: createHash("sha256").update(`${input.companyId}:${input.objectKey}:deleted`).digest("hex").slice(0, 32), idempotencyKey: input.idempotencyKey, acceptedAt: new Date().toISOString() } satisfies ProviderReceipt;
  }
  private target(companyId: string, objectKey: string) {
    if (!/^[A-Za-z0-9_-]+$/.test(companyId) || !objectKey || isAbsolute(objectKey) || objectKey.includes("\0")) throw new Error("STORAGE_KEY_INVALID");
    const target = resolve(this.root, companyId, objectKey);
    const offset = relative(this.root, target);
    if (!offset || offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) throw new Error("STORAGE_KEY_INVALID");
    return target;
  }
}

export function getPrivateStorageService(db: PrismaClient = prisma) {
  const secret = process.env.STORAGE_SIGNING_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "orqena-local-storage-signing-secret-change-me");
  if (process.env.STORAGE_PROVIDER === "s3") {
    const bucket = process.env.S3_BUCKET ?? "";
    if (!bucket || !process.env.S3_REGION || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) throw new Error("S3_CONFIGURATION_INCOMPLETE");
    const client = new S3Client({ region: process.env.S3_REGION, endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: Boolean(process.env.S3_ENDPOINT), credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
    const scanner = process.env.MALWARE_SCAN_ENDPOINT && process.env.MALWARE_SCAN_AUTHORIZATION
      ? new HttpMalwareScanner(new URL(process.env.MALWARE_SCAN_ENDPOINT), process.env.MALWARE_SCAN_AUTHORIZATION)
      : new FailClosedMalwareScanner();
    return new PrivateStorageService(db, new S3StorageProvider(client, bucket), bucket, secret, scanner);
  }
  return new PrivateStorageService(db, new LocalPrivateStorageProvider(), "local-private", secret);
}

export function sanitizeFilename(value: string) {
  const base = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+/, "").slice(0, 120);
  return base || "asset";
}

export function matchesImageSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (mimeType === "image/jpeg") return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  if (mimeType === "image/webp") return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return false;
}
