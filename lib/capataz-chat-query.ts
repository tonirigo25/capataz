export type ChatIntentKind =
  | "conversation_control"
  | "create"
  | "register"
  | "update"
  | "delete_archive"
  | "database_query"
  | "aggregate_query"
  | "comparison_query"
  | "context_question"
  | "navigation"
  | "pending_summary"
  | "pending_details"
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
  | "budget_by_amount"
  | "client_highest_debt"
  | "revenue_summary"
  | "expenses_summary"
  | "active_projects"
  | "paused_projects"
  | "work_highest_revenue"
  | "work_lowest_margin"
  | "works_starting_this_week"
  | "works_ending_today"
  | "client_contacts"
  | "work_documents"
  | "internal_notes"
  | "agenda_today"
  | "upcoming_visits"
  | "pending_reminders_count"
  | "pending_notifications"
  | "client_budgets"
  | "client_payments"
  | "clients_missing_tax_id"
  | "project_highest_expenses"
  | "recent_documents"
  | "business_health"
  | "business_collected"
  | "business_outstanding"
  | "business_overdue"
  | "business_profit"
  | "business_margin"
  | "business_best_work"
  | "business_slowest_client"
  | "business_quote_conversion"
  | "business_compare_periods"
  | "business_review_today"
  | "treasury_status"
  | "treasury_available_cash"
  | "treasury_collect_week"
  | "treasury_pay_month"
  | "treasury_forecast"
  | "treasury_minimum_breach"
  | "treasury_due_invoices"
  | "treasury_upcoming_payments"
  | "treasury_cashflow_month"
  | "treasury_work_cash_consumption"
  | "treasury_break_even"
  | "treasury_coverage"
  | "treasury_scenario_conservative"
  | "treasury_scenario_compare"
  | "treasury_review"
  | "signals_review_today"
  | "signals_urgent"
  | "signals_problems"
  | "signals_risks"
  | "signals_client_attention"
  | "signals_work_attention"
  | "signals_priority_invoices";

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
  amount?: number;
  rule?: string;
};

