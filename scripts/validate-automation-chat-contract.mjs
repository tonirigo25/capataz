import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { assertIsolatedTestDatabase } from "./test-database-safety.mjs";
import * as prismaModule from "../lib/prisma.ts";
import * as chatModule from "../app/(app)/capataz/actions.ts";
import * as taskModule from "../lib/tasks/task-engine.ts";
import * as registryModule from "../lib/automations/automation-registry.ts";
import * as contractModule from "../lib/chat-workflow-contract.ts";

const value = (module) => module.default ?? module;
const { prisma } = value(prismaModule);
const { runChatCommand } = value(chatModule);
const { createTask, createSubtask, addTaskDependency } = value(taskModule);
const { publishAutomationVersion } = value(registryModule);
const { parseNaturalFollowUpDate } = value(contractModule);
assertIsolatedTestDatabase();
const suffix = randomUUID().slice(0, 8);
let sequence = 0;
const send = (text, context = null, key = `contract-${suffix}-${++sequence}`) =>
  runChatCommand(text, context, { idempotencyKey: key });
const check = (condition, label) => { if (!condition) throw new Error(`CHAT_CONTRACT_FAILED:${label}`); };

const created = await send(`crea una tarea Contrato ${suffix} para mañana`);
let context = created.context;
check(created.result?.entityType === "task", "task_context");
const taskId = created.result.entityId;

const noContext = await send("añade revisar mediciones al checklist");
check(noContext.text.includes("qué tarea") || noContext.text.includes("A qué tarea"), "checklist_requires_context");
const add = await send("añade un punto para pedir el material", context);
context = add.context;
check(Boolean(context.lastTask.checklistItemId), "checklist_add");
const duplicate = await send("añade un punto para pedir el material", context);
check(duplicate.text.includes("no lo he duplicado"), "checklist_idempotency");
const complete = await send("completa el primer punto", context);
context = complete.context;
check((await prisma.taskChecklistItem.findUnique({ where: { id: context.lastTask.checklistItemId } })).completed, "checklist_complete");
await send("reabre ese punto", context);
check(!(await prisma.taskChecklistItem.findUnique({ where: { id: context.lastTask.checklistItemId } })).completed, "checklist_reopen");

const sub = await send("crea una subtarea para llamar al proveedor", context);
check(Boolean(sub.context.lastTask.parentTaskId), "subtask_create");
const parent = await send("abre la tarea padre", sub.context);
check(parent.result?.entityId === taskId, "subtask_parent");
let depthParent = taskId;
for (let index = 0; index < 10; index++) depthParent = (await createSubtask(depthParent, { title: `Nivel ${index} ${suffix}` })).id;
let depthBlocked = false;
try { await createSubtask(depthParent, { title: "Demasiada profundidad" }); } catch { depthBlocked = true; }
check(depthBlocked, "subtask_depth");

const source = await createTask({ title: `Origen dependencia ${suffix}` });
await createTask({ title: `Pedir material ${suffix}` });
await createTask({ title: `Pedir material ${suffix}` });
const sourceContext = { lastTask: { taskId: source.id, title: source.title, action: "shown", shownAt: new Date().toISOString() } };
const ambiguous = await send(`añade una dependencia con la tarea de Pedir material ${suffix}`, sourceContext);
check((ambiguous.context.pendingDisambiguation?.candidates.length ?? 0) >= 2, `dependency_ambiguity:${JSON.stringify(ambiguous.context.pendingDisambiguation)}`);
const selected = await send("la segunda", ambiguous.context);
check(Boolean(selected.context.lastTask.dependencyTaskId), "dependency_select_second");
const edge = await prisma.taskDependency.findFirstOrThrow({ where: { taskId: source.id } });
const removeContext = { ...selected.context, pendingDisambiguation: { type: "task_dependency", candidates: [{ id: edge.dependsOnTaskId, label: "seleccionada" }], requestedAction: "remove", sourceEntityId: source.id, expiresAt: new Date(Date.now() + 60_000).toISOString() } };
await send("la primera", removeContext);
check((await prisma.taskDependency.count({ where: { taskId: source.id } })) === 0, "dependency_remove");
const depA = await createTask({ title: `Ciclo A ${suffix}` }), depB = await createTask({ title: `Ciclo B ${suffix}` });
await addTaskDependency(depA.id, depB.id);
let cycleBlocked = false;
try { await addTaskDependency(depB.id, depA.id); } catch { cycleBlocked = true; }
check(cycleBlocked, "dependency_cycle");

