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
  type ChatContext,
  type ChatEntities
} from "@/lib/capataz-chat-engine";
import {
  normalizeName,
  type IvaMode,
  type ParsedActivityCommand,
  type ParsedBudgetCommand,
  type ParsedBudgetFollowUp,
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
  clientStartedAt?: number;
};

type ChatPerfTrace = {
  messageId?: string;
  startedAt: number;
};

export async function runChatCommand(text: string, context?: ChatCommandContext | null, options: ChatCommandOptions = {}): Promise<ChatCommandResult> {
  const trace: ChatPerfTrace = { messageId: options.messageId, startedAt: nowMs() };
  const persistStarted = nowMs();
  const persisted = await persistIncomingChatMessage(text, context ?? null, options);
  trace.messageId = persisted.messageId ?? trace.messageId;
  await logChatPerf(trace, "db:save_user_message", persistStarted, "ok", { duplicate: persisted.duplicate });

  if (persisted.result) {
    await logChatPerf(trace, "total", trace.startedAt, "duplicate_completed");
    return persisted.result;
  }

  if (persisted.duplicate) {
    const result = {
      handled: true,
      text: "Ya estoy procesando ese mensaje. Lo mantengo en la conversación y no duplicaré acciones.",
      context
    };
    await logChatPerf(trace, "total", trace.startedAt, "duplicate_processing");
    return result;
  }

  try {
    const result = await runChatCommandCore(text, context ?? null, trace);
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
  debugChat("received", { text, context });

  const planStarted = nowMs();
  const plan = planChatMessage(text, context);
  await logChatPerf(trace, "local:plan", planStarted, plan.handled ? "ok" : "fallback", {
    action: plan.action,
    source: plan.source
  });
  debugChat("plan", plan);

  if (shouldResolveBeforeAI(text, plan)) {
    await logChatPerf(trace, "route", trace.startedAt, "fast_local", { action: plan.action, source: plan.source });
    return executeLocalChatPlan(text, plan);
  }

  const aiResult = await runAIChatCommand(text, context, trace);
  if (aiResult) return aiResult;

  await logChatPerf(trace, "route", trace.startedAt, "local_after_ai", { action: plan.action, source: plan.source });

  return executeLocalChatPlan(text, plan);
}

async function executeLocalChatPlan(text: string, plan: ReturnType<typeof planChatMessage>): Promise<ChatCommandResult> {
  if (!plan.handled) {
    debugChat("fallback", { reason: "engine_no_match", entities: plan.entities });
    return { handled: false, text: "" };
  }

  if (plan.action === "ask_pending") {
    return {
      handled: true,
      text: plan.response ?? "Sigo con la acción anterior. Dime si quieres usar lo existente, crear algo nuevo o dejarlo pendiente.",
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

async function applyBudgetFollowUp(context: ChatCommandContext, followUp: ParsedBudgetFollowUp): Promise<ChatCommandResult> {
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

  await prisma.$transaction(async (tx) => {
    if (followUp.ivaMode) {
      const basis = amountForIvaUpdate(budget.subtotal, budget.iva, budget.total, followUp.ivaMode);
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

    const clientData: { telefono?: string; email?: string; notas?: string; ultimaInteraccion: Date } = { ultimaInteraccion: new Date() };
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
    if (followUp.nif) {
      clientData.notas = appendNote(budget.client.notas, `NIF/CIF indicado en Capataz: ${followUp.nif}.`);
      updates.push(`NIF/CIF ${followUp.nif}`);
      remaining.delete("datos_cliente");
    }
    if (followUp.phone || followUp.email || followUp.nif) {
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
        pendingFields: [...remaining],
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
    text: `Perfecto, he actualizado el presupuesto de ${budget.client.nombre}: ${joinNatural(updates)}. Ya puedes revisarlo o generar el PDF.`
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

    const clientData: { telefono?: string; email?: string; notas?: string; ultimaInteraccion: Date } = { ultimaInteraccion: new Date() };
    if (entities.phone) {
      clientData.telefono = entities.phone;
      updates.push(`teléfono ${entities.phone}`);
    }
    if (entities.email) {
      clientData.email = entities.email;
      updates.push(`email ${entities.email}`);
    }
    if (entities.nif) {
      clientData.notas = appendNote(invoice.client.notas, `NIF/CIF indicado en Capataz: ${entities.nif}.`);
      updates.push(`NIF/CIF ${entities.nif}`);
    }
    if (entities.phone || entities.email || entities.nif) {
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
    return { handled: true, text: "Necesito saber qué presupuesto aceptado quieres convertir en factura. Dime, por ejemplo: “convierte el presupuesto aceptado de Juana en factura”." };
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
    text: `PDF listo para revisar y descargar: ${path}. No he enviado nada al cliente.`
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
  if (!idempotencyKey) {
    const message = await prisma.chatMessage.create({
      data: {
        role: "user",
        content: text,
        status: "processing",
        context: toJsonValue(context),
        metadata: toJsonValue({ clientStartedAt: options.clientStartedAt })
      }
    });
    return { messageId: message.id, duplicate: false, result: null as ChatCommandResult | null };
  }

  const existing = await prisma.chatMessage.findUnique({ where: { idempotencyKey } });
  if (existing) {
    const completed = resultFromChatMetadata(existing.metadata);
    if (completed) return { messageId: existing.id, duplicate: true, result: completed };
    if (existing.status === "processing") return { messageId: existing.id, duplicate: true, result: null };
  }

  const message = await prisma.chatMessage.upsert({
    where: { idempotencyKey },
    create: {
      id: options.messageId,
      idempotencyKey,
      role: "user",
      content: text,
      status: "saved",
      context: toJsonValue(context),
      metadata: toJsonValue({ clientStartedAt: options.clientStartedAt })
    },
    update: {
      context: toJsonValue(context),
      metadata: toJsonValue({ clientStartedAt: options.clientStartedAt, retriedAt: new Date().toISOString() })
    }
  });

  const lock = await prisma.chatMessage.updateMany({
    where: { id: message.id, status: { in: ["saved", "failed"] } },
    data: { status: "processing" }
  });

  if (lock.count === 0) {
    const latest = await prisma.chatMessage.findUnique({ where: { id: message.id } });
    const completed = resultFromChatMetadata(latest?.metadata);
    return { messageId: message.id, duplicate: true, result: completed };
  }

  return { messageId: message.id, duplicate: false, result: null as ChatCommandResult | null };
}

async function completeChatMessage(messageId: string | undefined, result: ChatCommandResult) {
  if (!messageId) return;
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
        conversationId: "default",
        role: "assistant",
        content: result.text,
        status: "completed",
        metadata: toJsonValue({ replyTo: messageId, created: result.created ?? null })
      }
    });
  }
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

async function logChatPerf(trace: ChatPerfTrace, stage: string, startedAt: number, status: string, metadata?: Record<string, unknown>) {
  const durationMs = Math.max(0, Math.round(nowMs() - startedAt));
  const payload = { stage, status, durationMs, messageId: trace.messageId, ...(metadata ?? {}) };
  if (process.env.CAPATAZ_CHAT_DEBUG === "true" || process.env.NEXT_PUBLIC_APP_ENV !== "production") {
    console.info("[capataz-chat-perf]", JSON.stringify(payload));
  }

  await prisma.chatActionLog.create({
    data: {
      messageId: trace.messageId,
      stage,
      status,
      durationMs,
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

  return clients.filter((client) => {
    const normalized = normalizeName(client.nombre);
    const first = normalized.split(" ")[0];
    return normalized === target || first === target || normalized.startsWith(`${target} `);
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
  ivaMode,
  pendingFields
}: {
  clientId: string;
  workId: string;
  budgetId: string;
  clientName: string;
  ivaMode: IvaMode;
  pendingFields?: string[];
}): ChatCommandContext {
  return createBudgetCompletionContext({
    clientId,
    workId,
    budgetId,
    clientName,
    pendingFields: pendingFields ?? (ivaMode === "unknown" ? ["iva", "direccion_obra", "datos_cliente"] : ["direccion_obra", "datos_cliente"])
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
