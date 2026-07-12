"use server";
import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_RETRY_POLICY,
  publishAutomationVersion,
} from "@/lib/automations/automation-registry";
import { runAutomation } from "@/lib/automations/automation-runner";
import { retryAutomationRun } from "@/lib/automations/automation-retries";
import { confirmAutomationStep } from "@/lib/automations/automation-confirmations";
import { executeAutomationAction } from "@/lib/automations/automation-actions";
const refresh = () => revalidatePath("/automatizaciones");
export async function createAutomationAction(data: FormData) {
  const name = String(data.get("name") ?? "").trim();
  if (!name) return;
  await prisma.automationDefinition.create({
    data: {
      name,
      description: String(data.get("description") ?? "") || undefined,
      versions: {
        create: {
          version: 1,
          status: "draft",
          triggerMode: "manual",
          retryPolicy: DEFAULT_RETRY_POLICY,
          definitionHash: createHash("sha256")
            .update(randomUUID())
            .digest("hex"),
          triggers: {
            create: { type: "manual", configuration: { source: "user" } },
          },
          actions: {
            create: {
              actionType: "generate_internal_summary",
              order: 1,
              configuration: { title: name },
            },
          },
        },
      },
    },
  });
  refresh();
}
export async function publishAutomationAction(data: FormData) {
  await publishAutomationVersion(String(data.get("versionId")));
  refresh();
}
export async function runAutomationAction(data: FormData) {
  const id = String(data.get("id"));
  await runAutomation({
    definitionId: id,
    idempotencyKey: `automation:${id}:manual:${randomUUID()}`,
    triggerType: "manual",
    triggeredBy: "user",
    dryRun: data.get("dryRun") === "true",
  });
  refresh();
}
export async function toggleAutomationAction(data: FormData) {
  const id = String(data.get("id")),
    active = data.get("active") === "true";
  await prisma.automationDefinition.update({
    where: { id },
    data: { active, status: active ? "active" : "paused" },
  });
  refresh();
}
export async function duplicateAutomationAction(data: FormData) {
  const source = await prisma.automationDefinition.findUniqueOrThrow({
    where: { id: String(data.get("id")) },
    include: {
      currentVersion: {
        include: { triggers: true, conditions: true, actions: true },
      },
    },
  });
  const copy = await prisma.automationDefinition.create({
    data: {
      name: `${source.name} (copia)`,
      description: source.description,
      category: source.category,
    },
  });
  if (source.currentVersion)
    await cloneVersion(source.currentVersion, copy.id, 1);
  refresh();
}
export async function newAutomationVersionAction(data: FormData) {
  const definition = await prisma.automationDefinition.findUniqueOrThrow({
    where: { id: String(data.get("id")) },
    include: {
      currentVersion: {
        include: { triggers: true, conditions: true, actions: true },
      },
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!definition.currentVersion)
    throw new Error("AUTOMATION_VERSION_NOT_FOUND");
  await cloneVersion(
    definition.currentVersion,
    definition.id,
    (definition.versions[0]?.version ?? 0) + 1,
  );
  refresh();
}
export async function archiveAutomationAction(data: FormData) {
  await prisma.automationDefinition.update({
    where: { id: String(data.get("id")) },
    data: { active: false, status: "archived", archivedAt: new Date() },
  });
  refresh();
}
export async function disableAutomationAction(data: FormData) {
  const id = String(data.get("id"));
  await prisma.automationDefinition.update({
    where: { id },
    data: { active: false, status: "disabled" },
  });
  refresh();
  revalidatePath(`/automatizaciones/${id}`);
}
export async function saveDraftVersionAction(data: FormData) {
  const versionId = String(data.get("versionId")),
    version = await prisma.automationVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
  if (version.status !== "draft")
    throw new Error("PUBLISHED_VERSION_IMMUTABLE");
  const definitionId = version.automationDefinitionId;
  await prisma.$transaction(async (tx) => {
    await tx.automationTrigger.deleteMany({
      where: { automationVersionId: versionId },
    });
    await tx.automationCondition.deleteMany({
      where: { automationVersionId: versionId },
    });
    await tx.automationAction.deleteMany({
      where: { automationVersionId: versionId },
    });
    await tx.automationTrigger.create({
      data: {
        automationVersionId: versionId,
        type: String(data.get("triggerType") ?? "manual"),
        eventType: String(data.get("eventType") ?? "") || null,
        entityType: String(data.get("entityType") ?? "") || null,
        configuration: { source: "ui" },
      },
    });
    const field = String(data.get("field") ?? "").trim();
    if (field)
      await tx.automationCondition.create({
        data: {
          automationVersionId: versionId,
          group: 0,
          operator: String(data.get("operator") ?? "and"),
          field,
          comparator: String(data.get("comparator") ?? "equals"),
          value: String(data.get("value") ?? "") as never,
          valueType: String(data.get("valueType") ?? "string"),
          order: 1,
        },
      });
    await tx.automationAction.create({
      data: {
        automationVersionId: versionId,
        actionType: String(
          data.get("actionType") ?? "generate_internal_summary",
        ),
        order: 1,
        configuration: {
          title: String(data.get("actionTitle") ?? "Acción interna"),
        },
        requiresConfirmation: data.get("requiresConfirmation") === "true",
      },
    });
    await tx.automationVersion.update({
      where: { id: versionId },
      data: {
        timeoutSeconds: Number(data.get("timeoutSeconds") ?? 60),
        cooldownSeconds: data.get("cooldownSeconds")
          ? Number(data.get("cooldownSeconds"))
          : null,
        retryPolicy: {
          maxAttempts: Number(data.get("maxAttempts") ?? 3),
          backoffType: String(data.get("backoffType") ?? "exponential"),
          initialDelaySeconds: Number(data.get("initialDelaySeconds") ?? 2),
          maxDelaySeconds: Number(data.get("maxDelaySeconds") ?? 60),
          retryableErrors: ["TRANSIENT", "TIMEOUT"],
          nonRetryableErrors: [
            "INVALID",
            "NOT_FOUND",
            "CANCELLED",
            "DUPLICATE",
            "CONFIRMATION_REQUIRED",
          ],
        },
      },
    });
  });
  refresh();
  revalidatePath(`/automatizaciones/${definitionId}`);
}
export async function saveAutomationScheduleAction(data: FormData) {
  const id = String(data.get("id"));
  await prisma.automationSchedule.upsert({
    where: { automationDefinitionId: id },
    update: {
      active: data.get("active") === "true",
      timezone: String(data.get("timezone") ?? "Europe/Madrid"),
      rrule: String(data.get("rrule") ?? "") || null,
      cronExpression: String(data.get("cronExpression") ?? "") || null,
      nextRunAt: data.get("nextRunAt")
        ? new Date(String(data.get("nextRunAt")))
        : null,
    },
    create: {
      automationDefinitionId: id,
      active: data.get("active") === "true",
      timezone: String(data.get("timezone") ?? "Europe/Madrid"),
      rrule: String(data.get("rrule") ?? "") || null,
      cronExpression: String(data.get("cronExpression") ?? "") || null,
      nextRunAt: data.get("nextRunAt")
        ? new Date(String(data.get("nextRunAt")))
        : null,
    },
  });
  revalidatePath(`/automatizaciones/${id}`);
  refresh();
}
export async function retryRunNowAction(data: FormData) {
  const runId = String(data.get("runId"));
  await prisma.automationRun.update({
    where: { id: runId },
    data: { status: "queued", nextRetryAt: new Date(), lockUntil: null },
  });
  await retryAutomationRun(runId);
  revalidatePath(`/automatizaciones/${String(data.get("definitionId"))}`);
}
export async function cancelRunAction(data: FormData) {
  const runId = String(data.get("runId"));
  await prisma.automationRun.updateMany({
    where: { id: runId, status: { in: ["queued", "waiting_confirmation"] } },
    data: {
      status: "cancelled",
      nextRetryAt: null,
      lockUntil: null,
      completedAt: new Date(),
    },
  });
  revalidatePath(`/automatizaciones/${String(data.get("definitionId"))}`);
}
export async function confirmStepAction(data: FormData) {
  const stepId = String(data.get("stepId")),
    step = await prisma.automationStepRun.findUniqueOrThrow({
      where: { id: stepId },
      include: { run: true, action: true },
    });
  await confirmAutomationStep({
    runId: step.automationRunId,
    stepId: step.id,
    actionId: step.automationActionId,
    actor: { actorType: "user", origin: "ui" },
    entityType: step.run.triggerEntityType ?? undefined,
    entityId: step.run.triggerEntityId ?? undefined,
    payload: { actionType: step.action.actionType },
    correlationId: step.run.correlationId,
    idempotencyKey: `ui-confirm:${step.id}`,
  });
  try {
    const output = step.run.dryRun
      ? { dryRun: true }
      : await executeAutomationAction(step.action, step.run);
    await prisma.automationStepRun.update({
      where: { id: step.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        outputSummary: output as never,
      },
    });
    const pending = await prisma.automationStepRun.count({
      where: {
        automationRunId: step.run.id,
        status: { in: ["pending", "running", "waiting_confirmation"] },
      },
    });
    if (!pending)
      await prisma.automationRun.update({
        where: { id: step.run.id },
        data: { status: "completed", completedAt: new Date() },
      });
  } catch {
    await prisma.automationStepRun.update({
      where: { id: step.id },
      data: {
        status: "failed",
        errorCode: "CONFIRMED_ACTION_FAILED",
        errorSummary: "La acción confirmada no pudo completarse.",
      },
    });
  }
  revalidatePath(`/automatizaciones/${String(data.get("definitionId"))}`);
}
async function cloneVersion(
  source: Awaited<ReturnType<typeof loadVersion>>,
  definitionId: string,
  version: number,
) {
  if (!source) throw new Error("AUTOMATION_VERSION_NOT_FOUND");
  const created = await prisma.automationVersion.create({
    data: {
      automationDefinitionId: definitionId,
      version,
      status: "draft",
      triggerMode: source.triggerMode,
      cooldownSeconds: source.cooldownSeconds,
      timeoutSeconds: source.timeoutSeconds,
      retryPolicy: source.retryPolicy as never,
      requiresConfirmation: source.requiresConfirmation,
      confirmationMode: source.confirmationMode,
      deduplicationStrategy: source.deduplicationStrategy,
      definitionHash: createHash("sha256").update(randomUUID()).digest("hex"),
    },
  });
  for (const item of source.triggers)
    await prisma.automationTrigger.create({
      data: {
        automationVersionId: created.id,
        type: item.type,
        eventType: item.eventType,
        scheduleId: item.scheduleId,
        entityType: item.entityType,
        configuration: item.configuration as never,
      },
    });
  for (const item of source.conditions)
    await prisma.automationCondition.create({
      data: {
        automationVersionId: created.id,
        group: item.group,
        operator: item.operator,
        field: item.field,
        comparator: item.comparator,
        value: item.value as never,
        valueType: item.valueType,
        order: item.order,
      },
    });
  for (const item of source.actions)
    await prisma.automationAction.create({
      data: {
        automationVersionId: created.id,
        actionType: item.actionType,
        order: item.order,
        configuration: item.configuration as never,
        requiresConfirmation: item.requiresConfirmation,
        confirmationMode: item.confirmationMode,
        onFailure: item.onFailure,
      },
    });
  return created;
}
const loadVersion = (id: string) =>
  prisma.automationVersion.findUnique({
    where: { id },
    include: { triggers: true, conditions: true, actions: true },
  });
