import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StoredDocument = { storageKey: string; sizeBytes: number; checksum: string };
export type DocumentObjectInput = {
  companyId: string;
  category: string;
  documentId: string;
  filename: string;
  mimeType: string;
  checksum: string;
};

export interface DocumentStorage {
  readonly kind: "local" | "r2";
  put(input: DocumentObjectInput & { bytes: Buffer }): Promise<StoredDocument>;
  get(input: { companyId: string; storageKey: string }): Promise<Buffer>;
  delete(input: { companyId: string; storageKey: string }): Promise<void>;
  presignPut(input: DocumentObjectInput & { sizeBytes: number; expiresInSeconds?: number }): Promise<{ storageKey: string; url: string; expiresAt: Date }>;
  presignGet(input: { companyId: string; storageKey: string; filename: string; mimeType: string; expiresInSeconds?: number }): Promise<{ url: string; expiresAt: Date } | null>;
  verify(): Promise<void>;
}

export function documentStorageRoot() {
  return resolve(process.env.DOCUMENT_STORAGE_ROOT || join(process.cwd(), ".capataz-documents"));
}

export class LocalDocumentStorage implements DocumentStorage {
  readonly kind = "local" as const;
  constructor(private readonly root = documentStorageRoot()) {}

  async put(input: DocumentObjectInput & { bytes: Buffer }) {
    const storageKey = buildDocumentObjectKey(input);
    const checksum = sha256Hex(input.bytes);
    if (!timingSafeChecksum(checksum, input.checksum)) throw new Error("DOCUMENT_CHECKSUM_MISMATCH");
    const target = this.resolveKey(storageKey);
    const quarantineKey = `.quarantine/${safeSegment(input.companyId)}-${randomUUID()}.upload`;
    const quarantine = this.resolveKey(quarantineKey);
    await Promise.all([
      mkdir(dirname(target), { recursive: true }),
      mkdir(dirname(quarantine), { recursive: true })
    ]);
    try {
      await writeFile(quarantine, input.bytes, { flag: "wx", mode: 0o600 });
      await rename(quarantine, target);
    } catch (error) {
      await rm(quarantine, { force: true }).catch(() => undefined);
      throw error;
    }
    return { storageKey, sizeBytes: input.bytes.length, checksum };
  }

  async get({ companyId, storageKey }: { companyId: string; storageKey: string }) {
    return readFile(this.resolveCompanyKey(companyId, storageKey));
  }

  async delete({ companyId, storageKey }: { companyId: string; storageKey: string }) {
    await rm(this.resolveCompanyKey(companyId, storageKey), { force: true });
  }

  async presignPut(input: DocumentObjectInput & { sizeBytes: number; expiresInSeconds?: number }) {
    const storageKey = buildDocumentObjectKey(input);
    const expiresAt = new Date(Date.now() + expirySeconds(input.expiresInSeconds) * 1_000);
    return { storageKey, url: `local-document://${encodeURIComponent(storageKey)}`, expiresAt };
  }

  async presignGet() {
    return null;
  }

  async verify() {
    await mkdir(this.root, { recursive: true });
  }

  private resolveCompanyKey(companyId: string, storageKey: string) {
    assertCompanyObjectKey(companyId, storageKey);
    return this.resolveKey(storageKey.replace(/\\/g, "/"));
  }

  private resolveKey(storageKey: string) {
    if (!storageKey || isAbsolute(storageKey) || storageKey.includes("\0")) throw new Error("DOCUMENT_STORAGE_KEY_INVALID");
    const target = resolve(this.root, storageKey);
    const offset = relative(this.root, target);
    if (!offset || offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) throw new Error("DOCUMENT_STORAGE_KEY_INVALID");
    return target;
  }
}

export class R2DocumentStorage implements DocumentStorage {
  readonly kind = "r2" as const;
  private readonly client: S3Client;

