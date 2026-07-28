import type { PrismaClient } from "@prisma/client";
import { enqueueBusinessEvent } from "@/lib/platform/outbox";
import { persistenceContext } from "@/lib/platform/persistence-context";

export type CorrelationProbeContext = {
  companyId: string;
  userId: string;
  membershipId: string;
};

export async function createCorrelationProbe(
  prisma: PrismaClient,
  context: CorrelationProbeContext,
  input: { targetCompanyId: string; idempotencyKey: string },
) {
  if (input.targetCompanyId !== context.companyId) throw new Error("CORRELATION_PROBE_CROSS_TENANT_FORBIDDEN");
  const persistedContext = persistenceContext();
  return prisma.$transaction(async (transaction) => {
    const audit = await transaction.auditLog.create({
      data: {
        companyId: context.companyId,
        userActorId: context.userId,
        action: "readiness.correlation_probe_created",
        targetType: "ReadinessProbe",
        targetId: input.idempotencyKey,
        ...persistedContext,
      },
    });
    const event = await enqueueBusinessEvent(transaction, {
      companyId: context.companyId,
      actorId: context.userId,
      type: "readiness.correlation_probe",
      entityType: "ReadinessProbe",
      entityId: input.idempotencyKey,
      destination: "fake-observability",
      idempotencyKey: input.idempotencyKey,
      payload: { membershipId: context.membershipId },
    });
    return { auditId: audit.id, eventId: event.id };
  });
}
