import { prisma } from "@/lib/prisma";
import { sanitizeAutomationData } from "./automation-context";
export type ConfirmationActor = {
  actorType:
    | "user"
    | "system"
    | "automation"
    | "proactive"
    | "cron"
    | "unknown";
  actorId?: string;
  origin: "ui" | "chat" | "automation" | "proactive" | "cron";
};
export async function confirmAutomationStep(input: {
  runId: string;
  stepId: string;
  actionId: string;
  actor: ConfirmationActor;
  entityType?: string;
  entityId?: string;
  payload?: unknown;
  correlationId: string;
  idempotencyKey: string;
}) {
  const step = await prisma.automationStepRun.findUniqueOrThrow({
    where: { id: input.stepId },
  });
  if (
    step.automationRunId !== input.runId ||
    step.automationActionId !== input.actionId ||
    step.status !== "waiting_confirmation"
  )
    throw new Error("INVALID_CONFIRMATION_TARGET");
  return prisma.$transaction(async (tx) => {
    const confirmation = await tx.automationConfirmation.create({
      data: {
        automationRunId: input.runId,
        actionId: input.actionId,
        actorType: input.actor.actorType,
        actorId: input.actor.actorId,
        origin: input.actor.origin,
        entityType: input.entityType,
        entityId: input.entityId,
        payloadSanitized: sanitizeAutomationData(input.payload) as never,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await tx.automationStepRun.update({
      where: { id: input.stepId },
      data: {
        status: "pending",
        approvedBy: input.actor.actorId ?? input.actor.actorType,
        approvedAt: confirmation.confirmedAt,
      },
    });
    return confirmation;
  });
}
