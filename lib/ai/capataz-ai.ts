export const capatazAIIntents = [
  "crear_cliente",
  "crear_lead",
  "crear_obra",
  "crear_presupuesto",
  "crear_factura",
  "registrar_visita",
  "registrar_reunion",
  "registrar_seguimiento",
  "registrar_gasto",
  "registrar_pago",
  "generar_pdf",
  "convertir_presupuesto_en_factura",
  "actualizar_datos",
  "preguntar_aclaracion",
  "sin_accion"
] as const;

export type CapatazAIIntent = (typeof capatazAIIntents)[number];

export const capatazAIInternalActions = [
  "buscarCliente",
  "buscarDuplicados",
  "crearClienteProvisional",
  "crearContacto",
  "crearObra",
  "crearPresupuestoBorrador",
  "crearFacturaBorrador",
  "registrarVisita",
  "crearSeguimiento",
  "registrarGasto",
  "registrarPago",
  "generarPDF",
  "preguntarAclaracion",
  "actualizarDatos"
] as const;

export type CapatazAIInternalAction = (typeof capatazAIInternalActions)[number];

export type CapatazAIPartida = {
  descripcion?: string;
  cantidad?: number;
  unidad?: string;
  precioUnitario?: number;
  total?: number;
  categoria?: string;
};

export type CapatazAIEntities = {
  contacto_nombre?: string;
  contacto_telefono?: string;
  contacto_email?: string;
  empresa_facturacion?: string;
  cliente_nombre?: string;
  cliente_tipo?: "particular" | "autonomo" | "empresa";
  cliente_nif?: string;
  direccion_fiscal?: string;
  obra_nombre?: string;
  obra_tipo?: string;
  obra_localidad?: string;
  obra_direccion?: string;
  descripcion_trabajo?: string;
  alcance?: string;
  cantidad?: number;
  unidad_cantidad?: string;
  duracion_estimada?: string;
  partidas: CapatazAIPartida[];
  importe?: number;
  moneda?: "EUR";
  iva_porcentaje?: number;
  iva_incluido?: boolean;
  material_incluido?: boolean;
  fecha?: string;
  hora?: string;
  fecha_fin?: string;
  tipo_actividad?: "visita" | "reunion" | "llamada" | "nota" | "seguimiento";
  canal?: "whatsapp" | "email" | "interno";
  mensaje?: string;
  documento_tipo?: "presupuesto" | "factura";
  documento_numero?: string;
  estado?: string;
  metodo_pago?: string;
  notas?: string;
  datos_pendientes: string[];
  referencias_contexto: string[];
};

export type CapatazAIActionPlanItem = {
  action: CapatazAIInternalAction;
  reason: string;
  target?: string;
};

export type CapatazAIResult = {
  intent: CapatazAIIntent;
  confidence: number;
  entities: CapatazAIEntities;
  actionPlan: CapatazAIActionPlanItem[];
  shouldExecute: boolean;
  requiresConfirmation: boolean;
  clarificationQuestions: string[];
  userResponse: string;
  diagnostics?: CapatazAIDiagnostics;
};

export type CapatazAIContext = {
  chatContext?: unknown;
  clients?: Array<Record<string, unknown>>;
  works?: Array<Record<string, unknown>>;
  budgets?: Array<Record<string, unknown>>;
  invoices?: Array<Record<string, unknown>>;
  currentDate?: string;
};

export type CapatazAIInterpretInput = {
  message: string;
  context?: unknown;
  data?: CapatazAIContext;
};

export type CapatazAIDiagnostics = {
  lane: "fast" | "reasoning";
  model: string;
  schemaName: string;
  promptBytes: number;
  contextBytes: number;
  timeoutMs: number;
  durationMs: number;
  reasoningEffort?: string;
  escalated?: boolean;
  escalationReason?: string;
};

type CompactIntent = CapatazAIIntent;

type CompactExtraction = {
  i: CompactIntent;
  c: number;
  e: {
    cn?: string;
    ct?: string;
    ce?: string;
    fc?: string;
    cl?: string;
    typ?: "particular" | "autonomo" | "empresa";
    nif?: string;
    df?: string;
    on?: string;
    ot?: string;
    ol?: string;
    od?: string;
    job?: string;
    scope?: string;
    qty?: number;
    unit?: string;
    dur?: string;
    lines: Array<{ d?: string; q?: number; u?: string; p?: number; t?: number; cat?: string }>;
    amount?: number;
    iva?: boolean;
    mat?: boolean;
    date?: string;
    time?: string;
    act?: "visita" | "reunion" | "llamada" | "nota" | "seguimiento";
    channel?: "whatsapp" | "email" | "interno";
    msg?: string;
    doc?: "presupuesto" | "factura";
    state?: string;
    method?: string;
    notes?: string;
    pending: string[];
    refs: string[];
  };
  a: CapatazAIInternalAction[];
  x: boolean;
  rc: boolean;
  q: string[];
  er?: string;
};

