import { prisma } from "@/lib/prisma";
import { runAutomation } from "./automation-runner";
export async function dispatchBusinessEvent(event: {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  correlationId: string;
  payload?: Record<string, unknown>;
}) {
  const definitions = await prisma.automationDefinition.findMany({
    where: {
      active: true,
      currentVersion: {
        triggers: { some: { type: "entity_event", eventType: event.type } },
      },
    },
    include: { currentVersion: true },
  });
  return Promise.all(
    definitions.map((item) =>
      runAutomation({
        definitionId: item.id,
        idempotencyKey: `automation:${item.currentVersionId}:${event.type}:${event.entityId}:${event.id}`,
        triggerType: "entity_event",
        triggeredBy: "business_event",
        triggerEntityType: event.entityType,
        triggerEntityId: event.entityId,
        correlationId: event.correlationId,
        causationId: event.id,
        context: event.payload,
      }),
    ),
  );
}
