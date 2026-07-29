import { randomUUID } from "node:crypto";
import { normalizeChatContext, planChatMessage, type ChatEntities } from "@/lib/capataz-chat-engine";
import { normalizeName } from "@/lib/capataz-chat-parser";
import { getCapatazAIErrorMeta, interpretCapatazMessageWithAI, isCapatazAIConfigured, type CapatazAIResult } from "@/lib/ai/capataz-ai";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";
import { resolveAuthorization, resolveScopedEntityIds } from "@/lib/commercial/authorization";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";
import { aiHasAction, canCreateAIBudget, canCreateAIInvoice } from "@/lib/orqena/application/capataz/ai-mutations";
import { buildPdfResult, debugChat } from "@/lib/orqena/application/capataz/business-mutations";
import { extractPotentialNameHints, logChatPerf, nowMs, sanitizeAIError } from "@/lib/orqena/application/capataz/conversation-use-cases";
import { ChatActionResult, ChatCommandContext, ChatCommandResult, ChatPerfTrace } from "@/lib/orqena/application/capataz/orchestration";
import { buildAIClarificationResponse, contextIds } from "@/lib/orqena/application/capataz/shared-helpers";

export async function buildActionResult(result: ChatCommandResult): Promise<ChatActionResult | null> {
  const { companyId } = await requireCompanyContext();
  const created = result.created;
  if (!created) return null;

  if (created.budgetId) {
    const budget = await prisma.budget.findFirst({
      where: { id: created.budgetId, companyId },
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
    const invoice = await prisma.invoice.findFirst({
      where: { id: created.invoiceId, companyId },
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
    const event = await prisma.eventoAgenda.findFirst({
      where: { id: created.agendaEventId, companyId },
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
    const client = await prisma.client.findFirst({ where: { id: created.clientId, companyId } }).catch(() => null);
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
    const work = await prisma.work.findFirst({ where: { id: created.workId, companyId }, include: { client: true } }).catch(() => null);
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

export async function enrichChatContext(context: ChatCommandContext | null): Promise<ChatCommandContext | null> {
  const { companyId } = await requireCompanyContext();
  if (!context) return null;
  const normalized = normalizeChatContext(context);
  const task = normalized.activeTask ?? normalized.parkedTask;
  if (!task) return normalized;

  const ids = contextIds(normalized);
  try {
    if (ids.budgetId) {
      const budget = await prisma.budget.findFirst({
        where: { id: ids.budgetId, companyId },
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
      const invoice = await prisma.invoice.findFirst({
        where: { id: ids.invoiceId, companyId },
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

export async function personalizeContextGreeting(response: string) {
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

export type BudgetDraftOptions = {
  existingClientId?: string;
  existingWorkId?: string;
  forceNewWork?: boolean;
  followUp?: ChatEntities;
};

export function shouldResolveBeforeAI(text: string, plan: ReturnType<typeof planChatMessage>) {
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

export function wantsExplicitContinueTask(text: string) {
  const normalized = normalizeName(text);
  return /^(continuar tarea|continua tarea|continuar la tarea|volver a tarea|retomar tarea|seguir con esto|sigamos con eso|volver al presupuesto|vuelve al presupuesto)(\b|$)/.test(normalized);
}

export async function runAIChatCommand(text: string, context: ChatCommandContext | null, trace: ChatPerfTrace): Promise<ChatCommandResult | null> {
  if (!isCapatazAIConfigured()) {
    debugChat("ai_skipped", { reason: "missing_OPENAI_API_KEY" });
    await logChatPerf(trace, "ai:skipped", nowMs(), "missing_key");
    return null;
  }

  const aiStarted = nowMs();
  try {
    const actor = await requireCompanyContext();
    const capability = await resolveAuthorization(actor, "orqena.use");
    if (!capability.allowed) return { handled: true, text: "La ayuda automática no está disponible para este perfil. Continúa manualmente.", context };
    const contextStarted = nowMs();
    const data = await buildAIContext(context, text);
    await logChatPerf(trace, "db:ai_context", contextStarted, "ok", {
      clients: data.clients.length,
      works: data.works.length,
      budgets: data.budgets.length,
      invoices: data.invoices.length
    });
    const requestId = trace.messageId ?? randomUUID();
    const correlationId = trace.conversationId ?? randomUUID();
    const ai = await interpretCapatazMessageWithAI({
      message: text,
      context: safeAIChatContext(context),
      data,
      governance: {
        companyId: actor.companyId,
        actorId: actor.userId,
        role: actor.role,
        scopes: ["orqena.use"],
        requestId,
        correlationId,
        causationId: trace.messageId,
        idempotencyKey: trace.idempotencyKey ?? requestId,
      },
    });
    await logChatPerf(trace, "ai:interpret", aiStarted, "ok", {
      intent: ai.intent,
      confidence: ai.confidence,
      ...(ai.diagnostics ?? {})
    });
    debugChat("ai_result", { intent: ai.intent, confidence: ai.confidence, lane: ai.diagnostics?.lane, usageEventId: ai.diagnostics?.usageEventId });
    const executeStarted = nowMs();
    const result = await executeAIChatCommand(ai, context);
    await logChatPerf(trace, "ai:execute_plan", executeStarted, result?.handled ? "ok" : "no_result", {
      intent: ai.intent,
      created: result?.created ? Object.keys(result.created).filter((key) => result.created?.[key as keyof typeof result.created]) : []
    });
    return result ? {
      ...result,
      aiDisclosure: {
        prepared: true,
        caseUse: ai.intent,
        model: ai.diagnostics?.model ?? "modelo aprobado",
        dataUsed: ["mensaje actual", "contexto mínimo autorizado de la empresa"],
        reviewRequired: true,
      },
    } : null;
  } catch (error) {
    const aiMeta = getCapatazAIErrorMeta(error);
    await logChatPerf(trace, "ai:interpret", aiStarted, "error", error instanceof Error ? { message: sanitizeAIError(error.message), ...(aiMeta ?? {}) } : aiMeta ?? undefined);
    debugChat("ai_error", { code: typeof aiMeta?.errorType === "string" ? aiMeta.errorType : "AI_REQUEST_FAILED" });
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
  const authorization = await requireCompanyContext();
  const { companyId } = authorization;
  const [manifest, clientsDecision, worksDecision, budgetsDecision, invoicesDecision] = await Promise.all([
    buildPortalManifest(authorization),
    resolveAuthorization(authorization, "clients.view"),
    resolveAuthorization(authorization, "work.view"),
    resolveAuthorization(authorization, "sales.budgets.view"),
    resolveAuthorization(authorization, "sales.invoices.view"),
  ]);
  const ids: Partial<ReturnType<typeof contextIds>> = context ? contextIds(context) : {};
  const nameHints = extractPotentialNameHints(text);
  const clientWhere = ids.clientId
    ? { id: ids.clientId }
    : nameHints.length
      ? { OR: nameHints.map((hint) => ({ nombre: { contains: hint, mode: "insensitive" as const } })) }
      : undefined;

  const [clientIds, workIds, budgetWorkIds, budgetClientIds, invoiceWorkIds, invoiceClientIds] = await Promise.all([
    clientsDecision.allowed ? resolveScopedEntityIds(authorization, "clients.view", "Client") : Promise.resolve([]),
    worksDecision.allowed ? resolveScopedEntityIds(authorization, "work.view", "Work") : Promise.resolve([]),
    budgetsDecision.allowed ? resolveScopedEntityIds(authorization, "sales.budgets.view", "Work") : Promise.resolve([]),
    budgetsDecision.allowed ? resolveScopedEntityIds(authorization, "sales.budgets.view", "Client") : Promise.resolve([]),
    invoicesDecision.allowed ? resolveScopedEntityIds(authorization, "sales.invoices.view", "Work") : Promise.resolve([]),
    invoicesDecision.allowed ? resolveScopedEntityIds(authorization, "sales.invoices.view", "Client") : Promise.resolve([]),
  ]);
  const [clients, works, budgets, invoices] = await Promise.all([
    clientsDecision.allowed ? prisma.client.findMany({
      where: { companyId, AND: [clientIds === null ? {} : { id: { in: clientIds } }, clientWhere ?? {}] },
      orderBy: { ultimaInteraccion: "desc" },
      take: clientWhere ? 12 : 8,
      select: {
        tipo: true,
        estado: true,
      }
    }) : Promise.resolve([]),
    worksDecision.allowed ? prisma.work.findMany({
      where: { companyId, AND: [workIds === null ? {} : { id: { in: workIds } }, ids.workId ? { id: ids.workId } : ids.clientId ? { clienteId: ids.clientId } : {}] },
      orderBy: { id: "desc" },
      take: ids.workId || ids.clientId ? 12 : 8,
      select: {
        tipoTrabajo: true,
        estado: true,
      }
    }) : Promise.resolve([]),
    budgetsDecision.allowed ? prisma.budget.findMany({
      where: { companyId, AND: [scopedRelationWhere(budgetsDecision.scope, budgetWorkIds, budgetClientIds), ids.budgetId ? { id: ids.budgetId } : ids.clientId ? { clienteId: ids.clientId } : {}] },
      orderBy: { fechaCreacion: "desc" },
      take: ids.budgetId || ids.clientId ? 10 : 6,
      select: {
        ...(manifest.fieldVisibility.sale_price ? { total: true } : {}),
        estado: true,
      }
    }) : Promise.resolve([]),
    invoicesDecision.allowed ? prisma.invoice.findMany({
      where: { companyId, AND: [scopedRelationWhere(invoicesDecision.scope, invoiceWorkIds, invoiceClientIds), ids.invoiceId ? { id: ids.invoiceId } : ids.clientId ? { clienteId: ids.clientId } : {}] },
      orderBy: { fechaEmision: "desc" },
      take: ids.invoiceId || ids.clientId ? 10 : 6,
      select: {
        ...(manifest.fieldVisibility.sale_price ? { total: true } : {}),
        ...(manifest.fieldVisibility.treasury ? { pagado: true, pendiente: true } : {}),
        estado: true,
      }
    }) : Promise.resolve([])
  ]);

  return {
    chatContext: safeAIChatContext(context),
    clients,
    works,
    budgets,
    invoices,
    currentDate: new Date().toISOString()
  };
}

function safeAIChatContext(context: ChatCommandContext | null) {
  if (!context?.activeTask) return null;
  return {
    activeTask: {
      type: context.activeTask.type,
      status: context.activeTask.status,
      pendingFields: context.activeTask.pendingFields?.filter((field) => /^[a-z0-9_-]{1,64}$/i.test(field)).slice(0, 12) ?? [],
      availableActions: context.activeTask.availableActions?.filter((action) => /^[a-z0-9_-]{1,64}$/i.test(action)).slice(0, 12) ?? [],
    },
  };
}

function scopedRelationWhere(scope: string, workIds: string[] | null, clientIds: string[] | null) {
  if (scope === "COMPANY") return {};
  if (scope === "SELECTED_WORKS") return { obraId: { in: workIds ?? [] } };
  if (scope === "SELECTED_CLIENTS") return { clienteId: { in: clientIds ?? [] } };
  return { obraId: { in: workIds ?? [] } };
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
    return { handled: false, text: "", context };
  }

  if (wantsInvoice && canCreateAIInvoice(ai)) {
    return { handled: false, text: "", context };
  }

  if (wantsActivity && ai.shouldExecute && !ai.requiresConfirmation) {
    return { handled: false, text: "", context };
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