const stringOrNull = { type: ["string", "null"] };
const numberOrNull = { type: ["number", "null"] };
const booleanOrNull = { type: ["boolean", "null"] };

const entityProperties = {
  contacto_nombre: stringOrNull,
  contacto_telefono: stringOrNull,
  contacto_email: stringOrNull,
  empresa_facturacion: stringOrNull,
  cliente_nombre: stringOrNull,
  cliente_tipo: { type: ["string", "null"], enum: ["particular", "autonomo", "empresa", null] },
  cliente_nif: stringOrNull,
  direccion_fiscal: stringOrNull,
  obra_nombre: stringOrNull,
  obra_tipo: stringOrNull,
  obra_localidad: stringOrNull,
  obra_direccion: stringOrNull,
  descripcion_trabajo: stringOrNull,
  alcance: stringOrNull,
  cantidad: numberOrNull,
  unidad_cantidad: stringOrNull,
  duracion_estimada: stringOrNull,
  partidas: {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      required: ["descripcion", "cantidad", "unidad", "precioUnitario", "total", "categoria"],
      properties: {
        descripcion: stringOrNull,
        cantidad: numberOrNull,
        unidad: stringOrNull,
        precioUnitario: numberOrNull,
        total: numberOrNull,
        categoria: stringOrNull
      }
    }
  },
  importe: numberOrNull,
  moneda: { type: ["string", "null"], enum: ["EUR", null] },
  iva_porcentaje: numberOrNull,
  iva_incluido: booleanOrNull,
  material_incluido: booleanOrNull,
  fecha: stringOrNull,
  hora: stringOrNull,
  fecha_fin: stringOrNull,
  tipo_actividad: { type: ["string", "null"], enum: ["visita", "reunion", "llamada", "nota", "seguimiento", null] },
  canal: { type: ["string", "null"], enum: ["whatsapp", "email", "interno", null] },
  mensaje: stringOrNull,
  documento_tipo: { type: ["string", "null"], enum: ["presupuesto", "factura", null] },
  documento_numero: stringOrNull,
  estado: stringOrNull,
  metodo_pago: stringOrNull,
  notas: stringOrNull,
  datos_pendientes: { type: "array", items: { type: "string" } },
  referencias_contexto: { type: "array", items: { type: "string" } }
} as const;

const entityRequired = Object.keys(entityProperties);

export const capatazAIJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "intent",
    "confidence",
    "entities",
    "actionPlan",
    "shouldExecute",
    "requiresConfirmation",
    "clarificationQuestions",
    "userResponse"
  ],
  properties: {
    intent: { type: "string", enum: capatazAIIntents },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    entities: {
      type: "object",
      additionalProperties: false,
      required: entityRequired,
      properties: entityProperties
    },
    actionPlan: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "reason", "target"],
        properties: {
          action: { type: "string", enum: capatazAIInternalActions },
          reason: { type: "string" },
          target: stringOrNull
        }
      }
    },
    shouldExecute: { type: "boolean" },
    requiresConfirmation: { type: "boolean" },
    clarificationQuestions: { type: "array", items: { type: "string" } },
    userResponse: { type: "string" }
  }
} as const;

const compactEntityProperties = {
  cn: stringOrNull,
  ct: stringOrNull,
  ce: stringOrNull,
  fc: stringOrNull,
  cl: stringOrNull,
  typ: { type: ["string", "null"], enum: ["particular", "autonomo", "empresa", null] },
  nif: stringOrNull,
  df: stringOrNull,
  on: stringOrNull,
  ot: stringOrNull,
  ol: stringOrNull,
  od: stringOrNull,
  job: stringOrNull,
  scope: stringOrNull,
  qty: numberOrNull,
  unit: stringOrNull,
  dur: stringOrNull,
  lines: {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      required: ["d", "q", "u", "p", "t", "cat"],
      properties: {
        d: stringOrNull,
        q: numberOrNull,
        u: stringOrNull,
        p: numberOrNull,
        t: numberOrNull,
        cat: stringOrNull
      }
    }
  },
  amount: numberOrNull,
  iva: booleanOrNull,
  mat: booleanOrNull,
  date: stringOrNull,
  time: stringOrNull,
  act: { type: ["string", "null"], enum: ["visita", "reunion", "llamada", "nota", "seguimiento", null] },
  channel: { type: ["string", "null"], enum: ["whatsapp", "email", "interno", null] },
  msg: stringOrNull,
  doc: { type: ["string", "null"], enum: ["presupuesto", "factura", null] },
  state: stringOrNull,
  method: stringOrNull,
  notes: stringOrNull,
  pending: { type: "array", items: { type: "string" } },
  refs: { type: "array", items: { type: "string" } }
} as const;

const compactExtractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["i", "c", "e", "a", "x", "rc", "q", "er"],
  properties: {
    i: { type: "string", enum: capatazAIIntents },
    c: { type: "number", minimum: 0, maximum: 1 },
    e: {
      type: "object",
      additionalProperties: false,
      required: Object.keys(compactEntityProperties),
      properties: compactEntityProperties
    },
    a: { type: "array", items: { type: "string", enum: capatazAIInternalActions } },
    x: { type: "boolean" },
    rc: { type: "boolean" },
    q: { type: "array", items: { type: "string" } },
    er: stringOrNull
  }
} as const;

type ExtractionProfile = {
  id: "budget" | "invoice" | "visit" | "document" | "general";
  schemaName: string;
  instruction: string;
};

const extractionProfiles: Record<ExtractionProfile["id"], ExtractionProfile> = {
  budget: {
    id: "budget",
    schemaName: "capataz_budget_extract",
    instruction: "Extrae oportunidad/obra/presupuesto. Diferencia contacto operativo y empresa fiscal. Si hay precio acordado de trabajo, i=crear_presupuesto y a incluye crearPresupuestoBorrador."
  },
  invoice: {
    id: "invoice",
    schemaName: "capataz_invoice_extract",
    instruction: "Extrae factura solo si el usuario pide factura de forma explicita. Si solo menciona que la factura ira a una empresa pero describe un trabajo futuro, usa presupuesto."
  },
  visit: {
    id: "visit",
    schemaName: "capataz_visit_extract",
    instruction: "Extrae visita/reunion/nota. Horas como 17H son time=17:00, nunca amount. Si hay materiales revisados y confirmacion pendiente, pregunta seguimiento."
  },
  document: {
    id: "document",
    schemaName: "capataz_document_extract",
    instruction: "Extrae comandos de PDF/documentos. No generes documentos si falta referencia."
  },
  general: {
    id: "general",
    schemaName: "capataz_general_extract",
    instruction: "Extrae intencion y entidades minimas. Si no hay accion clara, i=preguntar_aclaracion o sin_accion."
  }
};

const capatazAISystemPrompt = `
Eres el motor de comprension de Capataz, una app para profesionales de reformas, construccion e instalaciones.
Tu trabajo no es ejecutar acciones directamente. Tu trabajo es devolver JSON estructurado para que el backend de Capataz ejecute herramientas internas controladas.

Reglas criticas:
- Distingue siempre contacto operativo, cliente real y empresa de facturacion. Si el usuario da un nombre de persona para contacto y una razon social distinta para facturar, la persona es contacto operativo y la razon social es empresa de facturacion/cliente fiscal.
- Distingue cantidades, importes, fechas, horas y duracion. "25 baños" es cantidad de unidades, "17H" es hora, "60mil euros" es importe, "2 semanas" es duracion.
- No confundas una visita/reunion con un gasto aunque aparezca una hora o numero. "La visita ha sido a las 17H" es hora 17:00, no 17 euros.
- Si el usuario pide crear presupuesto o describe precio acordado de trabajo, prepara un borrador de presupuesto profesional, no una factura definitiva.
- Si el usuario pide factura de forma explicita, prepara una factura en borrador. No la emitas ni la envies.
- Borradores editables de cliente, obra, presupuesto, factura y visita interna pueden ejecutarse si hay datos minimos.
- Pagos, gastos, cambios de estado, programaciones externas, envios por WhatsApp/email, conversiones definitivas y PDFs enviados requieren confirmacion humana previa.
- Nunca digas que has enviado WhatsApp, email o documentos. Capataz todavia no envia comunicaciones reales.
- Si faltan CIF/NIF, direccion fiscal, direccion de obra, telefono, email, IVA o forma de pago, anotalos en datos_pendientes y pregunta en clarificationQuestions.
- userResponse debe explicar lo entendido, que se va a crear solo un borrador/local, y las preguntas pendientes. No menciones detalles internos de implementación.

Herramientas internas disponibles solo para el backend:
buscarCliente, buscarDuplicados, crearClienteProvisional, crearContacto, crearObra, crearPresupuestoBorrador, crearFacturaBorrador, registrarVisita, crearSeguimiento, registrarGasto, registrarPago, generarPDF, preguntarAclaracion, actualizarDatos.
`.trim();

