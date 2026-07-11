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
import { nextDocumentNumber } from "@/lib/numbering";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";

type ChatDocumentKind = "budget" | "invoice";
type PendingField = "iva" | "direccion_obra" | "datos_cliente" | "datos_fiscales";

export type ChatCommandContext = ChatContext;

export type ChatCommandResult = {
  handled: boolean;
  text: string;
  result?: ChatActionResult;
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
  entityType: "client" | "contact" | "company" | "project" | "quote" | "invoice" | "expense" | "payment" | "visit" | "followup" | "reminder" | "pdf" | "query";
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

  if (wantsGlobalPendingList(text) && !enrichedContext?.activeTask) {
    await logChatPerf(trace, "route", trace.startedAt, "fast_local", { action: "list_global_pending" });
    return listGlobalPendingTasks(enrichedContext);
  }

  if (wantsExplicitContinueTask(text) && !enrichedContext?.activeTask) {
    await logChatPerf(trace, "route", trace.startedAt, "fast_local", { action: "continue_latest_task" });
    return continueLatestPendingTask();
  }

  const databaseIntent = databaseIntentForMessage(text, classifyChatIntent(text), enrichedContext);
  if (databaseIntent) {
    await logChatPerf(trace, "route", trace.startedAt, "database_query", { kind: databaseIntent.kind, action: databaseIntent.action });
    return answerDatabaseQuery(text, databaseIntent, enrichedContext);
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

async function listGlobalPendingTasks(context: ChatCommandContext | null): Promise<ChatCommandResult> {
  return queryPendingTasksSummary(context);
}

function databaseIntentForMessage(text: string, classified: ChatIntentClassification, context: ChatCommandContext | null): ChatIntentClassification | null {
  const normalized = normalizeQueryText(text);
  const activeType = context?.activeTask?.type;
  if (activeType === "pending_summary" && /^(dimelos|dime cuales|cuales son|detallame|detalle|ver todos|muestrame|ensename)$/i.test(normalized)) {
    return { kind: "pending_detail", action: "pending_detail", confidence: 0.9 };
  }
  if (classified.kind === "pending" || classified.kind === "pending_detail") return classified;
  if (classified.kind === "query" || classified.kind === "aggregate" || classified.kind === "compare") return classified;
  return null;
}

async function answerDatabaseQuery(text: string, intent: ChatIntentClassification, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  if (intent.kind === "pending") return queryPendingTasksSummary(context);
  if (intent.kind === "pending_detail") return queryPendingTaskDetails(intent.detailCategory, context);

  switch (intent.action) {
    case "highest_budget":
      return queryBudgetByAmount("desc", intent);
    case "lowest_budget":
      return queryBudgetByAmount("asc", intent);
    case "latest_budget":
      return queryLatestBudget(intent);
    case "highest_invoice":
      return queryInvoiceByAmount("desc", intent);
    case "lowest_invoice":
      return queryInvoiceByAmount("asc", intent);
    case "outstanding_invoices":
      return queryOutstandingInvoices(intent);
    case "pending_invoices_count":
      return queryPendingInvoicesCount(intent);
    case "pending_budgets_count":
      return queryPendingBudgetsCount(intent);
    case "overdue_invoices":
      return queryPendingTaskDetails("overdue_invoices", context);
    case "client_highest_debt":
      return queryClientHighestDebt();
    case "revenue_summary":
      return queryRevenueSummary(intent);
    case "expenses_summary":
      return queryExpensesSummary(intent);
    case "active_projects":
      return queryPendingTaskDetails("active_projects", context);
    case "client_budgets":
      return queryClientBudgets(intent);
    case "client_payments":
      return queryClientPayments(intent);
    case "clients_missing_tax_id":
      return queryPendingTaskDetails("clients_incomplete", context);
    case "project_highest_expenses":
      return queryProjectHighestExpenses(intent);
    case "recent_documents":
      return queryRecentDocuments(intent);
    default:
      return {
        handled: true,
        context,
        text: "Puedo consultar presupuestos, facturas, cobros, gastos, obras, clientes y pendientes. Dime qué dato quieres ver."
      };
  }
}

async function queryPendingTasksSummary(context: ChatCommandContext | null): Promise<ChatCommandResult> {
  const counts = await queryPendingTasksCounts();
  const rows = [
    ["Presupuestos pendientes", counts.pendingBudgets],
    ["Presupuestos pendientes de enviar", counts.budgetsToSend],
    ["Presupuestos pendientes de aceptar", counts.budgetsToAccept],
    ["Facturas pendientes de cobro", counts.pendingInvoices],
    ["Facturas vencidas", counts.overdueInvoices],
    ["Pagos parciales", counts.partialPayments],
    ["Visitas pendientes", counts.pendingVisits],
    ["Visitas por confirmar", counts.visitsToConfirm],
    ["Seguimientos pendientes", counts.pendingFollowups],
    ["Recordatorios pendientes", counts.pendingReminders],
    ["Clientes con datos incompletos", counts.incompleteClients],
    ["Obras activas con tareas pendientes", counts.activeProjects],
    ["Documentos pendientes de completar", counts.incompleteDocuments]
  ].filter(([, count]) => Number(count) > 0) as Array<[string, number]>;

  const nextContext = {
    ...(context ?? {}),
    activeTask: {
      type: "pending_summary" as const,
      status: "activo" as const,
      title: "Resumen de pendientes",
      pendingFields: rows.map(([label]) => label),
      draftData: counts,
      lastQuestion: "¿Quieres que te detalle alguna categoría?",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };

  if (!rows.length) {
    return {
      handled: true,
      context: nextContext,
      text: "No tienes tareas pendientes ahora mismo."
    };
  }

  return {
    handled: true,
    context: nextContext,
    text: `Tienes:\n\n${rows.map(([label, count]) => `- ${count} ${pendingCountLabel(label, count)}.`).join("\n")}\n\n¿Quieres que te detalle alguna categoría?`
  };
}

async function queryPendingTasksCounts() {
  const today = startOfDay(new Date());
  const [
    pendingBudgets,
    budgetsToSend,
    budgetsToAccept,
    pendingInvoices,
    overdueInvoices,
    partialPayments,
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
    prisma.invoice.count({ where: { pendiente: { gt: 0 } } }),
    prisma.invoice.count({ where: { pendiente: { gt: 0 }, OR: [{ estado: "vencida" }, { fechaVencimiento: { lt: today } }] } }),
    prisma.invoice.count({ where: { pagado: { gt: 0 }, pendiente: { gt: 0 } } }),
    prisma.eventoAgenda.count({ where: { tipo: "visita", estado: { in: ["pendiente", "confirmado"] } } }),
    prisma.eventoAgenda.count({ where: { tipo: "visita", estado: "pendiente", requiereConfirmacion: true } }),
    prisma.reminder.count({ where: { tipo: { in: ["seguimiento_presupuesto", "recordatorio_factura", "confirmar_visita"] }, estado: { in: ["borrador", "pendiente_confirmacion", "programado"] } } }),
    prisma.reminder.count({ where: { estado: { in: ["borrador", "pendiente_confirmacion", "programado"] } } }),
    prisma.client.findMany({ select: { telefono: true, email: true, direccion: true, estado: true, notas: true } }),
    prisma.work.count({ where: { estado: { in: ["en_curso", "pendiente_material", "pendiente_remates", "pendiente_cobro", "pendiente_inicio"] } } }),
    prisma.budget.count({ where: { estado: { in: ["borrador", "pendiente_revision"] } } })
  ]);

  return {
    pendingBudgets,
    budgetsToSend,
    budgetsToAccept,
    pendingInvoices,
    overdueInvoices,
    partialPayments,
    pendingVisits,
    visitsToConfirm,
    pendingFollowups,
    pendingReminders,
    incompleteClients: clients.filter(clientLooksIncomplete).length,
    activeProjects,
    incompleteDocuments
  };
}

async function queryPendingTaskDetails(category: PendingDetailCategory | undefined, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  if (!category) {
    return {
      handled: true,
      context,
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
    return compactListResult(budgets, "presupuestos pendientes", (budget) => `${budget.numero} · ${budget.client.nombre} · ${formatEuros(budget.total)} · ${budget.estado} · /presupuestos/${budget.id}`);
  }

  if (category === "invoices" || category === "overdue_invoices" || category === "partial_payments") {
    const invoices = await prisma.invoice.findMany({
      where: category === "overdue_invoices"
        ? { pendiente: { gt: 0 }, OR: [{ estado: "vencida" }, { fechaVencimiento: { lt: today } }] }
        : category === "partial_payments"
          ? { pagado: { gt: 0 }, pendiente: { gt: 0 } }
          : { pendiente: { gt: 0 } },
      orderBy: { fechaVencimiento: "asc" },
      take: 10,
      include: { client: true, work: true }
    });
    return compactListResult(invoices, "facturas", (invoice) => `${invoice.numero} · ${invoice.client.nombre} · pendiente ${formatEuros(invoice.pendiente)} · vence ${formatDateShort(invoice.fechaVencimiento)} · /dinero/${invoice.id}`);
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
    return compactListResult(visits, "visitas", (visit) => `${formatDateShort(visit.fechaInicio)} ${visit.horaInicio ?? ""} · ${visit.client?.nombre ?? "Sin cliente"} · ${visit.titulo} · /agenda`);
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
    return compactListResult(reminders, category === "followups" ? "seguimientos" : "recordatorios", (reminder) => `${formatDateShort(reminder.fechaProgramada)} · ${reminder.client?.nombre ?? "Sin cliente"} · ${reminder.tipo.replaceAll("_", " ")} · ${reminder.estado} · /recordatorios`);
  }

  if (category === "clients_incomplete") {
    const clients = (await prisma.client.findMany({ orderBy: { fechaCreacion: "desc" }, take: 60 })).filter(clientLooksIncomplete).slice(0, 10);
    return compactListResult(clients, "clientes con datos incompletos", (client) => `${client.nombre} · ${client.estado} · /clientes/${client.id}`);
  }

  const works = await prisma.work.findMany({
    where: { estado: { in: ["en_curso", "pendiente_material", "pendiente_remates", "pendiente_cobro", "pendiente_inicio"] } },
    orderBy: { fechaInicio: "desc" },
    take: 10,
    include: { client: true }
  });
  return compactListResult(works, "obras activas", (work) => `${work.titulo} · ${work.client.nombre} · ${work.estado} · /obras`);
}

async function queryBudgetByAmount(direction: "asc" | "desc", intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const client = await clientForQuery(intent.clientName);
  if (intent.clientName && !client) return noClientResult(intent.clientName);
  const budget = await prisma.budget.findFirst({
    where: { ...budgetPeriodWhere(intent.period), ...(client ? { clienteId: client.id } : {}) },
    orderBy: { total: direction },
    include: { client: true, work: true }
  });
  if (!budget) return { handled: true, text: "No hay presupuestos registrados todavía." };
  const label = direction === "desc" ? "más alto" : "más bajo";
  return {
    handled: true,
    context: latestDocumentContext("budget", budget.id, budget.clienteId, budget.obraId ?? undefined, budget.client.nombre),
    result: budgetQueryCard(`Presupuesto ${label}`, budget),
    text: `El presupuesto ${label} es el ${budget.numero}, por ${formatEuros(budget.total)}, para ${budget.client.nombre}.\n\n¿Quieres que te muestre los cinco presupuestos ${direction === "desc" ? "más altos" : "más bajos"}?`
  };
}

async function queryLatestBudget(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const client = await clientForQuery(intent.clientName);
  if (intent.clientName && !client) return noClientResult(intent.clientName);
  const budget = await prisma.budget.findFirst({
    where: { ...budgetPeriodWhere(intent.period), ...(client ? { clienteId: client.id } : {}) },
    orderBy: { fechaCreacion: "desc" },
    include: { client: true, work: true }
  });
  if (!budget) return { handled: true, text: "No hay presupuestos registrados todavía." };
  return {
    handled: true,
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
  if (!invoice) return { handled: true, text: "No hay facturas registradas todavía." };
  const label = direction === "desc" ? "más grande" : "más baja";
  return {
    handled: true,
    context: latestDocumentContext("invoice", invoice.id, invoice.clienteId, invoice.obraId ?? undefined, invoice.client.nombre),
    result: invoiceQueryCard(`Factura ${label}`, invoice),
    text: `La factura ${label} es la ${invoice.numero}, por ${formatEuros(invoice.total)}, para ${invoice.client.nombre}.`
  };
}

async function queryOutstandingInvoices(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const client = await clientForQuery(intent.clientName);
  if (intent.clientName && !client) return noClientResult(intent.clientName);
  const invoices = await prisma.invoice.findMany({
    where: { pendiente: { gt: 0 }, ...invoicePeriodWhere(intent.period), ...(client ? { clienteId: client.id } : {}) },
    orderBy: { pendiente: "desc" },
    take: 5,
    include: { client: true }
  });
  const total = invoices.reduce((sum, invoice) => sum + invoice.pendiente, 0);
  if (!invoices.length) return { handled: true, text: "No hay facturas pendientes de cobro." };
  return {
    handled: true,
    text: `Tienes ${invoices.length} facturas pendientes de cobro por ${formatEuros(total)} en total.\n\nLas 5 mayores son:\n${invoices.map((invoice, index) => `${index + 1}. ${invoice.numero} · ${invoice.client.nombre} · ${formatEuros(invoice.pendiente)} · /dinero/${invoice.id}`).join("\n")}`
  };
}

async function queryPendingInvoicesCount(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const count = await prisma.invoice.count({ where: { pendiente: { gt: 0 }, ...invoicePeriodWhere(intent.period) } });
  return { handled: true, text: count ? `Tienes ${count} facturas pendientes de cobro.` : "No hay facturas pendientes de cobro." };
}

async function queryPendingBudgetsCount(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const count = await prisma.budget.count({ where: { estado: { in: ["borrador", "pendiente_revision", "pendiente_respuesta", "enviado", "visto"] }, ...budgetPeriodWhere(intent.period) } });
  return { handled: true, text: count ? `Tienes ${count} presupuestos pendientes.` : "No hay presupuestos pendientes." };
}

async function queryClientHighestDebt(): Promise<ChatCommandResult> {
  const invoices = await prisma.invoice.findMany({ where: { pendiente: { gt: 0 } }, include: { client: true } });
  const totals = new Map<string, { name: string; total: number; clientId: string }>();
  for (const invoice of invoices) {
    const current = totals.get(invoice.clienteId) ?? { name: invoice.client.nombre, total: 0, clientId: invoice.clienteId };
    current.total += invoice.pendiente;
    totals.set(invoice.clienteId, current);
  }
  const top = [...totals.values()].sort((a, b) => b.total - a.total)[0];
  if (!top) return { handled: true, text: "No hay clientes con deuda pendiente." };
  return {
    handled: true,
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

function compactListResult<T>(items: T[], label: string, render: (item: T) => string): ChatCommandResult {
  if (!items.length) return { handled: true, text: `No hay ${label} registrados ahora mismo.` };
  return {
    handled: true,
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
    const profile = await prisma.usuarioPerfil.findFirst({
      select: { nombrePreferido: true, nombre: true }
    });
    const name = (profile?.nombrePreferido ?? profile?.nombre ?? "").trim();
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

function wantsGlobalPendingList(text: string) {
  const normalized = normalizeName(text);
  return /^(ver pendientes|pendientes|que tengo pendiente|qué tengo pendiente|tareas pendientes)$/.test(normalized);
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
  const company = await prisma.empresa.findFirst();
  const ivaMode = ivaModeFromAI(ai);
  const ivaPercent = entities.iva_porcentaje ?? company?.ivaDefecto ?? 21;
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

  const company = await prisma.empresa.findFirst();
  const ivaPercent = company?.ivaDefecto ?? 21;
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

  const company = await prisma.empresa.findFirst();
  const ivaPercent = company?.ivaDefecto ?? 21;
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
  const company = await prisma.empresa.findFirst();
  const ivaPercent = company?.ivaDefecto ?? 21;
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
  if (isRecord(value.activeTask) || isRecord(value.parkedTask) || typeof value.lastDocumentType === "string") {
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
