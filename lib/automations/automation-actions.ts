import type { AutomationAction, AutomationRun, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createTask } from "@/lib/tasks/task-engine";
import { createFollowUp } from "@/lib/followups/followup-engine";
import { publishBusinessEvent } from "@/lib/business-events";
import { DISABLED_EXTERNAL_ACTIONS } from "./automation-validation";

const object = (value: Prisma.JsonValue) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export async function executeAutomationAction(
  action: AutomationAction,
  run: AutomationRun,
) {
  if (
    (DISABLED_EXTERNAL_ACTIONS as readonly string[]).includes(action.actionType)
  )
    throw new Error("EXTERNAL_ACTION_DISABLED");
  const config = object(action.configuration);
  if (action.actionType === "create_task")
    return createTask({
      title: String(config.title ?? "Tarea automática"),
      description: config.description ? String(config.description) : undefined,
      automationRunId: run.id,
      origin: "automation",
      requiresConfirmation: false,
    });
  if (action.actionType === "create_followup")
    return createFollowUp({
      title: String(config.title ?? "Seguimiento automático"),
      type: String(config.type ?? "general"),
      automationRunId: run.id,
      origin: "automation",
    });
  if (action.actionType === "create_reminder")
    return prisma.reminder.create({
      data: {
        tipo: "recordatorio_interno",
        mensaje: String(config.message ?? "Recordatorio automático"),
        fechaProgramada: new Date(String(config.scheduledAt ?? new Date())),
        requiereConfirmacion: false,
        confirmadoPorUsuario: true,
      },
    });
  if (action.actionType === "create_calendar_event")
    return prisma.eventoAgenda.create({
      data: {
        titulo: String(config.title ?? "Evento automático"),
        tipo: "tarea_obra",
        fechaInicio: new Date(String(config.startsAt ?? new Date())),
        requiereConfirmacion: false,
        confirmadoPorUsuario: true,
      },
    });
  if (action.actionType === "add_internal_note")
    return prisma.internalNote.create({
      data: {
        content: String(config.content ?? "Nota automática"),
        clientId: config.clientId ? String(config.clientId) : undefined,
        workId: config.workId ? String(config.workId) : undefined,
      },
    });
  if (action.actionType === "write_audit_event")
    return publishBusinessEvent({
      type: String(config.type ?? "automation.audit"),
      entityType: run.triggerEntityType ?? "automation",
      entityId: run.triggerEntityId ?? run.automationDefinitionId,
      correlationId: run.correlationId,
      causationId: run.id,
      payloadSanitized: config,
    });
  if (
    [
      "create_recommendation",
      "create_alert",
      "generate_internal_summary",
      "open_review_request",
      "generate_pdf_draft",
      "link_entities",
    ].includes(action.actionType)
  )
    return { queuedForReview: action.actionType, configuration: config };
  if (
    [
      "mark_recommendation_reviewed",
      "snooze_recommendation",
      "assign_task",
      "update_task_priority",
    ].includes(action.actionType)
  )
    throw new Error("CONFIRMATION_REQUIRED");
  throw new Error("UNKNOWN_AUTOMATION_ACTION");
}