export function isCapatazAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getCapatazAIModel() {
  return getCapatazAIReasoningModel();
}

export function getCapatazAIFastModel() {
  return process.env.OPENAI_MODEL_FAST || "gpt-4.1-mini";
}

export function getCapatazAIReasoningModel() {
  return process.env.OPENAI_MODEL_REASONING || process.env.OPENAI_MODEL || "gpt-5.5";
}

export function getCapatazAIReasoningEffort() {
  return process.env.OPENAI_REASONING_EFFORT || "low";
}

export function getCapatazAIStatus() {
  return {
    configured: isCapatazAIConfigured(),
    model: getCapatazAIReasoningModel(),
    fastModel: getCapatazAIFastModel(),
    reasoningModel: getCapatazAIReasoningModel(),
    reasoningEffort: getCapatazAIReasoningEffort(),
    fastTimeoutMs: readTimeoutMs("fast"),
    reasoningTimeoutMs: readTimeoutMs("reasoning")
  };
}

export async function checkCapatazAIModels() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      fast: { model: getCapatazAIFastModel(), ok: false, error: "missing_OPENAI_API_KEY" },
      reasoning: { model: getCapatazAIReasoningModel(), ok: false, error: "missing_OPENAI_API_KEY" }
    };
  }

  const [fast, reasoning] = await Promise.all([
    pingOpenAIModel(apiKey, getCapatazAIFastModel(), "fast"),
    pingOpenAIModel(apiKey, getCapatazAIReasoningModel(), "reasoning")
  ]);

  return {
    ok: fast.ok && reasoning.ok,
    fast,
    reasoning
  };
}

export async function interpretCapatazMessageWithAI(input: CapatazAIInterpretInput): Promise<CapatazAIResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no esta configurada");
  }

  const fast = await runCompactExtraction({
    input,
    apiKey,
    lane: "fast",
    profile: selectExtractionProfile(input.message)
  });
  const fastResult = compactToCapatazResult(fast.data, fast.diagnostics);
  const escalationReason = shouldEscalate(fast.data, fastResult);
  if (!escalationReason) return fastResult;

  const reasoning = await runCompactExtraction({
    input,
    apiKey,
    lane: "reasoning",
    profile: selectExtractionProfile(input.message),
    previous: fast.data,
    escalationReason
  });
  return compactToCapatazResult(reasoning.data, {
    ...reasoning.diagnostics,
    escalated: true,
    escalationReason
  });
}

async function runCompactExtraction({
  input,
  apiKey,
  lane,
  profile,
  previous,
  escalationReason
}: {
  input: CapatazAIInterpretInput;
  apiKey: string;
  lane: "fast" | "reasoning";
  profile: ExtractionProfile;
  previous?: CompactExtraction;
  escalationReason?: string;
}) {
  const model = lane === "fast" ? getCapatazAIFastModel() : getCapatazAIReasoningModel();
  const timeoutMs = readTimeoutMs(lane);
  const prompt = compactPrompt(profile, lane, escalationReason);
  const compactContext = compactAIContext(input.data, input.context);
  const userPayload = JSON.stringify({
    m: input.message,
    ctx: compactContext,
    prev: previous ? compactForRetry(previous) : null
  });
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: prompt
          },
          {
            role: "user",
            content: userPayload
          }
        ],
        ...(lane === "reasoning" ? { reasoning: { effort: getCapatazAIReasoningEffort() } } : {}),
        text: {
          format: {
            type: "json_schema",
            name: profile.schemaName,
            strict: true,
            schema: compactExtractionSchema
          }
        }
      })
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new CapatazAIRequestError(`OpenAI ha superado el timeout de ${timeoutMs}ms`, {
        lane,
        model,
        schemaName: profile.schemaName,
        promptBytes: byteLength(prompt),
        contextBytes: byteLength(userPayload),
        timeoutMs,
        durationMs: Date.now() - startedAt,
        reasoningEffort: lane === "reasoning" ? getCapatazAIReasoningEffort() : undefined,
        errorType: "timeout"
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = extractOpenAIError(payload) || `OpenAI API devolvio HTTP ${response.status}`;
    throw new CapatazAIRequestError(message, {
      lane,
      model,
      schemaName: profile.schemaName,
      promptBytes: byteLength(prompt),
      contextBytes: byteLength(userPayload),
      timeoutMs,
      durationMs: Date.now() - startedAt,
      reasoningEffort: lane === "reasoning" ? getCapatazAIReasoningEffort() : undefined,
      status: response.status,
      errorType: classifyOpenAIError(response.status, message)
    });
  }

  const content = extractResponseText(payload);
  if (!content) {
    throw new CapatazAIRequestError("OpenAI no devolvio contenido estructurado", {
      lane,
      model,
      schemaName: profile.schemaName,
      promptBytes: byteLength(prompt),
      contextBytes: byteLength(userPayload),
      timeoutMs,
      durationMs: Date.now() - startedAt,
      reasoningEffort: lane === "reasoning" ? getCapatazAIReasoningEffort() : undefined,
      errorType: "empty_response"
    });
  }

  const parsed = JSON.parse(content) as unknown;
  return {
    data: validateCompactExtraction(parsed),
    diagnostics: {
      lane,
      model,
      schemaName: profile.schemaName,
      promptBytes: byteLength(prompt),
      contextBytes: byteLength(userPayload),
      timeoutMs,
      durationMs: Date.now() - startedAt,
      reasoningEffort: lane === "reasoning" ? getCapatazAIReasoningEffort() : undefined
    } satisfies CapatazAIDiagnostics
  };
}

