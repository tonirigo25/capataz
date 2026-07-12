"use server";

import { revalidatePath } from "next/cache";
import { parseBudgetLines, serializeBudgetLines, type BudgetLine } from "@/lib/budget-lines";
import {
  createActivityCompletionContext,
  createBudgetCompletionContext,
  createInvoiceCompletionContext,
  createLastDocumentContext,
  createWorkSelectionContext,
  draftBudgetCommandFromContext,
  mergeBudgetCommandWithEntities,
  normalizeChatContext,
  planChatMessage,
  summarizeActiveTask,
  type ChatContext,
  type ChatEntities
} from "@/lib/capataz-chat-engine";
import { CHAT_INACTIVITY_MS, shouldShowConversationInHistory } from "@/lib/chat-conversation-rules";
import { buildClientContacts } from "@/lib/contacts";
import {
  classifyChatIntent,
  normalizeQueryText,
  type ChatIntentClassification,
  type PendingDetailCategory
} from "@/lib/capataz-chat-query";
import {
  normalizeName,
  type IvaMode,
  type ParsedActivityCommand,
  type ParsedBudgetCommand,
  type ParsedConvertBudgetCommand,
  type ParsedInvoiceCommand,
  type ParsedPdfCommand
} from "@/lib/capataz-chat-parser";
import {
  getCapatazAIErrorMeta,
  interpretCapatazMessageWithAI,
  isCapatazAIConfigured,
  type CapatazAIResult
} from "@/lib/ai/capataz-ai";
import { getAgendaItems, itemsForDay as agendaItemsForDay, itemsBetween as agendaItemsBetween, addDays as agendaAddDays, startOfDay as agendaStartOfDay } from "@/lib/agenda";
import {
  dismissBusinessRecommendation,
  getBusinessRecommendations,
  markRecommendationViewed,
  reactivateBusinessRecommendation,
  snoozeBusinessRecommendation,
  snoozeBusinessRecommendationUntil,
  type BusinessRecommendation
} from "@/lib/business-recommendations";
import { getBusinessSignals, type BusinessSignal } from "@/lib/business-signals";
import { getBusinessIntelligenceSummary, metricDefinitionText } from "@/lib/business-intelligence";
import type { BusinessPeriodId } from "@/lib/business-periods";
import { getNotificationItems } from "@/lib/notifications";
import { nextDocumentNumber } from "@/lib/numbering";
import { getProactiveControlData } from "@/lib/proactive-evaluation";
import { prisma } from "@/lib/prisma";
import { createTask, changeTaskStatus } from "@/lib/tasks/task-engine";
import { createFollowUp, addFollowUpAttempt } from "@/lib/followups/followup-engine";
import { handleChatWorkflowContract } from "@/lib/chat-workflow-contract";
import { deriveInvoiceStatus } from "@/lib/status";
import { getTreasuryOverview } from "@/lib/treasury";
import { ACTIVE_WORK_STATUSES, buildWorkDocuments, calculateWorkFinancials, isActiveWorkStatus } from "@/lib/works";
import { requireCompanyContext } from "@/lib/auth/session";
import { companySettingsView } from "@/lib/tenant/company-settings";

async function activeCompany() {
  const context = await requireCompanyContext();
  return prisma.company.findUniqueOrThrow({ where: { id: context.companyId } }).then(companySettingsView);
}

type ChatDocumentKind = "budget" | "invoice";
type PendingField = "iva" | "direccion_obra" | "datos_cliente" | "datos_fiscales";

export type ChatCommandContext = ChatContext;

export type ChatCommandResult = {
  handled: boolean;
  text: string;
  result?: ChatActionResult;
  diagnostics?: ChatRouteDiagnostics;
  created?: {
    clientId?: string;
    workId?: string;
    budgetId?: string;
    invoiceId?: string;
    agendaEventId?: string;
    reminderId?: string;
  };
  context?: ChatCommandContext | null;
  clearContext?: boolean;
};

type ChatRouteDiagnostics = {
  normalizedText?: string;
  intentKind?: string;
  action?: string;
  confidence?: number;
  rule?: string;
  handler?: string;
  query?: string;
  resultCount?: number;
  noMutation?: boolean;
  responseLength?: number;
};

export type ChatCommandOptions = {
  messageId?: string;
  idempotencyKey?: string;
  conversationId?: string;
  clientStartedAt?: number;
};

export type ChatActionButton = {
  label: string;
  href?: string;
  action?: "confirm_send" | "retry" | "show_pending" | "continue_task";
  style?: "primary" | "secondary" | "danger";
};

export type ChatActionResult = {
  type: "created" | "updated" | "registered" | "generated" | "failed" | "partial" | "found";
  entityType: "client" | "contact" | "company" | "project" | "quote" | "invoice" | "expense" | "payment" | "visit" | "followup" | "reminder" | "pdf" | "query" | "business" | "business_metric" | "task" | "automation";
  entityId?: string;
  title: string;
  summary: Record<string, string | number | boolean | null>;
  pendingFields?: { key: string; label: string; requiredFor?: string }[];
  actions: ChatActionButton[];
};

export type ChatHistoryMessage = {
  id: string;
  role: "assistant" | "user" | "system";
  text: string;
  status: string;
  createdAt: string;
  metadata?: unknown;
  result?: ChatActionResult;
};

export type ChatHistoryConversation = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  lastActivityAt: string;
  createdAt: string;
  activeTask?: ChatCommandContext | null;
  metadata?: unknown;
  messages: ChatHistoryMessage[];
};

type ChatPerfTrace = {
  messageId?: string;
  conversationId?: string;
  idempotencyKey?: string;
  startedAt: number;
};

export async function runChatCommand(text: string, context?: ChatCommandContext | null, options: ChatCommandOptions = {}): Promise<ChatCommandResult> {
  const trace: ChatPerfTrace = { messageId: options.messageId, conversationId: options.conversationId, idempotencyKey: options.idempotencyKey, startedAt: nowMs() };
  const persistStarted = nowMs();
  const persisted = await persistIncomingChatMessage(text, context ?? null, options);
  trace.messageId = persisted.messageId ?? trace.messageId;
  trace.conversationId = persisted.conversationId;
  await logChatPerf(trace, "db:save_user_message", persistStarted, "ok", { duplicate: persisted.duplicate });

  if (persisted.result) {
    await logChatPerf(trace, "total", trace.startedAt, "duplicate_completed");
    return persisted.result;
  }

  if (persisted.duplicate) {
    const result = {
      handled: true,
      text: "Ya estoy procesando ese mensaje. Lo mantengo en la conversación y no duplicaré acciones.",
      context: persisted.context
    };
    await logChatPerf(trace, "total", trace.startedAt, "duplicate_processing");
    return result;
  }

  try {
    const rawResult = await runChatCommandCore(text, persisted.context, trace);
    const result = await withStructuredResult(rawResult);
    await completeChatMessage(trace.messageId, result);
    await logChatPerf(trace, "total", trace.startedAt, "ok", { handled: result.handled });
    return result;
  } catch (error) {
    await failChatMessage(trace.messageId, error);
    await logChatPerf(trace, "total", trace.startedAt, "error", error instanceof Error ? { message: error.message } : undefined);
    throw error;
  }
}

async function runChatCommandCore(text: string, context: ChatCommandContext | null, trace: ChatPerfTrace): Promise<ChatCommandResult> {
  const enrichedContext = await enrichChatContext(context);
  debugChat("received", { text, context: enrichedContext });
  const normalizedText = normalizeQueryText(text);

  const earlyClassifiedIntent = classifyChatIntent(text);
  const isStructuredMutation = /^(reprograma|cambia|mejor|volver|vuelve|crea|anade|agrega|completa|marca|reabre|esta tarea depende|bloqueala|elimina|retira|archiva|quita|ya no|simula|ejecuta)/.test(normalizedText);
  const earlyDatabaseIntent = isStructuredMutation ? null : databaseIntentForMessage(text, earlyClassifiedIntent, enrichedContext);
  if (earlyDatabaseIntent) {
    await logChatPerf(trace, "chat:intent", trace.startedAt, "database_candidate", {
      normalizedText, classifiedKind: earlyClassifiedIntent.kind, classifiedAction: earlyClassifiedIntent.action,
      classifiedConfidence: earlyClassifiedIntent.confidence, rule: earlyClassifiedIntent.rule,
      routedKind: earlyDatabaseIntent.kind, routedAction: earlyDatabaseIntent.action, conversationId: trace.conversationId
    });
    await logChatPerf(trace, "route", trace.startedAt, "database_query", { kind: earlyDatabaseIntent.kind, action: earlyDatabaseIntent.action, confidence: earlyDatabaseIntent.confidence, rule: earlyDatabaseIntent.rule });
    const queryStarted = nowMs();
    try {
      const result = await answerDatabaseQuery(text, earlyDatabaseIntent, enrichedContext);
      await logChatPerf(trace, "chat:database_result", queryStarted, "ok", { ...result.diagnostics, responseLength: result.text.length, conversationId: trace.conversationId });
      return result;
    } catch (error) {
      await logChatPerf(trace, "chat:database_result", queryStarted, "error", { normalizedText, intentKind: earlyDatabaseIntent.kind, action: earlyDatabaseIntent.action, error: error instanceof Error ? sanitizeAIError(error.message) : "unknown" });
      return { handled: true, context: enrichedContext, diagnostics: { normalizedText, intentKind: earlyDatabaseIntent.kind, action: earlyDatabaseIntent.action, confidence: earlyDatabaseIntent.confidence, rule: earlyDatabaseIntent.rule, handler: handlerNameForIntent(earlyDatabaseIntent), noMutation: true }, text: "No he podido consultar esos datos ahora mismo. No he creado ni modificado ningún registro; inténtalo de nuevo en unos segundos." };
    }
  }

  const contractResult = await handleChatWorkflowContract(text, enrichedContext, {
    conversationId: trace.conversationId,
    messageId: trace.messageId,
    idempotencyKey: trace.idempotencyKey,
  });
  if (contractResult) return contractResult;

  const workflowMutation = await runExplicitWorkflowMutation(text, normalizedText, enrichedContext);
  if (workflowMutation) return workflowMutation;

  if (wantsExplicitContinueTask(text) && !enrichedContext?.activeTask) {
    await logChatPerf(trace, "route", trace.startedAt, "fast_local", { action: "continue_latest_task" });
    return continueLatestPendingTask();
  }

  const classifiedIntent = classifyChatIntent(text);
  const databaseIntent = databaseIntentForMessage(text, classifiedIntent, enrichedContext);
  await logChatPerf(trace, "chat:intent", trace.startedAt, databaseIntent ? "database_candidate" : "not_database", {
    normalizedText,
    classifiedKind: classifiedIntent.kind,
    classifiedAction: classifiedIntent.action,
    classifiedConfidence: classifiedIntent.confidence,
    rule: classifiedIntent.rule,
    routedKind: databaseIntent?.kind,
    routedAction: databaseIntent?.action,
    conversationId: trace.conversationId
  });
  if (databaseIntent) {
    await logChatPerf(trace, "route", trace.startedAt, "database_query", { kind: databaseIntent.kind, action: databaseIntent.action, confidence: databaseIntent.confidence, rule: databaseIntent.rule });
    const queryStarted = nowMs();
    try {
      const result = await answerDatabaseQuery(text, databaseIntent, enrichedContext);
      await logChatPerf(trace, "chat:database_result", queryStarted, "ok", {
        ...result.diagnostics,
        responseLength: result.text.length,
        conversationId: trace.conversationId
      });
      return result;
    } catch (error) {
      await logChatPerf(trace, "chat:database_result", queryStarted, "error", {
        normalizedText,
        intentKind: databaseIntent.kind,
        action: databaseIntent.action,
        confidence: databaseIntent.confidence,
        rule: databaseIntent.rule,
        error: error instanceof Error ? sanitizeAIError(error.message) : "unknown"
      });
      return {
        handled: true,
        context: enrichedContext,
        diagnostics: {
          normalizedText,
          intentKind: databaseIntent.kind,
          action: databaseIntent.action,
          confidence: databaseIntent.confidence,
          rule: databaseIntent.rule,
          handler: handlerNameForIntent(databaseIntent),
          noMutation: true
        },
        text: "No he podido consultar esos datos ahora mismo. No he creado ni modificado ningún registro; inténtalo de nuevo en unos segundos."
      };
    }
  }

  const planStarted = nowMs();
  const plan = planChatMessage(text, enrichedContext);
  await logChatPerf(trace, "local:plan", planStarted, plan.handled ? "ok" : "fallback", {
    action: plan.action,
    source: plan.source
  });
  debugChat("plan", plan);

  if (shouldResolveBeforeAI(text, plan)) {
    await logChatPerf(trace, "route", trace.startedAt, "fast_local", { action: plan.action, source: plan.source });
    return executeLocalChatPlan(text, plan);
  }

  const aiResult = await runAIChatCommand(text, enrichedContext, trace);
  if (aiResult) return aiResult;

  await logChatPerf(trace, "route", trace.startedAt, "local_after_ai", { action: plan.action, source: plan.source });

  return executeLocalChatPlan(text, plan);
}

async function executeLocalChatPlan(text: string, plan: ReturnType<typeof planChatMessage>): Promise<ChatCommandResult> {
  if (!plan.handled) {
    debugChat("fallback", { reason: "engine_no_match", entities: plan.entities });
    return { handled: false, text: "" };
  }

  if (["ask_pending", "answer_context", "park_task", "clear_context", "cancel_task", "resume_task"].includes(plan.action)) {
    const response = plan.action === "answer_context"
      ? await personalizeContextGreeting(plan.response ?? "")
      : plan.response;
    return {
      handled: true,
      text: response ?? "Sigo con la acción anterior. Dime si quieres usar lo existente, crear algo nuevo o dejarlo pendiente.",
      context: plan.context
    };
  }

  if (plan.action === "use_existing_work_for_budget" || plan.action === "create_new_work_for_budget") {
    const draft = draftBudgetCommandFromContext(plan.context);
    if (!draft) {
      return {
        handled: true,
        text: "Tenía una decisión pendiente, pero falta el borrador del presupuesto. No he creado nada duplicado. Vuelve a pedirme el presupuesto con cliente, obra e importe.",
        context: null,
        clearContext: true
      };
    }

    const command = mergeBudgetCommandWithEntities(draft, plan.entities);
    try {
      return await createBudgetDraftFromChat(command, {
        existingClientId: plan.context.activeTask?.clienteId,
        existingWorkId: plan.action === "use_existing_work_for_budget" ? plan.context.activeTask?.obraId : undefined,
        forceNewWork: plan.action === "create_new_work_for_budget",
        followUp: plan.entities
      });
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido tu respuesta sobre la obra, pero no he podido continuar el presupuesto por un problema de base de datos. No he enviado nada al cliente.",
        context: plan.context
      };
    }
  }

  if (plan.action === "complete_budget") {
    try {
      return await applyBudgetFollowUp(plan.context, plan.entities);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que estás completando el presupuesto anterior, pero no he podido actualizarlo por un problema de base de datos. No he enviado nada al cliente.",
        context: plan.context
      };
    }
  }

  if (plan.action === "complete_invoice") {
    try {
      return await applyInvoiceFollowUp(plan.context, plan.entities);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que estás completando la factura anterior, pero no he podido actualizarla por un problema de base de datos. No he enviado nada al cliente.",
        context: plan.context
      };
    }
  }

  if (plan.action === "create_budget" && plan.command?.intent === "crear_presupuesto") {
    try {
      return await createBudgetDraftFromChat(plan.command);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que quieres crear un presupuesto, pero no he podido guardarlo por un problema de base de datos. No he enviado nada al cliente. Revisa DATABASE_URL, Prisma y la migración pendiente antes de reintentarlo."
      };
    }
  }

  if (plan.action === "create_invoice" && plan.command?.intent === "crear_factura") {
    try {
      return await createInvoiceDraftFromChat(plan.command);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que quieres crear una factura, pero no he podido guardarla por un problema de base de datos. No he enviado nada al cliente."
      };
    }
  }

  if (plan.action === "register_activity" && plan.command && isParsedActivityCommand(plan.command)) {
    try {
      return await registerActivityFromChat(plan.command);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que quieres registrar una visita o nota, pero no he podido guardarla por un problema de base de datos. No he creado gastos ni importes.",
        context: plan.context
      };
    }
  }

  if (plan.action === "complete_activity") {
    try {
      return await completeActivityFromChat(plan.context, text, plan.entities);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que estás completando una visita o seguimiento, pero no he podido actualizarlo por un problema de base de datos. No he enviado nada al cliente.",
        context: plan.context
      };
    }
  }

  if (plan.action === "convert_budget_to_invoice" && plan.command?.intent === "convertir_presupuesto_en_factura") {
    try {
      return await convertBudgetToInvoiceFromChat(plan.command, plan.context);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que quieres convertir un presupuesto en factura, pero no he podido hacerlo por un problema de base de datos. No he enviado nada al cliente."
      };
    }
  }

  if (plan.action === "generate_pdf") {
    try {
      if ("command" in plan && plan.command?.intent === "generar_pdf") return await buildPdfResult(plan.command, plan.context);
      const result = buildPdfResultFromContext(plan.context);
      if (result.handled) return result;
      return { handled: true, text: "Dime de qué presupuesto o factura quieres el PDF.", context: plan.context };
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que quieres el PDF, pero no he podido localizar el documento. No he enviado nada al cliente."
      };
    }
  }

  if (plan.action === "select_document") {
    const selectedInvoiceId = plan.context.activeTask?.facturaId;
    const taskAction = String(plan.context.activeTask?.draftData?.action ?? "");
    if (selectedInvoiceId && taskAction === "mark_invoice_paid") return await markInvoicePaidFromChat({ ...plan.entities, invoiceStatus: "pagada" }, plan.context);
    if (selectedInvoiceId && taskAction === "register_payment") return await registerPaymentFromChat({ ...plan.entities, amount: Number(plan.context.activeTask?.draftData?.amount ?? plan.entities.amount) }, plan.context);
    if (selectedInvoiceId) return pdfResult("invoice", selectedInvoiceId, plan.context.activeTask?.clienteId, plan.context.activeTask?.obraId, plan.context.lastClientName);
    return { handled: true, text: "He seleccionado el documento, pero falta la acción a aplicar. Dime si quieres PDF, marcar pagada o registrar un pago.", context: plan.context };
  }

  if (plan.action === "mark_invoice_paid") {
    try {
      return await markInvoicePaidFromChat(plan.entities, plan.context);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que quieres marcar una factura como pagada, pero no he podido actualizarla por un problema de base de datos. No he enviado nada al cliente.",
        context: plan.context
      };
    }
  }

  if (plan.action === "register_payment") {
    try {
      return await registerPaymentFromChat(plan.entities, plan.context);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que quieres registrar un pago, pero no he podido guardarlo por un problema de base de datos.",
        context: plan.context
      };
    }
  }

  return { handled: false, text: "" };
}

async function withStructuredResult(result: ChatCommandResult): Promise<ChatCommandResult> {
  if (result.result || !result.created) return result;
  const actionResult = await buildActionResult(result);
  return actionResult ? { ...result, result: actionResult } : result;
}

function databaseIntentForMessage(text: string, classified: ChatIntentClassification, context: ChatCommandContext | null): ChatIntentClassification | null {
  const normalized = normalizeQueryText(text);
  const lastQuery = context?.lastQuery;
  if (lastQuery?.type === "pending_summary" && isPendingDetailFollowUp(normalized)) {
    return {
      kind: "pending_details",
      action: "pending_detail",
      confidence: 0.9,
      detailCategory: isPendingDetailCategory(lastQuery.category) ? lastQuery.category : undefined,
      rule: "last_query_pending_detail"
    };
  }
  if (lastQuery?.type === "pending_detail" && isPendingDetailFollowUp(normalized)) {
    return {
      kind: "pending_details",
      action: "pending_detail",
      confidence: 0.88,
      detailCategory: isPendingDetailCategory(lastQuery.category) ? lastQuery.category : undefined,
      rule: "last_query_repeat_detail"
    };
  }
  if (classified.kind === "pending_summary" || classified.kind === "pending_details") return classified;
  if (classified.kind === "database_query" || classified.kind === "aggregate_query" || classified.kind === "comparison_query") return classified;
  return null;
}

async function answerDatabaseQuery(text: string, intent: ChatIntentClassification, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  if (intent.kind === "pending_summary") return withQueryDiagnostics(await queryPendingTasksSummary(context), text, intent, "queryPendingTasksSummary", "pending_tasks_counts");
  if (intent.kind === "pending_details") return withQueryDiagnostics(await queryPendingTaskDetails(intent.detailCategory, context), text, intent, "queryPendingTaskDetails", `pending_task_details:${intent.detailCategory ?? "lastQuery"}`);

  switch (intent.action) {
    case "automations_list": case "automations_active": case "automations_paused": case "automations_failed": case "automations_last_run": case "automations_next":
      return withQueryDiagnostics(await queryAutomations(intent.action, context), text, intent, "queryAutomations", `automation:${intent.action}`);
    case "tasks_today": case "tasks_overdue": case "tasks_week": case "tasks_blocked": case "tasks_next":
      return withQueryDiagnostics(await queryProfessionalTasks(intent.action, context), text, intent, "queryProfessionalTasks", `task:${intent.action}`);
    case "followups_pending": case "followups_overdue": case "followups_budget": case "followups_invoice": case "followups_success": case "followups_next":
      return withQueryDiagnostics(await queryProfessionalFollowUps(intent.action, context), text, intent, "queryProfessionalFollowUps", `followup:${intent.action}`);
    case "highest_budget":
      return withQueryDiagnostics(await queryBudgetByAmount("desc", intent), text, intent, "queryBudgetByAmount/highest", "budget.findFirst:total_desc");
    case "lowest_budget":
      return withQueryDiagnostics(await queryBudgetByAmount("asc", intent), text, intent, "queryBudgetByAmount/lowest", "budget.findFirst:total_asc");
    case "budget_by_amount":
      return withQueryDiagnostics(await queryBudgetByExactAmount(intent), text, intent, "queryBudgetByExactAmount", "budget.findMany:total_exact");
    case "latest_budget":
      return withQueryDiagnostics(await queryLatestBudget(intent), text, intent, "queryLatestBudget", "budget.findFirst:fechaCreacion_desc");
    case "highest_invoice":
      return withQueryDiagnostics(await queryInvoiceByAmount("desc", intent), text, intent, "queryInvoiceByAmount/highest", "invoice.findFirst:total_desc");
    case "lowest_invoice":
      return withQueryDiagnostics(await queryInvoiceByAmount("asc", intent), text, intent, "queryInvoiceByAmount/lowest", "invoice.findFirst:total_asc");
    case "outstanding_invoices":
      return withQueryDiagnostics(await queryBusinessMetric(intent, "outstanding"), text, intent, "queryBusinessMetric/outstanding", "business_intelligence:outstanding");
    case "pending_invoices_count":
      return withQueryDiagnostics(await queryPendingInvoicesCount(intent), text, intent, "queryPendingInvoicesCount", "invoice.findMany+payments:count_open_balance");
    case "pending_budgets_count":
      return withQueryDiagnostics(await queryPendingBudgetsCount(intent), text, intent, "queryPendingBudgetsCount", "budget.count:pending_states");
    case "overdue_invoices":
      return withQueryDiagnostics(await queryPendingTaskDetails("overdue_invoices", context), text, intent, "queryPendingTaskDetails", "invoice.findMany+payments:overdue");
    case "client_highest_debt":
      return withQueryDiagnostics(await queryBusinessClientHighestDebt(intent), text, intent, "queryBusinessClientHighestDebt", "business_intelligence:client_debt");
    case "revenue_summary":
      return withQueryDiagnostics(await queryBusinessMetric(intent, "invoiced"), text, intent, "queryBusinessMetric/invoiced", "business_intelligence:invoiced");
    case "expenses_summary":
      return withQueryDiagnostics(await queryBusinessMetric(intent, "expenses"), text, intent, "queryBusinessMetric/expenses", "business_intelligence:expenses");
    case "business_health":
      return withQueryDiagnostics(await queryBusinessHealth(intent), text, intent, "queryBusinessHealth", "business_intelligence:health");
    case "business_collected":
      return withQueryDiagnostics(await queryBusinessMetric(intent, "collected"), text, intent, "queryBusinessMetric/collected", "business_intelligence:collected");
    case "business_outstanding":
      return withQueryDiagnostics(await queryBusinessMetric(intent, "outstanding"), text, intent, "queryBusinessMetric/outstanding", "business_intelligence:outstanding");
    case "business_overdue":
      return withQueryDiagnostics(await queryBusinessMetric(intent, "overdue"), text, intent, "queryBusinessMetric/overdue", "business_intelligence:overdue");
    case "business_profit":
      return withQueryDiagnostics(await queryBusinessProfit(intent), text, intent, "queryBusinessProfit", "business_intelligence:profit");
    case "business_margin":
      return withQueryDiagnostics(await queryBusinessMargin(intent), text, intent, "queryBusinessMargin", "business_intelligence:margin");
    case "business_best_work":
      return withQueryDiagnostics(await queryBusinessBestWork(intent), text, intent, "queryBusinessBestWork", "business_intelligence:work_profitability");
    case "business_slowest_client":
      return withQueryDiagnostics(await queryBusinessSlowestClient(intent), text, intent, "queryBusinessSlowestClient", "business_intelligence:client_collection_days");
    case "business_quote_conversion":
      return withQueryDiagnostics(await queryBusinessQuoteConversion(intent), text, intent, "queryBusinessQuoteConversion", "business_intelligence:quote_conversion");
    case "business_compare_periods":
      return withQueryDiagnostics(await queryBusinessComparison(intent), text, intent, "queryBusinessComparison", "business_intelligence:period_compare");
    case "business_review_today":
      return withQueryDiagnostics(await queryBusinessReviewToday(intent), text, intent, "queryBusinessReviewToday", "business_intelligence:deterministic_alerts");
    case "treasury_status":
      return withQueryDiagnostics(await queryTreasuryStatus(intent), text, intent, "queryTreasuryStatus", "treasury:overview");
    case "treasury_available_cash":
      return withQueryDiagnostics(await queryTreasuryAvailableCash(intent), text, intent, "queryTreasuryAvailableCash", "treasury:accounts");
    case "treasury_collect_week":
      return withQueryDiagnostics(await queryTreasuryCollections(intent), text, intent, "queryTreasuryCollections", "treasury:receivables");
    case "treasury_pay_month":
    case "treasury_upcoming_payments":
      return withQueryDiagnostics(await queryTreasuryPayments(intent), text, intent, "queryTreasuryPayments", "treasury:payables");
    case "treasury_forecast":
      return withQueryDiagnostics(await queryTreasuryForecast(intent), text, intent, "queryTreasuryForecast", "treasury:forecast");
    case "treasury_minimum_breach":
      return withQueryDiagnostics(await queryTreasuryMinimumBreach(intent), text, intent, "queryTreasuryMinimumBreach", "treasury:minimum");
    case "treasury_due_invoices":
      return withQueryDiagnostics(await queryTreasuryDueInvoices(intent), text, intent, "queryTreasuryDueInvoices", "treasury:due_invoices");
    case "treasury_cashflow_month":
      return withQueryDiagnostics(await queryTreasuryCashflow(intent), text, intent, "queryTreasuryCashflow", "treasury:cashflow");
    case "treasury_work_cash_consumption":
      return withQueryDiagnostics(await queryTreasuryWorkCashConsumption(intent), text, intent, "queryTreasuryWorkCashConsumption", "treasury:work_cash");
    case "treasury_break_even":
      return withQueryDiagnostics(await queryTreasuryBreakEven(intent), text, intent, "queryTreasuryBreakEven", "treasury:break_even");
    case "treasury_coverage":
      return withQueryDiagnostics(await queryTreasuryCoverage(intent), text, intent, "queryTreasuryCoverage", "treasury:coverage");
    case "treasury_scenario_conservative":
      return withQueryDiagnostics(await queryTreasuryScenario(intent, "conservative"), text, intent, "queryTreasuryScenario/conservative", "treasury:scenario");
    case "treasury_scenario_compare":
      return withQueryDiagnostics(await queryTreasuryScenarioCompare(intent), text, intent, "queryTreasuryScenarioCompare", "treasury:scenario_compare");
    case "treasury_review":
      return withQueryDiagnostics(await queryTreasuryReview(intent), text, intent, "queryTreasuryReview", "treasury:alerts");
    case "signals_review_today":
      return withQueryDiagnostics(await queryBusinessSignals(intent, "review_today"), text, intent, "queryBusinessSignals/review_today", "business_signals:active_priority");
    case "signals_urgent":
      return withQueryDiagnostics(await queryBusinessSignals(intent, "urgent"), text, intent, "queryBusinessSignals/urgent", "business_signals:urgent");
    case "signals_problems":
      return withQueryDiagnostics(await queryBusinessSignals(intent, "problems"), text, intent, "queryBusinessSignals/problems", "business_signals:problems");
    case "signals_risks":
      return withQueryDiagnostics(await queryBusinessSignals(intent, "risks"), text, intent, "queryBusinessSignals/risks", "business_signals:risks");
    case "signals_client_attention":
      return withQueryDiagnostics(await queryBusinessSignals(intent, "clients"), text, intent, "queryBusinessSignals/clients", "business_signals:clients");
    case "signals_work_attention":
      return withQueryDiagnostics(await queryBusinessSignals(intent, "works"), text, intent, "queryBusinessSignals/works", "business_signals:works");
    case "signals_priority_invoices":
      return withQueryDiagnostics(await queryBusinessSignals(intent, "invoices"), text, intent, "queryBusinessSignals/invoices", "business_signals:invoices");
    case "signals_explain_alert":
      return withQueryDiagnostics(await queryBusinessSignals(intent, "explain_top"), text, intent, "queryBusinessSignals/explain_top", "business_signals:explanation");
    case "signals_critical_count":
      return withQueryDiagnostics(await queryBusinessSignals(intent, "critical_count"), text, intent, "queryBusinessSignals/critical_count", "business_signals:critical_count");
    case "recommendations_today":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "today", context), text, intent, "queryBusinessRecommendations/today", "recommendations:active_priority");
    case "recommendations_first":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "first", context), text, intent, "queryBusinessRecommendations/first", "recommendations:first");
    case "recommendations_quick_wins":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "quick_wins", context), text, intent, "queryBusinessRecommendations/quick_wins", "recommendations:quick_wins");
    case "recommendations_important":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "important", context), text, intent, "queryBusinessRecommendations/important", "recommendations:important");
    case "recommendations_client":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "client", context), text, intent, "queryBusinessRecommendations/client", "recommendations:client");
    case "recommendations_work":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "work", context), text, intent, "queryBusinessRecommendations/work", "recommendations:work");
    case "recommendations_explain_current":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "explain_current", context), text, intent, "queryBusinessRecommendations/explain_current", "recommendations:explanation");
    case "recommendations_do_current":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "do_current", context), text, intent, "queryBusinessRecommendations/do_current", "recommendations:confirm");
    case "recommendations_snooze_current":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "snooze_current", context), text, intent, "queryBusinessRecommendations/snooze_current", "recommendations:snooze");
    case "recommendations_dismiss_current":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "dismiss_current", context), text, intent, "queryBusinessRecommendations/dismiss_current", "recommendations:dismiss");
    case "recommendations_change_date_current":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "change_date_current", context), text, intent, "queryBusinessRecommendations/change_date_current", "recommendations:change_date");
    case "recommendations_reviewed_at":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "reviewed_at", context), text, intent, "queryBusinessRecommendations/reviewed_at", "recommendations:reviewed_at");
    case "recommendations_reactivated":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "reactivated", context), text, intent, "queryBusinessRecommendations/reactivated", "recommendations:reactivated");
    case "recommendations_resolved_week":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "resolved_week", context), text, intent, "queryBusinessRecommendations/resolved_week", "recommendations:resolved_week");
    case "recommendations_snoozed":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "snoozed", context), text, intent, "queryBusinessRecommendations/snoozed", "recommendations:snoozed");
    case "recommendations_due_today":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "due_today", context), text, intent, "queryBusinessRecommendations/due_today", "recommendations:due_today");
    case "recommendations_history":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "history", context), text, intent, "queryBusinessRecommendations/history", "recommendations:history");
    case "recommendations_noisy_rules":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "noisy_rules", context), text, intent, "queryBusinessRecommendations/noisy_rules", "recommendations:noisy_rules");
    case "recommendations_mark_reviewed":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "mark_reviewed_current", context), text, intent, "queryBusinessRecommendations/mark_reviewed_current", "recommendations:mark_reviewed");
    case "recommendations_reactivate_current":
      return withQueryDiagnostics(await queryBusinessRecommendations(intent, "reactivate_current", context), text, intent, "queryBusinessRecommendations/reactivate_current", "recommendations:reactivate");
    case "active_projects":
      return withQueryDiagnostics(await queryPendingTaskDetails("active_projects", context), text, intent, "queryPendingTaskDetails", "work.findMany:active");
    case "paused_projects":
      return withQueryDiagnostics(await queryWorksByStatus(["pausada", "parada"], "obras paradas"), text, intent, "queryWorksByStatus/paused", "work.findMany:paused");
    case "work_highest_revenue":
      return withQueryDiagnostics(await queryWorkHighestRevenue(intent), text, intent, "queryWorkHighestRevenue", "work.findMany+invoices:highest_revenue");
    case "work_lowest_margin":
      return withQueryDiagnostics(await queryWorkLowestMargin(intent), text, intent, "queryWorkLowestMargin", "work.findMany+financials:lowest_margin");
    case "works_starting_this_week":
      return withQueryDiagnostics(await queryWorksStartingThisWeek(), text, intent, "queryWorksStartingThisWeek", "work.findMany:fechaInicioPrevista_this_week");
    case "works_ending_today":
      return withQueryDiagnostics(await queryWorksEndingToday(), text, intent, "queryWorksEndingToday", "work.findMany:fechaFinPrevista_today");
    case "client_contacts":
      return withQueryDiagnostics(await queryClientContacts(intent), text, intent, "queryClientContacts", "contact.findMany:client");
    case "work_documents":
      return withQueryDiagnostics(await queryWorkDocuments(intent), text, intent, "queryWorkDocuments", "document+pdfs:work");
    case "internal_notes":
      return withQueryDiagnostics(await queryInternalNotes(intent), text, intent, "queryInternalNotes", "internalNote.findMany:entity");
    case "agenda_today":
      return withQueryDiagnostics(await queryAgendaToday(), text, intent, "queryAgendaToday", "agenda:today");
    case "upcoming_visits":
      return withQueryDiagnostics(await queryUpcomingVisits(), text, intent, "queryUpcomingVisits", "agenda:upcoming_visits");
    case "pending_reminders_count":
      return withQueryDiagnostics(await queryPendingRemindersCount(), text, intent, "queryPendingRemindersCount", "reminder.count:open");
    case "pending_notifications":
      return withQueryDiagnostics(await queryPendingNotifications(), text, intent, "queryPendingNotifications", "notifications:unread");
    case "client_budgets":
      return withQueryDiagnostics(await queryClientBudgets(intent), text, intent, "queryClientBudgets", "budget.findMany:client");
    case "client_payments":
      return withQueryDiagnostics(await queryClientPayments(intent), text, intent, "queryClientPayments", "payment.findMany:client");
    case "clients_missing_tax_id":
      return withQueryDiagnostics(await queryPendingTaskDetails("clients_incomplete", context), text, intent, "queryPendingTaskDetails", "client.findMany:incomplete");
    case "project_highest_expenses":
      return withQueryDiagnostics(await queryProjectHighestExpenses(intent), text, intent, "queryProjectHighestExpenses", "expense.findMany:group_by_work");
    case "recent_documents":
      return withQueryDiagnostics(await queryRecentDocuments(intent), text, intent, "queryRecentDocuments", "budget+invoice.findMany:recent");
    default:
      return {
        handled: true,
        context,
        diagnostics: {
          normalizedText: normalizeQueryText(text),
          intentKind: intent.kind,
          action: intent.action,
          confidence: intent.confidence,
          rule: intent.rule,
          handler: "answerDatabaseQuery/default",
          noMutation: true
        },
        text: "Puedo consultar presupuestos, facturas, cobros, gastos, obras, clientes y pendientes. Dime qué dato quieres ver."
      };
  }
}

