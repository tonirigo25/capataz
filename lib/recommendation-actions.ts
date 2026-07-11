import type { Prisma } from "@prisma/client";

export type RecommendationActionKind =
  | "navigate"
  | "open_preview"
  | "server_action"
  | "create_draft"
  | "confirm_then_execute"
  | "ask_for_missing_data"
  | "dismiss"
  | "snooze";

export type RecommendationEntityType =
  | "business"
  | "client"
  | "work"
  | "invoice"
  | "budget"
  | "treasury"
  | "agenda"
  | "reminder"
  | "document"
  | "expense";

export type RecommendationActionContext = {
  recommendationFingerprint?: string;
  entityType?: RecommendationEntityType | string | null;
  entityId?: string | null;
  clientId?: string | null;
  workId?: string | null;
  invoiceId?: string | null;
  budgetId?: string | null;
  amount?: number | null;
  title?: string | null;
  reason?: string | null;
  returnTo?: string | null;
};

export type RecommendationAction = {
  id: string;
  label: string;
  description: string;
  kind: RecommendationActionKind;
  requiresConfirmation: boolean;
  entityType?: string | null;
  entityId?: string | null;
  href?: string;
  payload?: Prisma.JsonObject;
  confirmationTitle?: string;
  preview?: Array<{ label: string; value: string }>;
  expectedOutcome: string;
};

type RecommendationActionDefinition = {
  id: string;
  label: string;
  description: string;
  kind: RecommendationActionKind;
  requiresConfirmation: boolean;
  compatibleEntityTypes: string[];
  expectedOutcome: string;
  href: (context: RecommendationActionContext) => string | undefined;
};

