import { randomUUID } from "node:crypto";
import * as prismaModule from "../lib/prisma.ts";
import * as registry from "../lib/automations/automation-registry.ts";
const moduleValue = (m) => m.default ?? m;
const { publishAutomationVersion, DEFAULT_RETRY_POLICY } =
  moduleValue(registry);
import * as runnerModule from "../lib/automations/automation-runner.ts";
import * as taskModule from "../lib/tasks/task-engine.ts";
import * as followUpModule from "../lib/followups/followup-engine.ts";
import * as recurrenceModule from "../lib/tasks/task-recurrence.ts";
import * as retryModule from "../lib/automations/automation-retries.ts";
import * as eventModule from "../lib/business-events.ts";
import * as chatModule from "../app/(app)/capataz/actions.ts";
const { prisma } = moduleValue(prismaModule),
  { runAutomation } = moduleValue(runnerModule),
  {
    addChecklistItem,
    addTaskDependency,
    changeTaskStatus,
    createSubtask,
    toggleChecklistItem,
  } = moduleValue(taskModule),
  { createFollowUp, addFollowUpAttempt, recordFollowUpOutcome } =
    moduleValue(followUpModule),
  { parseRRule, nextOccurrence, editTaskSeries } =
    moduleValue(recurrenceModule),
  { scheduleRunRetry, retryAutomationRun } = moduleValue(retryModule),
  { publishBusinessEvent } = moduleValue(eventModule),
  { runChatCommand } = moduleValue(chatModule);

const suffix = randomUUID().slice(0, 8),
  now = new Date();