async function runExplicitWorkflowMutation(text:string,normalized:string,context:ChatCommandContext|null):Promise<ChatCommandResult|null>{
  const shownAt=new Date().toISOString();
  if(/^(crea|crear) una tarea\b/.test(normalized)){const title=text.replace(/^.*?tarea\s+(para\s+)?/i,"").trim();if(!title)return null;const dueAt=/mañana|manana/.test(normalized)?tomorrowAt(10):undefined;const task=await createTask({title,dueAt,origin:"chat",clientId:context?.lastClientId,workId:context?.lastWorkId,budgetId:context?.lastBudgetId,invoiceId:context?.lastInvoiceId});return mutationResult(`He creado la tarea “${task.title}”.`,context,"task",task.id,"Tarea creada","/tareas",{lastTask:{taskId:task.id,action:"created",shownAt}})}
  if(/^(crea|crear) un seguimiento\b/.test(normalized)){const title=text.replace(/^.*?seguimiento\s+(para\s+)?/i,"").trim();if(!title)return null;const days=Number(normalized.match(/en (\d+) dias?/)?.[1]??0);const nextActionAt=days?new Date(Date.now()+days*86400000):undefined;const item=await createFollowUp({title,nextActionAt,origin:"chat",clientId:context?.lastClientId,workId:context?.lastWorkId,budgetId:context?.lastBudgetId,invoiceId:context?.lastInvoiceId});return mutationResult(`He creado el seguimiento “${item.title}”.`,context,"followup",item.id,"Seguimiento creado","/seguimientos",{lastFollowUp:{followUpId:item.id,action:"created",shownAt}})}
  if(/^(anota|registra) que no respondio/.test(normalized)){if(!context?.lastFollowUp)return clarification("¿En qué seguimiento debo registrar que no respondió?",context);const attempt=await addFollowUpAttempt(context.lastFollowUp.followUpId,{channel:"internal",summary:"No respondió",nextActionAt:new Date(Date.now()+3*86400000)});return mutationResult("He registrado el intento interno. No se ha enviado ninguna comunicación.",context,"followup",context.lastFollowUp.followUpId,"Intento registrado","/seguimientos",{lastFollowUp:{...context.lastFollowUp,attemptId:attempt.id,action:"attempt",shownAt}})}
  if(/(marca|completa|complétala|completala).*tarea|^completala$/.test(normalized)){if(!context?.lastTask)return clarification("¿Qué tarea quieres completar?",context);await changeTaskStatus(context.lastTask.taskId,"completed","chat","Orden explícita desde chat");return mutationResult("He completado la tarea indicada.",context,"task",context.lastTask.taskId,"Tarea completada","/tareas",{lastTask:{...context.lastTask,action:"completed",shownAt}})}
  if(/^(pausala|páusala|pausa esta automatizacion|pausa esta automatización)$/.test(normalized)){if(!context?.lastAutomation)return clarification("¿Qué automatización quieres pausar?",context);await prisma.automationDefinition.update({where:{id:context.lastAutomation.automationId},data:{active:false,status:"paused"}});return mutationResult("He pausado la automatización.",context,"automation",context.lastAutomation.automationId,"Automatización pausada","/automatizaciones",{lastAutomation:{...context.lastAutomation,action:"paused",shownAt}})}
  if(/^(reanúdala|reanudala|reanuda esta automatizacion|reanuda esta automatización)$/.test(normalized)){if(!context?.lastAutomation)return clarification("¿Qué automatización quieres reanudar?",context);await prisma.automationDefinition.update({where:{id:context.lastAutomation.automationId},data:{active:true,status:"active"}});return mutationResult("He reanudado la automatización.",context,"automation",context.lastAutomation.automationId,"Automatización activa","/automatizaciones",{lastAutomation:{...context.lastAutomation,action:"resumed",shownAt}})}
  if(/^(ejecutala en seco|ejecútala en seco)$/.test(normalized)){if(!context?.lastAutomation)return clarification("¿Qué automatización quieres ejecutar en seco?",context);const {runAutomation}=await import("@/lib/automations/automation-runner");const run=await runAutomation({definitionId:context.lastAutomation.automationId,idempotencyKey:`chat:dry-run:${context.lastAutomation.automationId}:${Date.now()}`,triggerType:"manual",triggeredBy:"chat",dryRun:true});return mutationResult(`Dry run completado con estado ${run.status}.`,context,"automation",run.automationDefinitionId,"Dry run","/automatizaciones",{lastAutomation:{automationId:run.automationDefinitionId,versionId:run.automationVersionId,runId:run.id,action:"dry_run",shownAt}})}
  return null;
}
const tomorrowAt=(hour:number)=>{const date=new Date();date.setDate(date.getDate()+1);date.setHours(hour,0,0,0);return date};
function clarification(text:string,context:ChatCommandContext|null):ChatCommandResult{return{handled:true,context,text}}
function mutationResult(text:string,context:ChatCommandContext|null,entityType:"task"|"followup"|"automation",entityId:string,title:string,href:string,extra:Partial<ChatCommandContext>):ChatCommandResult{return{handled:true,context:{...(context??{}),...extra},text,result:{type:"created",entityType,entityId,title,summary:{ok:true},actions:[{label:"Abrir",href}]}}}

async function queryAutomations(action: string, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  const now=new Date();
  if(action==="automations_failed"){const runs=await prisma.automationRun.findMany({where:{status:"failed"},include:{definition:true},orderBy:{startedAt:"desc"},take:5});return queryResult(runs.length?`${runs.length} ejecuciones fallidas:\n${runs.map(r=>`- ${r.definition.name}: ${r.errorSummary??r.lastErrorSummary??"falló"}`).join("\n")}`:"No hay ejecuciones fallidas.",context,"automation",runs[0]?.automationDefinitionId,"Automatizaciones fallidas","/automatizaciones",runs.map(r=>r.id),runs[0]?{lastAutomation:{automationId:runs[0].automationDefinitionId,versionId:runs[0].automationVersionId,runId:runs[0].id,action:"failed",shownAt:now.toISOString()}}:{});}
  if(action==="automations_last_run"){const run=await prisma.automationRun.findFirst({include:{definition:true,steps:true},orderBy:{startedAt:"desc"}});return queryResult(run?`${run.definition.name}: ${run.status}; ${run.steps.filter(s=>s.status==="completed").length}/${run.steps.length} pasos completados.`:"Todavía no hay ejecuciones.",context,"automation",run?.automationDefinitionId,"Última ejecución","/automatizaciones",run?[run.id]:[],run?{lastAutomation:{automationId:run.automationDefinitionId,versionId:run.automationVersionId,runId:run.id,action:"shown",shownAt:now.toISOString()}}:{});}
  if(action==="automations_next"){const schedule=await prisma.automationSchedule.findFirst({where:{active:true,nextRunAt:{gte:now}},include:{definition:true},orderBy:{nextRunAt:"asc"}});return queryResult(schedule?`${schedule.definition.name} se ejecutará ${schedule.nextRunAt?.toLocaleString("es-ES")}.`:"No hay una próxima automatización programada.",context,"automation",schedule?.automationDefinitionId,"Próxima automatización","/automatizaciones",schedule?[schedule.id]:[],{});}
  const status=action==="automations_active"?{active:true}:action==="automations_paused"?{status:"paused" as const}:{};const items=await prisma.automationDefinition.findMany({where:{...status,archivedAt:null},orderBy:{updatedAt:"desc"},take:10});return queryResult(items.length?`${items.length} automatizaciones:\n${items.map(i=>`- ${i.name} · ${i.status}`).join("\n")}`:"No hay automatizaciones con ese estado.",context,"automation",items[0]?.id,"Automatizaciones","/automatizaciones",items.map(i=>i.id),items[0]?{lastAutomation:{automationId:items[0].id,versionId:items[0].currentVersionId??undefined,action:"shown",shownAt:now.toISOString()}}:{});
}
async function queryProfessionalTasks(action:string,context:ChatCommandContext|null):Promise<ChatCommandResult>{const now=new Date(),start=new Date(now),end=new Date(now);start.setHours(0,0,0,0);end.setHours(23,59,59,999);let date:Record<string,unknown>={};if(action==="tasks_today")date={dueAt:{gte:start,lte:end}};if(action==="tasks_overdue")date={dueAt:{lt:start}};if(action==="tasks_week")date={dueAt:{gte:start,lte:new Date(start.getTime()+7*86400000)}};const items=await prisma.task.findMany({where:{...date,status:action==="tasks_blocked"?"blocked":{notIn:["completed","cancelled","archived"]},archivedAt:null},orderBy:{dueAt:"asc"},take:action==="tasks_next"?1:10});return queryResult(items.length?`${items.length} tareas:\n${items.map(i=>`- ${i.title}${i.dueAt?` · ${i.dueAt.toLocaleString("es-ES")}`:""} · ${i.status}`).join("\n")}`:"No hay tareas con ese filtro.",context,"task",items[0]?.id,"Tareas","/tareas",items.map(i=>i.id),items[0]?{lastTask:{taskId:items[0].id,action:"shown",shownAt:now.toISOString()}}:{});}
async function queryProfessionalFollowUps(action:string,context:ChatCommandContext|null):Promise<ChatCommandResult>{const now=new Date();const where:Record<string,unknown>={archivedAt:null};if(action==="followups_overdue")where.nextActionAt={lt:now};else if(action==="followups_budget")where.budgetId={not:null};else if(action==="followups_invoice")where.invoiceId={not:null};else if(action==="followups_success")where.status="completed";else where.status={notIn:["completed","cancelled","archived"]};const items=await prisma.followUp.findMany({where,include:{attempts:{orderBy:{attemptedAt:"desc"},take:1}},orderBy:{nextActionAt:"asc"},take:action==="followups_next"?1:10});return queryResult(items.length?`${items.length} seguimientos:\n${items.map(i=>`- ${i.title}${i.nextActionAt?` · ${i.nextActionAt.toLocaleString("es-ES")}`:""} · ${i.status}`).join("\n")}`:"No hay seguimientos con ese filtro.",context,"followup",items[0]?.id,"Seguimientos","/seguimientos",items.map(i=>i.id),items[0]?{lastFollowUp:{followUpId:items[0].id,attemptId:items[0].attempts[0]?.id,action:"shown",shownAt:now.toISOString()}}:{});}
function queryResult(text:string,context:ChatCommandContext|null,entityType:"task"|"followup"|"automation",entityId:string|undefined,title:string,href:string,resultIds:string[],extra:Partial<ChatCommandContext>):ChatCommandResult{return{handled:true,context:{...(context??{}),...extra,lastQuery:{type:entityType,resultIds,timestamp:new Date().toISOString()}},text,result:{type:"found",entityType,entityId,title,summary:{count:resultIds.length},actions:[{label:"Abrir",href}]}}}

function withQueryDiagnostics(result: ChatCommandResult, text: string, intent: ChatIntentClassification, handler: string, query: string): ChatCommandResult {
  return {
    ...result,
    diagnostics: {
      normalizedText: normalizeQueryText(text),
      intentKind: intent.kind,
      action: intent.action,
      confidence: intent.confidence,
      rule: intent.rule,
      handler,
      query,
      noMutation: true,
      resultCount: result.diagnostics?.resultCount,
      responseLength: result.text.length
    }
  };
}

function handlerNameForIntent(intent: ChatIntentClassification) {
  if (intent.kind === "pending_summary") return "queryPendingTasksSummary";
  if (intent.kind === "pending_details") return "queryPendingTaskDetails";
  if (intent.action === "highest_budget") return "queryBudgetByAmount/highest";
  if (intent.action === "lowest_budget") return "queryBudgetByAmount/lowest";
  if (intent.action === "budget_by_amount") return "queryBudgetByExactAmount";
  if (intent.action === "outstanding_invoices") return "queryBusinessMetric/outstanding";
  if (intent.action === "client_highest_debt") return "queryBusinessClientHighestDebt";
  if (intent.action === "business_health") return "queryBusinessHealth";
  if (intent.action === "business_collected") return "queryBusinessMetric/collected";
  if (intent.action === "business_outstanding") return "queryBusinessMetric/outstanding";
  if (intent.action === "business_overdue") return "queryBusinessMetric/overdue";
  if (intent.action === "business_profit") return "queryBusinessProfit";
  if (intent.action === "business_margin") return "queryBusinessMargin";
  if (intent.action === "business_best_work") return "queryBusinessBestWork";
  if (intent.action === "business_slowest_client") return "queryBusinessSlowestClient";
  if (intent.action === "business_quote_conversion") return "queryBusinessQuoteConversion";
  if (intent.action === "business_compare_periods") return "queryBusinessComparison";
  if (intent.action === "business_review_today") return "queryBusinessReviewToday";
  if (intent.action?.startsWith("signals_")) return `queryBusinessSignals/${intent.action}`;
  if (intent.action?.startsWith("treasury_")) return `queryTreasury/${intent.action}`;
  if (intent.action === "work_highest_revenue") return "queryWorkHighestRevenue";
  if (intent.action === "work_lowest_margin") return "queryWorkLowestMargin";
  if (intent.action === "paused_projects") return "queryWorksByStatus/paused";
  if (intent.action === "works_starting_this_week") return "queryWorksStartingThisWeek";
  if (intent.action === "works_ending_today") return "queryWorksEndingToday";
  if (intent.action === "client_contacts") return "queryClientContacts";
  if (intent.action === "work_documents") return "queryWorkDocuments";
  if (intent.action === "internal_notes") return "queryInternalNotes";
  if (intent.action === "agenda_today") return "queryAgendaToday";
  if (intent.action === "upcoming_visits") return "queryUpcomingVisits";
  if (intent.action === "pending_reminders_count") return "queryPendingRemindersCount";
  if (intent.action === "pending_notifications") return "queryPendingNotifications";
  return intent.action ?? intent.kind;
}

function isPendingDetailFollowUp(normalized: string) {
  return /^(dimelos|dimelas|dime cuales|cuales son|detallame|detalle|ver todos|muestrame|ensename|dime los pendientes|dime las pendientes)$/.test(normalized);
}

function isPendingDetailCategory(value: unknown): value is PendingDetailCategory {
  return typeof value === "string" && [
    "budgets",
    "budgets_to_send",
    "budgets_to_accept",
    "invoices",
    "overdue_invoices",
    "partial_payments",
    "visits",
    "visits_to_confirm",
    "followups",
    "reminders",
    "clients_incomplete",
    "active_projects",
    "documents"
  ].includes(value);
}

async function queryPendingTasksSummary(context: ChatCommandContext | null): Promise<ChatCommandResult> {
  const counts = await queryPendingTasksCounts();
  const rows = pendingSummaryRows(counts);
  const firstCategory = rows[0]?.category;
  const nextContext = withLastQuery(context, {
    type: "pending_summary",
    category: firstCategory,
    filters: { categories: rows.map((row) => row.category), counts },
    resultIds: [],
    handler: "queryPendingTasksSummary",
    timestamp: new Date().toISOString()
  });

  if (!rows.length) {
    return {
      handled: true,
      context: nextContext,
      diagnostics: { resultCount: 0 },
      text: "No tienes tareas pendientes ahora mismo."
    };
  }

  return {
    handled: true,
    context: nextContext,
    diagnostics: { resultCount: rows.length },
    text: `Tienes:\n\n${rows.map(({ label, count }) => `- ${count} ${pendingCountLabel(label, count)}.`).join("\n")}\n\n¿Quieres que te detalle alguna categoría?`
  };
}

async function queryPendingTasksCounts() {
  const today = startOfDay(new Date());
  const invoiceBalances = await findOpenInvoiceBalances();
  const [
    pendingBudgets,
    budgetsToSend,
    budgetsToAccept,
    pendingVisits,
    visitsToConfirm,
    pendingFollowups,
    pendingReminders,
    clients,
    activeProjects,
    incompleteDocuments
  ] = await Promise.all([
    prisma.budget.count({ where: { estado: { in: ["borrador", "pendiente_revision", "pendiente_respuesta", "enviado", "visto"] } } }),
    prisma.budget.count({ where: { estado: { in: ["borrador", "pendiente_revision"] } } }),
    prisma.budget.count({ where: { estado: { in: ["pendiente_respuesta", "enviado", "visto"] } } }),
    prisma.eventoAgenda.count({ where: { tipo: "visita", estado: { in: ["pendiente", "confirmado"] } } }),
    prisma.eventoAgenda.count({ where: { tipo: "visita", estado: "pendiente", requiereConfirmacion: true } }),
    prisma.reminder.count({ where: { tipo: { in: ["seguimiento_presupuesto", "recordatorio_factura", "confirmar_visita"] }, estado: { in: ["borrador", "pendiente_confirmacion", "programado"] } } }),
    prisma.reminder.count({ where: { estado: { in: ["borrador", "pendiente_confirmacion", "programado"] } } }),
    prisma.client.findMany({ select: { telefono: true, email: true, direccion: true, estado: true, notas: true } }),
    prisma.work.count({ where: { estado: { in: ACTIVE_WORK_STATUSES as any[] } } }),
    prisma.budget.count({ where: { estado: { in: ["borrador", "pendiente_revision"] } } })
  ]);

  return {
    pendingBudgets,
    budgetsToSend,
    budgetsToAccept,
    pendingInvoices: invoiceBalances.length,
    overdueInvoices: invoiceBalances.filter(({ invoice }) => invoice.estado === "vencida" || invoice.fechaVencimiento < today).length,
    partialPayments: invoiceBalances.filter(({ paid }) => paid > 0).length,
    pendingVisits,
    visitsToConfirm,
    pendingFollowups,
    pendingReminders,
    incompleteClients: clients.filter(clientLooksIncomplete).length,
    activeProjects,
    incompleteDocuments
  };
}

function pendingSummaryRows(counts: Awaited<ReturnType<typeof queryPendingTasksCounts>>) {
  return [
    { label: "Presupuestos pendientes", count: counts.pendingBudgets, category: "budgets" as PendingDetailCategory },
    { label: "Presupuestos pendientes de enviar", count: counts.budgetsToSend, category: "budgets_to_send" as PendingDetailCategory },
    { label: "Presupuestos pendientes de aceptar", count: counts.budgetsToAccept, category: "budgets_to_accept" as PendingDetailCategory },
    { label: "Facturas pendientes de cobro", count: counts.pendingInvoices, category: "invoices" as PendingDetailCategory },
    { label: "Facturas vencidas", count: counts.overdueInvoices, category: "overdue_invoices" as PendingDetailCategory },
    { label: "Pagos parciales", count: counts.partialPayments, category: "partial_payments" as PendingDetailCategory },
    { label: "Visitas pendientes", count: counts.pendingVisits, category: "visits" as PendingDetailCategory },
    { label: "Visitas por confirmar", count: counts.visitsToConfirm, category: "visits_to_confirm" as PendingDetailCategory },
    { label: "Seguimientos pendientes", count: counts.pendingFollowups, category: "followups" as PendingDetailCategory },
    { label: "Recordatorios pendientes", count: counts.pendingReminders, category: "reminders" as PendingDetailCategory },
    { label: "Clientes con datos incompletos", count: counts.incompleteClients, category: "clients_incomplete" as PendingDetailCategory },
    { label: "Obras activas con tareas pendientes", count: counts.activeProjects, category: "active_projects" as PendingDetailCategory },
    { label: "Documentos pendientes de completar", count: counts.incompleteDocuments, category: "documents" as PendingDetailCategory }
  ].filter((row) => row.count > 0);
}

function withLastQuery(context: ChatCommandContext | null, lastQuery: NonNullable<ChatCommandContext["lastQuery"]>): ChatCommandContext {
  return {
    ...(context ?? {}),
    lastQuery
  };
}

async function queryPendingTaskDetails(category: PendingDetailCategory | undefined, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  category = category ?? (isPendingDetailCategory(context?.lastQuery?.category) ? context.lastQuery.category : undefined);
  if (!category) {
    return {
      handled: true,
      context,
      diagnostics: { resultCount: 0 },
      text: "Dime qué categoría quieres detallar: presupuestos, facturas, visitas, seguimientos, recordatorios, clientes, obras o documentos."
    };
  }

  const today = startOfDay(new Date());
  if (category === "budgets" || category === "budgets_to_send" || category === "budgets_to_accept" || category === "documents") {
    const states = category === "budgets_to_send"
      ? (["borrador", "pendiente_revision"] as const)
      : category === "budgets_to_accept"
        ? (["pendiente_respuesta", "enviado", "visto"] as const)
        : (["borrador", "pendiente_revision", "pendiente_respuesta", "enviado", "visto"] as const);
    const budgets = await prisma.budget.findMany({
      where: { estado: { in: [...states] } },
      orderBy: { fechaCreacion: "desc" },
      take: 10,
      include: { client: true, work: true }
    });
    return compactListResult(budgets, "presupuestos pendientes", (budget) => `${budget.numero} · ${budget.client.nombre} · ${formatEuros(budget.total)} · ${budget.estado} · /presupuestos/${budget.id}`, {
      context: withPendingDetailLastQuery(context, category, budgets.map((budget) => budget.id)),
      resultCount: budgets.length
    });
  }

  if (category === "invoices" || category === "overdue_invoices" || category === "partial_payments") {
    const balances = (await findOpenInvoiceBalances())
      .filter(({ invoice, paid }) => {
        if (category === "overdue_invoices") return invoice.estado === "vencida" || invoice.fechaVencimiento < today;
        if (category === "partial_payments") return paid > 0;
        return true;
      })
      .sort((a, b) => a.invoice.fechaVencimiento.getTime() - b.invoice.fechaVencimiento.getTime())
      .slice(0, 10);
    return compactListResult(balances, "facturas", ({ invoice, pending }) => `${invoice.numero} · ${invoice.client.nombre} · pendiente ${formatEuros(pending)} · vence ${formatDateShort(invoice.fechaVencimiento)} · /dinero/${invoice.id}`, {
      context: withPendingDetailLastQuery(context, category, balances.map(({ invoice }) => invoice.id)),
      resultCount: balances.length
    });
  }

  if (category === "visits" || category === "visits_to_confirm") {
    const visits = await prisma.eventoAgenda.findMany({
      where: category === "visits_to_confirm"
        ? { tipo: "visita", estado: "pendiente", requiereConfirmacion: true }
        : { tipo: "visita", estado: { in: ["pendiente", "confirmado"] } },
      orderBy: { fechaInicio: "asc" },
      take: 10,
      include: { client: true, work: true }
    });
    return compactListResult(visits, "visitas", (visit) => `${formatDateShort(visit.fechaInicio)} ${visit.horaInicio ?? ""} · ${visit.client?.nombre ?? "Sin cliente"} · ${visit.titulo} · /agenda`, {
      context: withPendingDetailLastQuery(context, category, visits.map((visit) => visit.id)),
      resultCount: visits.length
    });
  }

  if (category === "followups" || category === "reminders") {
    const reminders = await prisma.reminder.findMany({
      where: category === "followups"
        ? { tipo: { in: ["seguimiento_presupuesto", "recordatorio_factura", "confirmar_visita"] }, estado: { in: ["borrador", "pendiente_confirmacion", "programado"] } }
        : { estado: { in: ["borrador", "pendiente_confirmacion", "programado"] } },
      orderBy: { fechaProgramada: "asc" },
      take: 10,
      include: { client: true, work: true }
    });
    return compactListResult(reminders, category === "followups" ? "seguimientos" : "recordatorios", (reminder) => `${formatDateShort(reminder.fechaProgramada)} · ${reminder.client?.nombre ?? "Sin cliente"} · ${reminder.tipo.replaceAll("_", " ")} · ${reminder.estado} · /recordatorios`, {
      context: withPendingDetailLastQuery(context, category, reminders.map((reminder) => reminder.id)),
      resultCount: reminders.length
    });
  }

  if (category === "clients_incomplete") {
    const clients = (await prisma.client.findMany({ orderBy: { fechaCreacion: "desc" }, take: 60 })).filter(clientLooksIncomplete).slice(0, 10);
    return compactListResult(clients, "clientes con datos incompletos", (client) => `${client.nombre} · ${client.estado} · /clientes/${client.id}`, {
      context: withPendingDetailLastQuery(context, category, clients.map((client) => client.id)),
      resultCount: clients.length
    });
  }

  const works = await prisma.work.findMany({
    where: { estado: { in: ACTIVE_WORK_STATUSES as any[] } },
    orderBy: { fechaInicio: "desc" },
    take: 10,
    include: { client: true }
  });
  return compactListResult(works, "obras activas", (work) => `${work.titulo} · ${work.client.nombre} · ${work.estado} · /obras`, {
    context: withPendingDetailLastQuery(context, category, works.map((work) => work.id)),
    resultCount: works.length
  });
}

