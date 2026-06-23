import {
  normalizeText,
  parseBudgetFollowUp,
  parseChatCommand,
  type IvaMode,
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
  | "create_reminder";

export type ChatDecisionType =
  | "use_existing_client"
  | "use_existing_work"
  | "create_new_work"
  | "confirm_pdf"
  | "confirm_send"
  | "select_document";

export type ChatEntityType = "client" | "work" | "budget" | "invoice";
export type ChatDocumentType = "budget" | "invoice";

export type ChatDecisionOption = {
  id: string;
  label: string;
  type: ChatEntityType;
};

export type ChatActiveTask = {
  type: ChatTaskType;
  clienteId?: string;
  obraId?: string;
  presupuestoId?: string;
  facturaId?: string;
  pendingFields?: string[];
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
        | "generate_pdf"
        | "confirm_send"
        | "select_document"
        | "ask_pending";
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

const fallbackResponse = "No lo he entendido del todo. ¿Quieres que lo trate como presupuesto, factura, gasto, pago o recordatorio?";

export function planChatMessage(message: string, rawContext?: ChatContext | LegacyChatContext | null): ChatPlan {
  const context = normalizeChatContext(rawContext);
  const entities = extractChatEntities(message);
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

  return {
    handled: false,
    source: "fallback",
    action: "fallback",
    entities,
    context,
    response: fallbackResponse
  };
}

export function resolvePendingContext(message: string, rawContext: ChatContext, entities = extractChatEntities(message)): ChatPlan | null {
  const context = normalizeChatContext(rawContext);
  const task = context.activeTask;
  if (!task) return null;

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
  pendingFields = ["iva", "direccion_obra", "datos_cliente"],
  createdAt
}: {
  clientId?: string;
  workId?: string;
  budgetId?: string;
  clientName?: string;
  pendingFields?: string[];
  createdAt?: string;
}): ChatContext {
  const timestamp = createdAt ?? now();
  return {
    activeTask: {
      type: "complete_budget",
      clienteId: clientId,
      obraId: workId,
      presupuestoId: budgetId,
      pendingFields,
      lastQuestion: clientName
        ? `Faltan datos del presupuesto de ${clientName}.`
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
  pendingFields = ["datos_fiscales"],
  createdAt
}: {
  clientId?: string;
  workId?: string;
  invoiceId?: string;
  clientName?: string;
  pendingFields?: string[];
  createdAt?: string;
}): ChatContext {
  const timestamp = createdAt ?? now();
  return {
    activeTask: {
      type: "complete_invoice",
      clienteId: clientId,
      obraId: workId,
      facturaId: invoiceId,
      pendingFields,
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

function mergePendingFields(fields: string[] | undefined, entities: ChatEntities) {
  const next = new Set(fields ?? []);
  if (entities.ivaMode) next.delete("iva");
  if (entities.workAddress) next.delete("direccion_obra");
  if (entities.phone || entities.email || entities.nif || entities.clientName) next.delete("datos_cliente");
  return [...next];
}

function hasUsefulEntities(entities: ChatEntities) {
  return Boolean(
    entities.ivaMode ||
    entities.workAddress ||
    entities.phone ||
    entities.email ||
    entities.nif ||
    entities.leavePending ||
    entities.wantsPdf ||
    entities.amount ||
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
    lastDocumentType: task.presupuestoId ? "budget" : task.facturaId ? "invoice" : context.lastDocumentType
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
    /cliente\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i,
    /(?:para|a)\s+(?!la\b|el\b|pagada\b|cobrada\b)([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return titleCase(match[1].replace(/\b(factura|presupuesto|obra|cliente)\b/gi, "").trim());
  }

  return undefined;
}

function extractMoneyAmount(text: string) {
  const match = text.match(/(\d[\d.,]*)(?:\s*(?:euros|eur|€))?/i);
  if (!match?.[1]) return null;
  const cleaned = match[1].trim();
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(cleaned)) return Number(cleaned.replace(/\./g, "").replace(",", "."));
  if (/^\d+[,.]\d{1,2}$/.test(cleaned)) return Number(cleaned.replace(",", "."));
  return Number(cleaned.replace(/[.,]/g, ""));
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