try {
  const client = await prisma.client.create({
    data: {
      nombre: `QA ${suffix}`,
      telefono: "000000000",
      direccion: "QA",
      tipo: "particular",
      origen: "test",
    },
  });
  const work = await prisma.work.create({
    data: {
      clienteId: client.id,
      titulo: `Obra QA ${suffix}`,
      direccion: "QA",
      tipoTrabajo: "test",
      presupuestoAprobado: 1000,
    },
  });
  const budget = await prisma.budget.create({
    data: {
      clienteId: client.id,
      obraId: work.id,
      numero: `Q-${suffix}`,
      titulo: "Presupuesto QA",
      partidas: "[]",
      subtotal: 1000,
      iva: 210,
      total: 1210,
      margenEstimado: 100,
    },
  });
  const invoice = await prisma.invoice.create({
    data: {
      clienteId: client.id,
      obraId: work.id,
      numero: `F-${suffix}`,
      concepto: "Factura QA",
      importeBase: 1000,
      iva: 210,
      total: 1210,
      pendiente: 1210,
      fechaEmision: now,
      fechaVencimiento: new Date(now.getTime() + 86400000),
    },
  });
  const definition = await prisma.automationDefinition.create({
    data: {
      name: `QA automation ${suffix}`,
      versions: {
        create: {
          version: 1,
          retryPolicy: DEFAULT_RETRY_POLICY,
          definitionHash: suffix,
          triggers: {
            create: { type: "manual", configuration: { source: "qa" } },
          },
          conditions: {
            create: {
              group: 0,
              operator: "and",
              field: "ready",
              comparator: "equals",
              value: true,
              valueType: "boolean",
              order: 1,
            },
          },
          actions: {
            create: {
              actionType: "create_task",
              order: 1,
              configuration: { title: `Task QA ${suffix}` },
            },
          },
        },
      },
    },
  });
  const version = await prisma.automationVersion.findFirstOrThrow({
    where: { automationDefinitionId: definition.id },
  });
  const dry = await runAutomation({
    definitionId: definition.id,
    idempotencyKey: `qa:dry:${suffix}`,
    triggerType: "manual",
    triggeredBy: "qa",
    context: { ready: true },
    dryRun: true,
  });
  if (!dry.dryRun || dry.status !== "completed")
    throw new Error("DRAFT_DRY_RUN_FAILED");
  await publishAutomationVersion(version.id);
  const run = await runAutomation({
    definitionId: definition.id,
    idempotencyKey: `qa:run:${suffix}`,
    triggerType: "manual",
    triggeredBy: "qa",
    context: { ready: true },
    triggerEntityType: "work",
    triggerEntityId: work.id,
  });
  const task = await prisma.task.findFirstOrThrow({
    where: { automationRunId: run.id },
  });
  const check = await addChecklistItem(task.id, "Punto QA");
  await toggleChecklistItem(check.id, true, "qa");
  const sub = await createSubtask(task.id, { title: "Subtarea QA" });
  const other = await prisma.task.create({ data: { title: "Dependencia QA" } });
  await addTaskDependency(task.id, other.id);
  let cycleBlocked = false;
  try {
    await addTaskDependency(other.id, task.id);
  } catch {
    cycleBlocked = true;
  }
  if (!cycleBlocked) throw new Error("INDIRECT_CYCLE_NOT_BLOCKED");
  await changeTaskStatus(task.id, "completed", "qa", "flujo aislado");
  const follow = await createFollowUp({
    title: `FollowUp QA ${suffix}`,
    clientId: client.id,
    workId: work.id,
    budgetId: budget.id,
    invoiceId: invoice.id,
    nextActionAt: now,
  });
  await addFollowUpAttempt(follow.id, {
    channel: "internal",
    summary: "No respondió",
    response: "no_response",
    nextActionAt: new Date(now.getTime() + 86400000),
  });
  await recordFollowUpOutcome(follow.id, "resolved", "Resuelto en QA");
  const rrule = "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=4";
  parseRRule(rrule);
  const recurrence = await prisma.taskRecurrence.create({
    data: {
      frequency: "biweekly",
      rrule,
      startsAt: now,
      nextOccurrenceAt: nextOccurrence(now, rrule, now),
    },
  });
  await prisma.task.update({
    where: { id: sub.id },
    data: { recurrenceId: recurrence.id, occurrenceKey: now.toISOString() },
  });
  await editTaskSeries(sub.id, "this", { title: "Subtarea QA editada" });
  const retryRun = await prisma.automationRun.create({
    data: {
      automationDefinitionId: definition.id,
      automationVersionId: version.id,
      status: "running",
      triggerType: "manual",
      triggeredBy: "qa",
      correlationId: suffix,
      idempotencyKey: `qa:retry:${suffix}`,
    },
  });
  await scheduleRunRetry(retryRun.id, "TRANSIENT", "fixture retry");
  await prisma.automationRun.update({
    where: { id: retryRun.id },
    data: { nextRetryAt: new Date() },
  });
  await retryAutomationRun(retryRun.id);
  await publishBusinessEvent({
    type: "qa.completed",
    entityType: "automation",
    entityId: definition.id,
    correlationId: suffix,
    payloadSanitized: { secret: "redacted", ok: true },
  });
  const chatQuery = await runChatCommand("qué tareas tengo hoy", null, {
    idempotencyKey: `qa-chat-query-${suffix}`,
  });
  const beforeChatCreate = await prisma.task.count();
  const chatCreate = await runChatCommand(
    "crea una tarea para revisar QA mañana",
    chatQuery.context,
    { idempotencyKey: `qa-chat-create-${suffix}` },
  );
  const afterChatCreate = await prisma.task.count();
  if (
    beforeChatCreate !== afterChatCreate - 1 ||
    !chatQuery.diagnostics?.noMutation ||
    chatCreate.result?.entityType !== "task"
  )
    throw new Error("CHAT_END_TO_END_INVALID");
  const counts = {
    clients: await prisma.client.count({ where: { id: client.id } }),
    works: await prisma.work.count({ where: { id: work.id } }),
    budgets: await prisma.budget.count({ where: { id: budget.id } }),
    invoices: await prisma.invoice.count({ where: { id: invoice.id } }),
    runs: await prisma.automationRun.count({
      where: { automationDefinitionId: definition.id },
    }),
    tasks: await prisma.task.count({
      where: { OR: [{ id: task.id }, { id: sub.id }, { id: other.id }] },
    }),
    checklists: await prisma.taskChecklistItem.count({
      where: { taskId: task.id },
    }),
    followups: await prisma.followUp.count({ where: { id: follow.id } }),
    attempts: await prisma.followUpAttempt.count({
      where: { followUpId: follow.id },
    }),
    outcomes: await prisma.followUpOutcome.count({
      where: { followUpId: follow.id },
    }),
    events: await prisma.businessEvent.count({
      where: { correlationId: suffix },
    }),
  };
  if (Object.values(counts).some((value) => value < 1))
    throw new Error("TRANSACTIONAL_COUNTS_INVALID");
  console.log(
    JSON.stringify({
      ok: true,
      cycleBlocked,
      dryRun: dry.status,
      run: run.status,
      chat: {
        queryNoMutation: chatQuery.diagnostics?.noMutation,
        created: chatCreate.result?.entityType,
      },
      counts,
    }),
  );
} finally {
  await prisma.$disconnect();
}