async function queryBudgetByAmount(direction: "asc" | "desc", intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const client = await clientForQuery(intent.clientName);
  if (intent.clientName && !client) return noClientResult(intent.clientName);
  const budget = await prisma.budget.findFirst({
    where: { ...budgetPeriodWhere(intent.period), ...(client ? { clienteId: client.id } : {}) },
    orderBy: { total: direction },
    include: { client: true, work: true }
  });
  if (!budget) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay presupuestos registrados todavía." };
  const label = direction === "desc" ? "más alto" : "más bajo";
  return {
    handled: true,
    diagnostics: { resultCount: 1 },
    context: latestDocumentContext("budget", budget.id, budget.clienteId, budget.obraId ?? undefined, budget.client.nombre),
    result: budgetQueryCard(`Presupuesto ${label}`, budget),
    text: `El presupuesto ${label} es el ${budget.numero}, por ${formatEuros(budget.total)}, para ${budget.client.nombre}.\n\n¿Quieres que te muestre los cinco presupuestos ${direction === "desc" ? "más altos" : "más bajos"}?`
  };
}

async function queryBudgetByExactAmount(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  if (typeof intent.amount !== "number" || !Number.isFinite(intent.amount)) {
    return { handled: true, diagnostics: { resultCount: 0 }, text: "Dime el importe del presupuesto que quieres consultar. No he creado ni modificado nada." };
  }
  const budgets = await prisma.budget.findMany({
    where: { ...budgetPeriodWhere(intent.period), total: { gte: intent.amount - 0.01, lte: intent.amount + 0.01 } },
    orderBy: { fechaCreacion: "desc" },
    take: 5,
    include: { client: true, work: true }
  });
  if (!budgets.length) {
    return {
      handled: true,
      diagnostics: { resultCount: 0 },
      text: `No encuentro ningún presupuesto por ${formatEuros(intent.amount)}. No he creado ni modificado ningún presupuesto.`
    };
  }
  if (budgets.length === 1) {
    const budget = budgets[0];
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      context: latestDocumentContext("budget", budget.id, budget.clienteId, budget.obraId ?? undefined, budget.client.nombre),
      result: budgetQueryCard("Presupuesto encontrado", budget),
      text: `He encontrado el presupuesto ${budget.numero}, por ${formatEuros(budget.total)}, para ${budget.client.nombre}.`
    };
  }
  return compactListResult(budgets, `presupuestos por ${formatEuros(intent.amount)}`, (budget) => `${budget.numero} · ${budget.client.nombre} · ${budget.estado} · /presupuestos/${budget.id}`, {
    resultCount: budgets.length
  });
}

async function queryLatestBudget(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const client = await clientForQuery(intent.clientName);
  if (intent.clientName && !client) return noClientResult(intent.clientName);
  const budget = await prisma.budget.findFirst({
    where: { ...budgetPeriodWhere(intent.period), ...(client ? { clienteId: client.id } : {}) },
    orderBy: { fechaCreacion: "desc" },
    include: { client: true, work: true }
  });
  if (!budget) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay presupuestos registrados todavía." };
  return {
    handled: true,
    diagnostics: { resultCount: 1 },
    context: latestDocumentContext("budget", budget.id, budget.clienteId, budget.obraId ?? undefined, budget.client.nombre),
    result: budgetQueryCard("Último presupuesto", budget),
    text: `El último presupuesto es el ${budget.numero}, de ${formatEuros(budget.total)}, para ${budget.client.nombre}.`
  };
}

async function queryInvoiceByAmount(direction: "asc" | "desc", intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const client = await clientForQuery(intent.clientName);
  if (intent.clientName && !client) return noClientResult(intent.clientName);
  const invoice = await prisma.invoice.findFirst({
    where: { ...invoicePeriodWhere(intent.period), ...(client ? { clienteId: client.id } : {}) },
    orderBy: { total: direction },
    include: { client: true, work: true }
  });
  if (!invoice) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay facturas registradas todavía." };
  const label = direction === "desc" ? "más grande" : "más baja";
  return {
    handled: true,
    diagnostics: { resultCount: 1 },
    context: latestDocumentContext("invoice", invoice.id, invoice.clienteId, invoice.obraId ?? undefined, invoice.client.nombre),
    result: invoiceQueryCard(`Factura ${label}`, invoice),
    text: `La factura ${label} es la ${invoice.numero}, por ${formatEuros(invoice.total)}, para ${invoice.client.nombre}.`
  };
}

async function queryOutstandingInvoices(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const client = await clientForQuery(intent.clientName);
  if (intent.clientName && !client) return noClientResult(intent.clientName);
  const balances = (await findOpenInvoiceBalances({ ...invoicePeriodWhere(intent.period), ...(client ? { clienteId: client.id } : {}) }))
    .sort((a, b) => b.pending - a.pending);
  const total = balances.reduce((sum, item) => sum + item.pending, 0);
  if (!balances.length) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay facturas pendientes de cobro." };
  const top = balances.slice(0, 5);
  return {
    handled: true,
    diagnostics: { resultCount: balances.length },
    text: `Tienes ${balances.length} facturas pendientes de cobro por ${formatEuros(total)} en total.\n\nLas 5 mayores son:\n${top.map(({ invoice, pending }, index) => `${index + 1}. ${invoice.numero} · ${invoice.client.nombre} · ${formatEuros(pending)} · /dinero/${invoice.id}`).join("\n")}`
  };
}

async function queryPendingInvoicesCount(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const count = (await findOpenInvoiceBalances(invoicePeriodWhere(intent.period))).length;
  return { handled: true, diagnostics: { resultCount: count }, text: count ? `Tienes ${count} facturas pendientes de cobro.` : "No hay facturas pendientes de cobro." };
}

async function queryPendingBudgetsCount(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const count = await prisma.budget.count({ where: { estado: { in: ["borrador", "pendiente_revision", "pendiente_respuesta", "enviado", "visto"] }, ...budgetPeriodWhere(intent.period) } });
  return { handled: true, diagnostics: { resultCount: count }, text: count ? `Tienes ${count} presupuestos pendientes.` : "No hay presupuestos pendientes." };
}

async function queryClientHighestDebt(context: ChatCommandContext | null): Promise<ChatCommandResult> {
  const balances = await findOpenInvoiceBalances();
  const totals = new Map<string, { name: string; total: number; clientId: string }>();
  for (const { invoice, pending } of balances) {
    const current = totals.get(invoice.clienteId) ?? { name: invoice.client.nombre, total: 0, clientId: invoice.clienteId };
    current.total += pending;
    totals.set(invoice.clienteId, current);
  }
  const top = [...totals.values()].sort((a, b) => b.total - a.total)[0];
  if (!top) return { handled: true, context, diagnostics: { resultCount: 0 }, text: "No hay clientes con deuda pendiente." };
  return {
    handled: true,
    context: withLastQuery(context, {
      type: "client_highest_debt",
      filters: {},
      resultIds: [top.clientId],
      handler: "queryClientHighestDebt",
      timestamp: new Date().toISOString()
    }),
    diagnostics: { resultCount: totals.size },
    result: {
      type: "found",
      entityType: "client",
      entityId: top.clientId,
      title: "Cliente con más pendiente",
      summary: { cliente: top.name, pendiente: top.total },
      actions: [{ label: "Ver cliente", href: `/clientes/${top.clientId}`, style: "primary" }, { label: "Ver facturas", href: "/dinero?filtro=pendientes" }]
    },
    text: `El cliente que más debe ahora mismo es ${top.name}, con ${formatEuros(top.total)} pendiente.`
  };
}

async function queryTreasuryStatus(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent);
  const forecast = summary.forecast.summary;
  return treasuryResult({
    title: "Estado de tesorería",
    text: `${treasuryIntro(summary)}

- Saldo registrado: ${summary.registeredBalance === null ? "sin cuentas configuradas" : formatEuros(summary.registeredBalance)}
- Cobros previstos: ${formatEuros(forecast.inflows)} (${formatEuros(forecast.confirmedInflows)} confirmados)
- Pagos previstos: ${formatEuros(forecast.outflows)}
- Flujo neto previsto: ${formatEuros(forecast.net)}
- Saldo final previsto: ${forecast.finalBalance === null ? "sin saldo calculable" : formatEuros(forecast.finalBalance)}
- Punto mínimo: ${forecast.minBalance === null ? "sin saldo calculable" : `${formatEuros(forecast.minBalance)}${forecast.minBalanceDate ? ` el ${formatDateShort(forecast.minBalanceDate)}` : ""}`}

No incluye movimientos bancarios no registrados.`,
    summary: { saldo: summary.registeredBalance, cobros_previstos: forecast.inflows, pagos_previstos: forecast.outflows, saldo_final: forecast.finalBalance },
    resultCount: summary.forecast.items.length
  });
}

async function queryTreasuryAvailableCash(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent);
  if (!summary.hasAccounts) {
    return treasuryResult({
      title: "Saldo no disponible",
      text: "No hay cuentas o cajas configuradas, así que Capataz no puede afirmar cuánto dinero disponible tienes. Configura una cuenta manual o caja en /tesoreria para empezar a controlar tesorería.",
      summary: { cuentas: 0 },
      resultCount: 0
    });
  }
  return treasuryResult({
    title: "Dinero disponible registrado",
    text: `Saldo de tesorería registrado: ${formatEuros(summary.registeredBalance ?? 0)}.

Este saldo sale de ${summary.accounts.length} cuentas/cajas activas. Si una cuenta tiene saldo manual, se usa ese saldo; si no, se usa saldo inicial más movimientos confirmados.

No es saldo bancario conectado: solo refleja datos registrados en Capataz.`,
    summary: { saldo_registrado: summary.registeredBalance, cuentas: summary.accounts.length },
    resultCount: summary.accounts.length
  });
}

async function queryTreasuryCollections(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, intent.period === "this_month" ? "month_end" : "7d");
  const collections = summary.receivables.filter((item) => item.effectiveDate).slice(0, 6);
  const total = summary.forecast.items.filter((item) => item.direction === "inflow" && !item.isTransfer).reduce((sum, item) => sum + item.amount, 0);
  return treasuryResult({
    title: "Cobros previstos",
    text: `${treasuryIntro(summary)}

Cobros previstos en el horizonte: ${formatEuros(total)}.

${collections.length ? collections.map((item, index) => `${index + 1}. ${formatDateShort(item.effectiveDate ?? item.date ?? new Date())} · ${item.clientName ?? "Cliente"} · ${item.title} · ${formatEuros(item.amount)}`).join("\n") : "No hay cobros previstos con fecha dentro del horizonte."}

Las facturas pendientes son previsiones de cobro, no dinero disponible.`,
    summary: { cobros_previstos: total },
    resultCount: collections.length
  });
}

async function queryTreasuryPayments(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, intent.period === "this_week" ? "7d" : "month_end");
  const payments = summary.payables.filter((item) => item.effectiveDate).slice(0, 6);
  const total = summary.forecast.items.filter((item) => item.direction === "outflow" && !item.isTransfer).reduce((sum, item) => sum + item.amount, 0);
  return treasuryResult({
    title: "Pagos previstos",
    text: `${treasuryIntro(summary)}

Pagos previstos en el horizonte: ${formatEuros(total)}.

${payments.length ? payments.map((item, index) => `${index + 1}. ${formatDateShort(item.effectiveDate ?? item.date ?? new Date())} · ${item.title} · ${formatEuros(item.amount)}`).join("\n") : "No hay pagos previstos con fecha dentro del horizonte."}

Los gastos pendientes sin fecha se muestran como sin fecha prevista y no se colocan artificialmente en el calendario.`,
    summary: { pagos_previstos: total, sin_fecha: summary.payablesSummary.unscheduledTotal },
    resultCount: payments.length
  });
}

async function queryTreasuryForecast(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, "30d");
  const forecast = summary.forecast.summary;
  return treasuryResult({
    title: "Forecast a 30 días",
    text: `${treasuryIntro(summary)}

- Saldo inicial: ${forecast.initialBalance === null ? "sin cuentas configuradas" : formatEuros(forecast.initialBalance)}
- Cobros previstos: ${formatEuros(forecast.inflows)}
- Pagos previstos: ${formatEuros(forecast.outflows)}
- Saldo final previsto: ${forecast.finalBalance === null ? "sin saldo calculable" : formatEuros(forecast.finalBalance)}
- Punto mínimo: ${forecast.minBalance === null ? "sin saldo calculable" : `${formatEuros(forecast.minBalance)}${forecast.minBalanceDate ? ` el ${formatDateShort(forecast.minBalanceDate)}` : ""}`}

Supuestos: facturas pendientes por vencimiento, gastos pendientes con fecha, recurrentes activos y previsiones manuales. No incluye bancos no conectados ni movimientos externos no registrados.`,
    summary: { saldo_final: forecast.finalBalance, punto_minimo: forecast.minBalance, necesidad_caja: forecast.cashNeed },
    resultCount: summary.forecast.items.length
  });
}

async function queryTreasuryMinimumBreach(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent);
  const date = summary.forecast.summary.minimumBreachDate;
  const text = date
    ? `Con los datos registrados, el saldo previsto cae por debajo del mínimo el ${formatDateShort(date)}. Necesidad estimada frente al mínimo: ${formatEuros(summary.forecast.summary.minimumCashNeed)}.`
    : summary.effectiveMinimumBalance === null
      ? "No hay saldo mínimo configurado. Puedes definir saldo mínimo, colchón y días de cobertura en /tesoreria."
      : "No se detecta incumplimiento del saldo mínimo dentro del horizonte seleccionado.";
  return treasuryResult({
    title: "Saldo mínimo",
    text: `${treasuryIntro(summary)}

${text}`,
    summary: { saldo_minimo: summary.effectiveMinimumBalance, fecha_incumplimiento: date ? formatDateShort(date) : null },
    resultCount: date ? 1 : 0
  });
}

async function queryTreasuryDueInvoices(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, "7d");
  const due = summary.receivables.filter((item) => item.effectiveDate).slice(0, 8);
  return treasuryResult({
    title: "Facturas que vencen",
    text: `${treasuryIntro(summary)}

${due.length ? due.map((item, index) => `${index + 1}. ${formatDateShort(item.effectiveDate ?? item.date ?? new Date())} · ${item.clientName ?? "Cliente"} · ${item.title} · ${formatEuros(item.amount)}`).join("\n") : "No hay facturas pendientes con vencimiento dentro del horizonte."}`,
    summary: { facturas: due.length, importe: due.reduce((sum, item) => sum + item.amount, 0) },
    resultCount: due.length
  });
}

async function queryTreasuryCashflow(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, "month_end");
  const forecast = summary.forecast.summary;
  return treasuryResult({
    title: "Flujo de caja",
    text: `${treasuryIntro(summary)}

Flujo de caja previsto = cobros menos pagos.

- Cobros: ${formatEuros(forecast.inflows)}
- Pagos: ${formatEuros(forecast.outflows)}
- Flujo neto: ${formatEuros(forecast.net)}

Las transferencias entre cuentas no cuentan como ingresos o gastos del negocio.`,
    summary: { cobros: forecast.inflows, pagos: forecast.outflows, flujo_neto: forecast.net },
    resultCount: summary.forecast.items.length
  });
}

async function queryTreasuryWorkCashConsumption(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent);
  const work = [...summary.workProfitability].sort((a, b) => a.cashFlow - b.cashFlow)[0];
  if (!work || work.cashFlow >= 0) {
    return treasuryResult({
      title: "Caja por obra",
      text: "No hay obras con flujo de caja negativo calculado con los datos registrados.",
      summary: { obras_negativas: 0 },
      resultCount: 0
    });
  }
  return treasuryResult({
    title: "Obra que consume más caja",
    text: `${work.title}, de ${work.clientName}, tiene el flujo de caja de obra más bajo: ${formatEuros(work.cashFlow)}.

Entradas cobradas: ${formatEuros(work.collected)}.
Salidas pagadas/costes pagados: ${formatEuros(work.paidCost)}.
Necesidad de caja de la obra: ${formatEuros(work.cashNeed)}.

El presupuesto no se considera entrada de caja.`,
    summary: { obra: work.title, flujo_caja: work.cashFlow, necesidad_caja: work.cashNeed },
    resultCount: 1,
    href: `/obras/${work.workId}`
  });
}

async function queryTreasuryBreakEven(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, "month_end");
  const breakEven = summary.breakEven;
  const text = breakEven.canCalculate
    ? `Punto de equilibrio estimado: ${formatEuros(breakEven.breakEvenRevenue ?? 0)} de facturación.

Costes fijos: ${formatEuros(breakEven.fixedCosts)}.
Costes variables: ${formatEuros(breakEven.variableCosts)}.
Margen de contribución: ${roundForChat(breakEven.contributionMarginPercent)}%.

${breakEven.explanation}`
    : breakEven.explanation;
  return treasuryResult({
    title: "Punto de equilibrio",
    text,
    summary: { puede_calcular: breakEven.canCalculate, facturacion_necesaria: breakEven.breakEvenRevenue },
    resultCount: breakEven.canCalculate ? 1 : 0
  });
}

async function queryTreasuryCoverage(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent);
  const coverage = summary.coverage;
  const text = coverage.canCalculate
    ? `Cobertura con saldo: ${roundForChat(coverage.daysWithBalance)} días.
Cobertura incluyendo cobros confirmados próximos: ${roundForChat(coverage.daysWithConfirmedInflows)} días.
Gasto medio mensual usado: ${formatEuros(coverage.monthlyExpenseAverage)}.

${coverage.explanation}`
    : coverage.explanation;
  return treasuryResult({
    title: "Cobertura de gastos",
    text,
    summary: { cobertura_dias: coverage.daysWithBalance, cobertura_con_cobros_confirmados: coverage.daysWithConfirmedInflows },
    resultCount: coverage.canCalculate ? 1 : 0
  });
}

async function queryTreasuryScenario(intent: ChatIntentClassification, scenario: "conservative" | "base" | "optimistic"): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, "30d", scenario);
  const forecast = summary.forecast.summary;
  return treasuryResult({
    title: `Escenario ${scenario === "conservative" ? "conservador" : scenario}`,
    text: `${treasuryIntro(summary)}

- Cobros incluidos: ${formatEuros(forecast.inflows)}
- Pagos incluidos: ${formatEuros(forecast.outflows)}
- Flujo neto: ${formatEuros(forecast.net)}
- Saldo final: ${forecast.finalBalance === null ? "sin saldo calculable" : formatEuros(forecast.finalBalance)}

Este escenario no modifica datos reales.`,
    summary: { escenario: scenario, saldo_final: forecast.finalBalance, flujo_neto: forecast.net },
    resultCount: summary.forecast.items.length
  });
}

async function queryTreasuryScenarioCompare(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent, "30d");
  return treasuryResult({
    title: "Comparativa de escenarios",
    text: `Comparativa a ${summary.horizon.label}:

${summary.scenarioComparison.map((item) => `- ${item.label}: flujo ${formatEuros(item.net)}, saldo final ${item.finalBalance === null ? "sin saldo" : formatEuros(item.finalBalance)}${item.deficitDate ? `, déficit ${formatDateShort(item.deficitDate)}` : ""}`).join("\n")}

Los escenarios son simulaciones deterministas y no modifican datos reales.`,
    summary: {
      conservador: summary.scenarioComparison.find((item) => item.scenario === "conservative")?.finalBalance,
      base: summary.scenarioComparison.find((item) => item.scenario === "base")?.finalBalance,
      optimista: summary.scenarioComparison.find((item) => item.scenario === "optimistic")?.finalBalance
    },
    resultCount: summary.scenarioComparison.length
  });
}

async function queryTreasuryReview(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await treasurySummaryForIntent(intent);
  const alerts = summary.alerts.slice(0, 5);
  const issues = summary.qualityIssues.filter((issue) => issue.count > 0).slice(0, 4);
  return treasuryResult({
    title: "Revisión de tesorería",
    text: `${treasuryIntro(summary)}

Alertas:
${alerts.length ? alerts.map((alert, index) => `${index + 1}. ${alert.title}: ${alert.detail}`).join("\n") : "No hay alertas deterministas relevantes."}

Calidad de datos:
${issues.length ? issues.map((issue, index) => `${index + 1}. ${issue.title}: ${issue.count}`).join("\n") : "No hay incidencias principales de calidad de datos."}`,
    summary: { alertas: alerts.length, incidencias_datos: issues.reduce((total, issue) => total + issue.count, 0) },
    resultCount: alerts.length + issues.length
  });
}

async function treasurySummaryForIntent(intent: ChatIntentClassification, horizon?: string, scenario: "conservative" | "base" | "optimistic" = "base") {
  const { companyId } = await requireCompanyContext();
  return getTreasuryOverview({
    companyId,
    horizon: horizon ?? treasuryHorizonForPeriod(intent.period),
    scenario
  });
}

function treasuryHorizonForPeriod(period: ChatIntentClassification["period"]) {
  if (period === "this_week") return "7d";
  if (period === "this_month") return "month_end";
  return "30d";
}

function treasuryIntro(summary: Awaited<ReturnType<typeof getTreasuryOverview>>) {
  return `Con el escenario ${summary.scenarioOptions.find((item) => item.id === summary.scenario)?.label ?? "Base"} y datos registrados a ${formatDateShort(summary.updatedAt)} (${summary.horizon.label}):`;
}

function treasuryResult({
  title,
  text,
  summary,
  resultCount,
  href = "/tesoreria"
}: {
  title: string;
  text: string;
  summary: Record<string, string | number | boolean | null | undefined>;
  resultCount: number;
  href?: string;
}): ChatCommandResult {
  return {
    handled: true,
    diagnostics: { resultCount },
    result: {
      type: "found",
      entityType: "business",
      title,
      summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, value ?? null])),
      actions: [{ label: "Abrir tesorería", href, style: "primary" }]
    },
    text
  };
}

async function queryBusinessHealth(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const attention = summary.alerts.slice(0, 3);
  return {
    handled: true,
    diagnostics: { resultCount: attention.length },
    result: {
      type: "found",
      entityType: "business",
      title: "Salud del negocio",
      summary: {
        periodo: summary.period.label,
        facturado: summary.money.invoiced,
        cobrado: summary.money.collected,
        pendiente: summary.money.outstanding,
        vencido: summary.money.overdue,
        gastos: summary.money.expenses,
        salud: summary.health.score
      },
      actions: [{ label: "Abrir inteligencia", href: businessPanelHref(summary.period.id), style: "primary" }]
    },
    text: [
      summary.summaryText,
      summary.health.canCalculate ? `Índice de salud: ${summary.health.score}/100 (${summary.health.label}).` : "No hay datos suficientes para calcular el índice de salud.",
      attention.length ? `Conviene revisar:\n${attention.map((alert, index) => `${index + 1}. ${alert.title}: ${alert.detail} · ${alert.href}`).join("\n")}` : "No hay alertas deterministas relevantes ahora mismo.",
      `Definición: ${metricDefinitionText("invoiced")}`
    ].join("\n\n")
  };
}

async function queryBusinessMetric(intent: ChatIntentClassification, metric: "invoiced" | "collected" | "outstanding" | "overdue" | "expenses"): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const values = {
    invoiced: { label: "Facturado", value: summary.money.invoiced, definition: metricDefinitionText("invoiced"), href: "/dinero" },
    collected: { label: "Cobrado", value: summary.money.collected, definition: metricDefinitionText("collected"), href: "/dinero" },
    outstanding: { label: "Pendiente de cobro", value: summary.money.outstanding, definition: metricDefinitionText("outstanding"), href: "/dinero?filtro=pendientes" },
    overdue: { label: "Vencido", value: summary.money.overdue, definition: metricDefinitionText("overdue"), href: "/dinero?filtro=vencidas" },
    expenses: { label: "Gastos", value: summary.money.expenses, definition: metricDefinitionText("expenses"), href: "/gastos-materiales" }
  };
  const item = values[metric];
  return {
    handled: true,
    diagnostics: { resultCount: 1 },
    result: {
      type: "found",
      entityType: "business_metric",
      title: item.label,
      summary: { periodo: summary.period.label, valor: item.value },
      actions: [{ label: "Ver detalle", href: item.href, style: "primary" }, { label: "Abrir inteligencia", href: businessPanelHref(summary.period.id) }]
    },
    text: `${summary.period.label}: ${item.label.toLowerCase()} ${formatEuros(item.value)}.\n\n${item.definition}`
  };
}

async function queryBusinessProfit(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  return {
    handled: true,
    diagnostics: { resultCount: 2 },
    text: `${summary.period.label}: beneficio sobre facturado ${formatEuros(summary.money.profitOnInvoiced)} y beneficio sobre cobrado ${formatEuros(summary.money.profitOnCollected)}.\n\nBeneficio es ambiguo: sobre facturado usa facturas emitidas menos gastos; sobre cobrado usa pagos reales menos gastos. ${metricDefinitionText("profit_invoiced")}`,
    result: {
      type: "found",
      entityType: "business_metric",
      title: "Beneficio",
      summary: { sobreFacturado: summary.money.profitOnInvoiced, sobreCobrado: summary.money.profitOnCollected },
      actions: [{ label: "Abrir inteligencia", href: `${businessPanelHref(summary.period.id)}#rentabilidad`, style: "primary" }]
    }
  };
}

async function queryBusinessMargin(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  return {
    handled: true,
    diagnostics: { resultCount: 2 },
    text: `${summary.period.label}: margen sobre facturado ${roundForChat(summary.money.marginOnInvoiced)}% y margen sobre cobrado ${roundForChat(summary.money.marginOnCollected)}%.\n\n${metricDefinitionText("margin_invoiced")}`,
    result: {
      type: "found",
      entityType: "business_metric",
      title: "Margen",
      summary: { margenFacturado: summary.money.marginOnInvoiced, margenCobrado: summary.money.marginOnCollected },
      actions: [{ label: "Abrir inteligencia", href: `${businessPanelHref(summary.period.id)}#rentabilidad`, style: "primary" }]
    }
  };
}

async function queryBusinessBestWork(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const top = summary.works.byProfit.find((work) => work.hasEnoughData);
  if (!top) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay datos suficientes para calcular la obra más rentable." };
  return {
    handled: true,
    diagnostics: { resultCount: summary.works.byProfit.length },
    result: {
      type: "found",
      entityType: "project",
      entityId: top.workId,
      title: "Obra más rentable",
      summary: { obra: top.title, beneficio: top.profitOnInvoiced, margen: top.marginOnInvoiced },
      actions: [{ label: "Ver obra", href: `/obras/${top.workId}`, style: "primary" }, { label: "Abrir inteligencia", href: `${businessPanelHref(summary.period.id)}#rentabilidad` }]
    },
    text: `La obra más rentable es ${top.title}, de ${top.clientName}: beneficio sobre facturado ${formatEuros(top.profitOnInvoiced)} y margen ${roundForChat(top.marginOnInvoiced)}%.\n\nRentabilidad de obra = ingresos relacionados con la obra menos gastos relacionados.`
  };
}

async function queryBusinessClientHighestDebt(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const top = summary.clients.byDebt[0];
  if (!top || top.debt <= 0) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay clientes con saldo pendiente calculado." };
  return {
    handled: true,
    diagnostics: { resultCount: summary.clients.byDebt.length },
    result: {
      type: "found",
      entityType: "client",
      entityId: top.clientId,
      title: "Cliente con mayor saldo pendiente",
      summary: { cliente: top.name, pendiente: top.debt },
      actions: [{ label: "Ver cliente", href: top.href, style: "primary" }, { label: "Ver facturas", href: "/dinero?filtro=pendientes" }]
    },
    text: `El cliente con mayor saldo pendiente es ${top.name}, con ${formatEuros(top.debt)}. Representa ${roundForChat(top.debtShare)}% del pendiente total.`
  };
}

async function queryBusinessSlowestClient(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const top = summary.clients.bySlowestPayment[0];
  if (!top) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay facturas completamente cobradas suficientes para calcular plazo medio de cobro por cliente." };
  return {
    handled: true,
    diagnostics: { resultCount: summary.clients.bySlowestPayment.length },
    text: `${top.name} tiene el mayor plazo medio de cobro calculado: ${roundForChat(top.averageCollectionDays ?? 0)} días.\n\nRegla: días entre fecha de factura y fecha en que los pagos acumulados cubren el total de la factura.`,
    result: {
      type: "found",
      entityType: "client",
      entityId: top.clientId,
      title: "Mayor plazo medio de cobro",
      summary: { cliente: top.name, dias: top.averageCollectionDays },
      actions: [{ label: "Ver cliente", href: top.href, style: "primary" }]
    }
  };
}

async function queryBusinessQuoteConversion(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const conversion = summary.quotes.conversionRate;
  return {
    handled: true,
    diagnostics: { resultCount: summary.quotes.count },
    text: conversion === null
      ? `${summary.period.label}: no hay presupuestos decididos suficientes para calcular conversión. Aceptados: ${summary.quotes.acceptedCount}, decididos: ${summary.quotes.decidedCount}.`
      : `${summary.period.label}: conversión de presupuestos ${roundForChat(conversion)}%. Aceptados: ${summary.quotes.acceptedCount}; decididos: ${summary.quotes.decidedCount}.\n\n${metricDefinitionText("quote_conversion")}`,
    result: {
      type: "found",
      entityType: "business_metric",
      title: "Conversión de presupuestos",
      summary: { conversion, aceptados: summary.quotes.acceptedCount, decididos: summary.quotes.decidedCount },
      actions: [{ label: "Abrir presupuestos", href: "/presupuestos", style: "primary" }]
    }
  };
}

async function queryBusinessComparison(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const rows = [
    ["Facturado", summary.comparisons.invoiced],
    ["Cobrado", summary.comparisons.collected],
    ["Gastos", summary.comparisons.expenses],
    ["Beneficio", summary.comparisons.profit]
  ] as const;
  return {
    handled: true,
    diagnostics: { resultCount: rows.length },
    text: `${summary.period.label} frente al periodo anterior:\n${rows.map(([label, item]) => `- ${label}: ${formatEuros(item.current)} vs ${item.previous === null ? "sin dato" : formatEuros(item.previous)} (${item.label}).`).join("\n")}\n\nLa semántica de tendencia distingue gastos y vencido como métricas donde subir puede ser negativo.`,
    result: {
      type: "found",
      entityType: "business_metric",
      title: "Comparativa temporal",
      summary: { periodo: summary.period.label },
      actions: [{ label: "Abrir inteligencia", href: businessPanelHref(summary.period.id), style: "primary" }]
    }
  };
}

