import type { PrismaClient } from "@prisma/client";
import type { ObservabilityProvider } from "@/lib/platform/providers/contracts";
import { executeIdempotent } from "@/lib/platform/idempotency";
import { completeOutboxEvent, type ClaimedOutboxEvent } from "@/lib/platform/outbox";
import { persistenceContext } from "@/lib/platform/persistence-context";
import { getRequestContext } from "@/lib/platform/request-context";
import { withOutboxEventContext } from "@/lib/platform/request-boundary";

export async function processCorrelationProbeEvent(prisma: PrismaClient, event: ClaimedOutboxEvent, provider: ObservabilityProvider) {
  return withOutboxEventContext(event, "worker.readiness.correlation_probe", async () => {
    const context = getRequestContext();
    if (!context || context.correlationId !== event.correlationId) throw new Error("WORKER_CORRELATION_CONTEXT_MISSING");
    const delivery = await executeIdempotent({
      prisma,
      companyId: event.companyId ?? undefined,
      namespace: "readiness-provider-effect",
      key: event.idempotencyKey ?? event.id,
      request: { eventId: event.id, correlationId: event.correlationId },
      operation: async (transaction) => {
        await provider.record({
          event: "readiness.correlation_probe_delivered",
          requestId: context.requestId,
          fields: { correlationId: context.correlationId, jobId: context.jobId ?? "" },
        });
        await transaction.auditLog.create({
          data: {
            companyId: event.companyId ?? undefined,
            userActorId: event.actorId ?? undefined,
            action: "readiness.correlation_probe_delivered",
            targetType: "BusinessEvent",
            targetId: event.id,
            ...persistenceContext(),
          },
        });
        return { status: "delivered", correlationId: context.correlationId };
      },
    });
    await completeOutboxEvent(prisma, event.id);
    return delivery;
  });
}
