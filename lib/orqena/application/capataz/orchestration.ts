import { draftBudgetCommandFromContext, mergeBudgetCommandWithEntities, planChatMessage, type ChatContext } from "@/lib/capataz-chat-engine";
import { classifyChatIntent, normalizeQueryText, type ChatIntentClassification } from "@/lib/capataz-chat-query";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext, withCompanyContext } from "@/lib/auth/session";
import { companySettingsView } from "@/lib/tenant/company-settings";
import { runConversationTurn } from "@/lib/orqena/conversation-service";
import { requireCapability, resolveAuthorization, resolveScopedEntityIds, resolveScopedTaskIds } from "@/lib/commercial/authorization";
import type { CapabilityKey } from "@/lib/commercial/catalog";
import { type ConversationTenantContext } from "@/lib/orqena/conversation-repository";
import { registerActivityFromChat } from "@/lib/orqena/application/capataz/ai-mutations";
import { applyBudgetFollowUp, applyInvoiceFollowUp, buildPdfResult, buildPdfResultFromContext, completeActivityFromChat, convertBudgetToInvoiceFromChat, createBudgetDraftFromChat, createInvoiceDraftFromChat, debugChat, isParsedActivityCommand, markInvoicePaidFromChat, pdfResult, persistIncomingChatMessage, registerPaymentFromChat } from "@/lib/orqena/application/capataz/business-mutations";
import { completeChatMessage, failChatMessage, logChatPerf, looksLikeExplicitWorkflowMutation, looksLikeWorkflowContractMutation, nowMs, sanitizeAIError } from "@/lib/orqena/application/capataz/conversation-use-cases";
import { queryBudgetByExactAmount, queryBusinessHealth, queryInvoiceByAmount, queryLatestBudget, queryPendingBudgetsCount, queryPendingInvoicesCount, queryTreasuryAvailableCash, queryTreasuryBreakEven, queryTreasuryCashflow, queryTreasuryCollections, queryTreasuryCoverage, queryTreasuryDueInvoices, queryTreasuryForecast, queryTreasuryMinimumBreach, queryTreasuryPayments, queryTreasuryReview, queryTreasuryScenario, queryTreasuryScenarioCompare, queryTreasuryStatus, queryTreasuryWorkCashConsumption } from "@/lib/orqena/application/capataz/finance-queries";
import { queryBusinessBestWork, queryBusinessClientHighestDebt, queryBusinessComparison, queryBusinessMargin, queryBusinessMetric, queryBusinessProfit, queryBusinessQuoteConversion, queryBusinessRecommendations, queryBusinessReviewToday, queryBusinessSignals, queryBusinessSlowestClient } from "@/lib/orqena/application/capataz/intelligence-queries";
import { continueLatestPendingTask, queryAgendaToday, queryClientBudgets, queryClientContacts, queryClientPayments, queryInternalNotes, queryPendingNotifications, queryPendingRemindersCount, queryProjectHighestExpenses, queryRecentDocuments, queryUpcomingVisits, queryWorkDocuments, queryWorkHighestRevenue, queryWorkLowestMargin, queryWorksByStatus, queryWorksEndingToday, queryWorksStartingThisWeek } from "@/lib/orqena/application/capataz/record-queries";
import { buildActionResult, enrichChatContext, personalizeContextGreeting, runAIChatCommand, shouldResolveBeforeAI, wantsExplicitContinueTask } from "@/lib/orqena/application/capataz/result-context";
import { handlerNameForIntent, isPendingDetailCategory, isPendingDetailFollowUp, queryAutomations, queryBudgetByAmount, queryPendingTaskDetails, queryPendingTasksSummary, queryProfessionalFollowUps, queryProfessionalTasks, withQueryDiagnostics } from "@/lib/orqena/application/capataz/workflow-queries";

export async function conversationTenantContext(): Promise<ConversationTenantContext> {
  if (process.env.CAPATAZ_TEST_DATABASE_ISOLATED === "true") {
    const isolated = await requireCompanyContext();
    if (isolated.sessionId === "isolated-test-session") return { userId: isolated.userId, companyId: isolated.companyId, membershipId: isolated.membershipId };
  }
  const { userId, companyId, membershipId } = await requireCapability("orqena.use");
  return { userId, companyId, membershipId };
}