async function pingOpenAIModel(apiKey: string, model: string, lane: "fast" | "reasoning") {
  const timeoutMs = lane === "fast" ? 5000 : 8000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: "Responde solo OK.",
        max_output_tokens: 16
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        model,
        ok: false,
        durationMs: Date.now() - startedAt,
        error: extractOpenAIError(payload) || `HTTP ${response.status}`
      };
    }
    return {
      model,
      ok: true,
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      model,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error && error.name === "AbortError" ? `timeout_${timeoutMs}ms` : error instanceof Error ? error.message : "unknown"
    };
  } finally {
    clearTimeout(timeout);
  }
}

function readTimeoutMs(lane: "fast" | "reasoning") {
  const envKey = lane === "fast" ? "OPENAI_FAST_TIMEOUT_MS" : "OPENAI_REASONING_TIMEOUT_MS";
  const fallback = lane === "fast" ? 10000 : Number(process.env.OPENAI_TIMEOUT_MS ?? 30000);
  const value = Number(process.env[envKey] ?? fallback);
  if (!Number.isFinite(value)) return lane === "fast" ? 10000 : 30000;
  return Math.min(lane === "fast" ? 15000 : 35000, Math.max(5000, value));
}

export class CapatazAIRequestError extends Error {
  meta: Record<string, unknown>;

  constructor(message: string, meta: Record<string, unknown>) {
    super(message);
    this.name = "CapatazAIRequestError";
    this.meta = meta;
  }
}

export function getCapatazAIErrorMeta(error: unknown) {
  return error instanceof CapatazAIRequestError ? error.meta : null;
}

function compactPrompt(profile: ExtractionProfile, lane: "fast" | "reasoning", escalationReason?: string) {
  return [
    "Eres el extractor estructurado de Capataz para reformas/construccion.",
    "Devuelve solo JSON valido. No redactes respuesta al usuario.",
    "Claves: i=intent, c=confidence, e=entidades, a=acciones internas, x=puede ejecutar borrador/local, rc=requiere confirmacion, q=preguntas, er=motivo de escalado.",
    "Entidades: cn contacto, fc empresa_facturacion, cl cliente, typ tipo cliente, on obra, ot tipo obra, ol localidad, od direccion obra, job trabajo, scope alcance, qty cantidad, unit unidad, dur duracion, amount importe, iva si importe incluye IVA, mat material incluido, time hora.",
    "Reglas: 17H es hora, no importe. 25 baños es cantidad. 60mil euros es amount=60000. Si hay persona de contacto y razon social distinta, separalas en contacto y empresa fiscal.",
    "No propongas enviar WhatsApp/email ni emitir facturas definitivas.",
    profile.instruction,
    lane === "reasoning" ? `Revisa la extraccion previa y corrige ambiguedad: ${escalationReason ?? "confidence baja"}.` : "Prioriza rapidez y campos seguros."
  ].join("\n");
}

function selectExtractionProfile(message: string): ExtractionProfile {
  const normalized = normalizeBasic(message);
  if (/\b(pdf|descargar|descarga)\b/.test(normalized)) return extractionProfiles.document;
  if (/\b(visita|reunion|reunido|he hablado|hemos hablado|llamada)\b/.test(normalized)) return extractionProfiles.visit;
  if (normalized.includes("factura") && /\b(haz|crear|crea|prepara|emite|factura a|factura para)\b/.test(normalized)) {
    if (!/(factura tendra que ser|factura tendrá que ser|ira a nombre|irá a nombre|nombre de empresa)/.test(normalized)) return extractionProfiles.invoice;
  }
  if (normalized.includes("presupuesto") || /\b(precio cerrado|hemos acordado|cliente nuevo|nuevo cliente|obra es|quiere que)\b/.test(normalized)) return extractionProfiles.budget;
  return extractionProfiles.general;
}