async function queryBusinessReviewToday(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const summary = await businessSummary(intent);
  const alerts = summary.alerts.slice(0, 5);
  if (!alerts.length) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay avisos deterministas relevantes para revisar ahora mismo." };
  return {
    handled: true,
    diagnostics: { resultCount: alerts.length },
    text: `Revisaría esto:\n${alerts.map((alert, index) => `${index + 1}. ${alert.title}: ${alert.detail} · ${alert.href}`).join("\n")}`,
    result: {
      type: "found",
      entityType: "business",
      title: "Puntos de revisión",
      summary: { alertas: alerts.length },
      actions: [{ label: "Abrir inteligencia", href: businessPanelHref(summary.period.id), style: "primary" }]
    }
  };
}

type BusinessSignalsChatMode = "review_today" | "urgent" | "problems" | "risks" | "clients" | "works" | "invoices" | "explain_top" | "critical_count";

async function queryBusinessSignals(intent: ChatIntentClassification, mode: BusinessSignalsChatMode): Promise<ChatCommandResult> {
  const result = await getBusinessSignals({ status: "active", limit: 120 });
  const filtered = filterSignalsForChat(result.signals, mode).slice(0, 7);
  const title = signalChatTitle(mode);
  if (mode === "critical_count") {
    const critical = result.signals.filter((signal) => signal.level === "critico");
    return {
      handled: true,
      diagnostics: { resultCount: critical.length },
      result: {
        type: "found",
        entityType: "business",
        title,
        summary: { criticas: critical.length, activas: result.summary.active },
        actions: [{ label: "Abrir alertas", href: "/alertas?nivel=critico", style: "primary" }]
      },
      text: `Tienes ${critical.length} alertas CRÍTICAS activas. ${critical.length ? `Las principales son:\n${critical.slice(0, 5).map((signal, index) => `${index + 1}. ${signal.title}: ${signal.explanation.why}${signal.entity ? ` · ${signal.entity.href}` : ""}`).join("\n")}` : "No hay señales críticas activas ahora mismo."}\n\nNo he cambiado ningún registro.`
    };
  }
  if (mode === "explain_top") {
    const top = result.summary.top;
    if (!top) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay alertas activas que explicar ahora mismo." };
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      result: {
        type: "found",
        entityType: top.entity?.type === "cliente" ? "client" : top.entity?.type === "obra" ? "project" : top.entity?.type === "factura" ? "invoice" : "business",
        entityId: top.entity?.id,
        title: "Explicación de alerta prioritaria",
        summary: { prioridad: top.prioridad, nivel: top.levelText, origen: top.sourceLabel },
        actions: [{ label: "Abrir alertas", href: "/alertas", style: "primary" }]
      },
      text: `${top.title}\n\nPor qué: ${top.explanation.why}\n\nRegla: ${top.explanation.rule}\n\nDatos usados:\n${top.explanation.dataUsed.map((item) => `- ${item}`).join("\n")}\n\nScore: ${top.prioridad}/100. ${top.explanation.scoreBreakdown.map((item) => `${item.label} ${item.value}`).join("; ")}.\n\nSi no haces nada: ${top.explanation.consequence}\n\nNo he cambiado ningún registro.`
    };
  }
  if (!filtered.length) {
    return {
      handled: true,
      diagnostics: { resultCount: 0 },
      result: {
        type: "found",
        entityType: "business",
        title,
        summary: { activas: result.summary.active, criticas: result.summary.critical, importantes: result.summary.important },
        actions: [{ label: "Abrir alertas", href: "/alertas", style: "primary" }]
      },
      text: `No hay señales activas para esa consulta. El centro de alertas tiene ${result.summary.active} señales activas en total.`
    };
  }

  const top = filtered[0];
  const lines = filtered.map((signal, index) => `${index + 1}. ${signal.levelText} · ${signal.title}: ${signal.explanation.why}${signal.entity ? ` · ${signal.entity.href}` : ""}`);
  return {
    handled: true,
    diagnostics: { resultCount: filtered.length },
    result: {
      type: "found",
      entityType: top.entity?.type === "cliente" ? "client" : top.entity?.type === "obra" ? "project" : top.entity?.type === "factura" ? "invoice" : "business",
      entityId: top.entity?.id,
      title,
      summary: {
        señales: filtered.length,
        criticas: filtered.filter((signal) => signal.level === "critico").length,
        importantes: filtered.filter((signal) => signal.level === "importante").length,
        impacto: filtered.reduce((total, signal) => total + (signal.relatedAmount ?? 0), 0)
      },
      actions: [
        { label: "Abrir alertas", href: "/alertas", style: "primary" },
        ...(top.entity ? [{ label: "Abrir prioridad", href: top.entity.href, style: "secondary" as const }] : [])
      ]
    },
    text: `${signalChatIntro(mode, result.summary.active)}

${lines.join("\n")}

Regla de orden: prioridad determinista por impacto económico, urgencia, riesgo, tiempo y dependencias. No he cambiado ningún registro.`
  };
}

type BusinessRecommendationsChatMode =
  | "today"
  | "first"
  | "quick_wins"
  | "important"
  | "client"
  | "work"
  | "explain_current"
  | "do_current"
  | "snooze_current"
  | "dismiss_current"
  | "change_date_current"
  | "reviewed_at"
  | "reactivated"
  | "resolved_week"
  | "snoozed"
  | "due_today"
  | "history"
  | "noisy_rules"
  | "mark_reviewed_current"
  | "reactivate_current";

async function queryBusinessRecommendations(intent: ChatIntentClassification, mode: BusinessRecommendationsChatMode, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  if (["reviewed_at", "reactivated", "resolved_week", "snoozed", "due_today", "history", "noisy_rules"].includes(mode)) {
    return queryProactiveRecommendationLifecycle(mode);
  }
  if (mode === "explain_current" || mode === "do_current" || mode === "snooze_current" || mode === "dismiss_current" || mode === "change_date_current" || mode === "mark_reviewed_current" || mode === "reactivate_current") {
    return handleCurrentRecommendation(mode, context);
  }

  const params = await recommendationParamsForChat(intent, mode, context);
  const result = await getBusinessRecommendations({ ...params, status: "active", limit: mode === "first" ? 5 : 12 });
  const filtered = filterRecommendationsForChat(result.recommendations, mode).slice(0, mode === "first" ? 1 : 6);
  if (!filtered.length) {
    return {
      handled: true,
      diagnostics: { resultCount: 0 },
      result: {
        type: "found",
        entityType: "business",
        title: "Recomendaciones",
        summary: { activas: result.summary.active },
        actions: [{ label: "Abrir recomendaciones", href: "/recomendaciones", style: "primary" }]
      },
      text: "No tienes recomendaciones prioritarias para esa consulta ahora mismo. No he cambiado ningún registro."
    };
  }

  const top = filtered[0];
  const lines = filtered.map((recommendation, index) => {
    const action = recommendation.preferredAction ? ` Acción sugerida: ${recommendation.preferredAction.label}.` : "";
    return `${index + 1}. Prioridad ${recommendation.priority} · ${recommendation.title}: ${recommendation.summary}.${action}${recommendation.entityHref ? ` ${recommendation.entityHref}` : ""}`;
  });

  return {
    handled: true,
    diagnostics: { resultCount: filtered.length },
    result: {
      type: "found",
      entityType: top.entityType === "client" ? "client" : top.entityType === "work" ? "project" : top.entityType === "invoice" ? "invoice" : "business",
      entityId: top.entityId ?? undefined,
      title: recommendationChatTitle(mode),
      summary: {
        recomendaciones: filtered.length,
        prioridad: top.priority,
        requiereConfirmacion: top.requiresConfirmation
      },
      actions: [
        { label: "Abrir recomendaciones", href: "/recomendaciones", style: "primary" },
        ...(top.entityHref ? [{ label: "Abrir entidad", href: top.entityHref, style: "secondary" as const }] : [])
      ]
    },
    context: withLastRecommendationContext(context, top),
    text: `${recommendationChatIntro(mode, result.summary.active)}

${lines.join("\n")}

He guardado la primera recomendación como contexto. Puedes preguntar "por qué", "recuérdamelo mañana" o "descártalo". Si una acción modifica datos, pediré confirmación. No he cambiado ningún registro.`
  };
}

async function queryProactiveRecommendationLifecycle(mode: BusinessRecommendationsChatMode): Promise<ChatCommandResult> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = addDays(todayStart, 1);

  if (mode === "reviewed_at") {
    const data = await getProactiveControlData(now);
    const latest = data.latestRun;
    return {
      handled: true,
      diagnostics: { resultCount: data.runs.length },
      result: {
        type: "found",
        entityType: "business",
        title: "Evaluación proactiva",
        summary: { ejecuciones: data.runs.length, ultima: latest ? formatDateShort(latest.startedAt) : "sin ejecución" },
        actions: [{ label: "Abrir control", href: "/recomendaciones/control", style: "primary" }]
      },
      text: latest
        ? `La última reevaluación proactiva fue el ${formatDateTime(latest.startedAt)}. Estado: ${latest.status}. Disparador: ${latest.triggeredBy}. Procesó ${latest.processedSignals} señales y ${latest.processedRecommendations} recomendaciones. No he cambiado ningún registro.`
        : "El sistema proactivo todavía no se ha evaluado. Puedes ejecutarlo desde /recomendaciones/control. No he cambiado ningún registro."
    };
  }

  if (mode === "noisy_rules") {
    const data = await getProactiveControlData(now);
    const lines = data.noisyRules.slice(0, 6).map((rule, index) => `${index + 1}. ${rule.ruleId}: ${rule.warning} (${rule.dismissed}/${rule.total} descartadas).`);
    return {
      handled: true,
      diagnostics: { resultCount: data.noisyRules.length },
      result: {
        type: "found",
        entityType: "business",
        title: "Reglas con ruido",
        summary: { reglas: data.noisyRules.length },
        actions: [{ label: "Abrir control", href: "/recomendaciones/control", style: "primary" }]
      },
      text: lines.length
        ? `Reglas con posible ruido:\n\n${lines.join("\n")}\n\nNo he desactivado ninguna regla automáticamente.`
        : "No veo reglas con alto descarte o exceso de recomendaciones activas. No he cambiado ningún registro."
    };
  }

  if (mode === "history") {
    const events = await prisma.proactiveAuditEvent.findMany({
      where: { recommendationFingerprint: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 8
    });
    const lines = events.map((event, index) => `${index + 1}. ${formatDateTime(event.createdAt)} · ${event.eventType}${event.previousStatus ? ` · ${event.previousStatus} -> ${event.nextStatus ?? "sin cambio"}` : ""}. ${event.reason ?? ""}`.trim());
    return {
      handled: true,
      diagnostics: { resultCount: events.length },
      result: {
        type: "found",
        entityType: "business",
        title: "Historial de recomendaciones",
        summary: { eventos: events.length },
        actions: [{ label: "Abrir control", href: "/recomendaciones/control", style: "primary" }]
      },
      text: lines.length ? `Historial reciente de recomendaciones:\n\n${lines.join("\n")}\n\nNo he cambiado ningún registro.` : "Aún no hay actividad del sistema proactivo. No he cambiado ningún registro."
    };
  }

  const params = mode === "snoozed"
    ? { status: "snoozed" as const, limit: 12 }
    : mode === "reactivated"
      ? { status: "all" as const, limit: 80 }
      : { status: "all" as const, limit: 80 };
  const result = await getBusinessRecommendations(params);
  let items = result.recommendations;
  if (mode === "reactivated") items = items.filter((item) => item.reactivatedAt).slice(0, 8);
  if (mode === "resolved_week") {
    const weekStart = startOfWeek(now);
    items = items.filter((item) => (item.completedAt && item.completedAt >= weekStart) || item.status === "obsolete").slice(0, 8);
  }
  if (mode === "due_today") {
    items = items.filter((item) =>
      (item.dueAt && item.dueAt >= todayStart && item.dueAt < todayEnd) ||
      (item.snoozedUntil && item.snoozedUntil >= todayStart && item.snoozedUntil < todayEnd)
    ).slice(0, 8);
  }

  const lines = items.map((item, index) => {
    const date = item.reactivatedAt ?? item.snoozedUntil ?? item.completedAt ?? item.dueAt ?? item.updatedAt;
    return `${index + 1}. ${item.statusLabel} · ${item.title} · ${formatDateShort(date)}. ${reactivationReasonForRecommendation(item)}`;
  });

  const titleMap: Partial<Record<BusinessRecommendationsChatMode, string>> = {
    reactivated: "Recomendaciones reactivadas",
    resolved_week: "Resuelto esta semana",
    snoozed: "Recomendaciones pospuestas",
    due_today: "Recomendaciones que vencen hoy"
  };
  const title = titleMap[mode] ?? "Recomendaciones";

  return {
    handled: true,
    diagnostics: { resultCount: items.length },
    result: {
      type: "found",
      entityType: "business",
      title,
      summary: { recomendaciones: items.length },
      actions: [{ label: "Abrir recomendaciones", href: "/recomendaciones", style: "primary" }]
    },
    text: lines.length ? `${title}:\n\n${lines.join("\n")}\n\nNo he cambiado ningún registro.` : `No hay datos para "${title}" ahora mismo. No he cambiado ningún registro.`
  };
}

async function handleCurrentRecommendation(mode: BusinessRecommendationsChatMode, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  const current = await findCurrentRecommendation(context);
  if (!current) {
    return {
      handled: true,
      diagnostics: { resultCount: 0 },
      result: {
        type: "found",
        entityType: "business",
        title: "Sin recomendación activa en contexto",
        summary: { requiereContexto: true },
        actions: [{ label: "Ver recomendaciones", href: "/recomendaciones", style: "primary" }]
      },
      text: "Necesito una recomendación concreta en contexto. Pregúntame primero qué te recomiendo hacer hoy o abre el centro de recomendaciones. No he cambiado ningún registro."
    };
  }

  if (mode === "explain_current") {
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      result: recommendationChatResult(current),
      context: withLastRecommendationContext(context, current),
      text: `${current.title}

Por qué: ${current.detailedExplanation}

Datos usados:
${current.evidence.dataUsed.map((item) => `- ${item}`).join("\n") || "- Señal activa y entidad relacionada."}

Acción sugerida: ${current.preferredAction?.label ?? "Revisar en el centro"}.
No he cambiado ningún registro.`
    };
  }

  if (mode === "mark_reviewed_current") {
    await markRecommendationViewed(current.fingerprint);
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      result: recommendationChatResult(current),
      context: withLastRecommendationContext(context, { ...current, status: "viewed", reviewedAt: new Date() }),
      text: `He marcado "${current.title}" como revisada. No la he resuelto: seguirá activa mientras la causa continúe y el cooldown solo reduce su prominencia temporal.`
    };
  }

  if (mode === "reactivate_current") {
    await reactivateBusinessRecommendation(current.fingerprint, "Reactivada desde Capataz Chat por petición explícita.");
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      result: recommendationChatResult(current),
      context: withLastRecommendationContext(context, { ...current, status: "active", reactivatedAt: new Date() }),
      text: `He reactivado "${current.title}". No he ejecutado ninguna acción externa ni he modificado facturas, clientes, obras o pagos.`
    };
  }

  if (mode === "do_current") {
    const action = current.preferredAction ?? current.suggestedActions[0];
    if (!action) {
      return { handled: true, diagnostics: { resultCount: 1 }, context: withLastRecommendationContext(context, current), text: "Esta recomendación no tiene una acción automática disponible. Puedo abrir el centro de recomendaciones para revisarla. No he cambiado ningún registro." };
    }
    if (action.requiresConfirmation) {
      return {
        handled: true,
        diagnostics: { resultCount: 1 },
        result: recommendationChatResult(current),
        context: withLastRecommendationContext(context, current),
        text: `Puedo preparar "${action.label}" para esta recomendación, pero requiere confirmación explícita antes de modificar nada.

Vista previa:
${(action.preview ?? []).map((row) => `- ${row.label}: ${row.value}`).join("\n") || `- Recomendación: ${current.title}`}

Confírmalo desde /recomendaciones o dime la acción concreta con todos los datos. No he cambiado ningún registro.`
      };
    }
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      result: recommendationChatResult(current),
      context: withLastRecommendationContext(context, current),
      text: `La siguiente acción es "${action.label}". Es una navegación o revisión, no una mutación. Puedes abrirla aquí: ${action.href ?? "/recomendaciones"}\n\nNo he cambiado ningún registro.`
    };
  }

  if (mode === "snooze_current") {
    await snoozeBusinessRecommendation(current.fingerprint, "tomorrow", "Pospuesta desde Capataz Chat");
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      context: withLastRecommendationContext(context, { ...current, status: "snoozed" }),
      text: `He pospuesto "${current.title}" hasta mañana. Solo he cambiado el estado de la recomendación; no he modificado facturas, clientes, obras ni pagos.`
    };
  }

  if (mode === "change_date_current") {
    const friday = nextWeekday(5);
    await snoozeBusinessRecommendationUntil(current.fingerprint, friday, "Reprogramada al viernes desde Capataz Chat");
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      context: withLastRecommendationContext(context, { ...current, status: "snoozed", snoozedUntil: friday }),
      text: `He cambiado el recordatorio de esta recomendación al viernes ${formatDateShort(friday)}. No he creado tareas nuevas ni he modificado entidades de negocio.`
    };
  }

  if (mode === "dismiss_current") {
    await dismissBusinessRecommendation(current.fingerprint, "Descartada desde Capataz Chat");
    return {
      handled: true,
      diagnostics: { resultCount: 1 },
      context: withLastRecommendationContext(context, { ...current, status: "dismissed" }),
      text: `He descartado "${current.title}" y lo he dejado registrado en el histórico. No he modificado entidades de negocio.`
    };
  }

  return { handled: false, text: "" };
}

async function recommendationParamsForChat(intent: ChatIntentClassification, mode: BusinessRecommendationsChatMode, context: ChatCommandContext | null) {
  if (mode === "client") {
    const clientId = context?.lastClientId ?? await findClientIdForRecommendation(intent.clientName);
    return clientId ? { clientId } : {};
  }
  if (mode === "work") {
    return context?.lastWorkId ? { workId: context.lastWorkId } : {};
  }
  return {};
}

function filterRecommendationsForChat(recommendations: BusinessRecommendation[], mode: BusinessRecommendationsChatMode) {
  const sorted = [...recommendations].sort((a, b) => b.priority - a.priority || b.score - a.score || (b.amount ?? 0) - (a.amount ?? 0));
  if (mode === "quick_wins") return sorted.filter((recommendation) => !recommendation.requiresConfirmation || ["view_invoice", "view_client", "view_work", "view_treasury"].includes(recommendation.preferredAction?.id ?? ""));
  if (mode === "important") return sorted.filter((recommendation) => ["critico", "importante"].includes(recommendation.level));
  return sorted;
}

async function findCurrentRecommendation(context: ChatCommandContext | null) {
  const fingerprint = context?.lastRecommendation?.fingerprint;
  const result = await getBusinessRecommendations({ status: "active", limit: 80 });
  if (fingerprint) {
    const current = result.recommendations.find((recommendation) => recommendation.fingerprint === fingerprint);
    if (current) return current;
  }
  return result.summary.top;
}

function withLastRecommendationContext(context: ChatCommandContext | null, recommendation: BusinessRecommendation): ChatCommandContext {
  return {
    ...(context ?? {}),
    lastRecommendation: {
      recommendationId: recommendation.id,
      fingerprint: recommendation.fingerprint,
      signalFingerprint: recommendation.signalFingerprint,
      entityType: recommendation.entityType,
      entityId: recommendation.entityId,
      actionId: recommendation.preferredAction?.id ?? null,
      shownAt: new Date().toISOString(),
      status: recommendation.status
    },
    lastClientId: recommendation.clientId ?? context?.lastClientId,
    lastWorkId: recommendation.workId ?? context?.lastWorkId,
    lastInvoiceId: recommendation.invoiceId ?? context?.lastInvoiceId,
    lastBudgetId: recommendation.budgetId ?? context?.lastBudgetId
  };
}

function recommendationChatResult(recommendation: BusinessRecommendation): ChatActionResult {
  return {
    type: "found",
    entityType: recommendation.entityType === "client" ? "client" : recommendation.entityType === "work" ? "project" : recommendation.entityType === "invoice" ? "invoice" : "business",
    entityId: recommendation.entityId ?? undefined,
    title: recommendation.title,
    summary: {
      prioridad: recommendation.priority,
      nivel: recommendation.levelText,
      accion: recommendation.preferredAction?.label ?? "Revisar",
      requiereConfirmacion: recommendation.requiresConfirmation
    },
    actions: [
      { label: "Abrir recomendaciones", href: "/recomendaciones", style: "primary" },
      ...(recommendation.entityHref ? [{ label: "Abrir entidad", href: recommendation.entityHref, style: "secondary" as const }] : [])
    ]
  };
}

async function findClientIdForRecommendation(clientName: string | undefined) {
  if (!clientName) return undefined;
  const client = await prisma.client.findFirst({
    where: { nombre: { contains: clientName, mode: "insensitive" } },
    select: { id: true }
  });
  return client?.id;
}

function recommendationChatTitle(mode: BusinessRecommendationsChatMode) {
  const labels: Record<BusinessRecommendationsChatMode, string> = {
    today: "Recomendaciones para hoy",
    first: "Siguiente mejor acción",
    quick_wins: "Acciones rápidas",
    important: "Recomendaciones importantes",
    client: "Recomendaciones del cliente",
    work: "Recomendaciones de obra",
    explain_current: "Explicación de recomendación",
    do_current: "Confirmación de recomendación",
    snooze_current: "Posponer recomendación",
    dismiss_current: "Descartar recomendación",
    change_date_current: "Cambiar fecha de recomendación",
    reviewed_at: "Evaluaciones proactivas",
    reactivated: "Recomendaciones reactivadas",
    resolved_week: "Resuelto esta semana",
    snoozed: "Recomendaciones pospuestas",
    due_today: "Recomendaciones que vencen hoy",
    history: "Historial de recomendaciones",
    noisy_rules: "Reglas con ruido",
    mark_reviewed_current: "Marcar revisada",
    reactivate_current: "Reactivar recomendación"
  };
  return labels[mode];
}

function recommendationChatIntro(mode: BusinessRecommendationsChatMode, activeCount: number) {
  const base = `He revisado ${activeCount} recomendaciones activas derivadas de señales reales.`;
  if (mode === "first") return `${base} Haría primero:`;
  if (mode === "quick_wins") return `${base} Lo más rápido de resolver es:`;
  if (mode === "important") return `${base} Las importantes son:`;
  if (mode === "client") return `${base} Para este cliente revisaría:`;
  if (mode === "work") return `${base} Para esta obra revisaría:`;
  return `${base} Recomiendo:`;
}

function reactivationReasonForRecommendation(recommendation: BusinessRecommendation) {
  if (recommendation.reactivatedAt && recommendation.snoozedUntil && recommendation.snoozedUntil <= new Date()) {
    return "Ha vuelto a aparecer porque terminó el aplazamiento y la causa sigue activa.";
  }
  if (recommendation.reactivatedAt) {
    return recommendation.outcome?.message ?? "Se reactivó por cambio material o porque volvió la condición.";
  }
  if (recommendation.status === "snoozed" && recommendation.snoozedUntil) {
    return `Volverá si la causa sigue activa al terminar el aplazamiento.`;
  }
  if (recommendation.status === "obsolete") {
    return recommendation.outcome?.message ?? "Quedó obsoleta porque la señal origen ya no está activa.";
  }
  return recommendation.detailedExplanation;
}

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  return start;
}

function nextWeekday(day: number) {
  const date = new Date();
  const diff = (day + 7 - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + diff);
  date.setHours(9, 0, 0, 0);
  return date;
}

function filterSignalsForChat(signals: BusinessSignal[], mode: BusinessSignalsChatMode) {
  const sorted = [...signals].sort((a, b) => b.score - a.score || (b.relatedAmount ?? 0) - (a.relatedAmount ?? 0));
  if (mode === "urgent") return sorted.filter((signal) => ["critico", "importante"].includes(signal.level));
  if (mode === "problems") return sorted.filter((signal) => signal.level !== "info");
  if (mode === "risks") return sorted.filter((signal) => ["critico", "importante"].includes(signal.level) || ["cobros", "tesoreria", "rentabilidad", "obras", "gastos"].includes(signal.source));
  if (mode === "clients") return sorted.filter((signal) => signal.client || signal.entity?.type === "cliente");
  if (mode === "works") return sorted.filter((signal) => signal.work || signal.entity?.type === "obra" || signal.type.startsWith("work_") || signal.type.includes("materials"));
  if (mode === "invoices") return sorted.filter((signal) => signal.entity?.type === "factura" || signal.type.includes("invoice") || ["facturas", "cobros"].includes(signal.source));
  if (mode === "critical_count") return sorted.filter((signal) => signal.level === "critico");
  return sorted;
}

function signalChatTitle(mode: BusinessSignalsChatMode) {
  const labels: Record<BusinessSignalsChatMode, string> = {
    review_today: "Qué revisar hoy",
    urgent: "Lo más urgente",
    problems: "Problemas detectados",
    risks: "Riesgos importantes",
    clients: "Clientes que requieren atención",
    works: "Obras que revisar",
    invoices: "Facturas prioritarias",
    explain_top: "Explicación de alerta",
    critical_count: "Alertas críticas"
  };
  return labels[mode];
}

function signalChatIntro(mode: BusinessSignalsChatMode, activeCount: number) {
  const base = `He revisado ${activeCount} señales activas del motor determinista.`;
  if (mode === "urgent") return `${base} Lo más urgente ahora es:`;
  if (mode === "clients") return `${base} Clientes con más atención operativa:`;
  if (mode === "works") return `${base} Obras que conviene revisar:`;
  if (mode === "invoices") return `${base} Facturas prioritarias:`;
  if (mode === "risks") return `${base} Riesgos importantes detectados:`;
  if (mode === "problems") return `${base} Problemas principales:`;
  if (mode === "explain_top") return `${base} Explicación de la alerta prioritaria:`;
  if (mode === "critical_count") return `${base} Alertas críticas:`;
  return `${base} Revisaría esto hoy:`;
}

async function businessSummary(intent: ChatIntentClassification) {
  const { companyId } = await requireCompanyContext();
  return getBusinessIntelligenceSummary({ companyId, period: businessPeriodForIntent(intent.period) });
}

function businessPeriodForIntent(period: ChatIntentClassification["period"]): BusinessPeriodId {
  if (period === "this_week") return "this_week";
  if (period === "this_month") return "this_month";
  if (period === "last_month") return "previous_month";
  if (period === "this_year") return "this_year";
  return "this_month";
}

function businessPanelHref(periodId: BusinessPeriodId) {
  return `/inteligencia?periodo=${periodId}`;
}

function roundForChat(value: number | null | undefined) {
  return Math.round((value ?? 0) * 10) / 10;
}

async function queryRevenueSummary(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const where = invoicePeriodWhere(intent.period);
  const invoices = await prisma.invoice.findMany({ where, select: { total: true, pagado: true, pendiente: true } });
  const total = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const paid = invoices.reduce((sum, invoice) => sum + invoice.pagado, 0);
  const pending = invoices.reduce((sum, invoice) => sum + invoice.pendiente, 0);
  return {
    handled: true,
    text: invoices.length
      ? `${periodText(intent.period, "facturación")}: ${formatEuros(total)} facturados en ${invoices.length} facturas. Cobrado: ${formatEuros(paid)}. Pendiente: ${formatEuros(pending)}.`
      : `${periodText(intent.period, "facturación")}: no hay facturas registradas.`
  };
}

async function queryExpensesSummary(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const expenses = await prisma.expense.findMany({ where: expensePeriodWhere(intent.period), select: { importe: true } });
  const total = expenses.reduce((sum, expense) => sum + expense.importe, 0);
  return {
    handled: true,
    text: expenses.length
      ? `${periodText(intent.period, "gastos")}: ${formatEuros(total)} en ${expenses.length} gastos registrados.`
      : `${periodText(intent.period, "gastos")}: no hay gastos registrados.`
  };
}

async function queryClientBudgets(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  if (!intent.clientName) return { handled: true, text: "Dime de qué cliente quieres consultar los presupuestos." };
  const client = await clientForQuery(intent.clientName);
  if (!client) return noClientResult(intent.clientName);
  const budgets = await prisma.budget.findMany({ where: { clienteId: client.id }, orderBy: { fechaCreacion: "desc" }, take: 10, include: { client: true, work: true } });
  return compactListResult(budgets, `presupuestos de ${client.nombre}`, (budget) => `${budget.numero} · ${budget.titulo} · ${formatEuros(budget.total)} · ${budget.estado} · /presupuestos/${budget.id}`);
}

async function queryClientPayments(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  if (!intent.clientName) return { handled: true, text: "Dime de qué cliente quieres consultar los pagos." };
  const client = await clientForQuery(intent.clientName);
  if (!client) return noClientResult(intent.clientName);
  const payments = await prisma.payment.findMany({ where: { clienteId: client.id }, orderBy: { fecha: "desc" }, take: 10, include: { invoice: true } });
  const total = payments.reduce((sum, payment) => sum + payment.importe, 0);
  return {
    handled: true,
    text: payments.length
      ? `${client.nombre} ha pagado ${formatEuros(total)} en ${payments.length} pagos registrados.\n${payments.map((payment, index) => `${index + 1}. ${formatDateShort(payment.fecha)} · ${formatEuros(payment.importe)} · ${payment.invoice.numero} · /dinero/${payment.facturaId}`).join("\n")}`
      : `No hay pagos registrados para ${client.nombre}.`
  };
}

async function queryClientContacts(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  if (!intent.clientName) return { handled: true, text: "Dime de qué cliente quieres consultar los contactos." };
  const client = await prisma.client.findFirst({
    where: { OR: [{ nombre: { contains: intent.clientName, mode: "insensitive" } }, { razonSocial: { contains: intent.clientName, mode: "insensitive" } }, { nombreComercial: { contains: intent.clientName, mode: "insensitive" } }] },
    include: { contacts: { orderBy: [{ archivedAt: "asc" }, { isPrimary: "desc" }, { nombre: "asc" }] } }
  });
  if (!client) return noClientResult(intent.clientName);
  const contacts = buildClientContacts(client);
  return compactListResult(contacts, `contactos de ${client.nombre}`, (contact) => `${contact.name} · ${contact.role} · ${contact.flags.join(", ") || "sin marca"} · ${contact.phone ?? contact.email ?? "sin teléfono/email"}`);
}

