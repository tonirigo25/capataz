import type { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { getRequestContext } from "@/lib/platform/request-context";

type Transaction = Prisma.TransactionClient;

export type OutboxEventInput = {
  companyId?: string;
  actorId?: string;
  type: string;
  entityType: string;
  entityId: string;
  destination: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string;
  payload?: Prisma.InputJsonValue;
  relatedEntities?: Prisma.InputJsonValue;
  schemaVersion?: number;
};

export async function enqueueBusinessEvent(transaction: Transaction, input: OutboxEventInput) {
  const context = getRequestContext();
  return transaction.businessEvent.create({
    data: {
      companyId: input.companyId ?? context?.companyId,
      actorId: input.actorId ?? context?.actor.id,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      destination: input.destination,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId ?? context?.correlationId ?? randomUUID(),
      causationId: input.causationId ?? context?.causationId,
      requestId: context?.requestId,
      jobId: context?.jobId,
      operation: context?.operation,
      release: context?.release,
      environment: context?.environment,
      payloadSanitized: input.payload,
      relatedEntities: input.relatedEntities,
      occurredAt: new Date(),
      schemaVersion: input.schemaVersion ?? 1,
      deliveryStatus: "PENDING",
    },
  });
}

export type ClaimedOutboxEvent = {
  id: string;
  companyId: string | null;
  actorId: string | null;
  requestId: string | null;
  jobId: string | null;
  operation: string | null;
  release: string | null;
  environment: string | null;
  type: string;
  entityType: string;
  entityId: string;
  destination: string | null;
  idempotencyKey: string | null;
  correlationId: string;
  causationId: string | null;
  schemaVersion: number;
  payloadSanitized: Prisma.JsonValue | null;
  attempts: number;
};

export async function claimOutboxBatch(prisma: PrismaClient, destination: string, batchSize = 25): Promise<ClaimedOutboxEvent[]> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error("INVALID_OUTBOX_BATCH_SIZE");
  return prisma.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<ClaimedOutboxEvent[]>`
      SELECT "id", "companyId", "actorId", "requestId", "jobId", "operation", "release", "environment", "type", "entityType", "entityId", "destination",
             "idempotencyKey", "correlationId", "causationId", "schemaVersion",
             "payloadSanitized", "attempts"
      FROM "BusinessEvent"
      WHERE "deliveryStatus" IN ('PENDING', 'RETRYING')
        AND "destination" = ${destination}
        AND "availableAt" <= NOW()
      ORDER BY "recordedAt", "id"
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}`;
    if (rows.length) {
      await transaction.businessEvent.updateMany({
        where: { id: { in: rows.map(({ id }) => id) }, deliveryStatus: { in: ["PENDING", "RETRYING"] } },
        data: { deliveryStatus: "PROCESSING", attempts: { increment: 1 } },
      });
    }
    return rows.map((row) => ({ ...row, attempts: row.attempts + 1 }));
  });
}

export async function completeOutboxEvent(prisma: PrismaClient, id: string) {
  return prisma.businessEvent.updateMany({
    where: { id, deliveryStatus: "PROCESSING" },
    data: { deliveryStatus: "PROCESSED", processedAt: new Date(), lastError: null },
  });
}

export async function failOutboxEvent(prisma: PrismaClient, id: string, errorCode: string, retryAt?: Date) {
  return prisma.businessEvent.updateMany({
    where: { id, deliveryStatus: "PROCESSING" },
    data: {
      deliveryStatus: retryAt ? "RETRYING" : "FAILED",
      availableAt: retryAt ?? new Date(),
      lastError: errorCode.replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 120),
    },
  });
}
