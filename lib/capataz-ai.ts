export type CapatazIntent =
  | "create_client"
  | "create_visit"
  | "create_budget"
  | "create_expense"
  | "create_payment"
  | "create_invoice"
  | "create_reminder"
  | "create_follow_up"
  | "query_agenda"
  | "query_collections"
  | "query_materials"
  | "change_status"
  | "search"
  | "update_company_settings"
  | "unknown";

export type CapatazAIResult = {
  intent: CapatazIntent;
  confidence: number;
  missingFields: string[];
  entityType: string | null;
  proposedData: Record<string, unknown>;
  requiresConfirmation: boolean;
  suggestedReply: string;
  source: "mock" | "openai-ready";
};

export const capatazSystemPrompt = `
Eres Capataz, asistente para autónomos y pequeñas pymes de construcción, reformas e instalaciones.
Interpretas lenguaje natural y jerga de obra, pero nunca ejecutas acciones sensibles sin confirmación explícita.
Devuelves siempre una intención estructurada, campos faltantes y una propuesta editable.
Acciones sensibles: enviar WhatsApp/email, registrar pago, cambiar precios, cerrar obra, reclamar cobro, reprogramar/cancelar visita externa, enviar presupuesto/factura.
Si falta información, pregunta antes de proponer una acción cerrada.
`.trim();

export function interpretWithFallback(message: string): CapatazAIResult {
  const text = normalize(message);
  const amount = message.match(/(\d+(?:[,.]\d{1,2})?)/)?.[1];

  if (text.includes("busca")) {
    return result("search", 0.86, "busqueda", { query: message.replace(/busca/i, "").trim() }, "Busco información relacionada en clientes, obras, cobros, agenda y materiales.");
  }
  if (text.includes("agenda") || text.includes("visita")) {
    return result("create_visit", 0.82, "eventoAgenda", { tipo: "visita", texto: message }, "Te preparo una visita editable antes de guardarla.");
  }
  if (text.includes("pagado") || text.includes("senal") || text.includes("pago a cuenta")) {
    return result("create_payment", 0.84, "pago", { importe: amount, texto: message }, "Te preparo un pago editable. Confirma antes de registrarlo.");
  }
  if (text.includes("factura")) {
    return result("create_invoice", 0.78, "factura", { importe: amount, texto: message }, "Te preparo una factura o seguimiento de cobro editable.");
  }
  if (text.includes("presupuesto")) {
    return result("create_budget", 0.8, "presupuesto", { importe: amount, texto: message }, "Te preparo un presupuesto editable antes de guardar.");
  }
  if (text.includes("gasto") || text.includes("apunta") || text.includes("material")) {
    return result("create_expense", 0.76, "gasto", { importe: amount, categoria: "material", texto: message }, "Te preparo un gasto editable.");
  }
  if (text.includes("empresa") || text.includes("cif") || text.includes("logo")) {
    return result("update_company_settings", 0.72, "empresa", { texto: message }, "Te preparo una propuesta de datos de empresa para revisar.");
  }

  return {
    intent: "unknown",
    confidence: 0.35,
    missingFields: ["intencion"],
    entityType: null,
    proposedData: { texto: message },
    requiresConfirmation: true,
    suggestedReply: "Necesito un poco más de contexto para preparar una acción segura.",
    source: "mock"
  };
}

function result(intent: CapatazIntent, confidence: number, entityType: string, proposedData: Record<string, unknown>, suggestedReply: string): CapatazAIResult {
  return {
    intent,
    confidence,
    missingFields: [],
    entityType,
    proposedData,
    requiresConfirmation: true,
    suggestedReply,
    source: "openai-ready"
  };
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