  constructor(
    private readonly config: {
      endpoint: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
    },
  ) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async put(input: DocumentObjectInput & { bytes: Buffer }) {
    const storageKey = buildDocumentObjectKey(input);
    const checksum = sha256Hex(input.bytes);
    if (!timingSafeChecksum(checksum, input.checksum)) throw new Error("DOCUMENT_CHECKSUM_MISMATCH");
    await this.client.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: storageKey,
      Body: input.bytes,
      ContentLength: input.bytes.length,
      ContentType: input.mimeType,
      ChecksumSHA256: Buffer.from(checksum, "hex").toString("base64"),
      Metadata: { company: safeSegment(input.companyId), document: safeSegment(input.documentId), sha256: checksum },
    }));
    return { storageKey, sizeBytes: input.bytes.length, checksum };
  }

  async get({ companyId, storageKey }: { companyId: string; storageKey: string }) {
    assertCompanyObjectKey(companyId, storageKey);
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: storageKey }));
    if (!response.Body) throw new Error("DOCUMENT_STORAGE_BODY_MISSING");
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async delete({ companyId, storageKey }: { companyId: string; storageKey: string }) {
    assertCompanyObjectKey(companyId, storageKey);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: storageKey }));
  }

  async presignPut(input: DocumentObjectInput & { sizeBytes: number; expiresInSeconds?: number }) {
    const storageKey = buildDocumentObjectKey(input);
    const seconds = expirySeconds(input.expiresInSeconds);
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: storageKey,
      ContentLength: input.sizeBytes,
      ContentType: input.mimeType,
      ChecksumSHA256: Buffer.from(normalizeChecksum(input.checksum), "hex").toString("base64"),
      Metadata: { company: safeSegment(input.companyId), document: safeSegment(input.documentId), sha256: normalizeChecksum(input.checksum) },
    });
    return {
      storageKey,
      url: await getSignedUrl(this.client, command, { expiresIn: seconds }),
      expiresAt: new Date(Date.now() + seconds * 1_000),
    };
  }

  async presignGet(input: { companyId: string; storageKey: string; filename: string; mimeType: string; expiresInSeconds?: number }) {
    assertCompanyObjectKey(input.companyId, input.storageKey);
    const seconds = expirySeconds(input.expiresInSeconds);
    const filename = normalizeFilename(input.filename).replace(/["\\]/g, "-");
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: input.storageKey,
      ResponseContentType: input.mimeType,
      ResponseContentDisposition: `inline; filename="${filename}"`,
    });
    return {
      url: await getSignedUrl(this.client, command, { expiresIn: seconds }),
      expiresAt: new Date(Date.now() + seconds * 1_000),
    };
  }

  async verify() {
    await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
  }
}

let resolvedStorage: DocumentStorage | undefined;

export function getDocumentStorage(environment = process.env): DocumentStorage {
  if (environment === process.env && resolvedStorage) return resolvedStorage;
  const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_ENDPOINT", "R2_REGION"] as const;
  const missing = required.filter((name) => !environment[name]?.trim());
  let storage: DocumentStorage;
  if (!missing.length) {
    storage = new R2DocumentStorage({
      endpoint: environment.R2_ENDPOINT!.trim(),
      region: environment.R2_REGION!.trim(),
      bucket: environment.R2_BUCKET!.trim(),
      accessKeyId: environment.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: environment.R2_SECRET_ACCESS_KEY!.trim(),
    });
  } else {
    if (environment.NODE_ENV === "production") throw new Error(`DOCUMENT_STORAGE_NOT_CONFIGURED:${missing.join(",")}`);
    storage = new LocalDocumentStorage(environment.DOCUMENT_STORAGE_ROOT ? resolve(environment.DOCUMENT_STORAGE_ROOT) : documentStorageRoot());
  }
  if (environment === process.env) resolvedStorage = storage;
  return storage;
}

export const documentStorage: DocumentStorage = {
  get kind() { return getDocumentStorage().kind; },
  put: (input) => getDocumentStorage().put(input),
  get: (input) => getDocumentStorage().get(input),
  delete: (input) => getDocumentStorage().delete(input),
  presignPut: (input) => getDocumentStorage().presignPut(input),
  presignGet: (input) => getDocumentStorage().presignGet(input),
  verify: () => getDocumentStorage().verify(),
};

export function buildDocumentObjectKey(input: DocumentObjectInput) {
  const companyId = safeSegment(input.companyId);
  const category = safeSegment(input.category.toLowerCase());
  const documentId = safeSegment(input.documentId);
  const filename = normalizeFilename(input.filename);
  return `companies/${companyId}/${category}/${documentId}/${filename}`;
}

export function assertCompanyObjectKey(companyId: string, storageKey: string) {
  const normalized = storageKey.replace(/\\/g, "/");
  const prefix = `companies/${safeSegment(companyId)}/`;
  if (
    !normalized.startsWith(prefix)
    || normalized.includes("\0")
    || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("DOCUMENT_STORAGE_TENANT_FORBIDDEN");
  }
}

export function expirySeconds(value?: number) {
  const configured = Number(value ?? process.env.R2_PRESIGNED_URL_TTL_SECONDS ?? 600);
  if (!Number.isFinite(configured)) return 600;
  return Math.max(60, Math.min(900, Math.floor(configured)));
}

function safeSegment(value: string) {
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe || safe !== value) throw new Error("DOCUMENT_STORAGE_SEGMENT_INVALID");
  return safe;
}

function normalizeFilename(value: string) {
  const leaf = value.replace(/\\/g, "/").split("/").pop() || "documento";
  const normalized = leaf.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const safe = normalized.replace(/[^a-z0-9._-]+/g, "-").replace(/-{2,}/g, "-").replace(/^[.-]+|[.-]+$/g, "").slice(0, 160);
  if (!safe || !/\.[a-z0-9]{1,8}$/.test(safe)) throw new Error("DOCUMENT_FILENAME_INVALID");
  return safe;
}

function sha256Hex(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeChecksum(value: string) {
  const checksum = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error("DOCUMENT_CHECKSUM_INVALID");
  return checksum;
}

function timingSafeChecksum(left: string, right: string) {
  return normalizeChecksum(left) === normalizeChecksum(right);
}