const follow = await send(`crea un seguimiento Seguimiento ${suffix}`);
let followContext = follow.context;
const followId = follow.result.entityId;
await prisma.followUp.update({ where: { id: followId }, data: { nextActionAt: new Date("2026-07-13T15:30:00Z") } });
const tomorrow = await send("reprograma este seguimiento mañana", followContext);
followContext = tomorrow.context;
check(new Date(followContext.lastFollowUp.nextActionAt).getMinutes() === 30, "followup_preserve_hour");
const friday = await send("volver a revisarlo el viernes", followContext);
check(new Date(friday.context.lastFollowUp.nextActionAt).getDay() === 5, "followup_friday");
check(parseNaturalFollowUpDate("dentro de cinco días") instanceof Date, "followup_natural_date");
const attempt = await send("anota que no respondió", friday.context);
check(Boolean(attempt.context.lastFollowUp.attemptId), "followup_attempt");
const activeArchive = await send("archiva este seguimiento", attempt.context);
check(activeArchive.text.includes("completado") && activeArchive.text.includes("cancelarlo"), "followup_archive_clarification");
await prisma.followUp.update({ where: { id: followId }, data: { status: "completed", completedAt: new Date() } });
await send("archiva este seguimiento", attempt.context);
check(Boolean((await prisma.followUp.findUnique({ where: { id: followId } })).archivedAt), "followup_archive");

const automation = await send("crea una automatización para revisar facturas vencidas cada lunes");
let automationContext = automation.context;
const automationId = automation.result.entityId;
check((await prisma.automationDefinition.findUnique({ where: { id: automationId } })).status === "draft", "automation_draft");
automationContext = (await send("cámbiala a los viernes", automationContext)).context;
await send("solo facturas con más de 1.000 €", automationContext);
await send("que cree una recomendación, no una tarea", automationContext);
const beforeDryTasks = await prisma.task.count();
automationContext = (await send("ejecútala en seco", automationContext)).context;
check((await prisma.task.count()) === beforeDryTasks, "automation_dry_no_mutation");
const run = await prisma.automationRun.findUniqueOrThrow({ where: { id: automationContext.lastAutomation.runId } });
check(run.dryRun && ["completed", "skipped"].includes(run.status), "automation_dry_run");
await send("archiva este borrador", automationContext);
check(Boolean((await prisma.automationDefinition.findUnique({ where: { id: automationId } })).archivedAt), "automation_archive");

const publishedDefinition = await send(`crea una automatización Publicada ${suffix}`);
const publishedId = publishedDefinition.result.entityId;
const publishedVersion = await prisma.automationVersion.findFirstOrThrow({ where: { automationDefinitionId: publishedId } });
await publishAutomationVersion(publishedVersion.id);
const immutable = await send("cámbiala a los viernes", publishedDefinition.context);
check((await prisma.automationVersion.findUnique({ where: { id: publishedVersion.id } })).status === "published", "published_immutable");
const draftVersion = await send("crea una nueva versión borrador", publishedDefinition.context);
check(draftVersion.text.includes("borrador"), "published_new_draft");

const archiveTaskResult = await send(`crea una tarea Archivar ${suffix}`);
await prisma.task.update({ where: { id: archiveTaskResult.result.entityId }, data: { status: "completed", completedAt: new Date() } });
await send("archiva esta tarea", archiveTaskResult.context);
check(Boolean((await prisma.task.findUnique({ where: { id: archiveTaskResult.result.entityId } })).archivedAt), "task_archive");
const activeTask = await send(`crea una tarea Activa ${suffix}`);
await prisma.task.update({ where: { id: activeTask.result.entityId }, data: { status: "in_progress" } });
check((await send("archiva esta tarea", activeTask.context)).text.includes("cancelarla"), "task_archive_active_clarification");
const parentWithSub = await send(`crea una tarea Padre ${suffix}`);
await createSubtask(parentWithSub.result.entityId, { title: "Sub activa" });
check((await send("archiva esta tarea", parentWithSub.context)).text.includes("subtareas activas"), "task_archive_subtask_warning");

const beforeQuery = await prisma.task.count();
const query = await send("qué tareas tengo hoy");
check(query.diagnostics?.noMutation && (await prisma.task.count()) === beforeQuery, "query_no_mutation");
const actionsSource = readFileSync(new URL("../app/(app)/capataz/actions.ts", import.meta.url), "utf8");
check(
  query.result?.actions?.some((action) => action.href === "/tareas")
    || (query.text.includes("No he podido consultar") && actionsSource.includes('"Tareas","/tareas"')),
  "query_real_link",
);
check((await prisma.chatActionLog.count({ where: { stage: "workflow_contract" } })) >= 12, "audit_log");

console.log(JSON.stringify({ ok: true, cases: 37, cycleBlocked, audit: true, noDuplicates: true }));
await prisma.$disconnect();
