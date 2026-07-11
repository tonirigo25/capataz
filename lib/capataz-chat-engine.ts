import {
  normalizeText,
  parseBudgetFollowUp,
  parseChatCommand,
  type IvaMode,
  type ParsedActivityCommand,
  type ParsedBudgetCommand,
  type ParsedBudgetFollowUp,
  type ParsedChatCommand,
  type ParsedConvertBudgetCommand,
  type ParsedInvoiceCommand,
  type ParsedPdfCommand
} from "@/lib/capataz-chat-parser";

export type ChatTaskType =
  | "create_budget"
  | "complete_budget"
  | "select_client"
  | "select_work"
  | "create_invoice"
  | "complete_invoice"
  | "generate_pdf"
  | "confirm_send"
  | "register_payment"
  | "register_expense"
  | "create_reminder"
  | "complete_activity"
  | "pending_summary";

export type ChatDecisionType =
  | "use_existing_client"
  | "use_existing_work"
  | "create_new_work"
  | "confirm_pdf"
  | "confirm_send"
  | "select_document";

export type ChatEntityType = "client" | "work" | "budget" | "invoice";
export type ChatDocumentType = "budget" | "invoice";
export type ChatTaskStatus = "activo" | "pendiente" | "aparcado" | "completado" | "cancelado";

export type ChatPendingFieldDetail = {
  key: string;
  label: string;
  status?: "pending" | "completed" | "optional";
  requiredFor?: string;
};

export type ChatDecisionOption = {
  id: string;
  label: string;
  type: ChatEntityType;
};

