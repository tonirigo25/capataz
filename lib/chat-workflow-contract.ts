import { createHash, randomUUID } from "node:crypto";
import type { ChatContext } from "@/lib/capataz-chat-engine";
import { prisma } from "@/lib/prisma";
import {
  addChecklistItem,
  addTaskDependency,
  archiveTask,
  createSubtask,
  removeTaskDependency,
  toggleChecklistItem,
} from "@/lib/tasks/task-engine";
import { archiveFollowUp, editFollowUp } from "@/lib/followups/followup-engine";
import { DEFAULT_RETRY_POLICY } from "@/lib/automations/automation-registry";
import { runAutomation } from "@/lib/automations/automation-runner";
import { requireCompanyContext } from "@/lib/auth/session";
import { logConversationActionForCompany } from "@/lib/orqena/conversation-repository";

type ContractResult = {
  handled: boolean;
  text: string;
  context?: ChatContext | null;
  result?: {
    type: "created" | "updated" | "registered" | "found";
    entityType: "task" | "followup" | "automation";
    entityId?: string;
    title: string;
    summary: Record<string, string | number | boolean | null>;
    actions: { label: string; href?: string; style?: "primary" | "secondary" | "danger" }[];
  };
};

type Options = { conversationId?: string; messageId?: string; idempotencyKey?: string };
const shownAt = () => new Date().toISOString();
const result = (text: string, context: ChatContext | null, entityType: "task" | "followup" | "automation", entityId: string, title: string, extra: Partial<ChatContext>): ContractResult => ({
  handled: true,
  text,
  context: { ...(context ?? {}), ...extra },
  result: { type: "updated", entityType, entityId, title, summary: { ok: true }, actions: [{ label: "Abrir", href: `/${entityType === "task" ? "tareas" : entityType === "followup" ? "seguimientos" : "automatizaciones"}/${entityId}` }] },
});
const clarify = (text: string, context: ChatContext | null): ContractResult => ({ handled: true, text, context });

async function audit(options: Options, actionType: string, status: string, payload: Record<string, unknown>, output?: Record<string, unknown>) {
  if (!options.conversationId) return;
  const { userId, companyId, membershipId } = await requireCompanyContext();
  await logConversationActionForCompany({ userId, companyId, membershipId }, options.conversationId, { messageId: options.messageId, stage: "workflow_contract", actionType, status, idempotencyKey: options.idempotencyKey, summary: `${actionType}:${status}`, payload: payload as never, result: output as never, metadata: { actorType: "user", origin: "chat" } });
}