function compactAIContext(data?: CapatazAIContext, context?: unknown) {
  return {
    active: compactActiveContext(context),
    clients: (data?.clients ?? []).slice(0, 5).map((client) => pickKeys(client, ["id", "nombre", "tipo", "estado"])),
    works: (data?.works ?? []).slice(0, 5).map((work) => pickKeys(work, ["id", "clienteId", "titulo", "direccion", "tipoTrabajo", "estado"])),
    budgets: (data?.budgets ?? []).slice(0, 4).map((budget) => pickKeys(budget, ["id", "clienteId", "obraId", "numero", "titulo", "total", "estado"])),
    invoices: (data?.invoices ?? []).slice(0, 4).map((invoice) => pickKeys(invoice, ["id", "clienteId", "obraId", "numero", "concepto", "total", "pendiente", "estado"])),
    now: data?.currentDate ?? new Date().toISOString()
  };
}

function compactActiveContext(context: unknown) {
  if (!isRecord(context)) return null;
  return {
    activeTask: context.activeTask ?? null,
    lastClientId: context.lastClientId ?? null,
    lastWorkId: context.lastWorkId ?? null,
    lastBudgetId: context.lastBudgetId ?? null,
    lastInvoiceId: context.lastInvoiceId ?? null,
    lastDocumentType: context.lastDocumentType ?? null,
    lastClientName: context.lastClientName ?? null
  };
}

function pickKeys(source: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, source[key]]).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function compactForRetry(value: CompactExtraction) {
  return {
    i: value.i,
    c: value.c,
    e: value.e,
    a: value.a,
    q: value.q,
    er: value.er ?? null
  };
}

function validateCompactExtraction(raw: unknown): CompactExtraction {
  if (!isRecord(raw)) throw new Error("Respuesta IA compacta invalida: no es objeto");
  if (!isIntent(raw.i)) throw new Error("Respuesta IA compacta invalida: intent desconocido");
  const entity = isRecord(raw.e) ? raw.e : {};
  return {
    i: raw.i,
    c: clampNumber(raw.c, 0, 1, 0),
    e: {
      cn: asCleanString(entity.cn),
      ct: asCleanString(entity.ct),
      ce: asCleanString(entity.ce),
      fc: asCleanString(entity.fc),
      cl: asCleanString(entity.cl),
      typ: asEnum(entity.typ, ["particular", "autonomo", "empresa"]),
      nif: asCleanString(entity.nif),
      df: asCleanString(entity.df),
      on: asCleanString(entity.on),
      ot: asCleanString(entity.ot),
      ol: asCleanString(entity.ol),
      od: asCleanString(entity.od),
      job: asCleanString(entity.job),
      scope: asCleanString(entity.scope),
      qty: asOptionalNumber(entity.qty),
      unit: asCleanString(entity.unit),
      dur: asCleanString(entity.dur),
      lines: normalizeCompactLines(entity.lines),
      amount: asOptionalNumber(entity.amount),
      iva: asOptionalBoolean(entity.iva),
      mat: asOptionalBoolean(entity.mat),
      date: asCleanString(entity.date),
      time: normalizeHour(entity.time),
      act: asEnum(entity.act, ["visita", "reunion", "llamada", "nota", "seguimiento"]),
      channel: asEnum(entity.channel, ["whatsapp", "email", "interno"]),
      msg: asCleanString(entity.msg),
      doc: asEnum(entity.doc, ["presupuesto", "factura"]),
      state: asCleanString(entity.state),
      method: asCleanString(entity.method),
      notes: asCleanString(entity.notes),
      pending: normalizeStringArray(entity.pending),
      refs: normalizeStringArray(entity.refs)
    },
    a: Array.isArray(raw.a) ? raw.a.filter(isInternalAction) : [],
    x: raw.x === true,
    rc: raw.rc === true,
    q: normalizeStringArray(raw.q),
    er: asCleanString(raw.er)
  };
}

function normalizeCompactLines(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((line) => ({
    d: asCleanString(line.d),
    q: asOptionalNumber(line.q),
    u: asCleanString(line.u),
    p: asOptionalNumber(line.p),
    t: asOptionalNumber(line.t),
    cat: asCleanString(line.cat)
  })).filter((line) => line.d || line.t || line.p);
}