export type ChatActiveTask = {
  type: ChatTaskType;
  status?: ChatTaskStatus;
  title?: string;
  contactName?: string;
  billingClientName?: string;
  workName?: string;
  clienteId?: string;
  contactoId?: string;
  empresaFacturacionId?: string;
  obraId?: string;
  presupuestoId?: string;
  facturaId?: string;
  visitaId?: string;
  seguimientoId?: string;
  importe?: number;
  iva?: number | "included" | "plus" | "none" | "unknown";
  pendingFields?: string[];
  pendingFieldDetails?: ChatPendingFieldDetail[];
  availableActions?: string[];
  pendingDecision?: {
    type: ChatDecisionType;
    options?: ChatDecisionOption[];
  };
  draftData?: Record<string, unknown>;
  lastQuestion?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatContext = {
  activeTask?: ChatActiveTask;
  parkedTask?: ChatActiveTask;
  lastClientId?: string;
  lastWorkId?: string;
  lastBudgetId?: string;
  lastInvoiceId?: string;
  lastDocumentType?: ChatDocumentType;
  lastClientName?: string;
};

export type ChatEntities = ParsedBudgetFollowUp & {
  clientName?: string;
  amount?: number;
  eventTime?: string;
  reminderDateHint?: "today" | "tomorrow";
  reminderTime?: string;
  materialIncluded?: boolean;
  invoiceStatus?: "pagada" | "parcialmente_pagada" | "pendiente" | "vencida" | "enviada" | "borrador";
  ordinal?: number;
  reference?: "current" | "previous" | "last" | "same";
  affirmation?: boolean;
  negation?: boolean;
  createNew?: boolean;
  sendChannel?: "whatsapp" | "email";
};

export type ChatPlan =
  | {
      handled: true;
      source: "context";
      action:
        | "use_existing_work_for_budget"
        | "create_new_work_for_budget"
        | "complete_budget"
        | "complete_invoice"
        | "complete_activity"
        | "generate_pdf"
        | "confirm_send"
        | "select_document"
        | "ask_pending"
        | "answer_context"
        | "park_task"
        | "clear_context"
        | "cancel_task"
        | "resume_task";
      entities: ChatEntities;
      context: ChatContext;
      response?: string;
    }
  | {
      handled: true;
      source: "parser";
      action:
        | "create_budget"
        | "create_invoice"
        | "convert_budget_to_invoice"
        | "generate_pdf"
        | "mark_invoice_paid"
        | "register_payment"
        | "register_expense"
        | "create_reminder"
        | "register_activity"
        | "ask_pending";
      entities: ChatEntities;
      context: ChatContext;
      command?: Exclude<ParsedChatCommand, null>;
      response?: string;
    }
  | {
      handled: false;
      source: "fallback";
      action: "fallback";
      entities: ChatEntities;
      context: ChatContext;
      response: string;
    };

type LegacyChatContext = {
  type?: "completar_presupuesto" | "completar_factura" | "ultimo_documento";
  clienteId?: string;
  obraId?: string;
  presupuestoId?: string;
  facturaId?: string;
  camposPendientes?: string[];
  clienteNombre?: string;
  documentKind?: ChatDocumentType;
  documentId?: string;
  fechaCreacion?: string;
  activeTask?: ChatActiveTask;
  lastClientId?: string;
  lastWorkId?: string;
  lastBudgetId?: string;
  lastInvoiceId?: string;
  lastDocumentType?: ChatDocumentType;
  lastClientName?: string;
};

const fallbackResponse = "Necesito un poco más de contexto. ¿Quieres preparar una visita, nota, seguimiento, presupuesto, factura, gasto, pago o recordatorio?";

export function planChatMessage(message: string, rawContext?: ChatContext | LegacyChatContext | null): ChatPlan {
  const context = normalizeChatContext(rawContext);
  const entities = extractChatEntities(message);
  const contextQuestion = resolveContextMetaQuestion(message, context, entities);
  if (contextQuestion) return contextQuestion;

  const pending = resolvePendingContext(message, context, entities);
  if (pending) return pending;

  const normalized = normalizeText(message);
  if (entities.invoiceStatus === "pagada" && normalized.includes("factura")) {
    return {
      handled: true,
      source: "parser",
      action: "mark_invoice_paid",
      entities,
      context: touchContext(context)
    };
  }

  if (entities.amount && /(me ha pagado|ha pagado|pago parcial|apunta pago|registrar pago|registra pago)/.test(normalized)) {
    return {
      handled: true,
      source: "parser",
      action: "register_payment",
      entities,
      context: touchContext(context)
    };
  }

  const command = parseChatCommand(message);
  if (!command) {
    return {
      handled: false,
      source: "fallback",
      action: "fallback",
      entities,
      context,
      response: fallbackResponse
    };
  }

  if (command.intent === "crear_presupuesto") {
    return {
      handled: true,
      source: "parser",
      action: "create_budget",
      command,
      entities: mergeCommandEntities(entities, command),
      context: touchContext(context)
    };
  }

  if (command.intent === "crear_factura") {
    return {
      handled: true,
      source: "parser",
      action: "create_invoice",
      command,
      entities: mergeCommandEntities(entities, command),
      context: touchContext(context)
    };
  }

  if (command.intent === "convertir_presupuesto_en_factura") {
    return {
      handled: true,
      source: "parser",
      action: "convert_budget_to_invoice",
      command,
      entities: mergeCommandEntities(entities, command),
      context: touchContext(context)
    };
  }

  if (command.intent === "generar_pdf") {
    return {
      handled: true,
      source: "parser",
      action: "generate_pdf",
      command,
      entities: mergeCommandEntities(entities, command),
      context: touchContext(context)
    };
  }

  if (command.intent === "registrar_visita" || command.intent === "registrar_reunion" || command.intent === "registrar_llamada" || command.intent === "registrar_nota_obra") {
    return {
      handled: true,
      source: "parser",
      action: "register_activity",
      command,
      entities: mergeCommandEntities(entities, command),
      context: touchContext(context)
    };
  }

  if (command.intent === "marcar_factura_pagada") {
    return {
      handled: true,
      source: "parser",
      action: "mark_invoice_paid",
      command,
      entities,
      context: touchContext(context)
    };
  }

  if (command.intent === "registrar_pago") {
    return {
      handled: true,
      source: "parser",
      action: entities.invoiceStatus === "pagada" ? "mark_invoice_paid" : "register_payment",
      command,
      entities,
      context: touchContext(context)
    };
  }

  if (command.intent === "registrar_gasto") {
    return {
      handled: true,
      source: "parser",
      action: "register_expense",
      command,
      entities,
      context: touchContext(context)
    };
  }

  if (command.intent === "crear_recordatorio") {
    return {
      handled: true,
      source: "parser",
      action: "create_reminder",
      command,
      entities,
      context: touchContext(context)
    };
  }

  if (command.intent === "crear_seguimiento") {
    return {
      handled: true,
      source: "parser",
      action: "create_reminder",
      command,
      entities: mergeCommandEntities(entities, command),
      context: touchContext(context)
    };
  }

  return {
    handled: false,
    source: "fallback",
    action: "fallback",
    entities,
    context,
    response: fallbackResponse
  };
}

export function resolveContextMetaQuestion(message: string, rawContext: ChatContext, entities = extractChatEntities(message)): ChatPlan | null {
  const context = normalizeChatContext(rawContext);
  const normalized = normalizeText(message);
  const activeTask = context.activeTask?.type === "pending_summary" ? undefined : context.activeTask;
  const parkedTask = context.parkedTask;
  const task = activeTask ?? parkedTask;

  if (wantsCancelTask(normalized) && activeTask) {
    const nextContext: ChatContext = {
      ...context,
      activeTask: undefined,
      parkedTask: undefined
    };
    return {
      handled: true,
      source: "context",
      action: "cancel_task",
      entities,
      context: nextContext,
      response: `He cancelado el contexto activo de ${taskTitle(activeTask)}. No he borrado el historial ni los registros ya creados.`
    };
  }

  if ((wantsParkTask(normalized) || wantsNewConversation(normalized)) && activeTask) {
    const parked = { ...activeTask, status: "aparcado" as const, updatedAt: now() };
    const nextContext: ChatContext = {
      ...context,
      activeTask: undefined,
      parkedTask: parked
    };
    return {
      handled: true,
      source: "context",
      action: wantsNewConversation(normalized) ? "clear_context" : "park_task",
      entities,
      context: nextContext,
      response: wantsNewConversation(normalized)
        ? `He limpiado el contexto activo y he dejado aparcado ${taskTitle(parked)}. Podemos empezar otra cosa sin borrar el historial.`
        : `Dejo aparcado ${taskTitle(parked)}. Puedes seguir con otra cosa y decirme "volver al presupuesto" cuando quieras retomarlo.`
    };
  }

  if (wantsNewConversation(normalized) && !activeTask) {
    return {
      handled: true,
      source: "context",
      action: "clear_context",
      entities,
      context,
      response: parkedTask
        ? `No hay una tarea activa bloqueando el chat. Mantengo aparcado ${taskTitle(parkedTask)} y podemos empezar otra cosa.`
        : "No hay una tarea activa ahora mismo. Podemos empezar otra cosa sin borrar el historial."
    };
  }

  if (wantsParkTask(normalized) && !activeTask && parkedTask) {
    return {
      handled: true,
      source: "context",
      action: "park_task",
      entities,
      context,
      response: `Ya estaba aparcado ${taskTitle(parkedTask)}. Puedes seguir con otra cosa o decir "volver al presupuesto" para retomarlo.`
    };
  }

  if (wantsResumeTask(normalized) && (parkedTask || activeTask)) {
    const resumed = { ...(parkedTask ?? activeTask!), status: "activo" as const, updatedAt: now() };
    const nextContext: ChatContext = {
      ...context,
      activeTask: resumed,
      parkedTask: parkedTask ? undefined : context.parkedTask
    };
    return {
      handled: true,
      source: "context",
      action: "resume_task",
      entities,
      context: nextContext,
      response: `${summarizeActiveTask(resumed)}\n\n${shortPendingQuestion(resumed)}`
    };
  }

  if (isGreeting(normalized)) {
    if (activeTask) {
      return {
        handled: true,
        source: "context",
        action: "answer_context",
        entities,
        context: touchContext(context),
        response: `Hola. Tengo pendiente ${taskTitle(activeTask)}. Si quieres, puedo decirte qué datos faltan o podemos seguir con otra cosa.`
      };
    }
    if (parkedTask) {
      return {
        handled: true,
        source: "context",
        action: "answer_context",
        entities,
        context,
        response: `Hola. Tengo aparcado ${taskTitle(parkedTask)}. Puedes decir "volver al presupuesto" para retomarlo o pedirme otra cosa.`
      };
    }
    return {
      handled: true,
      source: "context",
      action: "answer_context",
      entities,
      context,
      response: "Hola, dime qué necesitas y lo dejamos ordenado."
    };
  }

  if (!task) {
    if (asksPendingFields(normalized)) {
      return {
        handled: true,
        source: "context",
        action: "answer_context",
        entities,
        context,
        response: "No tengo una tarea activa en esta conversación. Si quieres, pulsa Ver pendientes o dime qué cliente, presupuesto, factura o visita quieres revisar."
      };
    }
    if (asksPdfPreview(normalized) && context.lastDocumentType && (context.lastBudgetId || context.lastInvoiceId)) {
      return {
        handled: true,
        source: "context",
        action: "generate_pdf",
        entities,
        context: touchContext(context)
      };
    }
    return null;
  }

  if (asksPdfPreview(normalized) && (task.presupuestoId || task.facturaId || context.lastBudgetId || context.lastInvoiceId)) {
    const resumed = activeTask ? activeTask : { ...task, status: "activo" as const, updatedAt: now() };
    return {
      handled: true,
      source: "context",
      action: "generate_pdf",
      entities,
      context: activeTask ? touchContext(context) : withTask({ ...context, parkedTask: undefined }, resumed)
    };
  }

  if (!activeTask && parkedTask && hasUsefulEntities(entities) && !asksPendingFields(normalized) && !asksActiveSummary(normalized) && !asksClientIdentity(normalized) && !asksAmount(normalized) && !asksWorkInfo(normalized)) {
    return {
      handled: true,
      source: "context",
      action: "answer_context",
      entities,
      context,
      response: `Tengo aparcado ${taskTitle(parkedTask)}. No lo retomo automáticamente para no mezclar datos. Si quieres aplicarlos a esa tarea, dime "volver al presupuesto" o abre la conversación anterior.`
    };
  }

  if (asksPendingFields(normalized)) {
    return {
      handled: true,
      source: "context",
      action: "answer_context",
      entities,
      context: activeTask ? touchContext(context) : context,
      response: listPendingFields(task)
    };
  }

  if (asksClientIdentity(normalized)) {
    return {
      handled: true,
      source: "context",
      action: "answer_context",
      entities,
      context: activeTask ? touchContext(context) : context,
      response: answerClientIdentity(task)
    };
  }

  if (asksAmount(normalized)) {
    return {
      handled: true,
      source: "context",
      action: "answer_context",
      entities,
      context: activeTask ? touchContext(context) : context,
      response: answerAmount(task)
    };
  }

  if (asksWorkInfo(normalized)) {
    return {
      handled: true,
      source: "context",
      action: "answer_context",
      entities,
      context: activeTask ? touchContext(context) : context,
      response: answerWorkInfo(task)
    };
  }

  if (asksActiveSummary(normalized)) {
    return {
      handled: true,
      source: "context",
      action: "answer_context",
      entities,
      context: activeTask ? touchContext(context) : context,
      response: `${summarizeActiveTask(task)}\n\n${shortPendingQuestion(task)}`
    };
  }

  return null;
}

export function resolvePendingContext(message: string, rawContext: ChatContext, entities = extractChatEntities(message)): ChatPlan | null {
  const context = normalizeChatContext(rawContext);
  const task = context.activeTask;
  if (!task) return null;
  if (task.status === "aparcado" || task.status === "cancelado" || task.status === "completado") return null;

  if (entities.wantsPdf) {
    return {
      handled: true,
      source: "context",
      action: "generate_pdf",
      entities,
      context: touchContext(context)
    };
  }

  if (task.pendingDecision?.type === "use_existing_work") {
    const decision = resolveDecision(message, task.pendingDecision.options ?? [], entities);
    if (decision.intent === "use_option" && decision.option) {
      return {
        handled: true,
        source: "context",
        action: "use_existing_work_for_budget",
        entities,
        context: withTask(context, {
          ...task,
          obraId: decision.option.id,
          pendingDecision: undefined,
          pendingFields: mergePendingFields(task.pendingFields, entities),
          updatedAt: now()
        })
      };
    }

    if (decision.intent === "create_new") {
      return {
        handled: true,
        source: "context",
        action: "create_new_work_for_budget",
        entities,
        context: withTask(context, {
          ...task,
          pendingDecision: undefined,
          pendingFields: mergePendingFields(task.pendingFields, entities),
          updatedAt: now()
        })
      };
    }

    if (hasUsefulEntities(entities)) {
      return {
        handled: true,
        source: "context",
        action: "ask_pending",
        entities,
        context: touchContext(context),
        response: `Creo que estas completando ${task.lastQuestion ? "la pregunta anterior" : "la obra pendiente"}. ¿Quieres usar la obra existente o crear una nueva?`
      };
    }

    return {
      handled: true,
      source: "context",
      action: "ask_pending",
      entities,
      context: touchContext(context),
      response: task.lastQuestion ?? "Tengo una obra parecida pendiente de confirmar. ¿Quieres usar esa obra o crear una nueva?"
    };
  }

  if (task.pendingDecision?.type === "select_document") {
    const decision = resolveDecision(message, task.pendingDecision.options ?? [], entities);
    if (decision.intent === "use_option" && decision.option) {
      return {
        handled: true,
        source: "context",
        action: "select_document",
        entities,
        context: withTask(context, {
          ...task,
          facturaId: decision.option.type === "invoice" ? decision.option.id : task.facturaId,
          presupuestoId: decision.option.type === "budget" ? decision.option.id : task.presupuestoId,
          pendingDecision: undefined,
          updatedAt: now()
        })
      };
    }

    return {
      handled: true,
      source: "context",
      action: "ask_pending",
      entities,
      context: touchContext(context),
      response: task.lastQuestion ?? "Tengo varios documentos posibles. Dime si quieres el primero, el segundo o el numero del documento."
    };
  }

  if (task.type === "complete_activity") {
    if (hasUsefulEntities(entities) || message.trim().length > 2) {
      return {
        handled: true,
        source: "context",
        action: "complete_activity",
        entities,
        context: withTask(context, {
          ...task,
          pendingFields: mergeActivityPendingFields(task.pendingFields, entities, message),
          updatedAt: now()
        })
      };
    }

    return {
      handled: true,
      source: "context",
      action: "ask_pending",
      entities,
      context: touchContext(context),
      response: task.lastQuestion ?? "Sigo con esa visita. Puedes decirme qué falta confirmar o cuándo quieres que te lo recuerde."
    };
  }

  if (task.type === "complete_budget" || task.type === "create_budget") {
    if (hasUsefulEntities(entities)) {
      return {
        handled: true,
        source: "context",
        action: "complete_budget",
        entities,
        context: withTask(context, {
          ...task,
          pendingFields: mergePendingFields(task.pendingFields, entities),
          updatedAt: now()
        })
      };
    }

    return {
      handled: true,
      source: "context",
      action: "ask_pending",
      entities,
      context: touchContext(context),
      response: task.lastQuestion ?? "Sigo con ese presupuesto. Me puedes dar IVA, direccion de obra, telefono, email, NIF/CIF o pedirme el PDF."
    };
  }

  if (task.type === "complete_invoice" || task.type === "create_invoice") {
    if (hasUsefulEntities(entities)) {
      return {
        handled: true,
        source: "context",
        action: "complete_invoice",
        entities,
        context: withTask(context, {
          ...task,
          pendingFields: mergePendingFields(task.pendingFields, entities),
          updatedAt: now()
        })
      };
    }

    return {
      handled: true,
      source: "context",
      action: "ask_pending",
      entities,
      context: touchContext(context),
      response: task.lastQuestion ?? "Sigo con esa factura. Puedes darme datos fiscales, marcarla pagada, registrar un pago o generar el PDF."
    };
  }

  return null;
}

export function extractChatEntities(message: string): ChatEntities {
  const normalized = normalizeText(message);
  const followUp = parseBudgetFollowUp(message);
  const entities: ChatEntities = {
    ...followUp,
    useful: followUp.useful || false,
    clientName: extractClientReference(message),
    amount: extractMoneyAmount(message) ?? undefined,
    eventTime: extractClockTime(message, normalized),
    reminderDateHint: normalized.includes("manana") ? "tomorrow" : normalized.includes("hoy") ? "today" : undefined,
    reminderTime: extractClockTime(message, normalized),
    materialIncluded: /material(?:es)? incluido|incluye material|con material/.test(normalized) ? true : undefined,
    invoiceStatus: extractInvoiceStatus(normalized),
    ordinal: extractOrdinal(normalized),
    reference: extractReference(normalized),
    affirmation: isAffirmation(normalized),
    negation: isNegation(normalized),
    createNew: wantsNew(normalized),
    sendChannel: normalized.includes("whatsapp") ? "whatsapp" : normalized.includes("email") || normalized.includes("correo") ? "email" : undefined
  };
  entities.useful = hasUsefulEntities(entities);
  return entities;
}

export function normalizeChatContext(rawContext?: ChatContext | LegacyChatContext | null): ChatContext {
  if (!rawContext) return {};
  if (rawContext.activeTask) return rawContext as ChatContext;

  const legacy = rawContext as LegacyChatContext;
  if (legacy.type === "completar_presupuesto") {
    return createBudgetCompletionContext({
      clientId: legacy.clienteId,
      workId: legacy.obraId,
      budgetId: legacy.presupuestoId,
      clientName: legacy.clienteNombre,
      pendingFields: legacy.camposPendientes,
      createdAt: legacy.fechaCreacion
    });
  }

  if (legacy.type === "completar_factura") {
    return createInvoiceCompletionContext({
      clientId: legacy.clienteId,
      workId: legacy.obraId,
      invoiceId: legacy.facturaId,
      clientName: legacy.clienteNombre,
      pendingFields: legacy.camposPendientes,
      createdAt: legacy.fechaCreacion
    });
  }

  if (legacy.type === "ultimo_documento") {
    return createLastDocumentContext({
      documentType: legacy.documentKind ?? (legacy.facturaId ? "invoice" : "budget"),
      documentId: legacy.documentId ?? legacy.facturaId ?? legacy.presupuestoId,
      clientId: legacy.clienteId,
      workId: legacy.obraId,
      clientName: legacy.clienteNombre
    });
  }

  return rawContext as ChatContext;
}

export function createBudgetCompletionContext({
  clientId,
  workId,
  budgetId,
  clientName,
  contactName,
  billingClientName,
  workName,
  title,
  pendingFields = ["iva", "direccion_obra", "datos_cliente"],
  pendingFieldDetails,
  draftData,
  createdAt
}: {
  clientId?: string;
  workId?: string;
  budgetId?: string;
  clientName?: string;
  contactName?: string;
  billingClientName?: string;
  workName?: string;
  title?: string;
  pendingFields?: string[];
  pendingFieldDetails?: ChatPendingFieldDetail[];
  draftData?: Record<string, unknown>;
  createdAt?: string;
}): ChatContext {
  const timestamp = createdAt ?? now();
  const taskBillingName = billingClientName ?? clientName;
  return {
    activeTask: {
      type: "complete_budget",
      status: "activo",
      title: title ?? (taskBillingName ? `el presupuesto de ${taskBillingName}` : undefined),
      contactName,
      billingClientName: taskBillingName,
      workName,
      clienteId: clientId,
      obraId: workId,
      presupuestoId: budgetId,
      pendingFields,
      pendingFieldDetails,
      draftData,
      lastQuestion: clientName
        ? `Tengo pendiente el presupuesto de ${clientName}. Faltan ${joinNatural(readablePendingFields({ type: "complete_budget", billingClientName: taskBillingName, contactName, workName, pendingFields, pendingFieldDetails, draftData, createdAt: timestamp, updatedAt: timestamp }).map(shortPendingLabel))}.`
        : "Faltan datos del presupuesto.",
      createdAt: timestamp,
      updatedAt: now()
    },
    lastClientId: clientId,
    lastWorkId: workId,
    lastBudgetId: budgetId,
    lastDocumentType: "budget",
    lastClientName: clientName
  };
}

export function createInvoiceCompletionContext({
  clientId,
  workId,
  invoiceId,
  clientName,
  contactName,
  billingClientName,
  workName,
  title,
  pendingFields = ["datos_fiscales"],
  pendingFieldDetails,
  draftData,
  createdAt
}: {
  clientId?: string;
  workId?: string;
  invoiceId?: string;
  clientName?: string;
  contactName?: string;
  billingClientName?: string;
  workName?: string;
  title?: string;
  pendingFields?: string[];
  pendingFieldDetails?: ChatPendingFieldDetail[];
  draftData?: Record<string, unknown>;
  createdAt?: string;
}): ChatContext {
  const timestamp = createdAt ?? now();
  const taskBillingName = billingClientName ?? clientName;
  return {
    activeTask: {
      type: "complete_invoice",
      status: "activo",
      title: title ?? (taskBillingName ? `la factura de ${taskBillingName}` : undefined),
      contactName,
      billingClientName: taskBillingName,
      workName,
      clienteId: clientId,
      obraId: workId,
      facturaId: invoiceId,
      pendingFields,
      pendingFieldDetails,
      draftData,
      lastQuestion: clientName
        ? `Faltan datos de la factura de ${clientName}.`
        : "Faltan datos de la factura.",
      createdAt: timestamp,
      updatedAt: now()
    },
    lastClientId: clientId,
    lastWorkId: workId,
    lastInvoiceId: invoiceId,
    lastDocumentType: "invoice",
    lastClientName: clientName
  };
}

export function createActivityCompletionContext({
  clientId,
  workId,
  eventId,
  clientName,
  workName,
  title,
  pendingFields = ["materiales_revisados", "pendiente_de_confirmar", "fecha_recordatorio"],
  pendingFieldDetails,
  draftData,
  createdAt
}: {
  clientId?: string;
  workId?: string;
  eventId?: string;
  clientName?: string;
  workName?: string;
  title?: string;
  pendingFields?: string[];
  pendingFieldDetails?: ChatPendingFieldDetail[];
  draftData?: Record<string, unknown>;
  createdAt?: string;
}): ChatContext {
  const timestamp = createdAt ?? now();
  return {
    activeTask: {
      type: "complete_activity",
      status: "activo",
      title: title ?? (clientName ? `la visita de ${clientName}` : undefined),
      contactName: clientName,
      workName,
      clienteId: clientId,
      obraId: workId,
      pendingFields,
      pendingFieldDetails,
      draftData: { ...draftData, eventId },
      lastQuestion: clientName
        ? `Sigo con la visita de ${clientName}.`
        : "Sigo con esa visita.",
      createdAt: timestamp,
      updatedAt: now()
    },
    lastClientId: clientId,
    lastWorkId: workId,
    lastClientName: clientName
  };
}

export function createWorkSelectionContext({
  clientId,
  clientName,
  workOption,
  draftBudget,
  pendingFields = ["iva", "direccion_obra", "datos_cliente"],
  lastQuestion
}: {
  clientId: string;
  clientName: string;
  workOption: ChatDecisionOption;
  draftBudget: ParsedBudgetCommand;
  pendingFields?: string[];
  lastQuestion: string;
}): ChatContext {
  const timestamp = now();
  return {
    activeTask: {
      type: "create_budget",
      status: "activo",
      title: `el presupuesto de ${clientName}`,
      billingClientName: clientName,
      clienteId: clientId,
      pendingFields,
      pendingDecision: {
        type: "use_existing_work",
        options: [workOption]
      },
      draftData: { budgetCommand: draftBudget },
      lastQuestion,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    lastClientId: clientId,
    lastClientName: clientName
  };
}

export function createLastDocumentContext({
  documentType,
  documentId,
  clientId,
  workId,
  clientName
}: {
  documentType: ChatDocumentType;
  documentId?: string;
  clientId?: string;
  workId?: string;
  clientName?: string;
}): ChatContext {
  return {
    lastClientId: clientId,
    lastWorkId: workId,
    lastBudgetId: documentType === "budget" ? documentId : undefined,
    lastInvoiceId: documentType === "invoice" ? documentId : undefined,
    lastDocumentType: documentType,
    lastClientName: clientName
  };
}

export function draftBudgetCommandFromContext(context: ChatContext): ParsedBudgetCommand | null {
  const draft = context.activeTask?.draftData?.budgetCommand;
  if (!draft || typeof draft !== "object") return null;
  const command = draft as Partial<ParsedBudgetCommand>;
  return command.intent === "crear_presupuesto" && typeof command.clientName === "string" && typeof command.amount === "number"
    ? command as ParsedBudgetCommand
    : null;
}

export function summarizeActiveTask(task: ChatActiveTask) {
  const subject = taskTitle(task);
  const amount = taskAmount(task);
  const details = [
    task.contactName ? `Contacto: ${task.contactName}.` : null,
    task.billingClientName ? `Cliente de facturación: ${task.billingClientName}.` : null,
    task.workName ? `Obra: ${task.workName}.` : null,
    typeof amount === "number" ? `Importe: ${formatEngineEuros(amount)}.` : null,
    task.status === "aparcado" ? "Estado: aparcado." : null
  ].filter(Boolean);

  return details.length
    ? `Tengo pendiente ${subject}.\n\n${details.join("\n")}`
    : `Tengo pendiente ${subject}.`;
}

export function listPendingFields(task: ChatActiveTask) {
  const fields = readablePendingFields(task);
  if (!fields.length) return `No veo datos obligatorios pendientes en ${taskTitle(task)}. Puedes pedirme un resumen o revisar el documento.`;
  const list = fields.map((field, index) => `${index + 1}. ${field}.`).join("\n");
  return `${withDePrefix(taskTitle(task))} faltan estos datos:\n\n${list}\n\nCon esos datos puedo dejarlo mucho más completo.`;
}

export function answerClientIdentity(task: ChatActiveTask) {
  const contact = task.contactName;
  const billing = task.billingClientName ?? taskTitleName(task);

  if (contact && billing && normalizeText(contact) !== normalizeText(billing)) {
    return `En este trabajo tengo dos datos separados:\n\nContacto: ${contact}.\nCliente de facturación: ${billing}.\n\nLa factura o presupuesto debería ir a nombre de ${billing}, y ${contact} queda como persona de contacto.`;
  }

  if (billing) return `El cliente que tengo para ${taskTitle(task)} es ${billing}.`;
  if (contact) return `La persona de contacto que tengo para ${taskTitle(task)} es ${contact}.`;
  return `Todavía no tengo claro el cliente de ${taskTitle(task)}. Si quieres, dime el contacto y la empresa de facturación.`;
}

export function answerAmount(task: ChatActiveTask) {
  const amount = taskAmount(task);
  if (typeof amount !== "number") return `No tengo un importe confirmado guardado para ${taskTitle(task)}.`;
  const iva = typeof task.iva === "number"
    ? ` IVA registrado: ${formatPercent(task.iva)}.`
    : task.iva === "included"
      ? " Tengo marcado que el IVA va incluido."
      : task.iva === "plus"
        ? " Tengo marcado que es más IVA."
        : "";
  return `El importe que tengo guardado para ${taskTitle(task)} es ${formatEngineEuros(amount)}.${iva}`;
}

export function answerWorkInfo(task: ChatActiveTask) {
  const work = task.workName || (typeof task.draftData?.workTitle === "string" ? task.draftData.workTitle : "");
  const address = typeof task.draftData?.workAddress === "string" ? task.draftData.workAddress : "";
  if (work && address) return `La obra que tengo para ${taskTitle(task)} es ${work}, en ${address}.`;
  if (work) return `La obra que tengo para ${taskTitle(task)} es ${work}.`;
  if (address) return `La dirección de obra que tengo para ${taskTitle(task)} es ${address}.`;
  return `Todavía no tengo una obra o dirección clara guardada para ${taskTitle(task)}.`;
}

function shortPendingQuestion(task: ChatActiveTask) {
  const fields = readablePendingFields(task);
  if (!fields.length) return "¿Quieres completarlo, generar un PDF o seguir con otra cosa?";
  return `Faltan ${joinNatural(fields.map(shortPendingLabel))}. ¿Quieres completarlo ahora o lo dejamos pendiente?`;
}

function readablePendingFields(task: ChatActiveTask) {
  const fromDetails = (task.pendingFieldDetails ?? [])
    .filter((field) => !task.pendingFields?.length || task.pendingFields.includes(field.key) || task.pendingFields.some((key) => field.key.startsWith(`${key}:`)))
    .map((field) => field.label.trim())
    .filter(Boolean);
  if (fromDetails.length) return [...new Set(fromDetails)];

  const labels: string[] = [];
  const pending = orderedPendingFields(task.pendingFields ?? []);
  const billingName = task.billingClientName ?? taskTitleName(task) ?? "cliente de facturación";
  const contactName = task.contactName ?? "contacto";
  const amount = typeof taskAmount(task) === "number" ? formatEngineEuros(taskAmount(task) as number) : "el importe";
  const workName = task.workName ?? "";
  const location = extractKnownLocation(task);
  const workAddressLabel = workName.toLowerCase().includes("hotel") || location
    ? `Dirección exacta ${location ? `del hotel en ${location}` : "de la obra/hotel"}`
    : "Dirección exacta de la obra";

  for (const field of pending) {
    if (field === "datos_fiscales") {
      labels.push(`CIF de ${billingName}`);
      labels.push(`Dirección fiscal de ${billingName}`);
    } else if (field === "iva") {
      labels.push(`Confirmar si los ${amount} son con IVA incluido o más IVA`);
    } else if (field === "direccion_obra") {
      labels.push(workAddressLabel);
    } else if (field === "datos_cliente") {
      labels.push(`Teléfono o email de ${contactName}`);
    } else if (field === "materiales_revisados") {
      labels.push("Qué materiales se revisaron");
    } else if (field === "pendiente_de_confirmar") {
      labels.push("Qué tiene que confirmar el cliente");
    } else if (field === "fecha_recordatorio") {
      labels.push("Cuándo quieres que te lo recuerde");
    } else {
      labels.push(humanizeKey(field));
    }
  }

  return [...new Set(labels)];
}

function orderedPendingFields(fields: string[]) {
  const order = ["datos_fiscales", "direccion_obra", "iva", "datos_cliente", "materiales_revisados", "pendiente_de_confirmar", "fecha_recordatorio"];
  return [...fields].sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    return (indexA === -1 ? order.length : indexA) - (indexB === -1 ? order.length : indexB);
  });
}