async function queryWorkDocuments(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  if (!intent.clientName) return { handled: true, text: "Dime de qué obra quieres consultar los documentos." };
  const work = await prisma.work.findFirst({
    where: {
      OR: [
        { titulo: { contains: intent.clientName, mode: "insensitive" } },
        { codigo: { contains: intent.clientName, mode: "insensitive" } },
        { numeroInterno: { contains: intent.clientName, mode: "insensitive" } },
        { client: { nombre: { contains: intent.clientName, mode: "insensitive" } } }
      ]
    },
    include: {
      budgets: true,
      invoices: true,
      documents: true,
      repositoryDocuments: true,
      client: true
    }
  });
  if (!work) return { handled: true, diagnostics: { resultCount: 0 }, text: `No he encontrado una obra que coincida con “${intent.clientName}”.` };
  const documents = buildWorkDocuments(work);
  return compactListResult(documents, `documentos de ${work.titulo}`, (document) => `${document.type} · ${document.name} · ${document.source}${document.href ? ` · ${document.href}` : ""}`);
}

async function queryInternalNotes(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  if (!intent.clientName) return { handled: true, text: "Dime de qué cliente u obra quieres consultar las notas internas." };
  const notes = await prisma.internalNote.findMany({
    where: {
      archivedAt: null,
      OR: [
        { client: { nombre: { contains: intent.clientName, mode: "insensitive" } } },
        { client: { razonSocial: { contains: intent.clientName, mode: "insensitive" } } },
        { work: { titulo: { contains: intent.clientName, mode: "insensitive" } } }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { client: true, work: true, budget: true, invoice: true }
  });
  return compactListResult(notes, `notas internas de ${intent.clientName}`, (note) => `${formatDateShort(note.createdAt)} · ${note.client?.nombre ?? note.work?.titulo ?? note.budget?.numero ?? note.invoice?.numero ?? "Entidad"} · ${note.content}`);
}

async function queryAgendaToday(): Promise<ChatCommandResult> {
  const items = agendaItemsForDay(await getAgendaItems(), new Date()).filter((item) => item.estado !== "cancelado");
  return compactListResult(items, "agenda de hoy", (item) => `${formatDateShort(item.fechaInicio)} · ${item.titulo} · ${item.clienteNombre ?? item.contactName ?? item.obraTitulo ?? "Interno"} · ${item.href}`);
}

async function queryUpcomingVisits(): Promise<ChatCommandResult> {
  const start = agendaStartOfDay(new Date());
  const end = agendaAddDays(start, 7);
  const items = agendaItemsBetween(await getAgendaItems(), start, end).filter((item) => item.tipo === "visita" && item.estado !== "cancelado");
  return compactListResult(items, "próximas visitas", (item) => `${formatDateShort(item.fechaInicio)} · ${item.titulo} · ${item.clienteNombre ?? item.contactName ?? item.obraTitulo ?? "Sin entidad"} · ${item.href}`);
}

async function queryPendingRemindersCount(): Promise<ChatCommandResult> {
  const count = await prisma.reminder.count({ where: { estado: { in: ["borrador", "pendiente_confirmacion", "programado"] } } });
  return { handled: true, diagnostics: { resultCount: count }, text: count ? `Tienes ${count} recordatorios pendientes o programados.` : "No tienes recordatorios pendientes." };
}

async function queryPendingNotifications(): Promise<ChatCommandResult> {
  const notifications = (await getNotificationItems()).filter((item) => !item.readAt);
  return compactListResult(notifications, "notificaciones pendientes", (item) => `${item.priority} · ${item.title} · ${item.body} · ${item.href}`);
}

async function queryWorksByStatus(statuses: string[], label: string): Promise<ChatCommandResult> {
  const works = await prisma.work.findMany({
    where: { estado: { in: statuses as any[] } },
    orderBy: [{ prioridad: "desc" }, { fechaFinPrevista: "asc" }],
    take: 10,
    include: { client: true, budgets: true, invoices: { include: { payments: true } }, expenses: true, materials: true, reminders: true, agendaEvents: true }
  });
  return compactListResult(works, label, (work) => renderWorkQueryLine(work), { resultCount: works.length });
}

async function queryWorkHighestRevenue(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const works = await prisma.work.findMany({
    include: { client: true, budgets: true, invoices: { include: { payments: true } }, expenses: true, materials: true, reminders: true, agendaEvents: true }
  });
  const ranked = works
    .map((work) => ({ work, financial: calculateWorkFinancials(work) }))
    .filter((item) => item.financial.invoiced > 0)
    .sort((a, b) => b.financial.invoiced - a.financial.invoiced);
  const top = ranked[0];
  if (!top) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay obras con facturación registrada." };
  return {
    handled: true,
    diagnostics: { resultCount: ranked.length },
    result: {
      type: "found",
      entityType: "project",
      entityId: top.work.id,
      title: "Obra que más factura",
      summary: { obra: top.work.titulo, cliente: top.work.client.nombre, facturado: top.financial.invoiced, margen: top.financial.marginPercent },
      actions: [{ label: "Ver obra", href: `/obras/${top.work.id}`, style: "primary" }, { label: "Ver facturas", href: "/dinero" }]
    },
    text: `La obra que más factura es ${top.work.titulo}, de ${top.work.client.nombre}, con ${formatEuros(top.financial.invoiced)} facturados y margen del ${top.financial.marginPercent}%.`
  };
}

async function queryWorkLowestMargin(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const works = await prisma.work.findMany({
    include: { client: true, budgets: true, invoices: { include: { payments: true } }, expenses: true, materials: true, reminders: true, agendaEvents: true }
  });
  const ranked = works
    .map((work) => ({ work, financial: calculateWorkFinancials(work) }))
    .filter((item) => item.financial.budgeted > 0 || item.financial.invoiced > 0)
    .sort((a, b) => a.financial.marginPercent - b.financial.marginPercent);
  const top = ranked[0];
  if (!top) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay obras con presupuesto o facturación suficiente para calcular margen." };
  return {
    handled: true,
    diagnostics: { resultCount: ranked.length },
    result: {
      type: "found",
      entityType: "project",
      entityId: top.work.id,
      title: "Obra con menor margen",
      summary: { obra: top.work.titulo, cliente: top.work.client.nombre, margen: top.financial.marginPercent, beneficio: top.financial.benefit },
      actions: [{ label: "Ver obra", href: `/obras/${top.work.id}`, style: "primary" }, { label: "Ver gastos", href: "/gastos-materiales" }]
    },
    text: `La obra con menor margen es ${top.work.titulo}, de ${top.work.client.nombre}: ${top.financial.marginPercent}% y beneficio estimado ${formatEuros(top.financial.benefit)}.`
  };
}

async function queryWorksStartingThisWeek(): Promise<ChatCommandResult> {
  const range = currentWeekRange();
  const works = await prisma.work.findMany({
    where: {
      OR: [
        { fechaInicioPrevista: range },
        { fechaInicio: range }
      ]
    },
    orderBy: [{ fechaInicioPrevista: "asc" }, { fechaInicio: "asc" }],
    take: 10,
    include: { client: true, budgets: true, invoices: { include: { payments: true } }, expenses: true, materials: true, reminders: true, agendaEvents: true }
  });
  return compactListResult(works, "obras que empiezan esta semana", (work) => `${work.titulo} · ${work.client.nombre} · inicio ${formatDateShort(work.fechaInicioPrevista ?? work.fechaInicio ?? new Date())} · /obras/${work.id}`, { resultCount: works.length });
}

async function queryWorksEndingToday(): Promise<ChatCommandResult> {
  const range = todayRange();
  const works = await prisma.work.findMany({
    where: { fechaFinPrevista: range },
    orderBy: { fechaFinPrevista: "asc" },
    take: 10,
    include: { client: true, budgets: true, invoices: { include: { payments: true } }, expenses: true, materials: true, reminders: true, agendaEvents: true }
  });
  return compactListResult(works, "obras que terminan hoy", (work) => `${work.titulo} · ${work.client.nombre} · estado ${work.estado} · /obras/${work.id}`, { resultCount: works.length });
}

async function queryProjectHighestExpenses(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const expenses = await prisma.expense.findMany({ where: expensePeriodWhere(intent.period), include: { work: { include: { client: true } } } });
  const totals = new Map<string, { workId: string; title: string; client: string; total: number }>();
  for (const expense of expenses) {
    const current = totals.get(expense.obraId) ?? { workId: expense.obraId, title: expense.work.titulo, client: expense.work.client.nombre, total: 0 };
    current.total += expense.importe;
    totals.set(expense.obraId, current);
  }
  const top = [...totals.values()].sort((a, b) => b.total - a.total)[0];
  if (!top) return { handled: true, text: "No hay gastos asociados a obras en ese periodo." };
  return {
    handled: true,
    result: {
      type: "found",
      entityType: "project",
      entityId: top.workId,
      title: "Obra con más gastos",
      summary: { obra: top.title, cliente: top.client, gastos: top.total },
      actions: [{ label: "Ver obras", href: "/obras", style: "primary" }, { label: "Ver gastos", href: "/gastos-materiales" }]
    },
    text: `La obra con más gastos es ${top.title}, de ${top.client}, con ${formatEuros(top.total)} registrados.`
  };
}

function renderWorkQueryLine(work: {
  id: string;
  titulo: string;
  estado: string;
  client: { nombre: string };
  budgets: Array<{ total: number; estado: string }>;
  invoices: Array<{ total: number; pagado: number | null; pendiente: number | null; estado: string; payments: Array<{ importe: number }> }>;
  expenses: Array<{ importe: number; categoria: string }>;
}) {
  const financial = calculateWorkFinancials(work);
  return `${work.titulo} · ${work.client.nombre} · ${work.estado} · facturado ${formatEuros(financial.invoiced)} · margen ${financial.marginPercent}% · /obras/${work.id}`;
}

async function queryRecentDocuments(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const [budgets, invoices] = await Promise.all([
    prisma.budget.findMany({ where: budgetPeriodWhere(intent.period), orderBy: { fechaCreacion: "desc" }, take: 5, include: { client: true } }),
    prisma.invoice.findMany({ where: invoicePeriodWhere(intent.period), orderBy: { fechaEmision: "desc" }, take: 5, include: { client: true } })
  ]);
  const docs = [
    ...budgets.map((budget) => ({ date: budget.fechaCreacion, line: `Presupuesto ${budget.numero} · ${budget.client.nombre} · ${formatEuros(budget.total)} · /presupuestos/${budget.id}` })),
    ...invoices.map((invoice) => ({ date: invoice.fechaEmision, line: `Factura ${invoice.numero} · ${invoice.client.nombre} · ${formatEuros(invoice.total)} · /dinero/${invoice.id}` }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
  return compactListResult(docs, "documentos recientes", (doc) => doc.line);
}

function withPendingDetailLastQuery(context: ChatCommandContext | null, category: PendingDetailCategory, resultIds: string[]) {
  return withLastQuery(context, {
    type: "pending_detail",
    category,
    filters: { category },
    resultIds,
    handler: "queryPendingTaskDetails",
    timestamp: new Date().toISOString()
  });
}

function compactListResult<T>(
  items: T[],
  label: string,
  render: (item: T) => string,
  options: { context?: ChatCommandContext | null; resultCount?: number } = {}
): ChatCommandResult {
  if (!items.length) {
    return {
      handled: true,
      context: options.context,
      diagnostics: { resultCount: options.resultCount ?? 0 },
      text: `No hay ${label} registrados ahora mismo.`
    };
  }
  return {
    handled: true,
    context: options.context,
    diagnostics: { resultCount: options.resultCount ?? items.length },
    text: `Estos son los ${label} que veo ahora:\n\n${items.map((item, index) => `${index + 1}. ${render(item)}`).join("\n")}${items.length >= 10 ? "\n\nTe muestro 10 como máximo. Puedes pedirme que filtre por cliente, estado o fecha." : ""}`
  };
}

function budgetQueryCard(title: string, budget: {
  id: string;
  numero: string;
  titulo: string;
  subtotal: number;
  iva: number;
  total: number;
  estado: string;
  fechaCreacion: Date;
  client: { nombre: string };
  work: { titulo: string } | null;
}): ChatActionResult {
  return {
    type: "found",
    entityType: "quote",
    entityId: budget.id,
    title,
    summary: {
      numero: budget.numero,
      cliente: budget.client.nombre,
      obra: budget.work?.titulo ?? budget.titulo,
      importe: budget.subtotal,
      iva: budget.iva,
      total: budget.total,
      estado: budget.estado,
      fecha: formatDateShort(budget.fechaCreacion)
    },
    actions: [
      { label: "Ver presupuesto", href: `/presupuestos/${budget.id}`, style: "primary" },
      { label: "Editar", href: `/gestion?tipo=presupuesto&id=${budget.id}&returnTo=/capataz` },
      { label: "Ver PDF", href: `/presupuestos/${budget.id}/pdf?preview=1` }
    ]
  };
}

function invoiceQueryCard(title: string, invoice: {
  id: string;
  numero: string;
  concepto: string;
  importeBase: number;
  iva: number;
  total: number;
  pagado: number;
  pendiente: number;
  estado: string;
  fechaEmision: Date;
  client: { nombre: string };
  work: { titulo: string } | null;
}): ChatActionResult {
  return {
    type: "found",
    entityType: "invoice",
    entityId: invoice.id,
    title,
    summary: {
      numero: invoice.numero,
      cliente: invoice.client.nombre,
      obra: invoice.work?.titulo ?? invoice.concepto,
      base: invoice.importeBase,
      iva: invoice.iva,
      total: invoice.total,
      pagado: invoice.pagado,
      pendiente: invoice.pendiente,
      estado: invoice.estado,
      fecha: formatDateShort(invoice.fechaEmision)
    },
    actions: [
      { label: "Ver factura", href: `/dinero/${invoice.id}`, style: "primary" },
      { label: "Editar", href: `/gestion?tipo=factura&id=${invoice.id}&returnTo=/capataz` },
      { label: "Ver PDF", href: `/dinero/${invoice.id}/pdf?preview=1` }
    ]
  };
}

async function clientForQuery(clientName?: string) {
  if (!clientName) return null;
  const matches = await findClientMatches(clientName);
  return matches[0] ?? null;
}

function noClientResult(clientName: string): ChatCommandResult {
  return {
    handled: true,
    text: `No encuentro ningún cliente llamado ${clientName}. No he creado ni modificado nada.`
  };
}

function budgetPeriodWhere(period?: ChatIntentClassification["period"]) {
  const range = dateRangeForPeriod(period);
  return range ? { fechaCreacion: range } : {};
}

function invoicePeriodWhere(period?: ChatIntentClassification["period"]) {
  const range = dateRangeForPeriod(period);
  return range ? { fechaEmision: range } : {};
}

const collectibleInvoiceStates = ["emitida", "enviada", "pendiente", "pendiente_pago", "parcialmente_pagada", "vencida", "reclamada"] as const;

async function findOpenInvoiceBalances(where: Record<string, unknown> = {}) {
  const invoices = await prisma.invoice.findMany({
    where: {
      ...where,
      estado: { in: [...collectibleInvoiceStates] }
    },
    include: { client: true, work: true, payments: true }
  });
  return invoices
    .map((invoice) => {
      const paymentsTotal = Array.isArray(invoice.payments)
        ? invoice.payments.reduce((sum, payment) => sum + payment.importe, 0)
        : 0;
      const paid = Math.max(paymentsTotal, invoice.pagado ?? 0);
      const pending = Math.max(0, invoice.total - paid);
      return { invoice, paid, pending };
    })
    .filter(({ pending }) => pending > 0.009);
}

function expensePeriodWhere(period?: ChatIntentClassification["period"]) {
  const range = dateRangeForPeriod(period);
  return range ? { fecha: range } : {};
}

function dateRangeForPeriod(period?: ChatIntentClassification["period"]) {
  const now = new Date();
  if (!period || period === "all") return null;
  if (period === "this_week") {
    const start = startOfDay(now);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { gte: start, lt: end };
  }
  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { gte: start, lt: end };
  }
  if (period === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    return { gte: start, lt: end };
  }
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  return { gte: start, lt: end };
}

function currentWeekRange() {
  const start = startOfDay(new Date());
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { gte: start, lt: end };
}

function todayRange() {
  const start = startOfDay(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

function periodText(period: ChatIntentClassification["period"], label: string) {
  if (period === "this_week") return `Resumen de ${label} de esta semana`;
  if (period === "this_month") return `Resumen de ${label} de este mes`;
  if (period === "last_month") return `Resumen de ${label} del mes pasado`;
  if (period === "this_year") return `Resumen de ${label} de este año`;
  return `Resumen de ${label}`;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDateShort(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function lowerInitial(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function pendingCountLabel(label: string, count: number) {
  if (count !== 1) return lowerInitial(label);
  const singular: Record<string, string> = {
    "Presupuestos pendientes": "presupuesto pendiente",
    "Presupuestos pendientes de enviar": "presupuesto pendiente de enviar",
    "Presupuestos pendientes de aceptar": "presupuesto pendiente de aceptar",
    "Facturas pendientes de cobro": "factura pendiente de cobro",
    "Facturas vencidas": "factura vencida",
    "Pagos parciales": "pago parcial",
    "Visitas pendientes": "visita pendiente",
    "Visitas por confirmar": "visita por confirmar",
    "Seguimientos pendientes": "seguimiento pendiente",
    "Recordatorios pendientes": "recordatorio pendiente",
    "Clientes con datos incompletos": "cliente con datos incompletos",
    "Obras activas con tareas pendientes": "obra activa con tareas pendientes",
    "Documentos pendientes de completar": "documento pendiente de completar"
  };
  return singular[label] ?? lowerInitial(label);
}

function clientLooksIncomplete(client: { telefono: string | null; email?: string | null; direccion: string | null; estado?: string | null; notas?: string | null }) {
  const notes = normalizeQueryText(client.notas ?? "");
  return client.estado === "pendiente_datos"
    || !client.telefono
    || client.telefono === "Pendiente"
    || !client.email
    || !client.direccion
    || client.direccion === "Dirección pendiente"
    || (!notes.includes("nif") && !notes.includes("cif"));
}

async function continueLatestPendingTask(): Promise<ChatCommandResult> {
  const conversations = await prisma.chatConversation.findMany({
    where: { status: "active", messages: { some: {} } },
    orderBy: { lastActivityAt: "desc" },
    take: 20
  });
  const taskContext = conversations
    .map((conversation) => normalizeConversationContext(conversation.activeTask))
    .find((context) => context?.activeTask || context?.parkedTask);

  if (!taskContext?.activeTask && !taskContext?.parkedTask) {
    return {
      handled: true,
      text: "No encuentro una tarea pendiente reciente para retomar. Puedes abrir una conversación del historial o decirme cliente y documento.",
      context: null
    };
  }

  const activeTask = taskContext.activeTask ?? taskContext.parkedTask!;
  const resumedContext = {
    ...taskContext,
    activeTask: { ...activeTask, status: "activo" as const, updatedAt: new Date().toISOString() },
    parkedTask: undefined
  };

  return {
    handled: true,
    context: resumedContext,
    text: `${summarizeActiveTask(resumedContext.activeTask)}\n\nHe retomado esta tarea porque lo has pedido explícitamente.`
  };
}

async function buildActionResult(result: ChatCommandResult): Promise<ChatActionResult | null> {
  const created = result.created;
  if (!created) return null;

  if (created.budgetId) {
    const budget = await prisma.budget.findUnique({
      where: { id: created.budgetId },
      include: { client: true, work: true }
    }).catch(() => null);
    if (!budget) return null;
    return {
      type: result.text.toLowerCase().includes("actualizado") ? "updated" : "created",
      entityType: "quote",
      entityId: budget.id,
      title: result.text.toLowerCase().includes("pdf") ? "PDF de presupuesto listo" : "Presupuesto creado",
      summary: {
        numero: budget.numero,
        cliente: budget.client.nombre,
        obra: budget.work?.titulo ?? budget.titulo,
        importe: budget.total,
        estado: budget.estado
      },
      pendingFields: result.context?.activeTask?.pendingFieldDetails,
      actions: [
        { label: "Ver presupuesto", href: `/presupuestos/${budget.id}`, style: "primary" },
        { label: "Editar", href: `/gestion?tipo=presupuesto&id=${budget.id}&returnTo=/capataz` },
        { label: "Generar PDF", href: `/presupuestos/${budget.id}/pdf?preview=1` }
      ]
    };
  }

  if (created.invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: created.invoiceId },
      include: { client: true, work: true }
    }).catch(() => null);
    if (!invoice) return null;
    return {
      type: result.text.toLowerCase().includes("pago") ? "registered" : result.text.toLowerCase().includes("actualizado") ? "updated" : "created",
      entityType: result.text.toLowerCase().includes("pago") ? "payment" : "invoice",
      entityId: invoice.id,
      title: result.text.toLowerCase().includes("pago") ? "Pago registrado" : "Factura creada",
      summary: {
        numero: invoice.numero,
        cliente: invoice.client.nombre,
        concepto: invoice.concepto,
        total: invoice.total,
        pagado: invoice.pagado,
        pendiente: invoice.pendiente,
        estado: invoice.estado
      },
      pendingFields: result.context?.activeTask?.pendingFieldDetails,
      actions: [
        { label: "Ver factura", href: `/dinero/${invoice.id}`, style: "primary" },
        { label: "Editar", href: `/gestion?tipo=factura&id=${invoice.id}&returnTo=/capataz` },
        { label: "Ver PDF", href: `/dinero/${invoice.id}/pdf?preview=1` },
        { label: "Registrar pago", href: `/gestion?tipo=pago&facturaId=${invoice.id}&returnTo=/capataz` }
      ]
    };
  }

  if (created.agendaEventId) {
    const event = await prisma.eventoAgenda.findUnique({
      where: { id: created.agendaEventId },
      include: { client: true, work: true }
    }).catch(() => null);
    if (!event) return null;
    return {
      type: "registered",
      entityType: event.tipo === "llamada" ? "followup" : "visit",
      entityId: event.id,
      title: event.tipo === "llamada" ? "Seguimiento registrado" : "Visita registrada",
      summary: {
        cliente: event.client?.nombre ?? "Sin cliente",
        obra: event.work?.titulo ?? null,
        fecha: event.fechaInicio.toISOString(),
        hora: event.horaInicio,
        estado: event.estado,
        tema: event.titulo
      },
      actions: [
        { label: "Ver agenda", href: "/agenda", style: "primary" },
        { label: "Editar", href: `/gestion?tipo=eventoAgenda&id=${event.id}&returnTo=/capataz` },
        { label: "Crear seguimiento", href: `/gestion?tipo=recordatorio&clienteId=${event.clienteId ?? ""}&returnTo=/capataz` }
      ]
    };
  }

  if (created.clientId && !created.workId && !created.budgetId && !created.invoiceId) {
    const client = await prisma.client.findUnique({ where: { id: created.clientId } }).catch(() => null);
    if (!client) return null;
    return {
      type: "created",
      entityType: "client",
      entityId: client.id,
      title: "Cliente creado",
      summary: {
        nombre: client.nombre,
        tipo: client.tipo,
        telefono: client.telefono,
        email: client.email,
        direccion: client.direccion,
        estado: client.estado
      },
      actions: [
        { label: "Ver cliente", href: `/clientes/${client.id}`, style: "primary" },
        { label: "Editar cliente", href: `/gestion?tipo=cliente&id=${client.id}&returnTo=/capataz` },
        { label: "Crear obra", href: `/gestion?tipo=obra&clienteId=${client.id}&returnTo=/capataz` },
        { label: "Crear presupuesto", href: `/gestion?tipo=presupuesto&clienteId=${client.id}&returnTo=/capataz` }
      ]
    };
  }

  if (created.workId) {
    const work = await prisma.work.findUnique({ where: { id: created.workId }, include: { client: true } }).catch(() => null);
    if (!work) return null;
    return {
      type: "created",
      entityType: "project",
      entityId: work.id,
      title: "Obra creada",
      summary: {
        cliente: work.client.nombre,
        obra: work.titulo,
        direccion: work.direccion,
        tipo: work.tipoTrabajo,
        estado: work.estado
      },
      actions: [
        { label: "Ver obras", href: "/obras", style: "primary" },
        { label: "Editar obra", href: `/gestion?tipo=obra&id=${work.id}&returnTo=/capataz` },
        { label: "Añadir gasto", href: `/gestion?tipo=gasto&obraId=${work.id}&returnTo=/capataz` },
        { label: "Registrar visita", href: `/gestion?tipo=eventoAgenda&tipoEvento=visita&obraId=${work.id}&returnTo=/capataz` }
      ]
    };
  }

  return null;
}

async function enrichChatContext(context: ChatCommandContext | null): Promise<ChatCommandContext | null> {
  if (!context) return null;
  const normalized = normalizeChatContext(context);
  const task = normalized.activeTask ?? normalized.parkedTask;
  if (!task) return normalized;

  const ids = contextIds(normalized);
  try {
    if (ids.budgetId) {
      const budget = await prisma.budget.findUnique({
        where: { id: ids.budgetId },
        include: { client: true, work: true }
      });
      if (!budget) return normalized;

      const notes = `${budget.client.notas ?? ""}\n${budget.work?.notas ?? ""}\n${budget.observaciones ?? ""}`;
      const contactName = task.contactName ?? extractContextContactName(notes);
      const locality = extractContextLocality(notes);
      const workName = task.workName ?? [budget.work?.titulo ?? budget.titulo, locality ? `en ${locality}` : null].filter(Boolean).join(" ");
      const enrichedTask = {
        ...task,
        status: task.status ?? "activo" as const,
        title: task.title ?? `el presupuesto de ${budget.client.nombre}`,
        contactName,
        billingClientName: task.billingClientName ?? budget.client.nombre,
        workName,
        pendingFields: task.pendingFields?.length ? task.pendingFields : inferBudgetPendingFields(budget),
        importe: budget.total,
        iva: budget.iva,
        draftData: {
          ...(task.draftData ?? {}),
          amount: typeof task.draftData?.amount === "number" ? task.draftData.amount : budget.total
        }
      };
      return replaceContextTask(normalized, enrichedTask);
    }

    if (ids.invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: ids.invoiceId },
        include: { client: true, work: true }
      });
      if (!invoice) return normalized;

      const enrichedTask = {
        ...task,
        status: task.status ?? "activo" as const,
        title: task.title ?? `la factura de ${invoice.client.nombre}`,
        billingClientName: task.billingClientName ?? invoice.client.nombre,
        workName: task.workName ?? invoice.work?.titulo ?? invoice.concepto,
        pendingFields: task.pendingFields?.length ? task.pendingFields : ["datos_fiscales"],
        importe: invoice.total,
        iva: invoice.iva,
        draftData: {
          ...(task.draftData ?? {}),
          amount: typeof task.draftData?.amount === "number" ? task.draftData.amount : invoice.total
        }
      };
      return replaceContextTask(normalized, enrichedTask);
    }
  } catch (error) {
    debugChat("context_enrich_error", error instanceof Error ? { message: error.message } : error);
  }

  return normalized;
}

function replaceContextTask(context: ChatCommandContext, task: NonNullable<ChatCommandContext["activeTask"]>): ChatCommandContext {
  if (context.activeTask) return { ...context, activeTask: task };
  if (context.parkedTask) return { ...context, parkedTask: task };
  return context;
}

async function personalizeContextGreeting(response: string) {
  if (!response.startsWith("Hola.") && !response.startsWith("Hola,")) return response;
  try {
    const session = await requireCompanyContext();
    const name = session.displayName.trim();
    if (!name) return response;
    return response.startsWith("Hola,")
      ? response.replace(/^Hola,/, `Hola ${name},`)
      : response.replace(/^Hola\./, `Hola ${name}.`);
  } catch {
    return response;
  }
}

function inferBudgetPendingFields(budget: { iva: number; client: { telefono: string | null; email: string | null; direccion: string | null; notas: string | null }; work: { direccion: string | null } | null }) {
  const fields = new Set<string>();
  const notes = budget.client.notas ?? "";
  if (!/(NIF|CIF|Dirección fiscal)/i.test(notes) || !budget.client.direccion || budget.client.direccion === "Dirección pendiente") fields.add("datos_fiscales");
  if (!budget.work?.direccion || budget.work.direccion === "Dirección pendiente") fields.add("direccion_obra");
  if (!budget.iva) fields.add("iva");
  if (!budget.client.telefono || budget.client.telefono === "Pendiente" || !budget.client.email) fields.add("datos_cliente");
  return [...fields];
}

function extractContextContactName(text: string) {
  const match = text.match(/Contacto operativo:\s*([^.\\n]+)/i) ?? text.match(/Contacto:\s*([^.\\n]+)/i);
  return match?.[1]?.trim();
}

function extractContextLocality(text: string) {
  const match = text.match(/Localidad:\s*([^.\\n]+)/i);
  return match?.[1]?.trim();
}

type BudgetDraftOptions = {
  existingClientId?: string;
  existingWorkId?: string;
  forceNewWork?: boolean;
  followUp?: ChatEntities;
};

function shouldResolveBeforeAI(text: string, plan: ReturnType<typeof planChatMessage>) {
  if (!plan.handled) return false;
  if (plan.source === "context") return true;

  const normalized = normalizeName(text);
  const words = normalized.split(/\s+/).filter(Boolean).length;

  if (["generate_pdf", "select_document", "mark_invoice_paid", "register_payment", "register_expense", "create_reminder", "convert_budget_to_invoice"].includes(plan.action)) {
    return true;
  }

  if (["complete_budget", "complete_invoice", "complete_activity", "use_existing_work_for_budget", "create_new_work_for_budget"].includes(plan.action)) {
    return true;
  }

  if (plan.action === "register_activity") return true;
  if ((plan.action === "create_budget" || plan.action === "create_invoice") && words <= 18) return true;

  return false;
}

function wantsExplicitContinueTask(text: string) {
  const normalized = normalizeName(text);
  return /^(continuar tarea|continua tarea|continuar la tarea|volver a tarea|retomar tarea|seguir con esto|sigamos con eso|volver al presupuesto|vuelve al presupuesto)(\b|$)/.test(normalized);
}

async function runAIChatCommand(text: string, context: ChatCommandContext | null, trace: ChatPerfTrace): Promise<ChatCommandResult | null> {
  if (!isCapatazAIConfigured()) {
    debugChat("ai_skipped", { reason: "missing_OPENAI_API_KEY" });
    await logChatPerf(trace, "ai:skipped", nowMs(), "missing_key");
    return null;
  }

  const aiStarted = nowMs();
  try {
    const contextStarted = nowMs();
    const data = await buildAIContext(context, text);
    await logChatPerf(trace, "db:ai_context", contextStarted, "ok", {
      clients: data.clients.length,
      works: data.works.length,
      budgets: data.budgets.length,
      invoices: data.invoices.length
    });
    const ai = await interpretCapatazMessageWithAI({ message: text, context, data });
    await logChatPerf(trace, "ai:interpret", aiStarted, "ok", {
      intent: ai.intent,
      confidence: ai.confidence,
      ...(ai.diagnostics ?? {})
    });
    debugChat("ai_result", ai);
    const executeStarted = nowMs();
    const result = await executeAIChatCommand(ai, context);
    await logChatPerf(trace, "ai:execute_plan", executeStarted, result?.handled ? "ok" : "no_result", {
      intent: ai.intent,
      created: result?.created ? Object.keys(result.created).filter((key) => result.created?.[key as keyof typeof result.created]) : []
    });
    return result;
  } catch (error) {
    const aiMeta = getCapatazAIErrorMeta(error);
    await logChatPerf(trace, "ai:interpret", aiStarted, "error", error instanceof Error ? { message: sanitizeAIError(error.message), ...(aiMeta ?? {}) } : aiMeta ?? undefined);
    debugChat("ai_error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
    const detail = process.env.NEXT_PUBLIC_APP_ENV !== "production" && error instanceof Error
      ? `\n\nDetalle técnico staging: ${sanitizeAIError(error.message)}`
      : "";
    return {
      handled: true,
      text: `He intentado interpretar el mensaje con IA, pero no he podido completar la lectura estructurada. No he creado ni enviado nada. Revisa OPENAI_API_KEY, OPENAI_MODEL y los logs del servidor antes de reintentarlo.${detail}`,
      context
    };
  }
}

async function buildAIContext(context: ChatCommandContext | null, text: string) {
  const ids: Partial<ReturnType<typeof contextIds>> = context ? contextIds(context) : {};
  const nameHints = extractPotentialNameHints(text);
  const clientWhere = ids.clientId
    ? { id: ids.clientId }
    : nameHints.length
      ? { OR: nameHints.map((hint) => ({ nombre: { contains: hint, mode: "insensitive" as const } })) }
      : undefined;

  const [clients, works, budgets, invoices] = await Promise.all([
    prisma.client.findMany({
      where: clientWhere,
      orderBy: { ultimaInteraccion: "desc" },
      take: clientWhere ? 12 : 8,
      select: {
        id: true,
        nombre: true,
        telefono: true,
        email: true,
        direccion: true,
        tipo: true,
        estado: true,
        origen: true,
        notas: true
      }
    }),
    prisma.work.findMany({
      where: ids.workId ? { id: ids.workId } : ids.clientId ? { clienteId: ids.clientId } : undefined,
      orderBy: { id: "desc" },
      take: ids.workId || ids.clientId ? 12 : 8,
      select: {
        id: true,
        clienteId: true,
        titulo: true,
        direccion: true,
        tipoTrabajo: true,
        estado: true,
        notas: true,
        client: { select: { nombre: true } }
      }
    }),
    prisma.budget.findMany({
      where: ids.budgetId ? { id: ids.budgetId } : ids.clientId ? { clienteId: ids.clientId } : undefined,
      orderBy: { fechaCreacion: "desc" },
      take: ids.budgetId || ids.clientId ? 10 : 6,
      select: {
        id: true,
        clienteId: true,
        obraId: true,
        numero: true,
        titulo: true,
        total: true,
        estado: true,
        client: { select: { nombre: true } }
      }
    }),
    prisma.invoice.findMany({
      where: ids.invoiceId ? { id: ids.invoiceId } : ids.clientId ? { clienteId: ids.clientId } : undefined,
      orderBy: { fechaEmision: "desc" },
      take: ids.invoiceId || ids.clientId ? 10 : 6,
      select: {
        id: true,
        clienteId: true,
        obraId: true,
        numero: true,
        concepto: true,
        total: true,
        pagado: true,
        pendiente: true,
        estado: true,
        client: { select: { nombre: true } }
      }
    })
  ]);

  return {
    chatContext: context,
    clients,
    works,
    budgets,
    invoices,
    currentDate: new Date().toISOString()
  };
}

async function executeAIChatCommand(ai: CapatazAIResult, context: ChatCommandContext | null): Promise<ChatCommandResult | null> {
  if (ai.confidence < 0.45) {
    return {
      handled: true,
      text: buildAIClarificationResponse(ai),
      context
    };
  }

  const wantsBudget = ai.intent === "crear_presupuesto" || aiHasAction(ai, "crearPresupuestoBorrador");
  const wantsInvoice = ai.intent === "crear_factura" || aiHasAction(ai, "crearFacturaBorrador");
  const wantsActivity = ai.intent === "registrar_visita" || ai.intent === "registrar_reunion" || aiHasAction(ai, "registrarVisita");
  const wantsPdf = ai.intent === "generar_pdf" || aiHasAction(ai, "generarPDF");

  if (wantsBudget && canCreateAIBudget(ai)) {
    return createBudgetDraftFromAI(ai);
  }

  if (wantsInvoice && canCreateAIInvoice(ai)) {
    return createInvoiceDraftFromAI(ai);
  }

  if (wantsActivity && ai.shouldExecute && !ai.requiresConfirmation) {
    return registerActivityFromAI(ai);
  }

  if (wantsPdf) {
    const documentKind = ai.entities.documento_tipo === "factura" ? "invoice" : ai.entities.documento_tipo === "presupuesto" ? "budget" : undefined;
    const clientName = ai.entities.empresa_facturacion ?? ai.entities.cliente_nombre ?? ai.entities.contacto_nombre;
    return buildPdfResult({ intent: "generar_pdf", documentKind, clientName }, context);
  }

  if (ai.intent === "registrar_gasto" || ai.intent === "registrar_pago" || ai.intent === "registrar_seguimiento") {
    return {
      handled: true,
      text: buildAIClarificationResponse(ai) + "\n\nAntes de guardar o programar esta acción necesito confirmación explícita. No he enviado WhatsApp, email ni he registrado movimientos definitivos.",
      context
    };
  }

  if (ai.requiresConfirmation || !ai.shouldExecute || ai.intent === "preguntar_aclaracion") {
    return {
      handled: true,
      text: buildAIClarificationResponse(ai),
      context
    };
  }

  if (ai.intent === "sin_accion") {
    return {
      handled: true,
      text: buildAIClarificationResponse(ai) || "Dime si quieres preparar un presupuesto, factura, visita, seguimiento, gasto, pago o PDF.",
      context
    };
  }

  return null;
}

function aiHasAction(ai: CapatazAIResult, action: string) {
  return ai.actionPlan.some((item) => item.action === action);
}

function canCreateAIBudget(ai: CapatazAIResult) {
  const clientName = ai.entities.empresa_facturacion ?? ai.entities.cliente_nombre ?? ai.entities.contacto_nombre;
  return Boolean(clientName && ai.entities.importe && buildAIWorkTitle(ai));
}

function canCreateAIInvoice(ai: CapatazAIResult) {
  const clientName = ai.entities.empresa_facturacion ?? ai.entities.cliente_nombre ?? ai.entities.contacto_nombre;
  return Boolean(clientName && ai.entities.importe && buildAIWorkTitle(ai));
}

async function createBudgetDraftFromAI(ai: CapatazAIResult): Promise<ChatCommandResult> {
  const entities = ai.entities;
  const clientName = entities.empresa_facturacion ?? entities.cliente_nombre ?? entities.contacto_nombre;
  const workTitle = buildAIWorkTitle(ai);
  const amount = entities.importe;

  if (!clientName || !workTitle || !amount) {
    return {
      handled: true,
      text: withQuestions(ai.userResponse, ai.clarificationQuestions) || "He entendido que quieres preparar un presupuesto, pero me falta cliente, trabajo o importe. No he creado nada."
    };
  }

  const clientMatches = await findClientMatches(clientName);
  if (clientMatches.length > 1) {
    return {
      handled: true,
      text: `He encontrado varios clientes parecidos a "${clientName}". Antes de crear nada, dime cuál quieres usar:\n${clientMatches.map((client, index) => `${index + 1}. ${client.nombre}${client.direccion ? ` · ${client.direccion}` : ""}`).join("\n")}`
    };
  }

  const existingClient = clientMatches[0] ?? null;
  const company = await activeCompany();
  const ivaMode = ivaModeFromAI(ai);
  const ivaPercent = entities.iva_porcentaje ?? company.defaultVat;
  const totals = calculateChatDocumentTotals(amount, ivaMode, ivaPercent);
  const line = buildAIBudgetLine(ai, totals.subtotal);
  const pendingFields = pendingFieldsFromAI(ai, ivaMode);
  const number = await nextDocumentNumber("budget");

  const result = await prisma.$transaction(async (tx) => {
    const client = existingClient ?? await tx.client.create({
      data: {
        nombre: clientName,
        telefono: entities.contacto_telefono ?? "Pendiente",
        email: entities.contacto_email ?? null,
        direccion: entities.direccion_fiscal ?? entities.obra_direccion ?? entities.obra_localidad ?? "Dirección pendiente",
        tipo: clientTypeFromAI(ai),
        estado: pendingFields.length ? "pendiente_datos" : "presupuesto_pendiente",
        origen: "Asistente Capataz",
        notas: buildAIClientNotes(ai),
        ultimaInteraccion: new Date()
      }
    });

    const work = await tx.work.create({
      data: {
        clienteId: client.id,
        titulo: workTitle,
        direccion: entities.obra_direccion ?? entities.obra_localidad ?? (client.direccion && client.direccion !== "Dirección pendiente" ? client.direccion : "Dirección pendiente"),
        tipoTrabajo: entities.descripcion_trabajo ?? entities.obra_tipo ?? workTitle,
        estado: "pendiente_inicio",
        fechaInicio: null,
        fechaFinPrevista: null,
        presupuestoAprobado: 0,
        gastoReal: 0,
        margenEstimado: 0,
        notas: buildAIWorkNotes(ai)
      }
    });

    const budget = await tx.budget.create({
      data: {
        clienteId: client.id,
        obraId: work.id,
        numero: number,
        titulo: workTitle,
        partidas: serializeBudgetLines([line]),
        subtotal: totals.subtotal,
        iva: totals.iva,
        descuento: 0,
        total: totals.total,
        margenEstimado: 0,
        estado: "borrador",
        fechaValidez: addDays(new Date(), 15),
        fechaSeguimiento: null,
        condiciones: company?.condicionesPorDefecto ?? "Validez 15 días. Fechas sujetas a disponibilidad y revisión de datos.",
        observaciones: buildAIBudgetObservations(ai, ivaMode),
        formaPago: "Pendiente de acordar"
      }
    });

    await tx.client.update({
      where: { id: client.id },
      data: {
        estado: pendingFields.length ? "pendiente_datos" : "presupuesto_pendiente",
        ultimaInteraccion: new Date(),
        notas: existingClient ? appendNote(client.notas, buildAIClientNotes(ai)) : undefined
      }
    });

    return { client, work, budget };
  });

  revalidateChatPaths(result.client.id, result.work.id, result.budget.id);

  const context = pendingBudgetContext({
    clientId: result.client.id,
    workId: result.work.id,
    budgetId: result.budget.id,
    clientName: result.client.nombre,
    contactName: entities.contacto_nombre,
    billingClientName: result.client.nombre,
    workName: `${result.work.titulo}${entities.obra_localidad ? ` en ${entities.obra_localidad}` : ""}`,
    amount,
    ivaMode,
    pendingFields
  });

  return {
    handled: true,
    created: {
      clientId: result.client.id,
      workId: result.work.id,
      budgetId: result.budget.id
    },
    context,
    text: buildAIBudgetMessage(ai, {
      clientName: result.client.nombre,
      contactName: entities.contacto_nombre,
      workTitle: result.work.titulo,
      amount,
      budgetId: result.budget.id,
      budgetNumber: result.budget.numero,
      ivaMode,
      pendingFields,
      clientWasCreated: !existingClient
    })
  };
}

async function createInvoiceDraftFromAI(ai: CapatazAIResult): Promise<ChatCommandResult> {
  const entities = ai.entities;
  const clientName = entities.empresa_facturacion ?? entities.cliente_nombre ?? entities.contacto_nombre;
  const workTitle = buildAIWorkTitle(ai);
  const amount = entities.importe;

  if (!clientName || !workTitle || !amount) {
    return {
      handled: true,
      text: withQuestions(ai.userResponse, ai.clarificationQuestions) || "He entendido que quieres preparar una factura, pero me falta cliente, concepto o importe. No he creado nada."
    };
  }

  const command: ParsedInvoiceCommand = {
    intent: "crear_factura",
    clientName,
    workTitle,
    lineDescription: buildAILineDescription(ai, workTitle),
    amount,
    currency: "EUR",
    ivaMode: ivaModeFromAI(ai),
    materialIncluded: entities.material_incluido === true
  };

  return createInvoiceDraftFromChat(command);
}

async function registerActivityFromAI(ai: CapatazAIResult): Promise<ChatCommandResult> {
  const entities = ai.entities;
  const clientName = entities.cliente_nombre ?? entities.contacto_nombre ?? entities.empresa_facturacion;
  const eventType = entities.tipo_actividad === "reunion"
    ? "reunion"
    : entities.tipo_actividad === "llamada"
      ? "llamada"
      : "visita";
  const workTitle = entities.obra_nombre ?? entities.descripcion_trabajo ?? entities.alcance;

  const command: ParsedActivityCommand = {
    intent: eventType === "reunion" ? "registrar_reunion" : eventType === "llamada" ? "registrar_llamada" : "registrar_visita",
    eventType,
    clientName,
    workTitle,
    eventTime: entities.hora,
    eventDateHint: undefined,
    topics: [entities.descripcion_trabajo, entities.alcance].filter(Boolean) as string[],
    materialsReviewed: Boolean(entities.material_incluido || entities.notas?.toLowerCase().includes("material")),
    pendingConfirmation: entities.datos_pendientes.some((field) => field.toLowerCase().includes("confirm")),
    notes: entities.notas ?? ai.userResponse
  };

  return registerActivityFromChat(command);
}

async function registerActivityFromChat(command: ParsedActivityCommand): Promise<ChatCommandResult> {
  if (!command.clientName) {
    return {
      handled: true,
      text: "He entendido que es una visita, reunión, llamada o nota de obra, pero me falta el cliente. No he creado gastos ni importes. ¿Con quién fue?"
    };
  }

  const clientMatches = await findClientMatches(command.clientName);
  if (clientMatches.length > 1) {
    return {
      handled: true,
      text: `He encontrado varios clientes parecidos a "${command.clientName}". Antes de registrar la actividad, dime cuál quieres usar:\n${clientMatches.map((client, index) => `${index + 1}. ${client.nombre}${client.direccion ? ` · ${client.direccion}` : ""}`).join("\n")}`
    };
  }

  const existingClient = clientMatches[0] ?? null;
  const existingWork = existingClient && command.workTitle ? await findSimilarWork(existingClient.id, command.workTitle) : null;
  const activityDate = activityDateTime(command.eventDateHint, command.eventTime);
  const isPast = activityLooksCompleted(command.notes);
  const agendaType = command.eventType === "llamada" ? "llamada" : "visita";
  const displayType = command.eventType === "reunion" ? "reunión" : command.eventType;
  const normalizedWorkTitle = command.workTitle ?? "Trabajo pendiente de definir";
  const pendingFields = activityPendingFields(command);

  const result = await prisma.$transaction(async (tx) => {
    const client = existingClient ?? await tx.client.create({
      data: {
        nombre: command.clientName!,
        telefono: "Pendiente",
        email: null,
        direccion: "Dirección pendiente",
        tipo: "Particular",
        estado: command.pendingConfirmation ? "seguimiento_pendiente" : "visita_pendiente",
        origen: "Asistente Capataz",
        notas: "Cliente provisional creado desde una actividad registrada en Capataz.",
        ultimaInteraccion: new Date()
      }
    });

    const work = command.workTitle
      ? existingWork ?? await tx.work.create({
          data: {
            clienteId: client.id,
            titulo: normalizedWorkTitle,
            direccion: client.direccion && client.direccion !== "Dirección pendiente" ? client.direccion : "Dirección pendiente",
            tipoTrabajo: normalizedWorkTitle,
            estado: "pendiente_inicio",
            fechaInicio: null,
            fechaFinPrevista: null,
            presupuestoAprobado: 0,
            gastoReal: 0,
            margenEstimado: 0,
            notas: "Obra provisional creada desde una visita o nota de Capataz."
          }
        })
      : null;

    const activityNotes = buildActivityNotes(command);
    const event = await tx.eventoAgenda.create({
      data: {
        titulo: `${titleCase(displayType)} con ${client.nombre}`,
        descripcion: activityNotes,
        tipo: agendaType,
        estado: isPast ? "realizado" : "pendiente",
        fechaInicio: activityDate,
        fechaFin: null,
        horaInicio: command.eventTime ?? timeValue(activityDate),
        horaFin: null,
        clienteId: client.id,
        obraId: work?.id ?? null,
        direccion: work?.direccion && work.direccion !== "Dirección pendiente" ? work.direccion : null,
        notas: activityNotes,
        requiereConfirmacion: false,
        confirmadoPorUsuario: true
      }
    });

    await tx.client.update({
      where: { id: client.id },
      data: {
        estado: command.pendingConfirmation ? "seguimiento_pendiente" : undefined,
        notas: appendNote(client.notas, `Actividad registrada: ${activityNotes}`),
        ultimaInteraccion: new Date()
      }
    });

    if (work) {
      await tx.work.update({
        where: { id: work.id },
        data: { notas: appendNote(work.notas, `Actividad registrada: ${activityNotes}`) }
      });
    }

    return { client, work, event };
  });

  revalidateActivityPaths(result.client.id, result.work?.id, result.event.id);

  const context = pendingFields.length
    ? createActivityCompletionContext({
        clientId: result.client.id,
        workId: result.work?.id,
        eventId: result.event.id,
        clientName: result.client.nombre,
        pendingFields
      })
    : {
        lastClientId: result.client.id,
        lastWorkId: result.work?.id,
        lastClientName: result.client.nombre
      };

  return {
    handled: true,
    created: {
      clientId: result.client.id,
      workId: result.work?.id,
      agendaEventId: result.event.id
    },
    context,
    text: activityCreatedMessage({
      command,
      clientName: result.client.nombre,
      workTitle: result.work?.titulo,
      eventId: result.event.id,
      pendingFields
    })
  };
}

async function completeActivityFromChat(context: ChatCommandContext, message: string, entities: ChatEntities): Promise<ChatCommandResult> {
  const eventId = typeof context.activeTask?.draftData?.eventId === "string" ? context.activeTask.draftData.eventId : undefined;
  if (!eventId) {
    return {
      handled: true,
      text: "Tenía una visita o nota pendiente, pero falta identificarla. No he creado recordatorios duplicados.",
      clearContext: true
    };
  }

  const event = await prisma.eventoAgenda.findUnique({
    where: { id: eventId },
    include: { client: true, work: true }
  });
  if (!event) {
    return {
      handled: true,
      text: "No encuentro la visita anterior. No he creado recordatorios duplicados.",
      clearContext: true
    };
  }

  const cleanMessage = message.trim();
  const reminderDate = reminderDateTime(cleanMessage, entities);
  const remaining = new Set(context.activeTask?.pendingFields ?? []);
  const updates: string[] = [];
  let reminderId: string | undefined;

  await prisma.$transaction(async (tx) => {
    if (cleanMessage) {
      await tx.eventoAgenda.update({
        where: { id: event.id },
        data: {
          notas: appendNote(event.notas, `Detalle añadido en Capataz: ${cleanMessage}`),
          descripcion: appendNote(event.descripcion, `Detalle: ${cleanMessage}`)
        }
      });
      updates.push("detalle añadido a la visita");
    }

    if (reminderDate) {
      const reminder = await tx.reminder.create({
        data: {
          clienteId: event.clienteId,
          obraId: event.obraId,
          tipo: "confirmar_visita",
          canal: "interno",
          mensaje: `Llamar a ${event.client?.nombre ?? "cliente"} para seguimiento de ${event.work?.titulo ?? event.titulo}. ${cleanMessage}`,
          fechaProgramada: reminderDate,
          estado: "programado",
          requiereConfirmacion: true,
          confirmadoPorUsuario: true
        }
      });
      reminderId = reminder.id;
      updates.push(`recordatorio interno programado para ${formatDateTime(reminderDate)}`);
      remaining.delete("fecha_recordatorio");
    }
  });

  revalidateActivityPaths(event.clienteId ?? undefined, event.obraId ?? undefined, event.id);
  revalidatePath("/recordatorios");

  const nextContext = remaining.size
    ? createActivityCompletionContext({
        clientId: event.clienteId ?? undefined,
        workId: event.obraId ?? undefined,
        eventId: event.id,
        clientName: event.client?.nombre ?? context.lastClientName,
        pendingFields: [...remaining],
        createdAt: context.activeTask?.createdAt
      })
    : {
        lastClientId: event.clienteId ?? undefined,
        lastWorkId: event.obraId ?? undefined,
        lastClientName: event.client?.nombre ?? context.lastClientName
      };

  return {
    handled: true,
    created: {
      clientId: event.clienteId ?? undefined,
      workId: event.obraId ?? undefined,
      agendaEventId: event.id,
      reminderId
    },
    context: nextContext,
    clearContext: !remaining.size,
    text: updates.length
      ? `${joinNatural(updates)}. No he enviado WhatsApp ni email.`
      : "Sigo con esa visita. Dime qué tiene que confirmar el cliente o cuándo quieres que te lo recuerde."
  };
}

async function createBudgetDraftFromChat(command: ParsedBudgetCommand, options: BudgetDraftOptions = {}): Promise<ChatCommandResult> {
  const clientMatches = options.existingClientId
    ? await findClientMatchesById(options.existingClientId)
    : await findClientMatches(command.clientName);
  if (clientMatches.length > 1) {
    return {
      handled: true,
      text: `He encontrado varios clientes parecidos a "${command.clientName}". Antes de crear nada, dime cuál quieres usar:\n${clientMatches.map((client, index) => `${index + 1}. ${client.nombre}${client.direccion ? ` · ${client.direccion}` : ""}`).join("\n")}`
    };
  }

  const existingClient = clientMatches[0] ?? null;
  if (existingClient && !options.forceNewWork && !options.existingWorkId) {
    const duplicateWork = await findSimilarWork(existingClient.id, command.workTitle);
    if (duplicateWork) {
      const question = `Ya existe una obra parecida para ${existingClient.nombre}: "${duplicateWork.titulo}". ¿Quieres usar esa obra o crear una nueva?`;
      return {
        handled: true,
        context: createWorkSelectionContext({
          clientId: existingClient.id,
          clientName: existingClient.nombre,
          workOption: { id: duplicateWork.id, label: duplicateWork.titulo, type: "work" },
          draftBudget: command,
          pendingFields: command.ivaMode === "unknown" ? ["iva", "direccion_obra", "datos_cliente"] : ["direccion_obra", "datos_cliente"],
          lastQuestion: question
        }),
        text: question
      };
    }
  }

  const company = await activeCompany();
  const ivaPercent = company.defaultVat;
  const totals = calculateChatDocumentTotals(command.amount, command.ivaMode, ivaPercent);
  const line = {
    descripcion: command.lineDescription,
    cantidad: 1,
    unidad: "servicio",
    precioUnitario: totals.subtotal,
    total: totals.subtotal,
    categoria: command.materialIncluded ? "Material incluido" : "General"
  };
  const number = await nextDocumentNumber("budget");

  const result = await prisma.$transaction(async (tx) => {
    const client = existingClient ?? await tx.client.create({
      data: {
        nombre: command.clientName,
        telefono: "Pendiente",
        email: null,
        direccion: "Dirección pendiente",
        tipo: "Particular",
        estado: "pendiente_datos",
        origen: "Asistente Capataz",
        notas: "Cliente provisional preparado por Capataz. Faltan apellidos, teléfono, NIF/CIF, email y dirección fiscal.",
        ultimaInteraccion: new Date()
      }
    });

    const work = options.existingWorkId
      ? options.followUp?.workAddress
        ? await tx.work.update({
            where: { id: options.existingWorkId },
            data: { direccion: options.followUp.workAddress }
          })
        : await tx.work.findUniqueOrThrow({ where: { id: options.existingWorkId } })
      : await tx.work.create({
          data: {
            clienteId: client.id,
            titulo: command.workTitle,
            direccion: options.followUp?.workAddress ?? (client.direccion && client.direccion !== "Dirección pendiente" ? client.direccion : "Dirección pendiente"),
            tipoTrabajo: command.workTitle,
            estado: "pendiente_inicio",
            fechaInicio: null,
            fechaFinPrevista: null,
            presupuestoAprobado: 0,
            gastoReal: 0,
            margenEstimado: 0,
            notas: `Trabajo provisional preparado por Capataz. Material incluido: ${command.materialIncluded ? "Sí" : "No indicado"}.`
          }
        });

    const budget = await tx.budget.create({
      data: {
        clienteId: client.id,
        obraId: work.id,
        numero: number,
        titulo: command.workTitle,
        partidas: serializeBudgetLines([line]),
        subtotal: totals.subtotal,
        iva: totals.iva,
        descuento: 0,
        total: totals.total,
        margenEstimado: 0,
        estado: "borrador",
        fechaValidez: addDays(new Date(), 15),
        fechaSeguimiento: null,
        condiciones: company?.condicionesPorDefecto ?? "Borrador pendiente de revisar antes de enviar.",
        observaciones: buildBudgetObservations(command),
        formaPago: "Pendiente de acordar"
      }
    });

    await tx.client.update({
      where: { id: client.id },
      data: {
        estado: existingClient ? "presupuesto_pendiente" : "pendiente_datos",
        telefono: options.followUp?.phone ?? undefined,
        email: options.followUp?.email ?? undefined,
        notas: options.followUp?.nif ? appendNote(client.notas, `NIF/CIF indicado en Capataz: ${options.followUp.nif}.`) : undefined,
        ultimaInteraccion: new Date()
      }
    });

    return { client, work, budget };
  });

  revalidateChatPaths(result.client.id, result.work.id, result.budget.id);

  const context = pendingBudgetContext({
    clientId: result.client.id,
    workId: result.work.id,
    budgetId: result.budget.id,
    clientName: result.client.nombre,
    billingClientName: result.client.nombre,
    workName: result.work.titulo,
    amount: command.amount,
    ivaMode: command.ivaMode,
    pendingFields: budgetPendingFields(command.ivaMode, options.followUp)
  });

  return {
    handled: true,
    created: {
      clientId: result.client.id,
      workId: result.work.id,
      budgetId: result.budget.id
    },
    context,
    text: budgetCreatedMessage({
      clientName: result.client.nombre,
      workTitle: result.work.titulo,
      amount: command.amount,
      materialIncluded: command.materialIncluded,
      budgetId: result.budget.id,
      budgetNumber: result.budget.numero,
      ivaMode: command.ivaMode,
      clientWasCreated: !existingClient
    })
  };
}

async function applyBudgetFollowUp(context: ChatCommandContext, followUp: ChatEntities): Promise<ChatCommandResult> {
  const ids = contextIds(context);
  if (!ids.budgetId || !ids.clientId) {
    return { handled: true, text: "Tenía una acción pendiente, pero falta el identificador del presupuesto. Abre el presupuesto desde Documentos y edítalo manualmente.", clearContext: true };
  }

  const budget = await prisma.budget.findUnique({
    where: { id: ids.budgetId },
    include: { client: true, work: true }
  });

  if (!budget) {
    return { handled: true, text: "No encuentro el presupuesto anterior. No he creado duplicados. Puedes abrir Documentos y revisar los borradores.", clearContext: true };
  }

  const company = await activeCompany();
  const ivaPercent = company.defaultVat;
  const updates: string[] = [];
  const remaining = new Set(context.activeTask?.pendingFields ?? []);
  let currentBudgetAmount = typeof context.activeTask?.draftData?.amount === "number"
    ? context.activeTask.draftData.amount
    : amountForIvaUpdate(budget.subtotal, budget.iva, budget.total, followUp.ivaMode ?? (budget.iva > 0 ? "plus" : "none"));
  let currentIvaMode: IvaMode = followUp.ivaMode ?? (context.activeTask?.iva === "included" || context.activeTask?.iva === "plus" || context.activeTask?.iva === "none" ? context.activeTask.iva : budget.iva > 0 ? "plus" : "none");

  await prisma.$transaction(async (tx) => {
    if (followUp.amount) {
      currentBudgetAmount = followUp.amount;
      currentIvaMode = followUp.ivaMode ?? currentIvaMode;
      const totals = calculateChatDocumentTotals(currentBudgetAmount, currentIvaMode, ivaPercent);
      const lines = retotalLines(parseBudgetLines(budget.partidas), budget.titulo, totals.subtotal);
      await tx.budget.update({
        where: { id: budget.id },
        data: {
          partidas: serializeBudgetLines(lines),
          subtotal: totals.subtotal,
          iva: totals.iva,
          total: totals.total,
          observaciones: appendNote(budget.observaciones, `Importe confirmado en Capataz: ${formatEuros(currentBudgetAmount)}${currentIvaMode === "plus" ? " + IVA" : currentIvaMode === "included" ? " IVA incluido" : ""}.`)
        }
      });
      updates.push(`importe ${formatEuros(currentBudgetAmount)}${currentIvaMode === "plus" ? " + IVA" : currentIvaMode === "included" ? " IVA incluido" : ""}`);
      if (followUp.ivaMode) remaining.delete("iva");
    }

    if (followUp.ivaMode && !followUp.amount) {
      currentIvaMode = followUp.ivaMode;
      const basis = amountForIvaUpdate(budget.subtotal, budget.iva, budget.total, followUp.ivaMode);
      currentBudgetAmount = basis;
      const totals = calculateChatDocumentTotals(basis, followUp.ivaMode, ivaPercent);
      const lines = retotalLines(parseBudgetLines(budget.partidas), budget.titulo, totals.subtotal);
      await tx.budget.update({
        where: { id: budget.id },
        data: {
          partidas: serializeBudgetLines(lines),
          subtotal: totals.subtotal,
          iva: totals.iva,
          total: totals.total,
          observaciones: appendNote(budget.observaciones, ivaObservation(followUp.ivaMode))
        }
      });
      updates.push(ivaSummary(followUp.ivaMode));
      remaining.delete("iva");
    }

    if (followUp.workAddress && budget.obraId) {
      await tx.work.update({
        where: { id: budget.obraId },
        data: {
          direccion: followUp.workAddress,
          notas: appendNote(budget.work?.notas, `Dirección/localización completada en Capataz: ${followUp.workAddress}.`)
        }
      });
      updates.push(`obra en ${followUp.workAddress}`);
      remaining.delete("direccion_obra");
    }

    const clientData: { telefono?: string; email?: string; direccion?: string; notas?: string; ultimaInteraccion: Date } = { ultimaInteraccion: new Date() };
    if (followUp.phone) {
      clientData.telefono = followUp.phone;
      updates.push(`teléfono del cliente ${followUp.phone}`);
      remaining.delete("datos_cliente");
    }
    if (followUp.email) {
      clientData.email = followUp.email;
      updates.push(`email ${followUp.email}`);
      remaining.delete("datos_cliente");
    }
    if (followUp.fiscalAddress) {
      clientData.direccion = followUp.fiscalAddress;
      updates.push(`dirección fiscal ${followUp.fiscalAddress}`);
    }
    if (followUp.nif) {
      clientData.notas = appendNote(budget.client.notas, `NIF/CIF indicado en Capataz: ${followUp.nif}.`);
      updates.push(`NIF/CIF ${followUp.nif}`);
    }
    if (followUp.nif || followUp.fiscalAddress) {
      remaining.delete("datos_cliente");
      if (followUp.nif && followUp.fiscalAddress) remaining.delete("datos_fiscales");
    }
    if (followUp.phone || followUp.email || followUp.nif || followUp.fiscalAddress) {
      await tx.client.update({ where: { id: budget.clienteId }, data: clientData });
    }
  });

  if (followUp.leavePending) {
    remaining.clear();
  }

  revalidateChatPaths(budget.clienteId, budget.obraId ?? undefined, budget.id);

  const nextContext = remaining.size
    ? createBudgetCompletionContext({
        clientId: budget.clienteId,
        workId: budget.obraId ?? undefined,
        budgetId: budget.id,
        clientName: budget.client.nombre,
        billingClientName: context.activeTask?.billingClientName ?? budget.client.nombre,
        contactName: context.activeTask?.contactName,
        workName: budget.work?.titulo ?? context.activeTask?.workName,
        pendingFields: [...remaining],
        draftData: { ...(typeof context.activeTask?.draftData === "object" && context.activeTask.draftData ? context.activeTask.draftData : {}), amount: currentBudgetAmount },
        createdAt: context.activeTask?.createdAt
      })
    : latestDocumentContext("budget", budget.id, budget.clienteId, budget.obraId ?? undefined, budget.client.nombre);

  if (!updates.length && followUp.leavePending) {
    return {
      handled: true,
      text: `De acuerdo, dejo esos datos pendientes en el presupuesto de ${budget.client.nombre}. No he enviado nada al cliente.`,
      context: nextContext
    };
  }

  if (!updates.length) {
    return {
      handled: true,
      text: pendingBudgetQuestion(context),
      context
    };
  }

  return {
    handled: true,
    context: nextContext,
    created: {
      clientId: budget.clienteId,
      workId: budget.obraId ?? undefined,
      budgetId: budget.id
    },
    text: `Perfecto, he actualizado el presupuesto de ${budget.client.nombre}: ${joinNatural(updates)}. Ya puedes revisarlo o generar el PDF. No he enviado nada al cliente.`
  };
}

async function applyInvoiceFollowUp(context: ChatCommandContext, entities: ChatEntities): Promise<ChatCommandResult> {
  const ids = contextIds(context);
  if (!ids.invoiceId && !ids.clientId) {
    return { handled: true, text: "Tenía una factura pendiente, pero falta identificarla. Abre Facturas o dime cliente y número de factura.", clearContext: true };
  }

  if (entities.invoiceStatus === "pagada") return markInvoicePaidFromChat(entities, context);
  if (entities.amount) return registerPaymentFromChat(entities, context);

  const invoice = ids.invoiceId
    ? await prisma.invoice.findUnique({ where: { id: ids.invoiceId }, include: { client: true, work: true } })
    : null;
  if (!invoice) {
    return { handled: true, text: "No encuentro la factura anterior. No he creado ni enviado nada.", clearContext: true };
  }

  const updates: string[] = [];
  await prisma.$transaction(async (tx) => {
    if (entities.workAddress && invoice.obraId) {
      await tx.work.update({ where: { id: invoice.obraId }, data: { direccion: entities.workAddress } });
      updates.push(`obra en ${entities.workAddress}`);
    }

    const clientData: { telefono?: string; email?: string; direccion?: string; notas?: string; ultimaInteraccion: Date } = { ultimaInteraccion: new Date() };
    if (entities.phone) {
      clientData.telefono = entities.phone;
      updates.push(`teléfono ${entities.phone}`);
    }
    if (entities.email) {
      clientData.email = entities.email;
      updates.push(`email ${entities.email}`);
    }
    if (entities.fiscalAddress) {
      clientData.direccion = entities.fiscalAddress;
      updates.push(`dirección fiscal ${entities.fiscalAddress}`);
    }
    if (entities.nif) {
      clientData.notas = appendNote(invoice.client.notas, `NIF/CIF indicado en Capataz: ${entities.nif}.`);
      updates.push(`NIF/CIF ${entities.nif}`);
    }
    if (entities.phone || entities.email || entities.nif || entities.fiscalAddress) {
      await tx.client.update({ where: { id: invoice.clienteId }, data: clientData });
    }
  });

  revalidateInvoicePaths(invoice.clienteId, invoice.obraId ?? undefined, invoice.id);

  if (!updates.length) {
    return {
      handled: true,
      text: `Sigo con la factura ${invoice.numero} de ${invoice.client.nombre}. Puedes darme datos fiscales, registrar un pago o pedirme el PDF.`,
      context
    };
  }

  return {
    handled: true,
    created: { clientId: invoice.clienteId, workId: invoice.obraId ?? undefined, invoiceId: invoice.id },
    context: latestDocumentContext("invoice", invoice.id, invoice.clienteId, invoice.obraId ?? undefined, invoice.client.nombre),
    text: `Perfecto, he actualizado la factura ${invoice.numero} de ${invoice.client.nombre}: ${joinNatural(updates)}. No he enviado nada al cliente.`
  };
}

async function markInvoicePaidFromChat(entities: ChatEntities, context: ChatCommandContext): Promise<ChatCommandResult> {
  const invoices = await findInvoiceCandidates(entities, context);
  if (!invoices.length) {
    return { handled: true, text: "No encuentro una factura pendiente clara para marcar como pagada. Dime el cliente o el número de factura.", context };
  }

  if (invoices.length > 1) {
    const question = `He encontrado varias facturas. Dime cuál marco como pagada:\n${invoices.map((invoice, index) => `${index + 1}. ${invoice.numero} · ${invoice.client.nombre} · ${formatEuros(invoice.pendiente)} pendiente`).join("\n")}`;
    return {
      handled: true,
      text: question,
      context: {
        ...context,
        activeTask: {
          type: "register_payment",
          clienteId: invoices[0].clienteId,
          pendingDecision: {
            type: "select_document",
            options: invoices.map((invoice) => ({ id: invoice.id, label: invoice.numero, type: "invoice" }))
          },
          draftData: { action: "mark_invoice_paid" },
          lastQuestion: question,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    };
  }

  const invoice = invoices[0];
  if (invoice.pendiente <= 0) {
    return {
      handled: true,
      text: `La factura ${invoice.numero} de ${invoice.client.nombre} ya estaba pagada.`,
      context: latestDocumentContext("invoice", invoice.id, invoice.clienteId, invoice.obraId ?? undefined, invoice.client.nombre)
    };
  }

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        facturaId: invoice.id,
        clienteId: invoice.clienteId,
        obraId: invoice.obraId,
        importe: invoice.pendiente,
        metodo: invoice.metodoPago ?? "transferencia",
        fecha: new Date(),
        tipo: "pago_final",
        notas: "Marcada como pagada desde Capataz."
      }
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: { pagado: invoice.total, pendiente: 0, estado: "pagada" }
    })
  ]);

  revalidateInvoicePaths(invoice.clienteId, invoice.obraId ?? undefined, invoice.id);

  return {
    handled: true,
    created: { clientId: invoice.clienteId, workId: invoice.obraId ?? undefined, invoiceId: invoice.id },
    context: latestDocumentContext("invoice", invoice.id, invoice.clienteId, invoice.obraId ?? undefined, invoice.client.nombre),
    text: `He marcado como pagada la factura ${invoice.numero} de ${invoice.client.nombre} y he registrado el pago final de ${formatEuros(invoice.pendiente)}.`
  };
}

async function registerPaymentFromChat(entities: ChatEntities, context: ChatCommandContext): Promise<ChatCommandResult> {
  if (!entities.amount || entities.amount <= 0) {
    return { handled: true, text: "He entendido que quieres registrar un pago, pero me falta el importe.", context };
  }

  const invoices = await findInvoiceCandidates(entities, context);
  if (!invoices.length) {
    return { handled: true, text: "No encuentro una factura clara para ese pago. Dime el cliente o número de factura.", context };
  }

  if (invoices.length > 1) {
    const question = `He encontrado varias facturas. Dime en cuál registro el pago de ${formatEuros(entities.amount)}:\n${invoices.map((invoice, index) => `${index + 1}. ${invoice.numero} · ${invoice.client.nombre} · ${formatEuros(invoice.pendiente)} pendiente`).join("\n")}`;
    return {
      handled: true,
      text: question,
      context: {
        ...context,
        activeTask: {
          type: "register_payment",
          clienteId: invoices[0].clienteId,
          pendingDecision: {
            type: "select_document",
            options: invoices.map((invoice) => ({ id: invoice.id, label: invoice.numero, type: "invoice" }))
          },
          draftData: { action: "register_payment", amount: entities.amount },
          lastQuestion: question,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    };
  }

  const invoice = invoices[0];
  const nuevoPagado = Math.min(invoice.total, invoice.pagado + entities.amount);
  const nuevoPendiente = Math.max(0, invoice.total - nuevoPagado);
  const estado = deriveInvoiceStatus(invoice.total, nuevoPendiente, invoice.fechaVencimiento);

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        facturaId: invoice.id,
        clienteId: invoice.clienteId,
        obraId: invoice.obraId,
        importe: entities.amount,
        metodo: "transferencia",
        fecha: new Date(),
        tipo: nuevoPendiente <= 0 ? "pago_final" : "pago_parcial",
        notas: "Pago registrado desde Capataz."
      }
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: { pagado: nuevoPagado, pendiente: nuevoPendiente, estado }
    })
  ]);

  revalidateInvoicePaths(invoice.clienteId, invoice.obraId ?? undefined, invoice.id);

  return {
    handled: true,
    created: { clientId: invoice.clienteId, workId: invoice.obraId ?? undefined, invoiceId: invoice.id },
    context: latestDocumentContext("invoice", invoice.id, invoice.clienteId, invoice.obraId ?? undefined, invoice.client.nombre),
    text: `He registrado un pago de ${formatEuros(entities.amount)} en la factura ${invoice.numero} de ${invoice.client.nombre}. Pendiente actualizado: ${formatEuros(nuevoPendiente)}.`
  };
}

