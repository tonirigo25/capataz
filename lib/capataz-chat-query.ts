export type ChatIntentKind =
  | "create"
  | "update"
  | "delete_archive"
  | "query"
  | "aggregate"
  | "compare"
  | "context"
  | "navigation"
  | "pending"
  | "pending_detail"
  | "unknown";

export type ChatQueryAction =
  | "pending_summary"
  | "pending_detail"
  | "highest_budget"
  | "lowest_budget"
  | "latest_budget"
  | "highest_invoice"
  | "lowest_invoice"
  | "outstanding_invoices"
  | "overdue_invoices"
  | "pending_budgets_count"
  | "pending_invoices_count"
  | "client_highest_debt"
  | "revenue_summary"
  | "expenses_summary"
  | "active_projects"
  | "client_budgets"
  | "client_payments"
  | "clients_missing_tax_id"
  | "project_highest_expenses"
  | "recent_documents";

export type ChatQueryPeriod = "this_week" | "this_month" | "last_month" | "this_year" | "all";

export type PendingDetailCategory =
  | "budgets"
  | "budgets_to_send"
  | "budgets_to_accept"
  | "invoices"
  | "overdue_invoices"
  | "partial_payments"
  | "visits"
  | "visits_to_confirm"
  | "followups"
  | "reminders"
  | "clients_incomplete"
  | "active_projects"
  | "documents";

export type ChatIntentClassification = {
  kind: ChatIntentKind;
  action?: ChatQueryAction;
  confidence: number;
  period?: ChatQueryPeriod;
  clientName?: string;
  detailCategory?: PendingDetailCategory;
};

export function classifyChatIntent(message: string): ChatIntentClassification {
  const normalized = normalizeQueryText(message);
  const period = detectPeriod(normalized);
  const detailCategory = detectPendingDetailCategory(normalized);

  if (isContextQuestion(normalized)) return { kind: "context", confidence: 0.86 };

  if (isPendingDetailRequest(normalized)) {
    return {
      kind: "pending_detail",
      action: "pending_detail",
      confidence: 0.88,
      detailCategory
    };
  }

  if (isPendingSummaryRequest(normalized) && !isSpecificFinancialPendingRequest(normalized)) {
    return { kind: "pending", action: "pending_summary", confidence: 0.94, period };
  }

  if (/(borra|borrar|elimina|eliminar|archiva|archivar)\b/.test(normalized)) {
    return { kind: "delete_archive", confidence: 0.8 };
  }

  if (/(modifica|modificar|cambia|cambiar|actualiza|actualizar|corrige|editar)\b/.test(normalized)) {
    return { kind: "update", confidence: 0.78 };
  }

  if (/(crear|crea|creame|haz|hazme|prepara|preparame|registrar|registra|apunta|genera|generar)\b/.test(normalized)) {
    return { kind: "create", confidence: 0.82 };
  }

  if (/(abre|abrir|muestra|mostrar|ver|quiero ver)\b/.test(normalized) && /(presupuesto|factura|cliente|obra|documento|pdf)\b/.test(normalized)) {
    return { kind: "navigation", confidence: 0.76 };
  }

  if (/(compara|comparar|diferencia|frente a|versus|vs)\b/.test(normalized)) {
    return { kind: "compare", confidence: 0.82, period };
  }

  const clientName = extractClientFromQuery(message, normalized);

  if (/(presupuesto|presupuestos)\b/.test(normalized)) {
    if (/(mas alto|mayor|mas grande|maximo|importe mas alto|de mas importe)\b/.test(normalized)) return { kind: "aggregate", action: "highest_budget", confidence: 0.95, period, clientName };
    if (/(mas bajo|menor|mas pequeno|minimo|importe mas bajo)\b/.test(normalized)) return { kind: "aggregate", action: "lowest_budget", confidence: 0.92, period, clientName };
    if (/(ultimo|reciente|mas reciente|ultimo presupuesto)\b/.test(normalized)) return { kind: "query", action: "latest_budget", confidence: 0.88, period, clientName };
    if (/(cuantos|cuantas|cantidad|numero)\b/.test(normalized) && /(pendiente|pendientes|enviado|enviados|aceptar|respuesta)\b/.test(normalized)) return { kind: "aggregate", action: "pending_budgets_count", confidence: 0.9, period, clientName };
    if (clientName) return { kind: "query", action: "client_budgets", confidence: 0.82, period, clientName };
  }

  if (/(factura|facturas|cobro|cobros|deben|deuda)\b/.test(normalized)) {
    if (/(mas alto|mayor|mas grande|maxima|importe mas alto|de mas importe)\b/.test(normalized)) return { kind: "aggregate", action: "highest_invoice", confidence: 0.94, period, clientName };
    if (/(mas bajo|menor|mas pequena|minima|importe mas bajo)\b/.test(normalized)) return { kind: "aggregate", action: "lowest_invoice", confidence: 0.9, period, clientName };
    if (/(cuantos|cuantas|cantidad|numero)\b/.test(normalized) && /(pendiente|pendientes|cobro|cobrar)\b/.test(normalized)) return { kind: "aggregate", action: "pending_invoices_count", confidence: 0.9, period, clientName };
    if (/(cuanto|cuanta|total).*(deben|pendiente|cobrar)|cuanto me deben|pendiente de cobro|pendiente cobrar/.test(normalized)) return { kind: "aggregate", action: "outstanding_invoices", confidence: 0.95, period, clientName };
    if (/(vencida|vencidas|vencido|vencidos)\b/.test(normalized)) return { kind: "query", action: "overdue_invoices", confidence: 0.91, period, clientName };
  }

  if (/(cuanto|cuantos|que|pagos|pagado)\b/.test(normalized) && /(ha pagado|pagado|pagos)\b/.test(normalized)) {
    return { kind: "aggregate", action: "client_payments", confidence: 0.86, period, clientName: clientName ?? extractTrailingPersonName(message) };
  }

  if (/(cliente|clientes)\b/.test(normalized) && /(debe mas|deuda mas alta|mayor deuda|me debe mas)\b/.test(normalized)) {
    return { kind: "aggregate", action: "client_highest_debt", confidence: 0.92, period };
  }

  if (/(facturado|facturacion|ingresos|he cobrado|cobrado)\b/.test(normalized) && /(cuanto|total|resumen)\b/.test(normalized)) {
    return { kind: "aggregate", action: "revenue_summary", confidence: 0.9, period };
  }

  if (/(gastado|gastos|he gastado|material comprado|compras)\b/.test(normalized) && /(cuanto|total|resumen)\b/.test(normalized)) {
    return { kind: "aggregate", action: "expenses_summary", confidence: 0.9, period };
  }

  if (/(obra|obras)\b/.test(normalized)) {
    if (/(activas|en curso|abiertas)\b/.test(normalized)) return { kind: "query", action: "active_projects", confidence: 0.88, period, clientName };
    if (/(mas gastos|mayor gasto|gasto mas alto)\b/.test(normalized)) return { kind: "aggregate", action: "project_highest_expenses", confidence: 0.88, period };
  }

  if (/(cliente|clientes)\b/.test(normalized) && /(sin cif|sin nif|no tienen cif|no tienen nif|datos incompletos)\b/.test(normalized)) {
    return { kind: "query", action: "clients_missing_tax_id", confidence: 0.9 };
  }

  if (/(documentos|presupuestos|facturas)\b/.test(normalized) && /(ultimos|recientes|reciente)\b/.test(normalized)) {
    return { kind: "query", action: "recent_documents", confidence: 0.82, period };
  }

  return { kind: "unknown", confidence: 0.35 };
}