export const RECOMMENDATION_ACTIONS: Record<string, RecommendationActionDefinition> = {
  view_invoice: {
    id: "view_invoice",
    label: "Ver factura",
    description: "Abre la factura vinculada para revisar importes, vencimiento y pagos.",
    kind: "navigate",
    requiresConfirmation: false,
    compatibleEntityTypes: ["invoice"],
    expectedOutcome: "La factura queda visible para revision.",
    href: (context) => context.invoiceId || context.entityId ? `/dinero/${context.invoiceId ?? context.entityId}` : undefined
  },
  register_payment: {
    id: "register_payment",
    label: "Registrar pago",
    description: "Abre el formulario de pago. No marca la factura como pagada sin accion explicita del usuario.",
    kind: "create_draft",
    requiresConfirmation: true,
    compatibleEntityTypes: ["invoice"],
    expectedOutcome: "El usuario revisa y confirma un pago real.",
    href: (context) => context.invoiceId || context.entityId ? `/gestion?tipo=pago&facturaId=${context.invoiceId ?? context.entityId}&returnTo=${encodeURIComponent(context.returnTo ?? "/recomendaciones")}` : undefined
  },
  create_collection_followup: {
    id: "create_collection_followup",
    label: "Crear seguimiento",
    description: "Crea un recordatorio interno de seguimiento de cobro solo despues de confirmacion.",
    kind: "confirm_then_execute",
    requiresConfirmation: true,
    compatibleEntityTypes: ["invoice"],
    expectedOutcome: "Seguimiento interno creado sin enviar comunicaciones externas.",
    href: () => undefined
  },
  view_client: {
    id: "view_client",
    label: "Abrir cliente",
    description: "Abre la ficha 360 del cliente.",
    kind: "navigate",
    requiresConfirmation: false,
    compatibleEntityTypes: ["client", "invoice", "budget", "work"],
    expectedOutcome: "El cliente queda visible para revision.",
    href: (context) => context.clientId || context.entityId ? `/clientes/${context.clientId ?? context.entityId}` : undefined
  },
  complete_client_data: {
    id: "complete_client_data",
    label: "Completar datos",
    description: "Abre la edicion del cliente para completar datos fiscales o de contacto.",
    kind: "ask_for_missing_data",
    requiresConfirmation: false,
    compatibleEntityTypes: ["client"],
    expectedOutcome: "El usuario puede completar los campos pendientes.",
    href: (context) => context.clientId || context.entityId ? `/gestion?tipo=cliente&id=${context.clientId ?? context.entityId}&returnTo=${encodeURIComponent(context.returnTo ?? "/recomendaciones")}` : undefined
  },
  view_work: {
    id: "view_work",
    label: "Abrir obra",
    description: "Abre la ficha 360 de la obra.",
    kind: "navigate",
    requiresConfirmation: false,
    compatibleEntityTypes: ["work", "invoice", "budget"],
    expectedOutcome: "La obra queda visible para revision.",
    href: (context) => context.workId || context.entityId ? `/obras/${context.workId ?? context.entityId}` : undefined
  },
  review_work_costs: {
    id: "review_work_costs",
    label: "Ver costes",
    description: "Abre la pestana de gastos de la obra para revisar margen y desviacion.",
    kind: "navigate",
    requiresConfirmation: false,
    compatibleEntityTypes: ["work"],
    expectedOutcome: "Los costes de la obra quedan visibles.",
    href: (context) => context.workId || context.entityId ? `/obras/${context.workId ?? context.entityId}?tab=gastos` : undefined
  },
  create_visit_draft: {
    id: "create_visit_draft",
    label: "Programar visita",
    description: "Abre un borrador de visita; no agenda nada hasta que el usuario guarde.",
    kind: "create_draft",
    requiresConfirmation: true,
    compatibleEntityTypes: ["work", "client"],
    expectedOutcome: "El usuario revisa y guarda una visita si procede.",
    href: (context) => {
      const params = new URLSearchParams({ tipo: "eventoAgenda", tipoEvento: "visita", returnTo: context.returnTo ?? "/recomendaciones" });
      if (context.clientId) params.set("clienteId", context.clientId);
      if (context.workId || context.entityId) params.set("obraId", context.workId ?? context.entityId ?? "");
      return `/gestion?${params.toString()}`;
    }
  },
  view_budget: {
    id: "view_budget",
    label: "Ver presupuesto",
    description: "Abre el presupuesto vinculado.",
    kind: "navigate",
    requiresConfirmation: false,
    compatibleEntityTypes: ["budget"],
    expectedOutcome: "El presupuesto queda visible para revision.",
    href: (context) => context.budgetId || context.entityId ? `/presupuestos/${context.budgetId ?? context.entityId}` : undefined
  },
  create_budget_followup: {
    id: "create_budget_followup",
    label: "Crear seguimiento",
    description: "Crea un recordatorio interno para seguimiento de presupuesto solo tras confirmacion.",
    kind: "confirm_then_execute",
    requiresConfirmation: true,
    compatibleEntityTypes: ["budget"],
    expectedOutcome: "Seguimiento interno creado sin enviar mensajes externos.",
    href: () => undefined
  },
  generate_budget_pdf: {
    id: "generate_budget_pdf",
    label: "PDF presupuesto",
    description: "Abre la generacion del PDF del presupuesto.",
    kind: "open_preview",
    requiresConfirmation: false,
    compatibleEntityTypes: ["budget"],
    expectedOutcome: "El PDF se abre bajo peticion del usuario.",
    href: (context) => context.budgetId || context.entityId ? `/presupuestos/${context.budgetId ?? context.entityId}/pdf` : undefined
  },
  generate_invoice_pdf: {
    id: "generate_invoice_pdf",
    label: "PDF factura",
    description: "Abre la generacion del PDF de la factura.",
    kind: "open_preview",
    requiresConfirmation: false,
    compatibleEntityTypes: ["invoice"],
    expectedOutcome: "El PDF se abre bajo peticion del usuario.",
    href: (context) => context.invoiceId || context.entityId ? `/dinero/${context.invoiceId ?? context.entityId}/pdf` : undefined
  },
  view_treasury: {
    id: "view_treasury",
    label: "Abrir tesoreria",
    description: "Abre tesoreria con forecast, cobros y pagos.",
    kind: "navigate",
    requiresConfirmation: false,
    compatibleEntityTypes: ["treasury", "business", "invoice", "expense"],
    expectedOutcome: "La tesoreria queda visible para revision.",
    href: () => "/tesoreria"
  },
  consult_conservative_scenario: {
    id: "consult_conservative_scenario",
    label: "Escenario conservador",
    description: "Abre tesoreria en modo conservador para revisar riesgo de caja.",
    kind: "navigate",
    requiresConfirmation: false,
    compatibleEntityTypes: ["treasury", "business"],
    expectedOutcome: "El escenario conservador queda visible.",
    href: () => "/tesoreria?escenario=conservative"
  },
  view_alerts: {
    id: "view_alerts",
    label: "Ver alertas",
    description: "Abre el centro de alertas que origina las recomendaciones.",
    kind: "navigate",
    requiresConfirmation: false,
    compatibleEntityTypes: ["business"],
    expectedOutcome: "Las alertas quedan visibles.",
    href: () => "/alertas"
  },
  view_documents: {
    id: "view_documents",
    label: "Ver documentos",
    description: "Abre documentos para revisar archivos pendientes o incompletos.",
    kind: "navigate",
    requiresConfirmation: false,
    compatibleEntityTypes: ["document", "business"],
    expectedOutcome: "Los documentos quedan visibles.",
    href: () => "/documentos"
  },
  view_agenda: {
    id: "view_agenda",
    label: "Abrir agenda",
    description: "Abre agenda para revisar visitas, llamadas y tareas.",
    kind: "navigate",
    requiresConfirmation: false,
    compatibleEntityTypes: ["agenda", "business"],
    expectedOutcome: "La agenda queda visible.",
    href: () => "/agenda"
  },
  view_reminders: {
    id: "view_reminders",
    label: "Ver recordatorios",
    description: "Abre recordatorios pendientes.",
    kind: "navigate",
    requiresConfirmation: false,
    compatibleEntityTypes: ["reminder", "business"],
    expectedOutcome: "Los recordatorios quedan visibles.",
    href: () => "/recordatorios"
  },
  view_expenses: {
    id: "view_expenses",
    label: "Ver gastos",
    description: "Abre gastos y materiales para revisar importes o clasificacion.",
    kind: "navigate",
    requiresConfirmation: false,
    compatibleEntityTypes: ["expense", "work", "business"],
    expectedOutcome: "Los gastos quedan visibles.",
    href: () => "/gastos-materiales"
  },
  snooze_recommendation: {
    id: "snooze_recommendation",
    label: "Posponer",
    description: "Oculta la recomendacion hasta una fecha concreta sin borrar historico.",
    kind: "snooze",
    requiresConfirmation: false,
    compatibleEntityTypes: ["business", "invoice", "budget", "work", "client", "treasury"],
    expectedOutcome: "La recomendacion reaparece si sigue vigente al vencer el aplazamiento.",
    href: () => undefined
  },
  dismiss_recommendation: {
    id: "dismiss_recommendation",
    label: "Descartar",
    description: "Descarta la recomendacion con motivo opcional, sin borrar historico.",
    kind: "dismiss",
    requiresConfirmation: false,
    compatibleEntityTypes: ["business", "invoice", "budget", "work", "client", "treasury"],
    expectedOutcome: "La recomendacion queda en historico.",
    href: () => undefined
  },
  mark_reviewed: {
    id: "mark_reviewed",
    label: "Marcar revisada",
    description: "Marca que la recomendacion fue revisada sin ejecutar acciones de negocio.",
    kind: "server_action",
    requiresConfirmation: false,
    compatibleEntityTypes: ["business", "invoice", "budget", "work", "client", "treasury"],
    expectedOutcome: "La recomendacion queda registrada como vista.",
    href: () => undefined
  }
};