async function createInvoiceDraftFromChat(command: ParsedInvoiceCommand): Promise<ChatCommandResult> {
  const clientMatches = await findClientMatches(command.clientName);
  if (clientMatches.length > 1) {
    return {
      handled: true,
      text: `He encontrado varios clientes parecidos a "${command.clientName}". Antes de crear la factura, dime cuál quieres usar:\n${clientMatches.map((client, index) => `${index + 1}. ${client.nombre}${client.direccion ? ` · ${client.direccion}` : ""}`).join("\n")}`
    };
  }

  const existingClient = clientMatches[0] ?? null;
  const existingWork = existingClient ? await findSimilarWork(existingClient.id, command.workTitle) : null;
  const company = await activeCompany();
  const ivaPercent = company.defaultVat;
  const totals = calculateChatDocumentTotals(command.amount, command.ivaMode, ivaPercent);
  const line = {
    descripcion: command.lineDescription,
    cantidad: 1,
    unidad: "servicio",
    precioUnitario: totals.subtotal,
    total: totals.subtotal,
    categoria: command.materialIncluded ? "Material incluido" : "General"
  };
  const number = await nextDocumentNumber("invoice");

  const result = await prisma.$transaction(async (tx) => {
    const client = existingClient ?? await tx.client.create({
      data: {
        nombre: command.clientName,
        telefono: "Pendiente",
        email: null,
        direccion: "Dirección pendiente",
        tipo: "Particular",
        estado: "pendiente_datos",
        origen: "Asistente Capataz",
        notas: "Cliente provisional preparado por Capataz para una factura. Faltan NIF/CIF y dirección fiscal.",
        ultimaInteraccion: new Date()
      }
    });

    const work = existingWork ?? await tx.work.create({
      data: {
        clienteId: client.id,
        titulo: command.workTitle,
        direccion: client.direccion && client.direccion !== "Dirección pendiente" ? client.direccion : "Dirección pendiente",
        tipoTrabajo: command.workTitle,
        estado: "pendiente_cobro",
        fechaInicio: null,
        fechaFinPrevista: null,
        presupuestoAprobado: totals.total,
        gastoReal: 0,
        margenEstimado: 0,
        notas: "Obra provisional preparada por Capataz para una factura. Revisar antes de enviar."
      }
    });

    const invoice = await tx.invoice.create({
      data: {
        clienteId: client.id,
        obraId: work.id,
        numero: number,
        concepto: command.workTitle,
        partidas: serializeBudgetLines([line]),
        importeBase: totals.subtotal,
        iva: totals.iva,
        total: totals.total,
        pagado: 0,
        pendiente: totals.total,
        fechaEmision: new Date(),
        fechaVencimiento: addDays(new Date(), 7),
        estado: "borrador",
        observaciones: `${invoiceIvaObservation(command.ivaMode)} Revisar datos fiscales antes de enviar.`,
        metodoPago: "Pendiente de acordar",
        datosBancarios: company?.iban ?? null
      }
    });

    await tx.client.update({
      where: { id: client.id },
      data: {
        estado: existingClient ? "pendiente_cobro" : "pendiente_datos",
        ultimaInteraccion: new Date()
      }
    });

    return { client, work, invoice };
  });

  revalidateInvoicePaths(result.client.id, result.work.id, result.invoice.id);

  const context: ChatCommandContext = createInvoiceCompletionContext({
    clientId: result.client.id,
    workId: result.work.id,
    invoiceId: result.invoice.id,
    clientName: result.client.nombre,
    pendingFields: ["datos_fiscales"]
  });

  return {
    handled: true,
    created: {
      clientId: result.client.id,
      workId: result.work.id,
      invoiceId: result.invoice.id
    },
    context,
    text: `He creado una factura en borrador para ${result.client.nombre}.

Cliente: ${result.client.nombre}${existingClient ? "" : " (provisional)"}
Concepto: ${command.workTitle}
Importe: ${formatEuros(command.amount)}
IVA: ${invoiceIvaLabel(command.ivaMode)}
Factura: ${result.invoice.numero}

Antes de enviarla falta revisar NIF/CIF y dirección fiscal del cliente. PDF disponible aquí: /dinero/${result.invoice.id}/pdf`
  };
}