export function parseNaturalFollowUpDate(text: string, previous?: Date | null, now = new Date()) {
  const normalized = text.toLocaleLowerCase("es-ES").normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const date = new Date(now);
  const hourMatch = normalized.match(/(?:a las|las)\s+(\d{1,2})(?::(\d{2}))?/);
  const hour = hourMatch ? Number(hourMatch[1]) : previous?.getHours() ?? 9;
  const minute = hourMatch ? Number(hourMatch[2] ?? 0) : previous?.getMinutes() ?? 0;
  const add = (days: number) => date.setDate(date.getDate() + days);
  if (/pasado manana/.test(normalized)) add(2);
  else if (/manana/.test(normalized)) add(1);
  else if (/proxima semana/.test(normalized)) add(7);
  else if (/dentro de (\d+) dias/.test(normalized)) add(Number(normalized.match(/dentro de (\d+) dias/)?.[1]));
  else if (/dentro de cinco dias/.test(normalized)) add(5);
  else {
    const weekdays: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
    const weekday = Object.entries(weekdays).find(([name]) => normalized.includes(name));
    if (weekday) { let delta = (weekday[1] - date.getDay() + 7) % 7; if (!delta || normalized.includes("que viene")) delta += 7; add(delta); }
    else {
      const explicit = normalized.match(/(?:el )?(\d{1,2}) de ([a-z]+)/);
      if (explicit) { const months = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]; date.setMonth(months.indexOf(explicit[2]), Number(explicit[1])); if (date < now) date.setFullYear(date.getFullYear() + 1); }
      else if (!/hoy/.test(normalized)) return null;
    }
  }
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function resolveDisambiguation(text: string, context: ChatContext, options: Options): Promise<ContractResult | null> {
  const pending = context.pendingDisambiguation;
  if (!pending || new Date(pending.expiresAt) < new Date()) return null;
  const normalized = text.toLowerCase();
  if (/ninguna|cancela/.test(normalized)) return clarify("De acuerdo, no haré ningún cambio.", { ...context, pendingDisambiguation: undefined });
  const words: Record<string, number> = { primera: 0, primero: 0, segunda: 1, segundo: 1, tercera: 2, tercero: 2 };
  let index = Object.entries(words).find(([word]) => normalized.includes(word))?.[1];
  if (index === undefined) index = pending.candidates.findIndex((candidate) => normalized.includes(candidate.label.toLowerCase().split(" — ")[0]));
  const candidate = index >= 0 ? pending.candidates[index] : undefined;
  if (!candidate) return clarify("No he podido identificar la opción. Indica la primera, la segunda, su nombre o ninguna.", context);
  if (pending.type === "task_dependency") {
    if (pending.requestedAction === "add") await addTaskDependency(pending.sourceEntityId, candidate.id);
    else {
      const edge = await prisma.taskDependency.findUnique({ where: { taskId_dependsOnTaskId: { taskId: pending.sourceEntityId, dependsOnTaskId: candidate.id } } });
      if (!edge) return clarify("Esa dependencia ya no existe.", { ...context, pendingDisambiguation: undefined });
      await removeTaskDependency(edge.id);
    }
    await audit(options, `dependency_${pending.requestedAction}`, "completed", { sourceEntityId: pending.sourceEntityId, candidateCount: pending.candidates.length }, { selected: candidate.label });
    return result(`He ${pending.requestedAction === "add" ? "añadido" : "retirado"} la dependencia con “${candidate.label}”.`, context, "task", pending.sourceEntityId, "Dependencia actualizada", { pendingDisambiguation: undefined, lastTask: { ...(context.lastTask!), dependencyTaskId: candidate.id, action: `dependency_${pending.requestedAction}`, shownAt: shownAt() } });
  }
  return null;
}