function taskTitle(task: ChatActiveTask) {
  if (task.title) return task.title;
  const name = taskTitleName(task);
  if (task.type === "complete_invoice" || task.type === "create_invoice") return `la factura de ${name ?? "ese cliente"}`;
  if (task.type === "complete_activity") return `la visita o seguimiento de ${name ?? "ese cliente"}`;
  return `el presupuesto de ${name ?? "ese cliente"}`;
}

function taskTitleName(task: ChatActiveTask) {
  return task.billingClientName ?? task.contactName;
}

function withDePrefix(title: string) {
  if (title.startsWith("el ")) return `Del ${title.slice(3)}`;
  if (title.startsWith("El ")) return `Del ${title.slice(3)}`;
  return `De ${title}`;
}

function shortPendingLabel(label: string) {
  return label
    .replace(/^Confirmar si /, "")
    .replace(/^Dirección exacta /, "dirección ")
    .replace(/^Teléfono o email /, "contacto ")
    .replace(/^CIF /, "CIF ")
    .replace(/^Dirección fiscal /, "dirección fiscal ");
}

function humanizeKey(field: string) {
  return field.replace(/_/g, " ");
}

function extractKnownLocation(task: ChatActiveTask) {
  const haystack = normalizeText(`${task.workName ?? ""} ${task.title ?? ""}`);
  const locations = ["Menorca", "Mallorca", "Ibiza", "Madrid", "Barcelona", "Valencia", "Alicante", "Sevilla", "Malaga", "Málaga"];
  return locations.find((location) => haystack.includes(normalizeText(location)));
}