async function convertBudgetToInvoiceFromChat(command: ParsedConvertBudgetCommand, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  let budgetId = context ? contextIds(context).budgetId : undefined;

  if (!budgetId && command.clientName) {
    const clientMatches = await findClientMatches(command.clientName);
    if (clientMatches.length > 1) {
      return {
        handled: true,
        text: `He encontrado varios clientes parecidos a "${command.clientName}". Dime cuál quieres usar antes de convertir el presupuesto.`
      };
    }
    const client = clientMatches[0] ?? null;
    if (!client) {
      return { handled: true, text: `No encuentro ningún cliente llamado ${command.clientName} con presupuesto aceptado. No he creado factura.` };
    }
    const acceptedBudget = await prisma.budget.findFirst({
      where: { clienteId: client.id, estado: "aceptado" },
      orderBy: { fechaCreacion: "desc" }
    });
    budgetId = acceptedBudget?.id;
  }

  if (!budgetId) {
    return { handled: true, text: "Necesito saber qué presupuesto aceptado quieres convertir en factura. Dime, por ejemplo: “convierte el presupuesto aceptado del cliente en factura”." };
  }

  const budget = await prisma.budget.findUnique({ where: { id: budgetId }, include: { client: true } });
  if (!budget) return { handled: true, text: "No encuentro ese presupuesto. No he creado factura." };
  if (budget.estado !== "aceptado") {
    return { handled: true, text: `He encontrado ${budget.numero}, pero todavía no está aceptado. Para evitar errores, márcalo como aceptado o confirma manualmente antes de convertirlo en factura.` };
  }

  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      clienteId: budget.clienteId,
      obraId: budget.obraId,
      observaciones: { contains: budget.numero }
    },
    orderBy: { fechaEmision: "desc" }
  });

  if (existingInvoice) {
    return {
      handled: true,
      context: latestDocumentContext("invoice", existingInvoice.id, budget.clienteId, budget.obraId ?? undefined, budget.client.nombre),
      text: `Ya existe una factura creada desde ${budget.numero}: ${existingInvoice.numero}. PDF disponible aquí: /dinero/${existingInvoice.id}/pdf`
    };
  }

  const invoice = await prisma.invoice.create({
    data: {
      clienteId: budget.clienteId,
      obraId: budget.obraId,
      numero: await nextDocumentNumber("invoice"),
      concepto: `Factura de ${budget.titulo}`,
      partidas: budget.partidas,
      importeBase: budget.subtotal,
      iva: budget.iva,
      total: budget.total,
      pagado: 0,
      pendiente: budget.total,
      fechaEmision: new Date(),
      fechaVencimiento: addDays(new Date(), 7),
      estado: "borrador",
      observaciones: `Creada desde presupuesto aceptado ${budget.numero}. Revisar antes de enviar al cliente.`,
      metodoPago: budget.formaPago,
      datosBancarios: null
    }
  });

  revalidateInvoicePaths(budget.clienteId, budget.obraId ?? undefined, invoice.id);
  revalidatePath("/presupuestos");
  revalidatePath(`/presupuestos/${budget.id}`);

  return {
    handled: true,
    created: {
      clientId: budget.clienteId,
      workId: budget.obraId ?? undefined,
      invoiceId: invoice.id
    },
    context: latestDocumentContext("invoice", invoice.id, budget.clienteId, budget.obraId ?? undefined, budget.client.nombre),
    text: `He creado una factura en borrador desde el presupuesto aceptado ${budget.numero} de ${budget.client.nombre}. Revisa los datos fiscales antes de enviarla. PDF disponible aquí: /dinero/${invoice.id}/pdf`
  };
}

async function buildPdfResult(command: ParsedPdfCommand, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  if (context) {
    const fromContext = buildPdfResultFromContext(context, command.documentKind);
    if (fromContext.handled) return fromContext;
  }

  if (!command.clientName) {
    return { handled: true, text: "Dime de qué cliente o documento quieres el PDF, o abre primero un presupuesto/factura desde Capataz." };
  }

  const clientMatches = await findClientMatches(command.clientName);
  const client = clientMatches[0] ?? null;
  if (!client) return { handled: true, text: `No encuentro documentos para ${command.clientName}.` };

  if (command.documentKind === "invoice") {
    const invoice = await prisma.invoice.findFirst({ where: { clienteId: client.id }, orderBy: { fechaEmision: "desc" } });
    if (!invoice) return { handled: true, text: `No encuentro facturas de ${client.nombre}.` };
    return pdfResult("invoice", invoice.id, client.id, invoice.obraId ?? undefined, client.nombre);
  }

  const budget = await prisma.budget.findFirst({ where: { clienteId: client.id }, orderBy: { fechaCreacion: "desc" } });
  if (!budget) return { handled: true, text: `No encuentro presupuestos de ${client.nombre}.` };
  return pdfResult("budget", budget.id, client.id, budget.obraId ?? undefined, client.nombre);
}

function buildPdfResultFromContext(context: ChatCommandContext, requestedKind?: ChatDocumentKind): ChatCommandResult {
  const ids = contextIds(context);
  const kind = context.lastDocumentType ?? (ids.invoiceId ? "invoice" : ids.budgetId ? "budget" : undefined);
  const id = kind === "invoice" ? ids.invoiceId : ids.budgetId;
  if (!kind || !id) return { handled: false, text: "" };
  if (requestedKind && requestedKind !== kind) return { handled: false, text: "" };
  return pdfResult(kind, id, ids.clientId, ids.workId, context.lastClientName);
}

function pdfResult(kind: ChatDocumentKind, id: string, clientId?: string, workId?: string, clientName?: string): ChatCommandResult {
  const path = kind === "budget" ? `/presupuestos/${id}/pdf` : `/dinero/${id}/pdf`;
  return {
    handled: true,
    context: latestDocumentContext(kind, id, clientId, workId, clientName),
    result: {
      type: "generated",
      entityType: "pdf",
      entityId: id,
      title: "PDF generado",
      summary: {
        tipo: kind === "budget" ? "Presupuesto" : "Factura",
        cliente: clientName ?? null,
        url: `${path}?preview=1`
      },
      actions: [
        { label: "Ver PDF", href: `${path}?preview=1`, style: "primary" },
        { label: "Descargar PDF", href: path },
        { label: kind === "budget" ? "Editar presupuesto" : "Editar factura", href: kind === "budget" ? `/gestion?tipo=presupuesto&id=${id}&returnTo=/capataz` : `/gestion?tipo=factura&id=${id}&returnTo=/capataz` }
      ]
    },
    text: `PDF listo para revisar aquí: ${path}?preview=1
Descarga directa: ${path}.
No he enviado nada al cliente.`
  };
}

function isParsedActivityCommand(command: { intent: string }): command is ParsedActivityCommand {
  return command.intent === "registrar_visita"
    || command.intent === "registrar_reunion"
    || command.intent === "registrar_llamada"
    || command.intent === "registrar_nota_obra";
}

function debugChat(step: string, payload: unknown) {
  const enabled = process.env.CAPATAZ_CHAT_DEBUG === "true" || process.env.NEXT_PUBLIC_APP_ENV !== "production";
  if (!enabled) return;
  console.info(`[capataz-chat] ${step}`, JSON.stringify(payload, null, 2));
}

async function persistIncomingChatMessage(text: string, context: ChatCommandContext | null, options: ChatCommandOptions) {
  const idempotencyKey = options.idempotencyKey ?? options.messageId;
  const conversation = await ensureChatConversation(options.conversationId, text);
  const conversationId = conversation.id;
  const conversationContext = normalizeConversationContext(conversation.activeTask) ?? context ?? null;
  if (!idempotencyKey) {
    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        role: "user",
        content: text,
        status: "processing",
        context: toJsonValue(conversationContext),
        metadata: toJsonValue({ clientStartedAt: options.clientStartedAt })
      }
    });
    await touchChatConversation(conversationId);
    return { messageId: message.id, conversationId, context: conversationContext, duplicate: false, result: null as ChatCommandResult | null };
  }

  const existing = await prisma.chatMessage.findUnique({ where: { idempotencyKey } });
  if (existing) {
    const completed = resultFromChatMetadata(existing.metadata);
    if (completed) return { messageId: existing.id, conversationId: existing.conversationId, context: conversationContext, duplicate: true, result: completed };
    if (existing.status === "processing") return { messageId: existing.id, conversationId: existing.conversationId, context: conversationContext, duplicate: true, result: null };
  }

  const message = await prisma.chatMessage.upsert({
    where: { idempotencyKey },
    create: {
      id: options.messageId,
      conversationId,
      idempotencyKey,
      role: "user",
      content: text,
      status: "saved",
      context: toJsonValue(conversationContext),
      metadata: toJsonValue({ clientStartedAt: options.clientStartedAt })
    },
    update: {
      context: toJsonValue(conversationContext),
      metadata: toJsonValue({ clientStartedAt: options.clientStartedAt, retriedAt: new Date().toISOString() })
    }
  });
  await touchChatConversation(message.conversationId);

  const lock = await prisma.chatMessage.updateMany({
    where: { id: message.id, status: { in: ["saved", "failed"] } },
    data: { status: "processing" }
  });

  if (lock.count === 0) {
    const latest = await prisma.chatMessage.findUnique({ where: { id: message.id } });
    const completed = resultFromChatMetadata(latest?.metadata);
    return { messageId: message.id, conversationId: message.conversationId, context: conversationContext, duplicate: true, result: completed };
  }

  return { messageId: message.id, conversationId: message.conversationId, context: conversationContext, duplicate: false, result: null as ChatCommandResult | null };
}

async function completeChatMessage(messageId: string | undefined, result: ChatCommandResult) {
  if (!messageId) return;
  const sourceMessage = await prisma.chatMessage.findUnique({ where: { id: messageId }, select: { conversationId: true, idempotencyKey: true } });
  const conversationId = sourceMessage?.conversationId;
  if (!conversationId) return;
  const metadata = toJsonValue({
    result,
    completedAt: new Date().toISOString()
  });
  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { status: "completed", metadata }
  });

  if (result.text) {
    await prisma.chatMessage.create({
      data: {
        conversationId,
        role: "assistant",
        content: result.text,
        status: "completed",
        metadata: toJsonValue({ replyTo: messageId, created: result.created ?? null, result: result.result ?? null })
      }
    });
  }
  if (result.result) {
    await prisma.chatActionLog.create({
      data: {
        conversationId,
        messageId,
        stage: "action_result",
        actionType: result.result.entityType,
        status: result.result.type,
        idempotencyKey: sourceMessage.idempotencyKey ?? undefined,
        summary: result.result.title,
        result: toJsonValue(result.result),
        metadata: toJsonValue({ created: result.created ?? null })
      }
    }).catch(() => undefined);
  }
  await updateConversationAfterResult(conversationId, result, sourceMessage.idempotencyKey);
}

async function failChatMessage(messageId: string | undefined, error: unknown) {
  if (!messageId) return;
  await prisma.chatMessage.update({
    where: { id: messageId },
    data: {
      status: "failed",
      metadata: toJsonValue({
        failedAt: new Date().toISOString(),
        error: error instanceof Error ? sanitizeAIError(error.message) : "unknown"
      })
    }
  }).catch(() => undefined);
}

export async function loadChatConversations(includeArchived = false): Promise<ChatHistoryConversation[]> {
  const conversations = await prisma.chatConversation.findMany({
    where: includeArchived ? undefined : { status: "active" },
    orderBy: { lastActivityAt: "desc" },
    take: 40,
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 80
      }
    }
  });

  return conversations
    .filter((conversation) => shouldShowConversationInHistory(conversation.messages.length, isRecord(conversation.metadata) && conversation.metadata.keepVisible === true))
    .map((conversation) => chatConversationToHistory(conversation));
}

export async function getOrCreateInitialConversation(preferredConversationId?: string | null): Promise<{ selected: ChatHistoryConversation; conversations: ChatHistoryConversation[]; reason: "restored_preferred" | "restored_recent" | "created_inactive" | "created_empty" }> {
  const now = new Date();
  const threshold = new Date(now.getTime() - CHAT_INACTIVITY_MS);
  const preferred = preferredConversationId
    ? await prisma.chatConversation.findFirst({
        where: { id: preferredConversationId, status: "active" },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 80 } }
      })
    : null;

  if (preferred && preferred.lastActivityAt >= threshold) {
    const conversations = await loadChatConversations(false);
    safeChatLog("conversation:init", { conversationId: preferred.id, reason: "restored_preferred" });
    return { selected: chatConversationToHistory(preferred), conversations: includeSelectedConversation(conversations, preferred), reason: "restored_preferred" };
  }

  const recent = await prisma.chatConversation.findFirst({
    where: { status: "active", lastActivityAt: { gte: threshold } },
    orderBy: { lastActivityAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 80 } }
  });

  if (recent) {
    const conversations = await loadChatConversations(false);
    safeChatLog("conversation:init", { conversationId: recent.id, reason: "restored_recent" });
    return { selected: chatConversationToHistory(recent), conversations: includeSelectedConversation(conversations, recent), reason: "restored_recent" };
  }

  const reusableEmpty = await prisma.chatConversation.findMany({
    where: {
      status: "active",
      messages: { none: {} }
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { messages: { orderBy: { createdAt: "asc" }, take: 80 } }
  }).catch(() => null);
  const empty = reusableEmpty?.find((conversation) => !conversation.activeTask) ?? null;

  const selected = empty ?? await prisma.chatConversation.create({
    data: {
      title: "Nueva conversación",
      status: "active",
      activeTask: undefined,
      metadata: toJsonValue({ reason: preferred ? "inactive_preferred" : "initial_empty" }),
      lastActivityAt: now
    },
    include: { messages: true }
  });

  const conversations = await loadChatConversations(false);
  const reason = preferred ? "created_inactive" as const : "created_empty" as const;
  safeChatLog("conversation:init", { conversationId: selected.id, previousConversationId: preferred?.id, reason });
  return { selected: chatConversationToHistory(selected), conversations: includeSelectedConversation(conversations, selected), reason };
}

function chatConversationToHistory(conversation: {
  id: string;
  title: string;
  status: string;
  activeTask?: unknown;
  metadata?: unknown;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    status: string;
    createdAt: Date;
    metadata: unknown;
  }>;
}): ChatHistoryConversation {
  return {
    id: conversation.id,
    title: conversation.title,
    status: conversation.status,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastActivityAt: conversation.lastActivityAt.toISOString(),
    activeTask: normalizeConversationContext(conversation.activeTask),
    metadata: conversation.metadata ?? undefined,
    messages: conversation.messages
      .filter((message) => message.role === "user" || message.role === "assistant" || message.role === "system")
      .map((message) => ({
        id: message.id,
        role: message.role as "assistant" | "user" | "system",
        text: message.content,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
        metadata: message.metadata ?? undefined,
        result: actionResultFromMessageMetadata(message.metadata)
      }))
  };
}

function includeSelectedConversation(conversations: ChatHistoryConversation[], selected: Parameters<typeof chatConversationToHistory>[0]) {
  if (conversations.some((conversation) => conversation.id === selected.id)) return conversations;
  return selected.messages.length ? [chatConversationToHistory(selected), ...conversations] : conversations;
}