export async function activeCompany() {
  const context = await requireCompanyContext();
  return prisma.company.findUniqueOrThrow({ where: { id: context.companyId } }).then(companySettingsView);
}

export type ChatDocumentKind = "budget" | "invoice";

export type PendingField = "iva" | "direccion_obra" | "datos_cliente" | "datos_fiscales";

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

export type ChatPerfTrace = {
  messageId?: string;
  conversationId?: string;
  idempotencyKey?: string;
  startedAt: number;
};

export async function runChatCommand(text: string, context?: ChatCommandContext | null, options: ChatCommandOptions = {}): Promise<ChatCommandResult> {
  const authorization = await requireOrqenaAuthorization();
  if (authorization) {
    const profile = authorization.functionalProfileKey ?? "";
    if (["PROJECT_MANAGER", "WORK_MANAGER", "TEAM_SUPERVISOR", "WORKER", "EXTERNAL_COLLABORATOR"].includes(profile)) {
      return answerScopedPortalQuery(authorization, text, context ?? null);
    }
    const classified = classifyChatIntent(text);
    const databaseIntent = databaseIntentForMessage(text, classified, context ?? null);
    const requiredCapability = databaseIntent ? capabilityForOrqenaIntent(databaseIntent) : null;
    if (databaseIntent && !requiredCapability) return { handled: true, text: "Esa consulta no tiene una política de acceso segura en tu portal. No se ha leído ni modificado ningún dato." };
    if (requiredCapability) {
      const requiredCapabilities = [...new Set([requiredCapability, ...additionalCapabilitiesForOrqenaIntent(databaseIntent!)])];
      const decisions = await Promise.all(requiredCapabilities.map((capability) => resolveAuthorization(authorization, capability)));
      if (decisions.some((decision) => !decision.allowed || decision.scope !== "COMPANY")) return { handled: true, text: "Esa consulta está fuera de tu alcance en Orqena. No se ha leído ni modificado ningún dato." };
    }
  }
  if (authorization && typeof withCompanyContext === "function") return withCompanyContext(authorization, () => runChatCommandInCompany(text, context, options));
  return runChatCommandInCompany(text, context, options);
}

function capabilityForOrqenaIntent(intent: ChatIntentClassification): CapabilityKey | null {
  const action = intent.action ?? "";
  if (action.startsWith("recommendations_")) return "orqena.execute";
  if (action === "client_payments") return "treasury.view";
  if (action === "project_highest_expenses") return "purchase_cost.view";
  if (action === "recent_documents") return "reports.view";
  if (action.startsWith("treasury_")) return "treasury.view";
  if (action.startsWith("business_") || action.startsWith("signals_") || ["client_highest_debt", "outstanding_invoices"].includes(action)) return "reports.view";
  if (["work_highest_revenue", "work_lowest_margin"].includes(action)) return "profitability.view";
  if ((action.includes("budget") || action.includes("quote")) && /(create|complete|convert|update)/.test(action)) return "sales.budgets.create";
  if (action.includes("invoice") && /(create|complete|convert|update|mark|register)/.test(action)) return "sales.invoices.create";
  if (action.includes("budget") || action.includes("quote")) return "sales.budgets.view";
  if (action.includes("invoice") || action.includes("revenue") || action.includes("collected")) return "sales.invoices.view";
  if (action.startsWith("tasks_") || intent.kind === "pending_summary" || intent.kind === "pending_details") return "tasks.view";
  if (action.startsWith("followups_")) return "followups.view";
  if (action.includes("agenda") || action.includes("visit")) return "agenda.view";
  if (action.includes("document")) return "documents.view";
  if (action.includes("client") || action.includes("contact")) return "clients.view";
  if (action.includes("work") || action.includes("project")) return "work.view";
  if (action.startsWith("automations_")) return "orqena.execute";
  return null;
}