function compactToCapatazResult(raw: CompactExtraction, diagnostics?: CapatazAIDiagnostics): CapatazAIResult {
  const entities: CapatazAIEntities = {
    contacto_nombre: raw.e.cn,
    contacto_telefono: raw.e.ct,
    contacto_email: raw.e.ce,
    empresa_facturacion: raw.e.fc,
    cliente_nombre: raw.e.cl ?? raw.e.fc ?? raw.e.cn,
    cliente_tipo: raw.e.typ,
    cliente_nif: raw.e.nif,
    direccion_fiscal: raw.e.df,
    obra_nombre: raw.e.on,
    obra_tipo: raw.e.ot,
    obra_localidad: raw.e.ol,
    obra_direccion: raw.e.od,
    descripcion_trabajo: raw.e.job,
    alcance: raw.e.scope,
    cantidad: raw.e.qty,
    unidad_cantidad: raw.e.unit,
    duracion_estimada: raw.e.dur,
    partidas: raw.e.lines.map((line) => ({
      descripcion: line.d,
      cantidad: line.q,
      unidad: line.u,
      precioUnitario: line.p,
      total: line.t,
      categoria: line.cat
    })),
    importe: raw.e.amount,
    moneda: raw.e.amount ? "EUR" : undefined,
    iva_incluido: raw.e.iva,
    material_incluido: raw.e.mat,
    fecha: raw.e.date,
    hora: raw.e.time,
    tipo_actividad: raw.e.act,
    canal: raw.e.channel,
    mensaje: raw.e.msg,
    documento_tipo: raw.e.doc,
    estado: raw.e.state,
    metodo_pago: raw.e.method,
    notas: raw.e.notes,
    datos_pendientes: raw.e.pending,
    referencias_contexto: raw.e.refs
  };

  return {
    intent: raw.i,
    confidence: raw.c,
    entities,
    actionPlan: raw.a.map((action) => ({ action, reason: "Extraccion IA compacta" })),
    shouldExecute: raw.x,
    requiresConfirmation: raw.rc,
    clarificationQuestions: raw.q,
    userResponse: "",
    diagnostics
  };
}