export function normalizeQueryText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectPeriod(normalized: string): ChatQueryPeriod {
  if (/(esta semana|semana actual)\b/.test(normalized)) return "this_week";
  if (/(este mes|mes actual)\b/.test(normalized)) return "this_month";
  if (/(mes pasado|el mes anterior)\b/.test(normalized)) return "last_month";
  if (/(este ano|ano actual|este año)\b/.test(normalized)) return "this_year";
  return "all";
}

function isContextQuestion(normalized: string) {
  return /^(dimelos|dime cuales|cuales son|que datos|que falta|resumen|resumeme esto|cuanto era|cual era el importe|que obra era|donde era)$/.test(normalized);
}

function isPendingSummaryRequest(normalized: string) {
  return /(que tareas pendientes tengo|dime que tengo pendiente|resumen de pendientes|cuantas cosas tengo pendientes|que queda por hacer|tareas pendientes|pendientes tengo|tengo pendiente|cosas pendientes)/.test(normalized);
}

function isSpecificFinancialPendingRequest(normalized: string) {
  return /(presupuesto|presupuestos|factura|facturas|cobro|cobros|deben|deuda)/.test(normalized);
}

function isPendingDetailRequest(normalized: string) {
  return /(dime cuales|ensename|ensenamelos|que .* son|detallame|detalle|ver todos|muestrame|listar|lista)\b/.test(normalized)
    && /(presupuesto|factura|seguimiento|recordatorio|visita|cliente|obra|documento|pendiente|vencida|parcial)/.test(normalized);
}

function detectPendingDetailCategory(normalized: string): PendingDetailCategory | undefined {
  if (/presupuesto/.test(normalized) && /(enviar|envio|mandar)/.test(normalized)) return "budgets_to_send";
  if (/presupuesto/.test(normalized) && /(aceptar|respuesta|responder|aceptacion)/.test(normalized)) return "budgets_to_accept";
  if (/presupuesto/.test(normalized)) return "budgets";
  if (/factura/.test(normalized) && /vencid/.test(normalized)) return "overdue_invoices";
  if (/factura|cobro|cobrar/.test(normalized)) return "invoices";
  if (/parcial|pagos parciales/.test(normalized)) return "partial_payments";
  if (/visita/.test(normalized) && /confirm/.test(normalized)) return "visits_to_confirm";
  if (/visita/.test(normalized)) return "visits";
  if (/seguimiento/.test(normalized)) return "followups";
  if (/recordatorio/.test(normalized)) return "reminders";
  if (/cliente/.test(normalized)) return "clients_incomplete";
  if (/obra/.test(normalized)) return "active_projects";
  if (/documento/.test(normalized)) return "documents";
  return undefined;
}

function extractClientFromQuery(original: string, normalized: string) {
  const explicit = original.match(/\b(?:cliente|de|del|para|a)\s+([A-ZÁÉÍÓÚÜÑ][\p{L}ÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\p{L}ÁÉÍÓÚÜÑáéíóúüñ]+){0,3})/u)?.[1];
  if (explicit) return explicit.trim();
  const lower = normalized.match(/\b(?:cliente|de|del|para|a|tiene|pagado)\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,3})/)?.[1];
  if (!lower) return undefined;
  const stop = new Set(["presupuesto", "presupuestos", "factura", "facturas", "obra", "obras", "este", "esta", "mes", "semana", "ano"]);
  const words = lower.split(" ").filter((word) => !stop.has(word));
  return words.length ? words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") : undefined;
}

function extractTrailingPersonName(original: string) {
  const match = original.match(/([A-ZÁÉÍÓÚÜÑ][\p{L}ÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\p{L}ÁÉÍÓÚÜÑáéíóúüñ]+){0,3})\s*$/u);
  return match?.[1]?.trim();
}