function additionalCapabilitiesForOrqenaIntent(intent: ChatIntentClassification): CapabilityKey[] {
  const action = intent.action ?? "";
  const combinedBusiness: CapabilityKey[] = ["reports.view", "work.view", "sales.budgets.view", "sales.pricing.view", "sales.invoices.view", "treasury.view", "banking.view", "purchases.received_invoices.view", "purchase_cost.view", "internal_cost.view", "margin_percent.view", "margin_amount.view", "profitability.view"];
  const combinedTreasury: CapabilityKey[] = ["sales.invoices.view", "treasury.view", "banking.view", "purchases.received_invoices.view", "purchase_cost.view", "internal_cost.view", "margin_percent.view", "margin_amount.view", "profitability.view"];
  if (action.startsWith("business_") || action.startsWith("signals_") || ["business_health", "client_highest_debt"].includes(action)) return combinedBusiness;
  if (action.startsWith("treasury_")) return combinedTreasury;
  if (action.includes("budget") || action.includes("quote")) return ["sales.pricing.view"];
  if (["work_highest_revenue", "work_lowest_margin"].includes(action)) return ["sales.invoices.view", "purchase_cost.view", "internal_cost.view", "margin_percent.view", "margin_amount.view", "profitability.view"];
  if (action === "recent_documents") return ["documents.view", "sales.budgets.view", "sales.pricing.view", "sales.invoices.view"];
  return [];
}

async function answerScopedPortalQuery(authorization: Awaited<ReturnType<typeof requireOrqenaAuthorization>>, text: string, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  if (!authorization) return { handled: true, text: "No hay un portal profesional activo." };
  const intent = databaseIntentForMessage(text, classifyChatIntent(text), context);
  const capability = intent ? capabilityForOrqenaIntent(intent) : null;
  if (!capability || !["work.view", "tasks.view", "agenda.view", "documents.view"].includes(capability)) return { handled: true, text: "Puedo ayudarte con tus trabajos, tareas, agenda y documentos asignados. Esa consulta general está fuera de tu alcance." };
  const decision = await resolveAuthorization(authorization, capability);
  if (!decision.allowed) return { handled: true, text: "Esa consulta está fuera de tu alcance." };
  if (capability === "tasks.view") {
    const ids = await resolveScopedTaskIds(authorization, "tasks.view");
    const tasks = await prisma.task.findMany({ where: { companyId: authorization.companyId, archivedAt: null, ...(ids === null ? {} : { id: { in: ids } }) }, select: { title: true, status: true }, orderBy: { updatedAt: "desc" }, take: 5 });
    return { handled: true, text: tasks.length ? `Tus tareas asignadas: ${tasks.map((item) => `${item.title} (${item.status})`).join("; ")}.` : "No tienes tareas asignadas disponibles." };
  }
  const workIds = await resolveScopedEntityIds(authorization, capability, "Work");
  if (capability === "work.view") {
    const works = await prisma.work.findMany({ where: { companyId: authorization.companyId, ...(workIds === null ? {} : { id: { in: workIds } }) }, select: { titulo: true, estado: true }, orderBy: { updatedAt: "desc" }, take: 5 });
    return { handled: true, text: works.length ? `Tus trabajos disponibles: ${works.map((item) => `${item.titulo} (${item.estado})`).join("; ")}.` : "No tienes trabajos asignados disponibles." };
  }
  if (capability === "agenda.view") {
    const events = await prisma.eventoAgenda.findMany({ where: { companyId: authorization.companyId, ...(workIds === null ? {} : { obraId: { in: workIds } }) }, select: { titulo: true, fechaInicio: true }, orderBy: { fechaInicio: "asc" }, take: 5 });
    return { handled: true, text: events.length ? `Tu agenda asignada: ${events.map((item) => `${item.titulo} (${item.fechaInicio.toLocaleDateString("es-ES")})`).join("; ")}.` : "No tienes citas asignadas disponibles." };
  }
  const documentIds = await resolveScopedEntityIds(authorization, "documents.view", "Document");
  const documents = await prisma.document.findMany({ where: { companyId: authorization.companyId, archivedAt: null, ...(documentIds === null ? {} : { id: { in: documentIds } }), classification: "OPERATIONAL" }, select: { name: true }, orderBy: { createdAt: "desc" }, take: 5 });
  return { handled: true, text: documents.length ? `Tus documentos operativos: ${documents.map((item) => item.name).join("; ")}.` : "No tienes documentos operativos asignados disponibles." };
}