export function classifyChatIntent(message: string): ChatIntentClassification {
  const normalized = normalizeQueryText(message);
  const period = detectPeriod(normalized);
  const detailCategory = detectPendingDetailCategory(normalized);

  if (isConversationControl(normalized)) return { kind: "conversation_control", confidence: 0.9, rule: "conversation_control" };

  if (isContextQuestion(normalized)) return { kind: "context_question", confidence: 0.86, rule: "context_question" };

  if (/(recordatorios)\b/.test(normalized) && /(cuantos|cuántos|pendientes|tengo)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "pending_reminders_count", confidence: 0.9, period, rule: "pending_reminders_count" };
  }

  if (/(notificaciones|avisos)\b/.test(normalized) && /(pendientes|sin leer|tengo|cuantas|cuántas)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "pending_notifications", confidence: 0.9, period, rule: "pending_notifications" };
  }

  if (/(factura|facturas|cobro|cobros)\b/.test(normalized) && /(prioritaria|prioritarias|prioritario|prioritarios|urgente|urgentes|revisar primero)\b/.test(normalized)) {
    return { kind: "database_query", action: "signals_priority_invoices", confidence: 0.94, period, rule: "signals_priority_invoices" };
  }

  if (isPendingDetailRequest(normalized)) {
    return {
      kind: "pending_details",
      action: "pending_detail",
      confidence: 0.88,
      detailCategory,
      rule: "pending_detail"
    };
  }

  if (isPendingSummaryRequest(normalized) && !isSpecificFinancialPendingRequest(normalized)) {
    return { kind: "pending_summary", action: "pending_summary", confidence: 0.94, period, rule: "pending_summary" };
  }

  const treasuryIntent = classifyTreasuryIntent(normalized, period);
  if (treasuryIntent) return treasuryIntent;

  const signalIntent = classifySignalIntent(normalized, period);
  if (signalIntent) return signalIntent;

  if (/(borra|borrar|elimina|eliminar|archiva|archivar)\b/.test(normalized)) {
    return { kind: "delete_archive", confidence: 0.8, rule: "delete_archive" };
  }

  if (/(modifica|modificar|cambia|cambiar|actualiza|actualizar|corrige|editar)\b/.test(normalized)) {
    return { kind: "update", confidence: 0.78, rule: "update" };
  }

  if (/(registrar|registra|apunta)\b/.test(normalized)) {
    return { kind: "register", confidence: 0.82, rule: "register" };
  }

  if (/(crear|crea|creame|haz|hazme|prepara|preparame|genera|generar)\b/.test(normalized)) {
    return { kind: "create", confidence: 0.82, rule: "create" };
  }

  if (/(abre|abrir|muestra|mostrar|ver|quiero ver)\b/.test(normalized) && /(presupuesto|factura|cliente|obra|documento|pdf)\b/.test(normalized)) {
    return { kind: "navigation", confidence: 0.76, rule: "navigation" };
  }

  if (/(compara|comparar|comparame|diferencia|frente a|versus|vs)\b/.test(normalized)) {
    if (/(escenario|caja|tesoreria|tesorería|flujo)\b/.test(normalized)) {
      return { kind: "comparison_query", action: "treasury_scenario_compare", confidence: 0.92, period, rule: "treasury_scenario_compare" };
    }
    if (/(mes|semana|trimestre|ano|año|negocio|facturacion|facturación|cobros|gastos|beneficio)\b/.test(normalized)) {
      return { kind: "comparison_query", action: "business_compare_periods", confidence: 0.9, period: period === "all" ? "this_month" : period, rule: "business_compare_periods" };
    }
    return { kind: "comparison_query", confidence: 0.82, period, rule: "comparison" };
  }

  const clientName = extractClientFromQuery(message, normalized);
  const amount = extractQueryAmount(normalized);

  if (/(como va|cómo va|salud|estado|situacion|situación)\b/.test(normalized) && /(negocio|empresa|capataz)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "business_health", confidence: 0.94, period: period === "all" ? "this_month" : period, rule: "business_health" };
  }

  if (/(que deberia revisar|qué debería revisar|que revisar|prioridades|puntos de atencion|puntos de atención)\b/.test(normalized)) {
    return { kind: "database_query", action: "business_review_today", confidence: 0.9, period: period === "all" ? "this_month" : period, rule: "business_review_today" };
  }

  if (/(cliente|clientes)\b/.test(normalized) && /(tarda mas en pagar|tarda más en pagar|plazo medio|mas lento|más lento)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "business_slowest_client", confidence: 0.9, period, rule: "business_slowest_client" };
  }

  if (/(obra|obras)\b/.test(normalized) && /(mas rentable|más rentable|mayor beneficio|mejor margen)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "business_best_work", confidence: 0.9, period, rule: "business_best_work" };
  }

  if (/(conversion|conversión|tasa de conversion|tasa de conversión|presupuestos aceptados|cuantos presupuestos he aceptado|cuántos presupuestos he aceptado)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "business_quote_conversion", confidence: 0.9, period: period === "all" ? "this_month" : period, rule: "business_quote_conversion" };
  }

  if (/(beneficio|ganancia|rentabilidad)\b/.test(normalized) && /(cuanto|cuánto|cual|cuál|tengo|hay|negocio)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "business_profit", confidence: 0.88, period: period === "all" ? "this_month" : period, rule: "business_profit" };
  }

  if (/(margen)\b/.test(normalized) && /(cuanto|cuánto|cual|cuál|tengo|hay)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "business_margin", confidence: 0.88, period: period === "all" ? "this_month" : period, rule: "business_margin" };
  }

  if (/(cobrado|cobros|he cobrado)\b/.test(normalized) && /(cuanto|cuánto|total|este|mes|semana|ano|año)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "business_collected", confidence: 0.9, period: period === "all" ? "this_month" : period, rule: "business_collected" };
  }

  if (/(vencido|vencida|vencidas|esta vencido|está vencido)\b/.test(normalized) && /(cuanto|cuánto|total|pendiente)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "business_overdue", confidence: 0.9, period: period === "all" ? "this_month" : period, rule: "business_overdue" };
  }

  if (!/(factura|facturas)\b/.test(normalized) && /(maximo presupuesto|presupuesto.*(mas alto|mayor importe|mas grande|mas importe)|cual tiene mas importe)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "highest_budget", confidence: 0.93, period, clientName, rule: "highest_budget" };
  }

  if (/(presupuesto|presupuestos)\b/.test(normalized)) {
    if (/(mas alto|mayor|mas grande|maximo|importe mas alto|de mas importe|mayor importe|mas importe)\b/.test(normalized)) return { kind: "aggregate_query", action: "highest_budget", confidence: 0.95, period, clientName, rule: "highest_budget" };
    if (/(mas bajo|menor|mas pequeno|minimo|importe mas bajo|menor importe)\b/.test(normalized)) return { kind: "aggregate_query", action: "lowest_budget", confidence: 0.92, period, clientName, rule: "lowest_budget" };
    if (amount !== undefined) return { kind: "database_query", action: "budget_by_amount", confidence: 0.86, period, amount, rule: "budget_by_amount" };
    if (/(ultimo|reciente|mas reciente|ultimo presupuesto)\b/.test(normalized)) return { kind: "database_query", action: "latest_budget", confidence: 0.88, period, clientName, rule: "latest_budget" };
    if (/(cuantos|cuantas|cantidad|numero)\b/.test(normalized) && /(pendiente|pendientes|enviado|enviados|aceptar|respuesta)\b/.test(normalized)) return { kind: "aggregate_query", action: "pending_budgets_count", confidence: 0.9, period, clientName, rule: "pending_budgets_count" };
    if (clientName) return { kind: "database_query", action: "client_budgets", confidence: 0.82, period, clientName, rule: "client_budgets" };
  }

  if (/(cliente|clientes|quien)\b/.test(normalized) && /(debe mas|deuda mas alta|mayor deuda|me debe mas)\b/.test(normalized)) {
    return { kind: "comparison_query", action: "client_highest_debt", confidence: 0.92, period, rule: "client_highest_debt" };
  }

  if (/(factura|facturas|cobro|cobros|cobrar|deben|debe|deuda)\b/.test(normalized)) {
    if (/(mas alto|mayor|mas grande|maxima|importe mas alto|de mas importe)\b/.test(normalized)) return { kind: "aggregate_query", action: "highest_invoice", confidence: 0.94, period, clientName, rule: "highest_invoice" };
    if (/(mas bajo|menor|mas pequena|minima|importe mas bajo)\b/.test(normalized)) return { kind: "aggregate_query", action: "lowest_invoice", confidence: 0.9, period, clientName, rule: "lowest_invoice" };
    if (/(cuantos|cuantas|cantidad|numero)\b/.test(normalized) && /(pendiente|pendientes|cobro|cobrar)\b/.test(normalized)) return { kind: "aggregate_query", action: "pending_invoices_count", confidence: 0.9, period, clientName, rule: "pending_invoices_count" };
    if (/(cuanto|cuanta|total).*(deben|debe|pendiente|cobrar)|cuanto me deben|pendiente de cobro|pendiente cobrar|pendiente de cobrar|deuda total|cobros pendientes/.test(normalized)) return { kind: "aggregate_query", action: "business_outstanding", confidence: 0.95, period, clientName, rule: "business_outstanding" };
    if (/(vencida|vencidas|vencido|vencidos)\b/.test(normalized)) return { kind: "database_query", action: "overdue_invoices", confidence: 0.91, period, clientName, rule: "overdue_invoices" };
  }

  if (/(cuanto|cuantos|que|pagos|pagado)\b/.test(normalized) && /(ha pagado|pagado|pagos)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "client_payments", confidence: 0.86, period, clientName: clientName ?? extractTrailingPersonName(message), rule: "client_payments" };
  }

  if (/(contacto|contactos)\b/.test(normalized) && /(principal|facturacion|obra|cliente|quien|quién)\b/.test(normalized)) {
    return { kind: "database_query", action: "client_contacts", confidence: 0.88, clientName: clientName ?? extractTrailingPersonName(message), rule: "client_contacts" };
  }

  if (/(agenda|visitas|citas)\b/.test(normalized) && /(hoy|dia|día)\b/.test(normalized)) {
    return { kind: "database_query", action: "agenda_today", confidence: 0.9, period, rule: "agenda_today" };
  }

  if (/(visitas|citas)\b/.test(normalized) && /(manana|mañana|proximas|próximas|siguientes)\b/.test(normalized)) {
    return { kind: "database_query", action: "upcoming_visits", confidence: 0.88, period, rule: "upcoming_visits" };
  }

  if (/(recordatorios)\b/.test(normalized) && /(cuantos|cuántos|pendientes|tengo)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "pending_reminders_count", confidence: 0.9, period, rule: "pending_reminders_count" };
  }

  if (/(notificaciones|avisos)\b/.test(normalized) && /(pendientes|sin leer|tengo|cuantas|cuántas)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "pending_notifications", confidence: 0.9, period, rule: "pending_notifications" };
  }

  if (/(facturado|facturacion|ingresos|he cobrado|cobrado)\b/.test(normalized) && /(cuanto|total|resumen)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "revenue_summary", confidence: 0.9, period, rule: "revenue_summary" };
  }

  if (/(gastado|gastos|he gastado|material comprado|compras)\b/.test(normalized) && /(cuanto|total|resumen)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "expenses_summary", confidence: 0.9, period, rule: "expenses_summary" };
  }

  if (/(obra|obras)\b/.test(normalized)) {
    if (/(paradas|parada|pausadas|pausada|detenidas|bloqueadas)\b/.test(normalized)) return { kind: "database_query", action: "paused_projects", confidence: 0.9, period, clientName, rule: "paused_projects" };
    if (/(factura mas|factura más|facturan mas|facturan más|mayor facturacion|mayor facturación|mas facturacion|más facturación)\b/.test(normalized)) return { kind: "aggregate_query", action: "work_highest_revenue", confidence: 0.9, period, rule: "work_highest_revenue" };
    if (/(menos margen|menor margen|peor margen|margen mas bajo|margen más bajo)\b/.test(normalized)) return { kind: "aggregate_query", action: "work_lowest_margin", confidence: 0.9, period, rule: "work_lowest_margin" };
    if (/(empiezan esta semana|empieza esta semana|inicio esta semana|inician esta semana|arrancan esta semana)\b/.test(normalized)) return { kind: "database_query", action: "works_starting_this_week", confidence: 0.88, period: "this_week", rule: "works_starting_this_week" };
    if (/(terminan hoy|acaban hoy|finalizan hoy|fin hoy)\b/.test(normalized)) return { kind: "database_query", action: "works_ending_today", confidence: 0.88, period, rule: "works_ending_today" };
    if (/(activas|en curso|abiertas)\b/.test(normalized)) return { kind: "database_query", action: "active_projects", confidence: 0.88, period, clientName, rule: "active_projects" };
    if (/(mas gastos|mayor gasto|gasto mas alto|gasta mas|gasta más)\b/.test(normalized)) return { kind: "aggregate_query", action: "project_highest_expenses", confidence: 0.88, period, rule: "project_highest_expenses" };
  }

  if (/(cliente|clientes)\b/.test(normalized) && /(sin cif|sin nif|no tienen cif|no tienen nif|datos incompletos)\b/.test(normalized)) {
    return { kind: "database_query", action: "clients_missing_tax_id", confidence: 0.9, rule: "clients_missing_tax_id" };
  }

  if (/(documentos|presupuestos|facturas)\b/.test(normalized) && /(ultimos|recientes|reciente)\b/.test(normalized)) {
    return { kind: "database_query", action: "recent_documents", confidence: 0.82, period, rule: "recent_documents" };
  }

  if (/(documento|documentos)\b/.test(normalized) && /(obra|tiene|hay)\b/.test(normalized)) {
    return { kind: "database_query", action: "work_documents", confidence: 0.86, clientName: clientName ?? extractTrailingPersonName(message), rule: "work_documents" };
  }

  if (/(nota|notas)\b/.test(normalized) && /(interna|internas|cliente|obra)\b/.test(normalized)) {
    return { kind: "database_query", action: "internal_notes", confidence: 0.84, clientName: clientName ?? extractTrailingPersonName(message), rule: "internal_notes" };
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

function classifyTreasuryIntent(normalized: string, period: ChatQueryPeriod): ChatIntentClassification | null {
  const isTreasury = /(tesoreria|tesorería|caja|saldo|dinero disponible|cuanto dinero tengo|cuánto dinero tengo|cuanto tengo disponible|cuánto tengo disponible|flujo de caja|colchon|colchón|por debajo del minimo|por debajo del mínimo|bajo el minimo|bajo el mínimo|cobertura|punto de equilibrio)\b/.test(normalized)
    || /(cuanto voy a cobrar|cuánto voy a cobrar|cuanto cobrare|cuánto cobraré|cuanto tengo que pagar|cuánto tengo que pagar|cuanto pagare|cuánto pagaré|cuanto pago|cuánto pago|pagos.*proximos|pagos.*próximos|facturas vencen|facturas.*vencen|dentro de \d+ dias|dentro de \d+ días|escenario conservador|base y conservador|conservador y base)/.test(normalized);
  if (!isTreasury) return null;
  if (/(compara|comparar|comparame|base y conservador|conservador y base)\b/.test(normalized)) {
    return { kind: "comparison_query", action: "treasury_scenario_compare", confidence: 0.94, period, rule: "treasury_scenario_compare" };
  }
  if (/(escenario conservador|haz escenario conservador|hazme escenario conservador|conservador)\b/.test(normalized)) {
    return { kind: "aggregate_query", action: "treasury_scenario_conservative", confidence: 0.94, period, rule: "treasury_scenario_conservative" };
  }
  if (/(punto de equilibrio)\b/.test(normalized)) return { kind: "aggregate_query", action: "treasury_break_even", confidence: 0.92, period, rule: "treasury_break_even" };
  if (/(cobertura|meses de cobertura|dias de cobertura|días de cobertura)\b/.test(normalized)) return { kind: "aggregate_query", action: "treasury_coverage", confidence: 0.9, period, rule: "treasury_coverage" };
  if (/(por debajo del minimo|por debajo del mínimo|bajo el minimo|bajo el mínimo|colchon|colchón)\b/.test(normalized)) return { kind: "aggregate_query", action: "treasury_minimum_breach", confidence: 0.9, period, rule: "treasury_minimum_breach" };
  if (/(obra|obras)\b/.test(normalized) && /(consume|consumiendo|caja negativa|mas caja|más caja)\b/.test(normalized)) return { kind: "aggregate_query", action: "treasury_work_cash_consumption", confidence: 0.92, period, rule: "treasury_work_cash_consumption" };
  if (/(que deberia revisar|qué debería revisar|que revisar|revisar en tesoreria|revisar en tesorería)\b/.test(normalized)) return { kind: "database_query", action: "treasury_review", confidence: 0.9, period, rule: "treasury_review" };
  if (/(facturas vencen|facturas.*vencen|vencen esta semana|vencen proximamente|vencen próximamente)\b/.test(normalized)) return { kind: "database_query", action: "treasury_due_invoices", confidence: 0.9, period: period === "all" ? "this_week" : period, rule: "treasury_due_invoices" };
  if (/(pagos.*proximos|pagos.*próximos|que pagos tengo|qué pagos tengo|tengo que pagar|cuanto pagare|cuánto pagaré|cuanto pago|cuánto pago)\b/.test(normalized)) return { kind: "aggregate_query", action: period === "this_month" ? "treasury_pay_month" : "treasury_upcoming_payments", confidence: 0.9, period: period === "all" ? "this_month" : period, rule: "treasury_upcoming_payments" };
  if (/(cuanto voy a cobrar|cuánto voy a cobrar|cuanto cobrare|cuánto cobraré|cobrar esta semana|cobrar este mes)\b/.test(normalized)) return { kind: "aggregate_query", action: "treasury_collect_week", confidence: 0.9, period: period === "all" ? "this_week" : period, rule: "treasury_collect" };
  if (/(flujo de caja|cashflow|cash flow)\b/.test(normalized)) return { kind: "aggregate_query", action: "treasury_cashflow_month", confidence: 0.9, period: period === "all" ? "this_month" : period, rule: "treasury_cashflow" };
  if (/(dentro de \d+ dias|dentro de \d+ días|en 30 dias|en 30 días|como estara|cómo estará)\b/.test(normalized)) return { kind: "aggregate_query", action: "treasury_forecast", confidence: 0.92, period, rule: "treasury_forecast" };
  if (/(dinero disponible|saldo disponible|cuanto dinero tengo|cuánto dinero tengo|cuanto tengo disponible|cuánto tengo disponible)\b/.test(normalized)) return { kind: "aggregate_query", action: "treasury_available_cash", confidence: 0.92, period, rule: "treasury_available_cash" };
  return { kind: "aggregate_query", action: "treasury_status", confidence: 0.9, period, rule: "treasury_status" };
}

function classifySignalIntent(normalized: string, period: ChatQueryPeriod): ChatIntentClassification | null {
  if (/(factura|facturas|cobro|cobros)\b/.test(normalized) && /(prioritaria|prioritarias|prioritario|prioritarios|urgente|urgentes|revisar primero)\b/.test(normalized)) {
    return { kind: "database_query", action: "signals_priority_invoices", confidence: 0.94, period, rule: "signals_priority_invoices" };
  }
  if (/(cliente|clientes)\b/.test(normalized) && /(requiere atencion|requieren atencion|atencion|problema|riesgo|revisar)\b/.test(normalized)) {
    return { kind: "database_query", action: "signals_client_attention", confidence: 0.92, period, rule: "signals_client_attention" };
  }
  if (/(obra|obras)\b/.test(normalized) && /(debo revisar|revisar|requiere atencion|requieren atencion|problema|riesgo)\b/.test(normalized)) {
    return { kind: "database_query", action: "signals_work_attention", confidence: 0.92, period, rule: "signals_work_attention" };
  }
  if (/(riesgo|riesgos)\b/.test(normalized) && /(importante|importantes|critico|criticos|detectas|tengo|hay|empresa|negocio)\b/.test(normalized)) {
    return { kind: "database_query", action: "signals_risks", confidence: 0.94, period, rule: "signals_risks" };
  }
  if (/(problema|problemas|incidencia|incidencias)\b/.test(normalized) && /(tengo|hay|detectas|principales|urgentes)\b/.test(normalized)) {
    return { kind: "database_query", action: "signals_problems", confidence: 0.92, period, rule: "signals_problems" };
  }
  if (/(urgente|urgentes|mas urgente|más urgente|lo primero|prioridad principal|prioridades principales)\b/.test(normalized)) {
    return { kind: "database_query", action: "signals_urgent", confidence: 0.9, period, rule: "signals_urgent" };
  }
  if (/(que deberia revisar|que revisar|revisar hoy|que miro hoy|prioridades de hoy|puntos de atencion)\b/.test(normalized)) {
    return { kind: "database_query", action: "signals_review_today", confidence: 0.93, period, rule: "signals_review_today" };
  }
  return null;
}

function isConversationControl(normalized: string) {
  return /^(nuevo chat|nueva conversacion|nueva conversación|abrir conversacion|abrir conversación|aparcar|aparca|aparcalo|apárcalo|retomar|retoma|continuar tarea|continua tarea|continúa tarea)$/.test(normalized);
}

function isContextQuestion(normalized: string) {
  return /^(dimelos|dimelas|dime cuales|cuales son|que datos|que falta|resumen|resumeme esto|cuanto era|cual era el importe|que obra era|donde era)$/.test(normalized);
}

function isPendingSummaryRequest(normalized: string) {
  return /(que tenemos pendiente|que hay pendiente|que tareas tengo|que tareas pendientes tengo|dime que tengo pendiente|resumen de pendientes|cuantas cosas tengo pendientes|cuantas tareas pendientes tengo|que queda por hacer|tareas pendientes|pendientes tengo|tengo pendiente|cosas pendientes|^pendientes$|^ver pendientes$)/.test(normalized);
}

function isSpecificFinancialPendingRequest(normalized: string) {
  return /(presupuesto|presupuestos|factura|facturas|cobro|cobros|cobrar|deben|debe|deuda)/.test(normalized);
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
  const stop = new Set(["presupuesto", "presupuestos", "factura", "facturas", "obra", "obras", "este", "esta", "mes", "semana", "ano", "mayor", "menor", "importe", "alto", "alta", "bajo", "baja", "mas", "grande", "maximo", "minimo", "pendiente", "pendientes", "cobrar", "cobro"]);
  const words = lower.split(" ").filter((word) => !stop.has(word) && !/^\d+(?:[.,]\d+)?$/.test(word));
  return words.length ? words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") : undefined;
}

function extractQueryAmount(normalized: string) {
  const match = normalized.match(/\b(\d[\d.,]*)\b/);
  if (!match?.[1]) return undefined;
  const value = match[1];
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value)) return Number(value.replace(/\./g, "").replace(",", "."));
  if (/^\d+[,.]\d{1,2}$/.test(value)) return Number(value.replace(",", "."));
  return Number(value.replace(/[.,]/g, ""));
}

function extractTrailingPersonName(original: string) {
  const match = original.match(/([A-ZÁÉÍÓÚÜÑ][\p{L}ÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\p{L}ÁÉÍÓÚÜÑáéíóúüñ]+){0,3})\s*$/u);
  return match?.[1]?.trim();
}
