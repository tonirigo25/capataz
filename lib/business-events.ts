import { prisma } from "@/lib/prisma";
import { sanitizeAutomationData } from "@/lib/automations/automation-context";
import { getRequestContext } from "@/lib/platform/request-context";
export async function publishBusinessEvent(input: { type: string; entityType: string; entityId: string; relatedEntities?: unknown; actorId?: string; companyId?: string; correlationId: string; causationId?: string; payloadSanitized?: unknown; occurredAt?: Date }) {
  const context = getRequestContext();
  return prisma.businessEvent.create({ data: {
    ...input,
    companyId: input.companyId ?? context?.companyId,
    actorId: input.actorId ?? context?.actor.id,
    causationId: input.causationId ?? context?.causationId,
    requestId: context?.requestId,
    jobId: context?.jobId,
    operation: context?.operation,
    release: context?.release,
    environment: context?.environment,
    relatedEntities: sanitizeAutomationData(input.relatedEntities) as never,
    payloadSanitized: sanitizeAutomationData(input.payloadSanitized) as never,
    occurredAt: input.occurredAt ?? new Date(),
  } });
}