async function runChatCommandInCompany(text: string, context: ChatCommandContext | null | undefined, options: ChatCommandOptions): Promise<ChatCommandResult> {
  const trace: ChatPerfTrace = { messageId: options.messageId, conversationId: options.conversationId, idempotencyKey: options.idempotencyKey, startedAt: nowMs() };
  const persistStarted = nowMs();
  return runConversationTurn<ChatCommandContext | null, ChatCommandResult>({
    text,
    context: context ?? null,
    persist: async () => {
      const persisted = await persistIncomingChatMessage(text, context ?? null, options);
      trace.messageId = persisted.messageId ?? trace.messageId;
      trace.conversationId = persisted.conversationId;
      await logChatPerf(trace, "db:save_user_message", persistStarted, "ok", { duplicate: persisted.duplicate });
      return { duplicate: persisted.duplicate, completed: persisted.result ?? undefined, context: persisted.context };
    },
    execute: async (persistedContext) => withStructuredResult(await runChatCommandCore(text, persistedContext, trace)),
    complete: async (result) => { await completeChatMessage(trace.messageId, result); await logChatPerf(trace, "total", trace.startedAt, "ok", { handled: result.handled }); },
    fail: async (error) => { await failChatMessage(trace.messageId, error); await logChatPerf(trace, "total", trace.startedAt, "error", error instanceof Error ? { message: error.message } : undefined); },
    duplicateResult: (persistedContext) => ({ handled: true, text: "Ya estoy procesando ese mensaje. Lo mantengo en la conversación y no duplicaré acciones.", context: persistedContext })
  });
}

async function requireOrqenaAuthorization() {
  try { return await requireCapability("orqena.use"); }
  catch (error) {
    if (process.env.CAPATAZ_TEST_DATABASE_ISOLATED === "true" && error instanceof Error && (error.message.includes("outside a request scope") || error.message === "NEXT_REDIRECT")) return null;
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

  if (looksLikeWorkflowContractMutation(normalizedText) || enrichedContext?.pendingDisambiguation) return { handled: false, text: "", context: enrichedContext };

  if (looksLikeExplicitWorkflowMutation(normalizedText)) return { handled: false, text: "", context: enrichedContext };

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

  if (["use_existing_work_for_budget", "create_new_work_for_budget", "complete_budget", "complete_invoice", "create_budget", "create_invoice", "register_activity", "complete_activity", "convert_budget_to_invoice", "mark_invoice_paid", "register_payment"].includes(plan.action)) {
    return { handled: false, text: "", context: plan.context };
  }

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

  const mutationCapabilities = capabilitiesForLocalMutation(plan);
  if (mutationCapabilities.length && !await canExecuteOrqenaMutation(mutationCapabilities)) {
    return {
      handled: true,
      text: "Tu portal permite consultar esta información, pero no modificarla desde Orqena. No se ha creado ni actualizado ningún dato.",
      context: plan.context,
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

function capabilitiesForLocalMutation(plan: ReturnType<typeof planChatMessage>): CapabilityKey[] {
  const action = plan.action;
  if (["use_existing_work_for_budget", "create_new_work_for_budget", "create_budget"].includes(action)) {
    return ["orqena.execute", "sales.budgets.create", "sales.pricing.view"];
  }
  if (action === "complete_budget") return ["orqena.execute", "sales.budgets.update", "sales.pricing.view"];
  if (["create_invoice", "convert_budget_to_invoice"].includes(action)) return ["orqena.execute", "sales.invoices.create"];
  if (action === "complete_invoice") return ["orqena.execute", "sales.invoices.create"];
  if (["register_activity", "complete_activity"].includes(action)) return ["orqena.execute", "agenda.manage"];
  if (["mark_invoice_paid", "register_payment"].includes(action)) return ["orqena.execute", "treasury.collections.register"];
  if (action === "select_document") {
    const pendingAction = String(plan.context.activeTask?.draftData?.action ?? "");
    if (pendingAction === "mark_invoice_paid" || pendingAction === "register_payment") {
      return ["orqena.execute", "treasury.collections.register"];
    }
  }
  return [];
}

async function canExecuteOrqenaMutation(capabilities: CapabilityKey[]) {
  try {
    const context = await requireCompanyContext();
    const decisions = await Promise.all(capabilities.map((capability) => resolveAuthorization(context, capability)));
    return decisions.every((decision) => decision.allowed && decision.scope === "COMPANY");
  } catch (error) {
    if (process.env.CAPATAZ_TEST_DATABASE_ISOLATED === "true" && error instanceof Error && error.message.includes("outside a request scope")) return true;
    throw error;
  }
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
