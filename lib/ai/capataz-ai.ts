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

const capatazAISystemPrompt = `
Eres el motor de comprension de Capataz, una app para profesionales de reformas, construccion e instalaciones.
Tu trabajo no es ejecutar acciones directamente. Tu trabajo es devolver JSON estructurado para que el backend de Capataz ejecute herramientas internas controladas.

Reglas criticas:
- Distingue siempre contacto operativo, cliente real y empresa de facturacion. Si el usuario dice "se llama Alberto Ruiz" y "la factura ira a nombre de MURHOTEL SL", Alberto Ruiz es contacto operativo y MURHOTEL SL es empresa de facturacion/cliente fiscal.
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
  return process.env.OPENAI_MODEL || "gpt-5.5";
}

export function getCapatazAIStatus() {
  return {
    configured: isCapatazAIConfigured(),
    model: getCapatazAIModel()
  };
}

export async function interpretCapatazMessageWithAI(input: CapatazAIInterpretInput): Promise<CapatazAIResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no esta configurada");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: getCapatazAIModel(),
      input: [
        {
          role: "system",
          content: capatazAISystemPrompt
        },
        {
          role: "user",
          content: JSON.stringify({
            message: input.message,
            chatContext: input.context ?? null,
            appContext: input.data ?? {},
            currentDate: input.data?.currentDate ?? new Date().toISOString()
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "capataz_ai_result",
          strict: true,
          schema: capatazAIJsonSchema
        }
      }
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = extractOpenAIError(payload) || `OpenAI API devolvio HTTP ${response.status}`;
    throw new Error(message);
  }

  const content = extractResponseText(payload);
  if (!content) throw new Error("OpenAI no devolvio contenido estructurado");

  const parsed = JSON.parse(content) as unknown;
  return validateCapatazAIResult(parsed);
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