function formatEngineEuros(amount: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value)}%`;
}

function taskAmount(task: ChatActiveTask) {
  if (typeof task.importe === "number") return task.importe;
  if (typeof task.draftData?.amount === "number") return task.draftData.amount;
  if (typeof task.draftData?.total === "number") return task.draftData.total;
  return undefined;
}

function joinNatural(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function isGreeting(normalized: string) {
  return /^(hola|buenas|buenos dias|buenos días|buenas tardes|buenas noches|hey|que tal|qué tal)([!. ]*)?$/.test(normalized);
}

function asksPendingFields(normalized: string) {
  return /(que datos faltan|que datos\??|que falta|dime lo que falta|dime los datos|dimelos|dímelos|dime cuales|dime cuáles|cuales son|cuáles son|que tengo pendiente|que necesitas|que hace falta|datos pendientes|faltantes|pendiente para terminar|para terminarlo)/.test(normalized);
}

function asksClientIdentity(normalized: string) {
  return /(como se llama el cliente|quien es el cliente|quien es contacto|quien es el contacto|a nombre de quien|a nombre de quién|cliente de facturacion|cliente de facturación)/.test(normalized);
}

function asksActiveSummary(normalized: string) {
  return /(que teniamos pendiente|qué teníamos pendiente|resumen|resumen de esto|resumeme esto|resúmeme esto|resume esto|que era esto|en que estabamos|en qué estábamos|que tengo abierto|tarea pendiente)/.test(normalized);
}

function asksAmount(normalized: string) {
  return /(cuanto era|cuánto era|cuanto era el importe|cuál era el importe|cual era el importe|que importe|qué importe|importe guardado|cuanto costaba|cuánto costaba|por cuanto era|por cuánto era)/.test(normalized);
}

function asksWorkInfo(normalized: string) {
  return /(que obra era|qué obra era|donde era|dónde era|direccion de la obra|dirección de la obra|ubicacion|ubicación|que trabajo era|qué trabajo era)/.test(normalized);
}

function asksPdfPreview(normalized: string) {
  return /^(quiero\s+)?(verlo|verlo aqui|verlo aquí|ver aqui|ver aquí|abrirlo|mostrarlo|muestralo|muéstralo|enseñamelo|enséñamelo)(\s+por aqui|\s+por aquí)?[.!?]*$/.test(normalized);
}

function wantsParkTask(normalized: string) {
  return /(dejalo pendiente|déjalo pendiente|aparcalo|apárcalo|aparcar esto|lo dejamos pendiente|luego seguimos|mas tarde|más tarde)/.test(normalized);
}

function wantsNewConversation(normalized: string) {
  return /(nuevo chat|nueva conversacion|nueva conversación|empezamos otra cosa|otra cosa|limpia el contexto|empezar de cero)/.test(normalized);
}

function wantsCancelTask(normalized: string) {
  return /(cancela esto|cancelar esto|olvida este presupuesto|olvida esta factura|olvida esto|descarta esto|borra este contexto)/.test(normalized);
}

function wantsResumeTask(normalized: string) {
  return /(sigue con|seguir con|volver al|vuelve al|retoma|retomar|continuar tarea|continua con|continúa con)/.test(normalized);
}

export function mergeBudgetCommandWithEntities(command: ParsedBudgetCommand, entities: ChatEntities): ParsedBudgetCommand {
  return {
    ...command,
    amount: entities.amount ?? command.amount,
    materialIncluded: entities.materialIncluded ?? command.materialIncluded,
    ivaMode: entities.ivaMode ?? command.ivaMode
  };
}

function resolveDecision(message: string, options: ChatDecisionOption[], entities: ChatEntities) {
  const normalized = normalizeText(message);
  const option = optionFromReference(normalized, options, entities);

  if (entities.createNew || (entities.negation && wantsNew(normalized))) {
    return { intent: "create_new" as const, option: undefined };
  }

  if (option || entities.affirmation || entities.reference === "same" || entities.reference === "current") {
    return { intent: "use_option" as const, option: option ?? options[0] };
  }

  if (entities.negation) {
    return { intent: "create_new" as const, option: undefined };
  }

  return { intent: "unknown" as const, option: undefined };
}

function optionFromReference(normalized: string, options: ChatDecisionOption[], entities: ChatEntities) {
  if (!options.length) return undefined;
  if (entities.ordinal && options[entities.ordinal - 1]) return options[entities.ordinal - 1];

  const direct = options.find((option) => normalized.includes(normalizeText(option.label)));
  if (direct) return direct;

  if (/(esa|ese|esta|este|misma|mismo|anterior|ultimo|ultima|ahi|ahi mismo)/.test(normalized)) return options[0];
  return undefined;
}

function mergeCommandEntities(entities: ChatEntities, command: Exclude<ParsedChatCommand, null>): ChatEntities {
  if ("clientName" in command && command.clientName) entities.clientName = command.clientName;
  if ("amount" in command && command.amount) entities.amount = command.amount;
  if ("ivaMode" in command && command.ivaMode && command.ivaMode !== "unknown") entities.ivaMode = command.ivaMode as Exclude<IvaMode, "unknown">;
  if ("materialIncluded" in command) entities.materialIncluded = command.materialIncluded;
  if (isActivityCommand(command)) {
    if (command.eventTime) entities.eventTime = command.eventTime;
    if (command.eventDateHint) entities.reminderDateHint = command.eventDateHint;
  }
  if (command.intent === "crear_seguimiento") {
    if (command.reminderDateHint) entities.reminderDateHint = command.reminderDateHint;
    if (command.reminderTime) entities.reminderTime = command.reminderTime;
    if (command.channel === "whatsapp" || command.channel === "email") entities.sendChannel = command.channel;
  }
  if (command.intent === "generar_pdf") {
    const pdfCommand = command as ParsedPdfCommand;
    if (pdfCommand.clientName) entities.clientName = pdfCommand.clientName;
  }
  if (command.intent === "convertir_presupuesto_en_factura") {
    const convertCommand = command as ParsedConvertBudgetCommand;
    if (convertCommand.clientName) entities.clientName = convertCommand.clientName;
  }
  entities.useful = hasUsefulEntities(entities);
  return entities;
}

function isActivityCommand(command: Exclude<ParsedChatCommand, null>): command is ParsedActivityCommand {
  return command.intent === "registrar_visita" || command.intent === "registrar_reunion" || command.intent === "registrar_llamada" || command.intent === "registrar_nota_obra";
}

function mergePendingFields(fields: string[] | undefined, entities: ChatEntities) {
  const next = new Set(fields ?? []);
  if (entities.ivaMode) next.delete("iva");
  if (entities.workAddress) next.delete("direccion_obra");
  if (entities.phone || entities.email || entities.clientName) next.delete("datos_cliente");
  if (entities.nif || entities.fiscalAddress) {
    next.delete("datos_cliente");
    if (entities.nif && entities.fiscalAddress) next.delete("datos_fiscales");
  }
  return [...next];
}

function mergeActivityPendingFields(fields: string[] | undefined, entities: ChatEntities, message: string) {
  const next = new Set(fields ?? []);
  const normalized = normalizeText(message);
  if (/(material|azulejo|suelo|grifo|mampara|pintura|mueble|encimera|plato|sanitario)/.test(normalized)) next.delete("materiales_revisados");
  if (/(confirmar|aprob|precio|fecha|material|color|medida|presupuesto|licencia)/.test(normalized)) next.delete("pendiente_de_confirmar");
  if (entities.reminderDateHint || entities.reminderTime || /(manana|hoy|lunes|martes|miercoles|jueves|viernes|sabado|domingo|semana)/.test(normalized)) next.delete("fecha_recordatorio");
  return [...next];
}

function hasUsefulEntities(entities: ChatEntities) {
  return Boolean(
    entities.ivaMode ||
    entities.workAddress ||
    entities.fiscalAddress ||
    entities.phone ||
    entities.email ||
    entities.nif ||
    entities.leavePending ||
    entities.wantsPdf ||
    entities.amount ||
    entities.eventTime ||
    entities.reminderDateHint ||
    entities.reminderTime ||
    entities.materialIncluded !== undefined ||
    entities.clientName ||
    entities.invoiceStatus ||
    entities.ordinal ||
    entities.reference ||
    entities.affirmation ||
    entities.negation ||
    entities.createNew ||
    entities.sendChannel
  );
}

function touchContext(context: ChatContext) {
  if (!context.activeTask) return context;
  return withTask(context, { ...context.activeTask, updatedAt: now() });
}

function withTask(context: ChatContext, task: ChatActiveTask): ChatContext {
  return {
    ...context,
    activeTask: task,
    lastClientId: task.clienteId ?? context.lastClientId,
    lastWorkId: task.obraId ?? context.lastWorkId,
    lastBudgetId: task.presupuestoId ?? context.lastBudgetId,
    lastInvoiceId: task.facturaId ?? context.lastInvoiceId,
    lastDocumentType: task.presupuestoId ? "budget" : task.facturaId ? "invoice" : context.lastDocumentType,
    lastClientName: task.billingClientName ?? task.contactName ?? context.lastClientName
  };
}

function isAffirmation(normalized: string) {
  return /^(si|sí|vale|ok|correcto|hazlo|adelante|sigue|usa esa|quiero usar esa|la misma|esa misma|esa|ese|esta|este)(\b|$)/.test(normalized);
}

function isNegation(normalized: string) {
  return /^(no|mejor no|negativo)(\b|$)/.test(normalized);
}

function wantsNew(normalized: string) {
  return /(crea otra|crear otra|crea una nueva|crear una nueva|mejor una nueva|nueva obra|otra obra|no, crea|no crea esa)/.test(normalized);
}

function extractReference(normalized: string): ChatEntities["reference"] {
  if (/(ultima|ultimo|el ultimo|la ultima)/.test(normalized)) return "last";
  if (/(anterior|lo anterior|el de antes|la de antes)/.test(normalized)) return "previous";
  if (/(misma|mismo|esa misma|ese mismo)/.test(normalized)) return "same";
  if (/(esa|ese|esto|esta|este|ahi)/.test(normalized)) return "current";
  return undefined;
}

function extractOrdinal(normalized: string) {
  if (/(la primera|el primero|primera|primero|opcion 1|opción 1|\b1\b)/.test(normalized)) return 1;
  if (/(la segunda|el segundo|segunda|segundo|opcion 2|opción 2|\b2\b)/.test(normalized)) return 2;
  if (/(la tercera|el tercero|tercera|tercero|opcion 3|opción 3|\b3\b)/.test(normalized)) return 3;
  return undefined;
}

function extractInvoiceStatus(normalized: string): ChatEntities["invoiceStatus"] {
  if (/(marca pagada|esta cobrada|está cobrada|cobrada|pagada|ha pagado todo)/.test(normalized)) return "pagada";
  if (/(pago parcial|pagado parte|ha pagado \d|me ha pagado \d)/.test(normalized)) return "parcialmente_pagada";
  if (/(vencida|vencido)/.test(normalized)) return "vencida";
  if (/(enviada|enviado)/.test(normalized)) return "enviada";
  return undefined;
}

function extractClientReference(message: string) {
  const patterns = [
    /factura\s+de\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i,
    /presupuesto\s+de\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i,
    /obra\s+de\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i,
    /(?:visita|reunion|reunión|llamada)\s+con\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)(?=\s+(?:referente|sobre|por|para|a\s+las|hemos|y|,|\.|$))/i,
    /\bcon\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)(?=\s+(?:referente|sobre|por|para|a\s+las|hemos|y|,|\.|$))/i,
    /cliente\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i,
    /\b(?:para|a)\s+(?!la\b|el\b|obra\b|direccion\b|dirección\b|fiscal\b|nif\b|cif\b|pagada\b|cobrada\b)([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return titleCase(match[1].replace(/\b(factura|presupuesto|obra|cliente)\b/gi, "").trim());
  }

  return undefined;
}

function extractMoneyAmount(text: string) {
  const thousands = text.match(/\b(\d[\d.,]*)\s+mil(?:\s*(?:euros|eur|€))?\b/i);
  if (thousands && !isTimeLikeNumber(text, thousands.index ?? 0, thousands[1])) {
    const base = parseEngineNumber(thousands[1]);
    return Number.isFinite(base) ? base * 1000 : null;
  }
  const pattern = /(\d[\d.,]*)(?:\s*(?:euros|eur|€))?/gi;
  let cleaned: string | null = null;
  for (const match of text.matchAll(pattern)) {
    if (!match[1]) continue;
    if (isTimeLikeNumber(text, match.index ?? 0, match[1])) continue;
    cleaned = match[1].trim();
    break;
  }
  if (!cleaned) return null;
  return parseEngineNumber(cleaned);
}

function parseEngineNumber(cleaned: string) {
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(cleaned)) return Number(cleaned.replace(/\./g, "").replace(",", "."));
  if (/^\d+[,.]\d{1,2}$/.test(cleaned)) return Number(cleaned.replace(",", "."));
  return Number(cleaned.replace(/[.,]/g, ""));
}

function isTimeLikeNumber(text: string, index: number, value: string) {
  const before = text.slice(Math.max(0, index - 12), index).toLowerCase();
  const after = text.slice(index + value.length, index + value.length + 4).toLowerCase();
  if (/^\s*(h|:)/.test(after)) return true;
  if (/\b(a\s+)?las\s+$/.test(before)) return true;
  return false;
}

function extractClockTime(original: string, normalized: string) {
  const numeric = original.match(/\b(?:a\s+las\s+|las\s+)?([01]?\d|2[0-3])(?::([0-5]\d))?\s*h\b/i)
    ?? original.match(/\b(?:a\s+las\s+|las\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i)
    ?? original.match(/\b(?:a\s+las\s+|las\s+)([01]?\d|2[0-3])\b/i);
  if (numeric?.[1]) return `${numeric[1].padStart(2, "0")}:${numeric[2] ?? "00"}`;

  const hourWords: Record<string, number> = {
    una: 1,
    uno: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
    once: 11,
    doce: 12
  };
  const word = normalized.match(/\ba las (una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?: de la (tarde|manana|noche))?\b/);
  if (!word?.[1]) return undefined;
  let hour = hourWords[word[1]] ?? 0;
  if ((word[2] === "tarde" || word[2] === "noche") && hour < 12) hour += 12;
  return `${String(hour).padStart(2, "0")}:00`;
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function now() {
  return new Date().toISOString();
}
