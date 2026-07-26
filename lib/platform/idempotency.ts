import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

type Transaction = Prisma.TransactionClient;

export type IdempotentInput<T> = {
  prisma: PrismaClient;
  companyId?: string;
  namespace: string;
  key: string;
  request: unknown;
  expiresAt?: Date;
  operation: (transaction: Transaction) => Promise<T>;
};

export async function executeIdempotent<T>(input: IdempotentInput<T>): Promise<{ value: T; replayed: boolean }> {
  const namespace = normalizePart(input.namespace, "namespace");
  const key = normalizePart(input.key, "key");
  const scope = input.companyId ?? "global";
  const id = createHash("sha256").update(`${scope}:${namespace}:${key}`).digest("hex");
  const requestHash = hashCanonical(input.request);
  return input.prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
    const existing = await transaction.idempotencyRecord.findUnique({ where: { id } });
    if (existing) {
      if (existing.requestHash !== requestHash) throw new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST");
      if (existing.completedAt && existing.responseBody !== null) {
        return { value: existing.responseBody as T, replayed: true };
      }
      throw new Error("IDEMPOTENCY_OPERATION_IN_PROGRESS");
    }
    await transaction.idempotencyRecord.create({
      data: {
        id,
        companyId: input.companyId,
        namespace,
        idempotencyKey: key,
        requestHash,
        schemaVersion: 1,
        lockedUntil: new Date(Date.now() + 60_000),
        expiresAt: input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60_000),
      },
    });
    const value = await input.operation(transaction);
    const responseBody = toJson(value);
    await transaction.idempotencyRecord.update({
      where: { id },
      data: { responseStatus: 200, responseBody, completedAt: new Date(), lockedUntil: null },
    });
    return { value, replayed: false };
  }, { isolationLevel: "Serializable" });
}

export function hashCanonical(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

function normalizePart(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) throw new Error(`INVALID_IDEMPOTENCY_${field.toUpperCase()}`);
  return normalized;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
