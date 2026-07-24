import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { evaluateConditions } from "./automation-conditions";
import { sanitizeAutomationData } from "./automation-context";
import { executeAutomationAction } from "./automation-actions";
import { scheduleRunRetry } from "./automation-retries";

export const MAX_AUTOMATION_CHAIN_DEPTH = 10;

export async function runAutomation(input: {
  definitionId: string;
  idempotencyKey: string;
  triggerType: string;
  triggeredBy: string;
  context?: Record<string, unknown>;
  dryRun?: boolean;
  correlationId?: string;
  causationId?: string;
  triggerEntityType?: string;
  triggerEntityId?: string;
  chainDepth?: number;
  sourceAutomationId?: string;
}) {
  if ((input.chainDepth ?? 0) > MAX_AUTOMATION_CHAIN_DEPTH)
    throw new Error("AUTOMATION_CHAIN_DEPTH_EXCEEDED");
  const existing = await prisma.automationRun.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return existing;
  const definition = await prisma.automationDefinition.findUnique({
    where: { id: input.definitionId },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          conditions: { orderBy: { order: "asc" } },
          actions: { orderBy: { order: "asc" } },
        },
      },
      currentVersion: {
        include: {
          conditions: { orderBy: { order: "asc" } },
          actions: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  const version = input.dryRun
    ? definition?.versions[0]
    : definition?.currentVersion;
  if (
    !definition ||
    !version ||
    (!input.dryRun &&
      (!definition.active ||
        definition.status !== "active" ||
        version.status !== "published"))
  )
    throw new Error("AUTOMATION_NOT_ACTIVE");
  const context = input.context ?? {};
  if (
    !evaluateConditions(
      version.conditions.map((item) => ({ ...item, value: item.value })),
      context,
    )
  )
    return prisma.automationRun.create({
      data: {
        companyId: definition.companyId,
        automationDefinitionId: definition.id,
        automationVersionId: version.id,
        status: "skipped",
        triggerType: input.triggerType,
        triggeredBy: input.triggeredBy,
        correlationId: input.correlationId ?? randomUUID(),
        causationId: input.causationId,
        idempotencyKey: input.idempotencyKey,
        triggerEntityType: input.triggerEntityType,
        triggerEntityId: input.triggerEntityId,
        inputSnapshot: sanitizeAutomationData(context) as never,
        dryRun: Boolean(input.dryRun),
        completedAt: new Date(),
      },
    });
  const run = await prisma.automationRun.create({
    data: {
      companyId: definition.companyId,
      automationDefinitionId: definition.id,
      automationVersionId: version.id,
      status: "running",
      triggerType: input.triggerType,
      triggeredBy: input.triggeredBy,
      correlationId: input.correlationId ?? randomUUID(),
      causationId: input.causationId,
      idempotencyKey: input.idempotencyKey,
      triggerEntityType: input.triggerEntityType,
      triggerEntityId: input.triggerEntityId,
      inputSnapshot: sanitizeAutomationData(context) as never,
      dryRun: Boolean(input.dryRun),
      lockUntil: new Date(Date.now() + version.timeoutSeconds * 1000),
      chainDepth: input.chainDepth ?? 0,
      sourceAutomationId: input.sourceAutomationId,
    },
  });
  let failed = 0;
  for (const action of version.actions) {
    const key = `${run.id}:${action.id}:${input.triggerEntityId ?? "none"}`;
    const step = await prisma.automationStepRun.create({
      data: {
        automationRunId: run.id,
        automationActionId: action.id,
        order: action.order,
        idempotencyKey: key,
        status:
          !input.dryRun &&
          (action.requiresConfirmation || version.requiresConfirmation)
            ? "waiting_confirmation"
            : "running",
      },
    });
    if (step.status === "waiting_confirmation") continue;
    try {
      const result = input.dryRun
        ? { dryRun: true, actionType: action.actionType }
        : await executeAutomationAction(action, run);
      await prisma.automationStepRun.update({
        where: { id: step.id },
        data: {
          status: "completed",
          completedAt: new Date(),
          outputSummary: sanitizeAutomationData(result) as never,
        },
      });
    } catch (error) {
      failed++;
      const code = error instanceof Error ? error.message : "UNKNOWN";
      await prisma.automationStepRun.update({
        where: { id: step.id },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorCode: code,
          errorSummary: "La acción no pudo completarse.",
        },
      });
      if (action.onFailure === "stop") break;
    }
  }
  const waiting =
    !input.dryRun &&
    version.actions.some(
      (action) => action.requiresConfirmation || version.requiresConfirmation,
    );
  if (failed && !waiting)
    return scheduleRunRetry(
      run.id,
      "TRANSIENT",
      "Una acción reintentable falló.",
    );
  return prisma.automationRun.update({
    where: { id: run.id },
    data: {
      status: waiting ? "waiting_confirmation" : "completed",
      completedAt: waiting ? undefined : new Date(),
      lockUntil: null,
      outputSummary: { actions: version.actions.length, failed },
    },
  });
}
