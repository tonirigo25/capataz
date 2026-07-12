import { prisma } from "@/lib/prisma";
import { sanitizeAutomationData } from "@/lib/automations/automation-context";
export async function publishBusinessEvent(input: { type: string; entityType: string; entityId: string; relatedEntities?: unknown; actorId?: string; companyId?: string; correlationId: string; causationId?: string; payloadSanitized?: unknown; occurredAt?: Date }) {
  return prisma.businessEvent.create({ data: { ...input, relatedEntities: sanitizeAutomationData(input.relatedEntities) as never, payloadSanitized: sanitizeAutomationData(input.payloadSanitized) as never, occurredAt: input.occurredAt ?? new Date() } });
}