export async function createChatConversation(title = "Nueva conversación") {
  const conversation = await prisma.chatConversation.create({
    data: {
      title: cleanConversationTitle(title) || "Nueva conversación",
      activeTask: undefined,
      metadata: toJsonValue({ createdFrom: "new_chat_button" }),
      lastActivityAt: new Date()
    },
    include: { messages: true }
  });
  safeChatLog("conversation:new", { conversationId: conversation.id });
  revalidatePath("/capataz");
  return chatConversationToHistory(conversation);
}

export async function renameChatConversation(conversationId: string, title: string) {
  const nextTitle = cleanConversationTitle(title);
  if (!nextTitle) return;
  await prisma.chatConversation.update({ where: { id: conversationId }, data: { title: nextTitle } });
  revalidatePath("/capataz");
}

export async function archiveChatConversation(conversationId: string) {
  await prisma.chatConversation.update({ where: { id: conversationId }, data: { status: "archived", archivedAt: new Date(), activeTask: undefined } });
  safeChatLog("conversation:archive", { conversationId });
  revalidatePath("/capataz");
}

export async function deleteChatConversation(conversationId: string) {
  await prisma.chatConversation.delete({ where: { id: conversationId } }).catch(() => undefined);
  safeChatLog("conversation:delete", { conversationId });
  revalidatePath("/capataz");
}

async function ensureChatConversation(conversationId: string | undefined, firstText: string) {
  if (conversationId) {
    const existing = await prisma.chatConversation.findFirst({ where: { id: conversationId, status: "active" } });
    if (existing) return existing;
    safeChatLog("conversation:missing_selected", { conversationId });
  }

  const created = await prisma.chatConversation.create({
    data: {
      title: titleFromUserMessage(firstText),
      status: "active",
      activeTask: undefined,
      metadata: toJsonValue({ createdFrom: conversationId ? "missing_selected_fallback" : "message_without_conversation" }),
      lastActivityAt: new Date()
    }
  });
  safeChatLog("conversation:create_for_message", { conversationId: created.id, previousConversationId: conversationId });
  return created;
}

async function updateConversationAfterResult(conversationId: string, result: ChatCommandResult, idempotencyKey?: string | null) {
  const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId }, select: { title: true } });
  if (!conversation) return;
  const generic = !conversation.title || conversation.title === "Nueva conversación" || conversation.title === "Conversación anterior" || conversation.title === "Conversación principal";
  const firstUserMessage = generic
    ? await prisma.chatMessage.findFirst({ where: { conversationId, role: "user" }, orderBy: { createdAt: "asc" }, select: { content: true } })
    : null;
  const nextContext = result.clearContext ? null : result.context ?? undefined;
  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: {
      title: generic ? titleFromUserMessage(firstUserMessage?.content ?? result.text) : conversation.title,
      activeTask: nextContext === undefined ? undefined : toJsonValue(nextContext),
      lastActivityAt: new Date(),
      metadata: result.result ? toJsonValue({ lastResult: result.result, lastIdempotencyKey: idempotencyKey ?? null }) : undefined
    }
  }).catch(() => undefined);
}

async function touchChatConversation(conversationId: string) {
  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { lastActivityAt: new Date() }
  }).catch(() => undefined);
}

function titleFromUserMessage(text: string) {
  const cleaned = cleanConversationTitle(text);
  if (!cleaned) return "Nueva conversación";
  const normalized = normalizeName(cleaned);
  if (normalized.includes("presupuesto")) return compactTitle(cleaned, "Presupuesto");
  if (normalized.includes("factura")) return compactTitle(cleaned, "Factura");
  if (normalized.includes("visita") || normalized.includes("reunion") || normalized.includes("llamada")) return compactTitle(cleaned, "Visita");
  if (normalized.includes("gasto") || normalized.includes("material")) return compactTitle(cleaned, "Gasto/material");
  if (normalized.includes("pago") || normalized.includes("pagado")) return compactTitle(cleaned, "Pago");
  return cleaned.slice(0, 58);
}

function compactTitle(text: string, prefix: string) {
  return `${prefix} ${text.replace(/^(haz|crea|crear|creame|créame|hacer|apunta|registrar|registra)\s+/i, "").slice(0, 48)}`.trim();
}

function cleanConversationTitle(title: string) {
  return title.replace(/\s+/g, " ").replace(/[\n\r\t]/g, " ").trim().slice(0, 80);
}

async function logChatPerf(trace: ChatPerfTrace, stage: string, startedAt: number, status: string, metadata?: Record<string, unknown>) {
  const durationMs = Math.max(0, Math.round(nowMs() - startedAt));
  const payload = { stage, status, durationMs, messageId: trace.messageId, conversationId: trace.conversationId, ...(metadata ?? {}) };
  if (process.env.CAPATAZ_CHAT_DEBUG === "true" || process.env.NEXT_PUBLIC_APP_ENV !== "production") {
    console.info("[capataz-chat-perf]", JSON.stringify(payload));
  }

  await prisma.chatActionLog.create({
    data: {
      conversationId: trace.conversationId,
      messageId: trace.messageId,
      stage,
      actionType: stage,
      status,
      idempotencyKey: trace.idempotencyKey,
      summary: typeof metadata?.action === "string" ? metadata.action : stage,
      durationMs,
      payload: toJsonValue({ stage, status }),
      metadata: toJsonValue(metadata ?? {})
    }
  }).catch(() => undefined);
}

function resultFromChatMetadata(value: unknown): ChatCommandResult | null {
  const metadata = isRecord(value) ? value : null;
  const result = isRecord(metadata?.result) ? metadata.result : null;
  if (!result || typeof result.text !== "string" || typeof result.handled !== "boolean") return null;
  return result as ChatCommandResult;
}

function actionResultFromMessageMetadata(value: unknown): ChatActionResult | undefined {
  const metadata = isRecord(value) ? value : null;
  const result = isRecord(metadata?.result) ? metadata.result : null;
  if (isChatActionResult(result)) return result;
  const commandResult = isRecord(result?.result) ? result.result : null;
  return isChatActionResult(commandResult) ? commandResult : undefined;
}

function isChatActionResult(value: unknown): value is ChatActionResult {
  if (!isRecord(value)) return false;
  return typeof value.type === "string"
    && typeof value.entityType === "string"
    && typeof value.title === "string"
    && isRecord(value.summary)
    && Array.isArray(value.actions);
}

function normalizeConversationContext(value: unknown): ChatCommandContext | null {
  if (!isRecord(value)) return null;
  if (isRecord(value.activeTask) || isRecord(value.parkedTask) || isRecord(value.lastQuery) || typeof value.lastDocumentType === "string") {
    return normalizeChatContext(value as ChatCommandContext);
  }
  return null;
}

function safeChatLog(event: string, metadata: Record<string, unknown>) {
  const enabled = process.env.CAPATAZ_CHAT_DEBUG === "true" || process.env.NEXT_PUBLIC_APP_ENV !== "production";
  if (!enabled) return;
  console.info("[capataz-chat-state]", JSON.stringify({ event, ...metadata }));
}

function toJsonValue(value: unknown) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value ?? null));
}

function nowMs() {
  return Date.now();
}

function extractPotentialNameHints(text: string) {
  const matches = text.match(/\b[A-ZÁÉÍÓÚÑ][\p{L}ÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}ÁÉÍÓÚÑáéíóúñ]+){0,2}\b/gu) ?? [];
  const ignored = new Set(["Tengo", "Quiere", "Hemos", "Factura", "Presupuesto", "Capataz"]);
  return [...new Set(matches.map((match) => match.trim()).filter((match) => match.length > 2 && !ignored.has(match)))].slice(0, 6);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeAIError(message: string) {
  return message
    .replace(/sk-[A-Za-z0-9_*.-]+/g, "[OPENAI_API_KEY]")
    .replace(/\[OPENAI_API_KEY\][A-Za-z0-9_*.-]+/g, "[OPENAI_API_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 700);
}

async function findClientMatches(name: string) {
  const target = normalizeName(name);
  const clients = await prisma.client.findMany({
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, direccion: true, notas: true }
  });

  const exactMatches = clients.filter((client) => normalizeName(client.nombre) === target);
  if (exactMatches.length) return exactMatches;

  const targetTokens = target.split(" ").filter(Boolean);
  if (targetTokens.length < 2) return [];

  return clients.filter((client) => {
    const normalized = normalizeName(client.nombre);
    return normalized.startsWith(`${target} `);
  });
}

async function findClientMatchesById(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, nombre: true, direccion: true, notas: true }
  });
  return client ? [client] : [];
}

async function findInvoiceCandidates(entities: ChatEntities, context: ChatCommandContext) {
  const ids = contextIds(context);
  if (ids.invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: ids.invoiceId },
      include: { client: true }
    });
    return invoice ? [invoice] : [];
  }

  let clientId = ids.clientId;
  if (entities.clientName) {
    const matches = await findClientMatches(entities.clientName);
    if (matches.length === 1) clientId = matches[0].id;
  }

  if (!clientId) return [];

  return prisma.invoice.findMany({
    where: { clienteId: clientId },
    include: { client: true },
    orderBy: [{ pendiente: "desc" }, { fechaEmision: "desc" }]
  });
}

async function findSimilarWork(clientId: string, title: string) {
  const targetWords = new Set(normalizeName(title).split(" ").filter((word) => word.length > 2));
  const works = await prisma.work.findMany({
    where: { clienteId: clientId },
    select: { id: true, titulo: true, direccion: true, notas: true }
  });

  return works.find((work) => {
    const normalized = normalizeName(work.titulo);
    if (normalized === normalizeName(title)) return true;
    const words = normalized.split(" ").filter((word) => word.length > 2);
    const overlap = words.filter((word) => targetWords.has(word)).length;
    return targetWords.size >= 2 && overlap >= Math.min(2, targetWords.size);
  }) ?? null;
}

function calculateChatDocumentTotals(amount: number, ivaMode: IvaMode, ivaPercent: number) {
  if (ivaMode === "included") {
    const subtotal = roundMoney(amount / (1 + ivaPercent / 100));
    return {
      subtotal,
      iva: roundMoney(amount - subtotal),
      total: roundMoney(amount)
    };
  }

  if (ivaMode === "plus") {
    const iva = roundMoney(amount * (ivaPercent / 100));
    return {
      subtotal: roundMoney(amount),
      iva,
      total: roundMoney(amount + iva)
    };
  }

  return {
    subtotal: roundMoney(amount),
    iva: 0,
    total: roundMoney(amount)
  };
}

function activityDateTime(dateHint?: "today" | "tomorrow", eventTime?: string) {
  const date = new Date();
  if (dateHint === "tomorrow") date.setDate(date.getDate() + 1);
  if (eventTime) {
    const [hours, minutes] = eventTime.split(":").map(Number);
    date.setHours(hours || 0, minutes || 0, 0, 0);
  }
  return date;
}

function activityLooksCompleted(notes: string) {
  const normalized = notes
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /(he tenido|ha sido|hemos revisado|hemos hablado|he hablado|he ido|visita ha sido|reunion ha sido)/.test(normalized);
}

function activityPendingFields(command: ParsedActivityCommand) {
  const fields: string[] = [];
  if (command.materialsReviewed) fields.push("materiales_revisados");
  if (command.pendingConfirmation) {
    fields.push("pendiente_de_confirmar");
    fields.push("fecha_recordatorio");
  }
  return fields;
}

function buildActivityNotes(command: ParsedActivityCommand) {
  const parts = [
    command.notes,
    command.materialsReviewed ? "Se revisaron materiales." : null,
    command.pendingConfirmation ? "Queda confirmación pendiente por parte del cliente." : null
  ].filter(Boolean);
  return parts.join("\n");
}

function activityCreatedMessage({
  command,
  clientName,
  workTitle,
  eventId,
  pendingFields
}: {
  command: ParsedActivityCommand;
  clientName: string;
  workTitle?: string;
  eventId: string;
  pendingFields: string[];
}) {
  const typeLabel = command.eventType === "reunion" ? "reunión" : command.eventType;
  const time = command.eventTime ? ` a las ${command.eventTime}` : "";
  const work = workTitle ? ` sobre ${workTitle}` : "";
  const notes = [
    command.materialsReviewed ? "He anotado que revisasteis materiales." : null,
    command.pendingConfirmation ? `${clientName} tiene que confirmar.` : null
  ].filter(Boolean).join(" ");
  const questions = [
    pendingFields.includes("materiales_revisados") ? "¿Qué materiales revisasteis?" : null,
    pendingFields.includes("pendiente_de_confirmar") ? "¿Qué tiene que confirmar exactamente?" : null,
    pendingFields.includes("fecha_recordatorio") ? "¿Cuándo quieres que te recuerde llamarle si no responde?" : null
  ].filter(Boolean).map((question, index) => `${index + 1}. ${question}`).join("\n");

  return `He registrado la ${typeLabel} con ${clientName}${work}${time}.

${notes || "He guardado la nota en la agenda interna."}

${questions ? `Para dejar el seguimiento mejor preparado:\n\n${questions}` : `Puedes revisarla en /agenda?buscar=${encodeURIComponent(eventId)}.`}`;
}

function reminderDateTime(message: string, entities: ChatEntities) {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const hint = entities.reminderDateHint ?? (normalized.includes("manana") ? "tomorrow" : normalized.includes("hoy") ? "today" : undefined);
  const weekday = weekdayDate(normalized);
  if (!hint && !weekday && !entities.reminderTime) return null;
  const date = weekday ?? new Date();
  if (hint === "tomorrow") date.setDate(date.getDate() + 1);
  const time = entities.reminderTime ?? "10:00";
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours || 10, minutes || 0, 0, 0);
  return date;
}

function weekdayDate(normalized: string) {
  const weekdays: Record<string, number> = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6
  };
  const match = normalized.match(/\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/);
  if (!match?.[1]) return null;
  const target = weekdays[match[1]];
  const date = new Date();
  const delta = (target - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + delta);
  return date;
}

function timeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function amountForIvaUpdate(subtotal: number, iva: number, total: number, mode: IvaMode) {
  if (mode === "included") return roundMoney(total);
  if (mode === "plus") return iva > 0 ? roundMoney(subtotal) : roundMoney(total);
  return iva > 0 ? roundMoney(subtotal) : roundMoney(total);
}

function retotalLines(lines: BudgetLine[], title: string, newSubtotal: number) {
  const normalized = lines.length ? lines : [{ descripcion: title, cantidad: 1, unidad: "servicio", precioUnitario: newSubtotal, total: newSubtotal, categoria: "General" }];
  const currentSubtotal = normalized.reduce((sum, line) => sum + line.total, 0);
  if (currentSubtotal <= 0) {
    return normalized.map((line, index) => index === 0 ? { ...line, precioUnitario: newSubtotal, total: newSubtotal } : { ...line, precioUnitario: 0, total: 0 });
  }

  let accumulated = 0;
  return normalized.map((line, index) => {
    const isLast = index === normalized.length - 1;
    const total = isLast ? roundMoney(newSubtotal - accumulated) : roundMoney(line.total * (newSubtotal / currentSubtotal));
    accumulated += total;
    const cantidad = line.cantidad || 1;
    return { ...line, total, precioUnitario: roundMoney(total / cantidad) };
  });
}

function ivaModeFromAI(ai: CapatazAIResult): IvaMode {
  if (ai.entities.iva_porcentaje === 0) return "none";
  if (ai.entities.iva_incluido === true) return "included";
  if (ai.entities.iva_incluido === false) return "plus";
  return "unknown";
}

function buildAIWorkTitle(ai: CapatazAIResult) {
  const entities = ai.entities;
  const base = entities.descripcion_trabajo ?? entities.alcance ?? entities.obra_nombre;
  if (!base) return null;

  let title = base;
  if (entities.cantidad && entities.unidad_cantidad && !title.includes(String(entities.cantidad))) {
    title = `${title} ${entities.cantidad} ${entities.unidad_cantidad}`;
  }
  const workPlaceType = entities.obra_tipo ?? (/hotel/i.test(entities.obra_nombre ?? "") ? entities.obra_nombre : null);
  if (workPlaceType && !title.toLowerCase().includes(workPlaceType.toLowerCase())) {
    title = `${title} en ${workPlaceType}`;
  }

  return sentenceLike(title);
}

function buildAIBudgetLine(ai: CapatazAIResult, subtotal: number): BudgetLine {
  const firstLine = ai.entities.partidas[0];
  const quantity = firstLine?.cantidad ?? ai.entities.cantidad ?? 1;
  const total = firstLine?.total ?? subtotal;
  const safeQuantity = quantity > 0 ? quantity : 1;
  const description = firstLine?.descripcion ?? buildAILineDescription(ai, buildAIWorkTitle(ai) ?? "Trabajo");

  return {
    descripcion: description,
    cantidad: safeQuantity,
    unidad: firstLine?.unidad ?? ai.entities.unidad_cantidad ?? "servicio",
    precioUnitario: firstLine?.precioUnitario ?? roundMoney(total / safeQuantity),
    total: roundMoney(total),
    categoria: firstLine?.categoria ?? (ai.entities.material_incluido ? "Material incluido" : "General")
  };
}

function buildAILineDescription(ai: CapatazAIResult, fallback: string) {
  const entities = ai.entities;
  const details = [
    entities.descripcion_trabajo ?? fallback,
    entities.alcance && !fallback.toLowerCase().includes(entities.alcance.toLowerCase()) ? entities.alcance : null,
    entities.material_incluido ? "material incluido" : null,
    entities.duracion_estimada ? `duración estimada ${entities.duracion_estimada}` : null
  ].filter(Boolean);
  return sentenceLike(details.join(", "));
}

function pendingFieldsFromAI(ai: CapatazAIResult, ivaMode: IvaMode) {
  const fields = new Set<PendingField>();
  const pendingText = ai.entities.datos_pendientes.join(" ").toLowerCase();

  if (ivaMode === "unknown" || pendingText.includes("iva")) fields.add("iva");
  if (!ai.entities.obra_direccion || pendingText.includes("direccion obra") || pendingText.includes("dirección obra")) fields.add("direccion_obra");
  if (!ai.entities.contacto_telefono && !ai.entities.contacto_email) fields.add("datos_cliente");
  if (!ai.entities.cliente_nif || !ai.entities.direccion_fiscal || pendingText.includes("cif") || pendingText.includes("nif") || pendingText.includes("fiscal")) {
    fields.add("datos_fiscales");
  }

  return [...fields];
}

function clientTypeFromAI(ai: CapatazAIResult) {
  if (ai.entities.empresa_facturacion) return "Empresa";
  if (ai.entities.cliente_tipo === "empresa") return "Empresa";
  if (ai.entities.cliente_tipo === "autonomo") return "Autónomo";
  return "Particular";
}

function buildAIClientNotes(ai: CapatazAIResult) {
  const entities = ai.entities;
  const notes = [
    entities.contacto_nombre && entities.empresa_facturacion ? `Contacto operativo: ${entities.contacto_nombre}.` : null,
    entities.contacto_telefono ? `Teléfono contacto: ${entities.contacto_telefono}.` : null,
    entities.contacto_email ? `Email contacto: ${entities.contacto_email}.` : null,
    entities.cliente_nif ? `NIF/CIF: ${entities.cliente_nif}.` : null,
    entities.direccion_fiscal ? `Dirección fiscal: ${entities.direccion_fiscal}.` : null,
    entities.datos_pendientes.length ? `Datos pendientes: ${entities.datos_pendientes.join(", ")}.` : null
  ].filter(Boolean);

  return notes.join("\n") || "Cliente provisional preparado por Capataz. Faltan datos para emitir documentos definitivos.";
}

function buildAIWorkNotes(ai: CapatazAIResult) {
  const entities = ai.entities;
  const notes = [
    entities.obra_tipo ? `Tipo de obra: ${entities.obra_tipo}.` : null,
    entities.obra_localidad ? `Localidad: ${entities.obra_localidad}.` : null,
    entities.alcance ? `Alcance: ${entities.alcance}.` : null,
    entities.cantidad && entities.unidad_cantidad ? `Cantidad: ${entities.cantidad} ${entities.unidad_cantidad}.` : null,
    entities.material_incluido === true ? "Material incluido en el precio." : null,
    entities.duracion_estimada ? `Duración estimada: ${entities.duracion_estimada}.` : null,
    entities.notas ? entities.notas : null
  ].filter(Boolean);

  return notes.join("\n") || "Obra provisional preparada por Capataz.";
}

function buildAIBudgetObservations(ai: CapatazAIResult, ivaMode: IvaMode) {
  const notes = [
    invoiceIvaObservation(ivaMode),
    `Material incluido: ${ai.entities.material_incluido ? "Sí" : "No indicado"}.`,
    ai.entities.duracion_estimada ? `Duración estimada: ${ai.entities.duracion_estimada}.` : null,
    ai.entities.datos_pendientes.length ? `Pendiente de completar: ${ai.entities.datos_pendientes.join(", ")}.` : null
  ].filter(Boolean);

  return notes.join(" ");
}

function buildAIBudgetMessage(ai: CapatazAIResult, details: {
  clientName: string;
  contactName?: string;
  workTitle: string;
  amount: number;
  budgetId: string;
  budgetNumber: string;
  ivaMode: IvaMode;
  pendingFields: string[];
  clientWasCreated: boolean;
}) {
  const pending = details.pendingFields.length || ai.clarificationQuestions.length
    ? `\n\nPara dejarlo bien cerrado me falta:\n\n${[
        ...new Set([
          ...ai.clarificationQuestions,
          details.pendingFields.includes("iva") ? `Confirmar si los ${formatEuros(details.amount)} son con IVA incluido o más IVA.` : null,
          details.pendingFields.includes("datos_fiscales") ? "CIF/NIF y dirección fiscal del cliente de facturación." : null,
          details.pendingFields.includes("direccion_obra") ? "Dirección exacta de la obra." : null,
          (details.contactName || details.pendingFields.includes("datos_cliente") || (!ai.entities.contacto_telefono && !ai.entities.contacto_email))
            ? `Teléfono o email de ${details.contactName ?? "contacto"}.`
            : null
        ].filter(Boolean) as string[])
      ].map((question, index) => `${index + 1}. ${question}`).join("\n")}`
    : "";
  const contact = details.contactName && details.contactName !== details.clientName ? `Contacto: ${details.contactName}\n` : "";
  const location = ai.entities.obra_localidad ? `\nUbicación: ${ai.entities.obra_localidad}` : "";
  const duration = ai.entities.duracion_estimada ? `\nDuración estimada: ${ai.entities.duracion_estimada}` : "";

  return `He preparado el nuevo trabajo en borrador.

${contact}Cliente de facturación: ${details.clientName}${details.clientWasCreated ? " (provisional)" : ""}
Obra: ${details.workTitle}${location}
Importe acordado: ${formatEuros(details.amount)}
Material incluido: ${ai.entities.material_incluido ? "Sí" : "No indicado"}${duration}
Presupuesto: ${details.budgetNumber}

Puedes revisarlo y editarlo aquí: /presupuestos/${details.budgetId}${pending}

No he enviado ningún documento al cliente.`;
}

function buildAIClarificationResponse(ai: CapatazAIResult) {
  const entitySummary = [
    ai.entities.contacto_nombre ? `Contacto: ${ai.entities.contacto_nombre}` : null,
    ai.entities.empresa_facturacion ? `Cliente de facturación: ${ai.entities.empresa_facturacion}` : null,
    ai.entities.descripcion_trabajo ? `Trabajo: ${ai.entities.descripcion_trabajo}` : null,
    ai.entities.importe ? `Importe: ${formatEuros(ai.entities.importe)}` : null
  ].filter(Boolean).join("\n");
  const intro = entitySummary ? `He entendido estos datos:\n\n${entitySummary}` : "Necesito un poco más de contexto para preparar una acción segura.";
  return withQuestions(intro, ai.clarificationQuestions);
}

function withQuestions(response: string, questions: string[]) {
  const clean = response.trim();
  if (!questions.length) return clean;
  const list = questions.map((question, index) => `${index + 1}. ${question}`).join("\n");
  return `${clean}\n\n${list}`.trim();
}

function sentenceLike(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : clean;
}

function buildBudgetObservations(command: ParsedBudgetCommand) {
  const ivaNote = invoiceIvaObservation(command.ivaMode);
  return `${ivaNote} Material incluido: ${command.materialIncluded ? "Sí" : "No indicado"}. Revisar antes de enviar al cliente.`;
}

function ivaObservation(mode: Exclude<IvaMode, "unknown">) {
  if (mode === "included") return "IVA incluido confirmado.";
  if (mode === "plus") return "IVA añadido aparte confirmado.";
  return "Presupuesto marcado sin IVA.";
}

function invoiceIvaObservation(mode: IvaMode) {
  if (mode === "included") return "IVA incluido en el importe indicado.";
  if (mode === "plus") return "IVA añadido aparte sobre la base indicada.";
  if (mode === "none") return "Sin IVA.";
  return "IVA pendiente de confirmar: no queda claro si el importe incluye IVA o si hay que añadirlo aparte.";
}

function ivaSummary(mode: Exclude<IvaMode, "unknown">) {
  if (mode === "included") return "IVA incluido";
  if (mode === "plus") return "IVA aparte";
  return "sin IVA";
}

function invoiceIvaLabel(mode: IvaMode) {
  if (mode === "included") return "incluido";
  if (mode === "plus") return "añadido aparte";
  if (mode === "none") return "sin IVA";
  return "pendiente de confirmar";
}

function budgetCreatedMessage({
  clientName,
  workTitle,
  amount,
  materialIncluded,
  budgetId,
  budgetNumber,
  ivaMode,
  clientWasCreated
}: {
  clientName: string;
  workTitle: string;
  amount: number;
  materialIncluded: boolean;
  budgetId: string;
  budgetNumber: string;
  ivaMode: IvaMode;
  clientWasCreated: boolean;
}) {
  const ivaQuestion = ivaMode === "unknown"
    ? "1. ¿Los " + formatEuros(amount) + " son con IVA incluido o hay que añadir IVA aparte?"
    : "1. He aplicado el IVA según lo indicado. ¿Quieres revisarlo antes de enviar?";

  return `He preparado un presupuesto en borrador para ${clientName}.

Cliente: ${clientName}${clientWasCreated ? " (provisional)" : ""}
Trabajo: ${workTitle}
Importe: ${formatEuros(amount)}
Material incluido: ${materialIncluded ? "Sí" : "No indicado"}
Estado: Borrador
Presupuesto: ${budgetNumber}

Para dejarlo bien cerrado me falta confirmar:

${ivaQuestion}
2. ¿Dónde es la obra?
3. ¿Quieres completar los datos de ${clientName} con teléfono, apellidos, NIF/CIF o email?

Puedes revisarlo y editarlo aquí: /presupuestos/${budgetId}`;
}

function pendingBudgetQuestion(context: ChatCommandContext) {
  const clientName = context.lastClientName ?? "ese cliente";
  return `Sigo con el presupuesto de ${clientName}. Me falta IVA, dirección de la obra o datos del cliente. Puedes contestar algo como “con IVA y en Mallorca”, “más IVA y en calle Mayor 12” o “tel 65898784”.`;
}

function pendingBudgetContext({
  clientId,
  workId,
  budgetId,
  clientName,
  contactName,
  billingClientName,
  workName,
  amount,
  ivaMode,
  pendingFields
}: {
  clientId: string;
  workId: string;
  budgetId: string;
  clientName: string;
  contactName?: string;
  billingClientName?: string;
  workName?: string;
  amount?: number;
  ivaMode: IvaMode;
  pendingFields?: string[];
}): ChatCommandContext {
  return createBudgetCompletionContext({
    clientId,
    workId,
    budgetId,
    clientName,
    contactName,
    billingClientName,
    workName,
    pendingFields: pendingFields ?? (ivaMode === "unknown" ? ["iva", "direccion_obra", "datos_cliente"] : ["direccion_obra", "datos_cliente"]),
    draftData: amount ? { amount } : undefined
  });
}

function budgetPendingFields(ivaMode: IvaMode, followUp?: ChatEntities) {
  const fields = new Set<string>();
  if (ivaMode === "unknown" && !followUp?.ivaMode) fields.add("iva");
  if (!followUp?.workAddress) fields.add("direccion_obra");
  if (!followUp?.phone && !followUp?.email && !followUp?.nif) fields.add("datos_cliente");
  return [...fields];
}

function latestDocumentContext(kind: ChatDocumentKind, id: string, clientId?: string, workId?: string, clientName?: string): ChatCommandContext {
  return createLastDocumentContext({
    documentType: kind,
    documentId: id,
    clientId,
    workId,
    clientName
  });
}

function contextIds(context: ChatCommandContext) {
  const normalized = normalizeChatContext(context);
  const task = normalized.activeTask;
  return {
    clientId: task?.clienteId ?? normalized.lastClientId,
    workId: task?.obraId ?? normalized.lastWorkId,
    budgetId: task?.presupuestoId ?? normalized.lastBudgetId,
    invoiceId: task?.facturaId ?? normalized.lastInvoiceId
  };
}

function appendNote(current: string | null | undefined, note: string) {
  const cleanCurrent = (current ?? "").trim();
  if (cleanCurrent.includes(note)) return cleanCurrent || note;
  return cleanCurrent ? `${cleanCurrent}\n${note}` : note;
}

function joinNatural(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function revalidateChatPaths(clientId?: string, workId?: string, budgetId?: string) {
  revalidatePath("/capataz");
  revalidatePath("/documentos");
  revalidatePath("/presupuestos");
  if (budgetId) revalidatePath(`/presupuestos/${budgetId}`);
  revalidatePath("/clientes");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/obras");
  if (workId) revalidatePath(`/obras/${workId}`);
  revalidatePath("/hoy");
}

function revalidateInvoicePaths(clientId?: string, workId?: string, invoiceId?: string) {
  revalidatePath("/capataz");
  revalidatePath("/documentos");
  revalidatePath("/dinero");
  if (invoiceId) revalidatePath(`/dinero/${invoiceId}`);
  revalidatePath("/clientes");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/obras");
  if (workId) revalidatePath(`/obras/${workId}`);
  revalidatePath("/hoy");
}

function revalidateActivityPaths(clientId?: string, workId?: string, eventId?: string) {
  revalidatePath("/capataz");
  revalidatePath("/agenda");
  revalidatePath("/recordatorios");
  revalidatePath("/clientes");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/obras");
  if (workId) revalidatePath(`/obras/${workId}`);
  if (eventId) revalidatePath(`/agenda?evento=${eventId}`);
  revalidatePath("/hoy");
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatEuros(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