export async function handleChatWorkflowContract(text: string, context: ChatContext | null, options: Options = {}): Promise<ContractResult | null> {
  const { companyId } = await requireCompanyContext();
  const normalized = text.toLocaleLowerCase("es-ES").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
  if (context?.pendingDisambiguation) { const resolved = await resolveDisambiguation(normalized, context, options); if (resolved) return resolved; }

  if (/^(anade|añade|agrega).*(checklist|punto)|^anade esto al checklist/.test(normalized)) {
    if (!context?.lastTask) return clarify("¿A qué tarea quieres añadir el punto de checklist?", context);
    const title = text.replace(/^.*?(?:checklist|punto)(?:\s+para|\s+de)?\s*/i, "").replace(/^(para\s+)?/i, "").trim() || "Nuevo punto";
    const existing = await prisma.taskChecklistItem.findFirst({ where: { taskId: context.lastTask.taskId, title: { equals: title, mode: "insensitive" } } });
    if (existing) return clarify("Ese punto ya existe; no lo he duplicado.", { ...context, lastTask: { ...context.lastTask, checklistItemId: existing.id, action: "checklist_existing", shownAt: shownAt() } });
    const item = await addChecklistItem(context.lastTask.taskId, title);
    await audit(options, "checklist_add", "completed", { taskId: context.lastTask.taskId, title });
    return result(`He añadido “${item.title}” al checklist.`, context, "task", context.lastTask.taskId, "Checklist actualizado", { lastTask: { ...context.lastTask, checklistItemId: item.id, action: "checklist_added", shownAt: shownAt() } });
  }
  if (/^(completa|marca).*(punto|checklist)|^completa el primer punto|^reabre (ese|el).*punto/.test(normalized)) {
    if (!context?.lastTask) return clarify("¿De qué tarea es el punto?", context);
    const items = await prisma.taskChecklistItem.findMany({ where: { taskId: context.lastTask.taskId }, orderBy: { order: "asc" } });
    let item = context.lastTask.checklistItemId ? items.find((value) => value.id === context.lastTask?.checklistItemId) : undefined;
    if (/primer punto/.test(normalized)) item = items[0];
    if (!item) item = items.find((value) => normalized.includes(value.title.toLowerCase()));
    if (!item) return clarify("No encuentro ese punto. Indica su nombre o di «el primer punto».", context);
    const completed = !normalized.startsWith("reabre");
    await toggleChecklistItem(item.id, completed, "chat");
    await audit(options, completed ? "checklist_complete" : "checklist_reopen", "completed", { taskId: context.lastTask.taskId, checklistItemId: item.id });
    return result(`He ${completed ? "completado" : "reabierto"} “${item.title}”.`, context, "task", context.lastTask.taskId, "Checklist actualizado", { lastTask: { ...context.lastTask, checklistItemId: item.id, action: completed ? "checklist_completed" : "checklist_reopened", shownAt: shownAt() } });
  }

  if (/^(crea|anade|añade).*(subtarea)|^haz que esto sea subtarea/.test(normalized)) {
    if (!context?.lastTask) return clarify("¿Cuál es la tarea padre?", context);
    const title = text.replace(/^.*?subtarea(?:\s+para|\s+de)?\s*/i, "").trim();
    if (!title) return clarify("¿Qué título tendrá la subtarea?", context);
    const existing = await prisma.task.findFirst({ where: { parentTaskId: context.lastTask.taskId, title: { equals: title, mode: "insensitive" }, archivedAt: null } });
    if (existing) return clarify("Esa subtarea ya existe; no la he duplicado.", context);
    const subtask = await createSubtask(context.lastTask.taskId, { companyId, title });
    await audit(options, "subtask_create", "completed", { parentTaskId: context.lastTask.taskId, title });
    return result(`He creado la subtarea “${title}” bajo “${context.lastTask.title ?? "la tarea actual"}”.`, context, "task", subtask.id, "Subtarea creada", { lastTask: { taskId: subtask.id, title, parentTaskId: context.lastTask.taskId, action: "subtask_created", shownAt: shownAt() } });
  }
  if (/abre la tarea padre/.test(normalized)) {
    if (!context?.lastTask?.parentTaskId) return clarify("La tarea actual no tiene una tarea padre en el contexto.", context);
    const parent = await prisma.task.findUniqueOrThrow({ where: { id: context.lastTask.parentTaskId } });
    return result(`La tarea padre es “${parent.title}”.`, context, "task", parent.id, parent.title, { lastTask: { taskId: parent.id, title: parent.title, action: "parent_shown", shownAt: shownAt() } });
  }

  const dependencyAction: "add" | "remove" | null = /^(esta tarea depende|bloqueala hasta|anade una dependencia|añade una dependencia)/.test(normalized) ? "add" : /^(elimina esa dependencia|ya no depende|retira.*dependencia)/.test(normalized) ? "remove" : null;
  if (dependencyAction) {
    if (!context?.lastTask) return clarify("¿Qué tarea quieres relacionar?", context);
    const reference = text
      .replace(/^.*?(?:depende de|terminar|dependencia con(?: la tarea de)?|tarea de|ya no depende de)\s*/i, "")
      .trim();
    const candidates = await prisma.task.findMany({ where: { id: { not: context.lastTask.taskId }, archivedAt: null, ...(reference ? { title: { contains: reference, mode: "insensitive" } } : {}) }, take: 6 });
    if (!candidates.length) return clarify("No encuentro una tarea que coincida. Indica parte del título.", context);
    if (candidates.length > 1) {
      const pending = { type: "task_dependency" as const, candidates: candidates.map((item) => ({ id: item.id, label: item.title })), requestedAction: dependencyAction, sourceEntityId: context.lastTask.taskId, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() };
      await audit(options, "dependency_disambiguation", "pending", { candidateCount: candidates.length, requestedAction: dependencyAction });
      return clarify(`No puedo saber a cuál te refieres. He encontrado:\n\n${pending.candidates.map((candidate, index) => `${index + 1}. ${candidate.label}`).join("\n")}\n\n¿Cuál eliges?`, { ...context, pendingDisambiguation: pending });
    }
    const pendingContext = { ...context, pendingDisambiguation: { type: "task_dependency" as const, candidates: [{ id: candidates[0].id, label: candidates[0].title }], requestedAction: dependencyAction, sourceEntityId: context.lastTask.taskId, expiresAt: new Date(Date.now() + 60_000).toISOString() } };
    return resolveDisambiguation("la primera", pendingContext, options);
  }
  if (/que bloquea esta tarea/.test(normalized) && context?.lastTask) {
    const edges = await prisma.taskDependency.findMany({ where: { taskId: context.lastTask.taskId }, include: { dependsOnTask: true } });
    return clarify(edges.length ? `La bloquean: ${edges.map((edge) => edge.dependsOnTask.title).join(", ")}.` : "Esta tarea no tiene dependencias bloqueantes.", context);
  }

  if (/^(reprograma|cambia|mejor|volver|vuelve).*(viernes|lunes|martes|miercoles|jueves|sabado|domingo|manana|hoy|dias|semana|julio|agosto)/.test(normalized)) {
    if (!context?.lastFollowUp) return clarify("¿Qué seguimiento quieres reprogramar?", context);
    const current = await prisma.followUp.findUniqueOrThrow({ where: { id: context.lastFollowUp.followUpId } });
    const date = parseNaturalFollowUpDate(text, current.nextActionAt);
    if (!date) return clarify("No he podido interpretar la fecha. Prueba con «mañana», «el viernes» o «dentro de cinco días».", context);
    await editFollowUp(current.id, { nextActionAt: date });
    await audit(options, "followup_reschedule", "completed", { followUpId: current.id, nextActionAt: date.toISOString() });
    return result(`He cambiado la próxima acción a ${new Intl.DateTimeFormat("es-ES", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Madrid" }).format(date)}.`, context, "followup", current.id, "Seguimiento reprogramado", { lastFollowUp: { ...context.lastFollowUp, title: current.title, nextActionAt: date.toISOString(), action: "rescheduled", shownAt: shownAt() } });
  }

  if (/^crea una automatizacion/.test(normalized)) {
    const name = text.replace(/^crea una automatización(?:\s+para)?\s*/i, "").trim() || "Automatización desde Chat";
    const existing = await prisma.automationDefinition.findFirst({ where: { name: { equals: name, mode: "insensitive" }, status: "draft", archivedAt: null } });
    if (existing) return clarify("Ese borrador ya existe; no lo he duplicado.", { ...context, lastAutomation: { automationId: existing.id, automationDefinitionId: existing.id, action: "draft_existing", title: existing.name, shownAt: shownAt() } });
    const weekday = ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"].find((day) => normalized.includes(day));
    const definition = await prisma.automationDefinition.create({ data: { name, description: "Borrador creado desde Chat; nunca se publica automáticamente.", source: "chat", versions: { create: { version: 1, status: "draft", triggerMode: weekday ? "schedule" : "manual", retryPolicy: DEFAULT_RETRY_POLICY, definitionHash: createHash("sha256").update(randomUUID()).digest("hex"), triggers: { create: { type: weekday ? "schedule" : "manual", configuration: weekday ? { weekday, hour: 9, timezone: "Europe/Madrid" } : { source: "chat" } } }, actions: { create: { actionType: "create_task", order: 1, configuration: { title: name } } } } } } });
    const version = await prisma.automationVersion.findFirstOrThrow({ where: { automationDefinitionId: definition.id } });
    await audit(options, "automation_draft_create", "completed", { definitionId: definition.id, trigger: weekday ?? "manual" });
    return result(`He creado el borrador “${name}”. No está publicado ni activo.`, context, "automation", definition.id, "Borrador creado", { lastAutomation: { automationId: definition.id, automationDefinitionId: definition.id, versionId: version.id, automationVersionId: version.id, action: "draft_created", draftStep: "summary", title: name, shownAt: shownAt() } });
  }
  if (/^(cambiala|mejor).*(viernes|lunes|martes|miercoles|jueves|nueve)|maximo .*reintentos|cooldown/.test(normalized) && context?.lastAutomation) {
    const definitionId = context.lastAutomation.automationDefinitionId ?? context.lastAutomation.automationId;
    const version = await prisma.automationVersion.findFirstOrThrow({ where: { automationDefinitionId: definitionId }, include: { triggers: true } , orderBy: { version: "desc" } });
    if (version.status !== "draft") return clarify("Esa versión ya está publicada. Crearé una nueva versión borrador si lo confirmas.", context);
    const weekday = ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"].find((day) => normalized.includes(day));
    const hour = /nueve|9/.test(normalized) ? 9 : undefined;
    const retries = Number(normalized.match(/maximo (\d+) reintentos/)?.[1]);
    if (weekday || hour) await prisma.automationTrigger.updateMany({ where: { automationVersionId: version.id }, data: { type: "schedule", configuration: { weekday: weekday ?? "lunes", hour: hour ?? 9, timezone: "Europe/Madrid" } } });
    if (retries) await prisma.automationVersion.update({ where: { id: version.id }, data: { retryPolicy: { ...DEFAULT_RETRY_POLICY, maxAttempts: retries } } });
    await audit(options, "automation_draft_edit", "completed", { definitionId, weekday, hour, retries });
    return result("He actualizado únicamente la versión borrador.", context, "automation", definitionId, "Borrador actualizado", { lastAutomation: { ...context.lastAutomation, versionId: version.id, automationVersionId: version.id, action: "draft_updated", shownAt: shownAt() } });
  }
  if (/^(solo|anade|añade).*(condicion|facturas con mas de)/.test(normalized) && context?.lastAutomation) {
    const definitionId = context.lastAutomation.automationDefinitionId ?? context.lastAutomation.automationId;
    const version = await prisma.automationVersion.findFirstOrThrow({ where: { automationDefinitionId: definitionId }, orderBy: { version: "desc" } });
    if (version.status !== "draft") return clarify("Esa versión ya está publicada. Crearé una nueva versión borrador si lo confirmas.", context);
    const amount = Number(normalized.match(/([\d.]+)\s*(?:€|euros?)/)?.[1]?.replace(".", "") ?? 0);
    const order = await prisma.automationCondition.count({ where: { automationVersionId: version.id } });
    await prisma.automationCondition.create({ data: { automationVersionId: version.id, group: 0, operator: "and", field: "outstandingAmount", comparator: "gte", value: amount, valueType: "number", order: order + 1 } });
    await audit(options, "automation_condition_add", "completed", { definitionId, field: "outstandingAmount", amount });
    return result("He añadido la condición al borrador.", context, "automation", definitionId, "Condición añadida", { lastAutomation: { ...context.lastAutomation, action: "condition_added", shownAt: shownAt() } });
  }
  if (/que cree una recomendacion,? no una tarea/.test(normalized) && context?.lastAutomation) {
    const definitionId = context.lastAutomation.automationDefinitionId ?? context.lastAutomation.automationId;
    const version = await prisma.automationVersion.findFirstOrThrow({ where: { automationDefinitionId: definitionId }, orderBy: { version: "desc" } });
    if (version.status !== "draft") return clarify("Esa versión ya está publicada. Crearé una nueva versión borrador si lo confirmas.", context);
    await prisma.automationAction.updateMany({ where: { automationVersionId: version.id }, data: { actionType: "create_recommendation", configuration: { source: "chat" } } });
    await audit(options, "automation_action_change", "completed", { definitionId, actionType: "create_recommendation" });
    return result("He cambiado la acción del borrador para crear una recomendación interna.", context, "automation", definitionId, "Acción actualizada", { lastAutomation: { ...context.lastAutomation, action: "action_updated", shownAt: shownAt() } });
  }
  if (/crea (una )?nueva version borrador/.test(normalized) && context?.lastAutomation) {
    const definitionId = context.lastAutomation.automationDefinitionId ?? context.lastAutomation.automationId;
    const source = await prisma.automationVersion.findFirstOrThrow({ where: { automationDefinitionId: definitionId }, include: { triggers: true, conditions: true, actions: true }, orderBy: { version: "desc" } });
    const draft = await prisma.automationVersion.create({ data: { automationDefinitionId: definitionId, version: source.version + 1, status: "draft", triggerMode: source.triggerMode, cooldownSeconds: source.cooldownSeconds, timeoutSeconds: source.timeoutSeconds, retryPolicy: source.retryPolicy as never, requiresConfirmation: source.requiresConfirmation, confirmationMode: source.confirmationMode, deduplicationStrategy: source.deduplicationStrategy, definitionHash: createHash("sha256").update(randomUUID()).digest("hex"), triggers: { create: source.triggers.map(({ type, eventType, scheduleId, entityType, configuration }) => ({ type, eventType, scheduleId, entityType, configuration: configuration as never })) }, conditions: { create: source.conditions.map(({ group, operator, field, comparator, value, valueType, order }) => ({ group, operator, field, comparator, value: value as never, valueType, order })) }, actions: { create: source.actions.map(({ actionType, order, configuration, requiresConfirmation, confirmationMode, onFailure }) => ({ actionType, order, configuration: configuration as never, requiresConfirmation, confirmationMode, onFailure })) } } });
    await audit(options, "automation_draft_version_create", "completed", { definitionId, sourceVersion: source.version, draftVersion: draft.version });
    return result(`He creado la versión ${draft.version} como borrador.`, context, "automation", definitionId, "Nueva versión borrador", { lastAutomation: { ...context.lastAutomation, versionId: draft.id, automationVersionId: draft.id, action: "draft_version_created", shownAt: shownAt() } });
  }
  if (/^(ejecutala en seco|simulala|que haria esta automatizacion|cuantos registros afectaria)/.test(normalized) && context?.lastAutomation) {
    const definitionId = context.lastAutomation.automationDefinitionId ?? context.lastAutomation.automationId;
    const run = await runAutomation({ definitionId, idempotencyKey: options.idempotencyKey ? `${options.idempotencyKey}:dry-run:${definitionId}` : `chat:dry-run:${definitionId}:${randomUUID()}`, triggerType: "manual", triggeredBy: "chat", dryRun: true });
    await audit(options, "automation_dry_run", "completed", { definitionId }, { runId: run.id, status: run.status, dryRun: run.dryRun });
    return result(`Simulación completada: ${run.status}. No se ejecutó ninguna acción real.`, context, "automation", definitionId, "Dry run", { lastAutomation: { ...context.lastAutomation, runId: run.id, action: "dry_run", shownAt: shownAt() } });
  }
  if (/^(archiva|elimina|ya no quiero).*(borrador|automatizacion)/.test(normalized) && context?.lastAutomation) {
    const definitionId = context.lastAutomation.automationDefinitionId ?? context.lastAutomation.automationId;
    const definition = await prisma.automationDefinition.findUniqueOrThrow({ where: { id: definitionId } });
    if ((definition.active || definition.status === "active") && !/archiva la automatizacion activa/.test(normalized)) return clarify("Esta automatización está activa y dejaría de ejecutarse. Confirma con «archiva la automatización activa».", { ...context, lastAutomation: { ...context.lastAutomation, action: "archive_pending", shownAt: shownAt() } });
    await prisma.automationDefinition.update({ where: { id: definitionId }, data: { archivedAt: new Date(), status: "archived", active: false } });
    await audit(options, "automation_archive", "completed", { definitionId });
    return result("He archivado el borrador conservando versiones y runs.", context, "automation", definitionId, "Borrador archivado", { lastAutomation: { ...context.lastAutomation, action: "archived", shownAt: shownAt() } });
  }

  if (/^archiva la automatizacion activa/.test(normalized) && context?.lastAutomation?.action === "archive_pending") {
    const definitionId = context.lastAutomation.automationDefinitionId ?? context.lastAutomation.automationId;
    await prisma.automationDefinition.update({ where: { id: definitionId }, data: { archivedAt: new Date(), status: "archived", active: false } });
    await audit(options, "automation_archive", "confirmed", { definitionId });
    return result("He pausado y archivado la automatización; versiones y runs se conservan.", context, "automation", definitionId, "Automatización archivada", { lastAutomation: { ...context.lastAutomation, action: "archived", shownAt: shownAt() } });
  }

  if (/^(archiva|quita|ya no necesito).*(tarea)|^archivala$/.test(normalized) && context?.lastTask) {
    const task = await prisma.task.findUniqueOrThrow({ where: { id: context.lastTask.taskId }, include: { subtasks: { where: { status: { notIn: ["completed","cancelled","archived"] } } }, blocking: true } });
    if (["in_progress","blocked"].includes(task.status) && context.lastTask.action !== "archive_pending") return clarify("La tarea está activa. ¿Quieres cancelarla o archivarla?", { ...context, lastTask: { ...context.lastTask, action: "archive_pending", shownAt: shownAt() } });
    if ((task.subtasks.length || task.blocking.length) && context.lastTask.action !== "archive_pending") return clarify(`La tarea tiene ${task.subtasks.length} subtareas activas y bloquea ${task.blocking.length} tareas. Di «confirma archivar esta tarea» para continuar.`, { ...context, lastTask: { ...context.lastTask, action: "archive_pending", shownAt: shownAt() } });
    await archiveTask(task.id); await audit(options, "task_archive", "completed", { taskId: task.id });
    return result("He archivado la tarea conservando su histórico.", context, "task", task.id, "Tarea archivada", { lastTask: { ...context.lastTask, title: task.title, action: "archived", shownAt: shownAt() } });
  }
  if (/^confirma archivar esta tarea/.test(normalized) && context?.lastTask?.action === "archive_pending") {
    await archiveTask(context.lastTask.taskId); await audit(options, "task_archive", "confirmed", { taskId: context.lastTask.taskId });
    return result("He archivado la tarea tras la confirmación.", context, "task", context.lastTask.taskId, "Tarea archivada", { lastTask: { ...context.lastTask, action: "archived", shownAt: shownAt() } });
  }
  if (/^(archiva|ya no quiero seguir|cierra y archiva).*(seguimiento)/.test(normalized) && context?.lastFollowUp) {
    const follow = await prisma.followUp.findUniqueOrThrow({ where: { id: context.lastFollowUp.followUpId } });
    if (!["completed","cancelled","unsuccessful","archived"].includes(follow.status) && context.lastFollowUp.action !== "archive_pending") return clarify("El seguimiento sigue activo. ¿Quieres marcarlo como completado, cancelarlo o simplemente archivarlo?", { ...context, lastFollowUp: { ...context.lastFollowUp, action: "archive_pending", shownAt: shownAt() } });
    await archiveFollowUp(follow.id); await audit(options, "followup_archive", "completed", { followUpId: follow.id });
    return result("He archivado el seguimiento conservando intentos y resultados.", context, "followup", follow.id, "Seguimiento archivado", { lastFollowUp: { ...context.lastFollowUp, title: follow.title, action: "archived", shownAt: shownAt() } });
  }
  if (/^(simplemente )?archivalo/.test(normalized) && context?.lastFollowUp?.action === "archive_pending") {
    await archiveFollowUp(context.lastFollowUp.followUpId); await audit(options, "followup_archive", "confirmed", { followUpId: context.lastFollowUp.followUpId });
    return result("He archivado el seguimiento conservando intentos y resultados.", context, "followup", context.lastFollowUp.followUpId, "Seguimiento archivado", { lastFollowUp: { ...context.lastFollowUp, action: "archived", shownAt: shownAt() } });
  }
  return null;
}