function shouldEscalate(raw: CompactExtraction, result: CapatazAIResult) {
  if (raw.c < 0.72) return "confidence_baja";
  if (raw.er) return raw.er;
  if (["crear_presupuesto", "crear_factura"].includes(result.intent)) {
    if (!result.entities.importe || !(result.entities.empresa_facturacion ?? result.entities.cliente_nombre ?? result.entities.contacto_nombre)) return "faltan_campos_clave_documento";
  }
  if ((result.intent === "registrar_visita" || result.intent === "registrar_reunion") && !result.entities.contacto_nombre && !result.entities.cliente_nombre) {
    return "falta_cliente_actividad";
  }
  return null;
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function normalizeBasic(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function classifyOpenAIError(status: number, message: string) {
  const normalized = normalizeBasic(message);
  if (status === 401 || normalized.includes("incorrect api key")) return "auth";
  if (status === 404 || normalized.includes("model")) return "model";
  if (status === 429 || normalized.includes("rate")) return "rate_limit";
  if (status >= 500) return "openai_server";
  if (normalized.includes("schema") || normalized.includes("json")) return "validation";
  return "api_error";
}

export function validateCapatazAIResult(raw: unknown): CapatazAIResult {
  if (!isRecord(raw)) throw new Error("Respuesta IA invalida: no es un objeto");
  if (!isIntent(raw.intent)) throw new Error("Respuesta IA invalida: intent desconocido");

  const entities = normalizeEntities(raw.entities);
  const actionPlan = Array.isArray(raw.actionPlan)
    ? raw.actionPlan.map(normalizeActionPlanItem).filter((item): item is CapatazAIActionPlanItem => Boolean(item))
    : [];

  const result: CapatazAIResult = {
    intent: raw.intent,
    confidence: clampNumber(raw.confidence, 0, 1, 0),
    entities,
    actionPlan,
    shouldExecute: raw.shouldExecute === true,
    requiresConfirmation: raw.requiresConfirmation === true,
    clarificationQuestions: normalizeStringArray(raw.clarificationQuestions),
    userResponse: asCleanString(raw.userResponse) ?? "He entendido la peticion y necesito revisar algunos datos antes de continuar."
  };

  return result;
}

function normalizeEntities(value: unknown): CapatazAIEntities {
  const raw = isRecord(value) ? value : {};
  return {
    contacto_nombre: asCleanString(raw.contacto_nombre),
    contacto_telefono: asCleanString(raw.contacto_telefono),
    contacto_email: asCleanString(raw.contacto_email),
    empresa_facturacion: asCleanString(raw.empresa_facturacion),
    cliente_nombre: asCleanString(raw.cliente_nombre),
    cliente_tipo: asEnum(raw.cliente_tipo, ["particular", "autonomo", "empresa"]),
    cliente_nif: asCleanString(raw.cliente_nif),
    direccion_fiscal: asCleanString(raw.direccion_fiscal),
    obra_nombre: asCleanString(raw.obra_nombre),
    obra_tipo: asCleanString(raw.obra_tipo),
    obra_localidad: asCleanString(raw.obra_localidad),
    obra_direccion: asCleanString(raw.obra_direccion),
    descripcion_trabajo: asCleanString(raw.descripcion_trabajo),
    alcance: asCleanString(raw.alcance),
    cantidad: asOptionalNumber(raw.cantidad),
    unidad_cantidad: asCleanString(raw.unidad_cantidad),
    duracion_estimada: asCleanString(raw.duracion_estimada),
    partidas: normalizePartidas(raw.partidas),
    importe: asOptionalNumber(raw.importe),
    moneda: raw.moneda === "EUR" ? "EUR" : undefined,
    iva_porcentaje: asOptionalNumber(raw.iva_porcentaje),
    iva_incluido: asOptionalBoolean(raw.iva_incluido),
    material_incluido: asOptionalBoolean(raw.material_incluido),
    fecha: asCleanString(raw.fecha),
    hora: normalizeHour(raw.hora),
    fecha_fin: asCleanString(raw.fecha_fin),
    tipo_actividad: asEnum(raw.tipo_actividad, ["visita", "reunion", "llamada", "nota", "seguimiento"]),
    canal: asEnum(raw.canal, ["whatsapp", "email", "interno"]),
    mensaje: asCleanString(raw.mensaje),
    documento_tipo: asEnum(raw.documento_tipo, ["presupuesto", "factura"]),
    documento_numero: asCleanString(raw.documento_numero),
    estado: asCleanString(raw.estado),
    metodo_pago: asCleanString(raw.metodo_pago),
    notas: asCleanString(raw.notas),
    datos_pendientes: normalizeStringArray(raw.datos_pendientes),
    referencias_contexto: normalizeStringArray(raw.referencias_contexto)
  };
}

function normalizePartidas(value: unknown): CapatazAIPartida[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((line) => ({
      descripcion: asCleanString(line.descripcion),
      cantidad: asOptionalNumber(line.cantidad),
      unidad: asCleanString(line.unidad),
      precioUnitario: asOptionalNumber(line.precioUnitario),
      total: asOptionalNumber(line.total),
      categoria: asCleanString(line.categoria)
    }))
    .filter((line) => line.descripcion || line.total || line.precioUnitario);
}

function normalizeActionPlanItem(value: unknown): CapatazAIActionPlanItem | null {
  if (!isRecord(value)) return null;
  if (!isInternalAction(value.action)) return null;
  return {
    action: value.action,
    reason: asCleanString(value.reason) ?? "Accion propuesta por Capataz",
    target: asCleanString(value.target)
  };
}

function extractResponseText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.output_text === "string") return payload.output_text;

  const output = Array.isArray(payload.output) ? payload.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isRecord(content)) continue;
      if (typeof content.text === "string") parts.push(content.text);
    }
  }

  return parts.join("").trim() || null;
}

function extractOpenAIError(payload: unknown) {
  if (!isRecord(payload)) return null;
  const error = payload.error;
  if (!isRecord(error)) return null;
  return asCleanString(error.message);
}

function isIntent(value: unknown): value is CapatazAIIntent {
  return typeof value === "string" && (capatazAIIntents as readonly string[]).includes(value);
}

function isInternalAction(value: unknown): value is CapatazAIInternalAction {
  return typeof value === "string" && (capatazAIInternalActions as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asCleanString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean || undefined;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(asCleanString).filter(Boolean) as string[];
}

function asOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const normalized = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(normalized) ? normalized : undefined;
}

function asOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function asEnum<const T extends readonly string[]>(value: unknown, values: T): T[number] | undefined {
  return typeof value === "string" && values.includes(value) ? value : undefined;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = asOptionalNumber(value);
  if (number === undefined) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeHour(value: unknown) {
  const clean = asCleanString(value);
  if (!clean) return undefined;
  const match = clean.match(/^(\d{1,2})(?::?(\d{2}))?h?$/i);
  if (!match) return clean;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return clean;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
