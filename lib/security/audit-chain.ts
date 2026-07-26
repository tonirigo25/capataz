import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

export type SensitiveAuditInput = {
  companyId?: string | null;
  platformActorId?: string | null;
  userActorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
  reason?: string | null;
  requestId?: string | null;
  correlationId?: string | null;
  membershipId?: string | null;
  actorType?: string | null;
  environment?: string | null;
  release?: string | null;
};

type AuditClient = Prisma.TransactionClient | PrismaClient;

export async function appendSensitiveAuditLog(db: AuditClient, input: SensitiveAuditInput) {
  const chainScope = input.companyId ? `company:${input.companyId}` : "platform";
  if ("$executeRaw" in db) await db.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${chainScope}))`);
  const previous = await db.auditLog.findFirst({ where: { chainScope, entryHash: { not: null } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { entryHash: true, createdAt: true } });
  const id = randomUUID();
  const clock = new Date();
  const createdAt = previous && previous.createdAt >= clock ? new Date(previous.createdAt.getTime() + 1) : clock;
  const previousHash = previous?.entryHash ?? "GENESIS";
  const chainVersion = 1;
  const payload = canonicalAuditPayload({ ...input, id, chainScope, chainVersion, previousHash, createdAt });
  const entryHash = sha256(payload);
  return db.auditLog.create({ data: {
    id,
    companyId: input.companyId ?? null,
    platformActorId: input.platformActorId ?? null,
    userActorId: input.userActorId ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    metadata: input.metadata,
    reason: input.reason ?? null,
    requestId: input.requestId ?? null,
    correlationId: input.correlationId ?? null,
    membershipId: input.membershipId ?? null,
    actorType: input.actorType ?? null,
    environment: input.environment ?? null,
    release: input.release ?? null,
    chainScope,
    previousHash,
    entryHash,
    chainVersion,
    createdAt,
  } });
}

export async function verifySensitiveAuditChain(db: AuditClient, chainScope: string) {
  const entries = await db.auditLog.findMany({ where: { chainScope }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  let previousHash = "GENESIS";
  for (const entry of entries) {
    if (!entry.entryHash || entry.previousHash !== previousHash || entry.chainVersion !== 1) return { valid: false, entryId: entry.id, reason: "CHAIN_LINK_INVALID", checked: entries.indexOf(entry) };
    const payload = canonicalAuditPayload({
      id: entry.id,
      companyId: entry.companyId,
      platformActorId: entry.platformActorId,
      userActorId: entry.userActorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata as Prisma.InputJsonValue | undefined,
      reason: entry.reason,
      requestId: entry.requestId,
      correlationId: entry.correlationId,
      membershipId: entry.membershipId,
      actorType: entry.actorType,
      environment: entry.environment,
      release: entry.release,
      chainScope,
      chainVersion: entry.chainVersion,
      previousHash,
      createdAt: entry.createdAt,
    });
    if (sha256(payload) !== entry.entryHash) return { valid: false, entryId: entry.id, reason: "ENTRY_HASH_INVALID", checked: entries.indexOf(entry) };
    previousHash = entry.entryHash;
  }
  return { valid: true, checked: entries.length, head: previousHash };
}

function canonicalAuditPayload(input: SensitiveAuditInput & { id: string; chainScope: string; chainVersion: number; previousHash: string; createdAt: Date }) {
  return stableJson({
    id: input.id,
    companyId: input.companyId ?? null,
    platformActorId: input.platformActorId ?? null,
    userActorId: input.userActorId ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    metadata: input.metadata ?? null,
    reason: input.reason ?? null,
    requestId: input.requestId ?? null,
    correlationId: input.correlationId ?? null,
    membershipId: input.membershipId ?? null,
    actorType: input.actorType ?? null,
    environment: input.environment ?? null,
    release: input.release ?? null,
    chainScope: input.chainScope,
    chainVersion: input.chainVersion,
    previousHash: input.previousHash,
    createdAt: input.createdAt.toISOString(),
  });
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

export function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}