export function resolveRecommendationAction(actionId: string, context: RecommendationActionContext): RecommendationAction | null {
  const definition = RECOMMENDATION_ACTIONS[actionId];
  if (!definition) return null;
  const entityType = context.entityType ?? "business";
  if (!definition.compatibleEntityTypes.includes("business") && !definition.compatibleEntityTypes.includes(String(entityType))) return null;
  const href = definition.href(context);
  const action: RecommendationAction = {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    kind: definition.kind,
    requiresConfirmation: definition.requiresConfirmation,
    entityType,
    entityId: context.entityId ?? context.invoiceId ?? context.budgetId ?? context.workId ?? context.clientId ?? null,
    href,
    expectedOutcome: definition.expectedOutcome
  };
  if (definition.requiresConfirmation) {
    action.confirmationTitle = `Confirmar: ${definition.label}`;
    action.preview = [
      { label: "Recomendacion", value: context.title ?? "Recomendacion operativa" },
      { label: "Entidad", value: context.entityType ? `${context.entityType}${context.entityId ? ` · ${context.entityId}` : ""}` : "Negocio" },
      { label: "Motivo", value: context.reason ?? "Derivada de una señal activa" }
    ];
  }
  return action;
}

export function serializeRecommendationActions(actions: RecommendationAction[]): Prisma.InputJsonArray {
  return actions.map((action) => ({
    id: action.id,
    label: action.label,
    description: action.description,
    kind: action.kind,
    requiresConfirmation: action.requiresConfirmation,
    entityType: action.entityType ?? null,
    entityId: action.entityId ?? null,
    href: action.href ?? null,
    payload: action.payload ?? null,
    confirmationTitle: action.confirmationTitle ?? null,
    preview: action.preview ?? [],
    expectedOutcome: action.expectedOutcome
  }));
}
