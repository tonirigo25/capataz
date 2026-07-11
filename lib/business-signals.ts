import type {
  BusinessSignalLevel as PrismaBusinessSignalLevel,
  BusinessSignalSource as PrismaBusinessSignalSource,
  BusinessSignalStatus as PrismaBusinessSignalStatus,
  Prisma
} from "@prisma/client";
import { calculateWorkFinancials, isActiveWorkStatus, normalizeStatus as normalizeWorkStatus } from "@/lib/works";
import { invoiceBalance, isBillableInvoiceStatus, safeNumber } from "@/lib/business-metrics";
import { prisma } from "@/lib/prisma";
import { getTreasuryOverview, type TreasuryAlert, type TreasuryDataQualityIssue } from "@/lib/treasury";

export type BusinessSignalLevel = PrismaBusinessSignalLevel;
export type BusinessSignalStatus = PrismaBusinessSignalStatus;
export type BusinessSignalSource = PrismaBusinessSignalSource;

export type BusinessSignalAction = {
  label: string;
  href: string;
  kind: "review" | "open" | "register" | "complete" | "schedule";
};

export type BusinessSignalScorePart = {
  label: string;
  value: number;
  detail: string;
};

export type BusinessSignalExplanation = {
  summary: string;
  why: string;
  dataUsed: string[];
  rule: string;
  modules: string[];
  consequence: string;
  scoreBreakdown: BusinessSignalScorePart[];
};

export type BusinessSignalEntity = {
  type: string;
  id: string;
  label: string;
  href: string;
};

export type BusinessSignal = {
  id: string;
  fingerprint: string;
  type: string;
  tipo: string;
  title: string;
  summary: string;
  level: BusinessSignalLevel;
  nivel: BusinessSignalLevel;
  levelText: string;
  ruleId: string;
  ruleVersion: string;
  prioridad: number;
  score: number;
  date: Date | null;
  fecha: Date | null;
  startsAt: Date | null;
  detectedAt: Date;
  source: BusinessSignalSource;
  sourceLabel: string;
  entity: BusinessSignalEntity | null;
  client: BusinessSignalEntity | null;
  work: BusinessSignalEntity | null;
  relatedAmount: number | null;
  status: BusinessSignalStatus;
  statusLabel: string;
  explanation: BusinessSignalExplanation;
  suggestedActions: BusinessSignalAction[];
  expiresAt: Date | null;
  shownAt: Date | null;
  dismissedAt: Date | null;
  dismissedReason: string | null;
  dismissedBy: string | null;
  snoozedUntil: Date | null;
  snoozeReason: string | null;
  resolvedAt: Date | null;
  resolution: string | null;
};

export type BusinessSignalGroup = {
  key: string;
  title: string;
  source: BusinessSignalSource;
  level: BusinessSignalLevel;
  status: BusinessSignalStatus | "mixed";
  count: number;
  totalAmount: number;
  maxScore: number;
  topSignals: BusinessSignal[];
  explanation: string;
};

export type BusinessSignalsSummary = {
  total: number;
  active: number;
  snoozed: number;
  dismissed: number;
  resolved: number;
  expired: number;
  critical: number;
  important: number;
  attention: number;
  info: number;
  totalAmount: number;
  top: BusinessSignal | null;
};

export type BusinessSignalsParams = {
  status?: BusinessSignalStatus | "all" | "history";
  level?: BusinessSignalLevel | "all";
  source?: BusinessSignalSource | "all";
  q?: string;
  includeResolved?: boolean;
  sync?: boolean;
  limit?: number;
  now?: Date;
};

export type BusinessSignalsResult = {
  signals: BusinessSignal[];
  groups: BusinessSignalGroup[];
  summary: BusinessSignalsSummary;
  generatedAt: Date;
  filters: Required<Omit<BusinessSignalsParams, "now" | "limit">> & { limit: number };
  definitions: typeof BUSINESS_SIGNAL_RULES;
};

export type SignalSnoozePreset = "tomorrow" | "week" | "month";

type BusinessSignalDraft = Omit<
  BusinessSignal,
  | "id"
  | "status"
  | "statusLabel"
  | "shownAt"
  | "dismissedAt"
  | "dismissedReason"
  | "dismissedBy"
  | "snoozedUntil"
  | "snoozeReason"
  | "resolvedAt"
  | "resolution"
>;

type SignalState = {
  id: string;
  fingerprint: string;
  type: string;
  level: BusinessSignalLevel;
  status: BusinessSignalStatus;
  source: BusinessSignalSource;
  ruleId: string | null;
  ruleVersion: string | null;
  entityType: string | null;
  entityId: string | null;
  clientId: string | null;
  workId: string | null;
  invoiceId: string | null;
  budgetId: string | null;
  title: string;
  summary: string | null;
  lastPriority: number;
  amount: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  shownAt: Date | null;
  dismissedAt: Date | null;
  dismissedReason: string | null;
  dismissedBy: string | null;
  snoozedUntil: Date | null;
  snoozeReason: string | null;
  resolvedAt: Date | null;
  resolution: string | null;
  explanation: Prisma.JsonValue | null;
  suggestedActions: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
};

type SignalClient = {
  id: string;
  nombre: string;
  nifCif?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  estado?: string | null;
  ultimaInteraccion?: Date | string | null;
  invoices?: SignalInvoice[];
  budgets?: SignalBudget[];
  works?: SignalWork[];
  reminders?: SignalReminder[];
  agendaEvents?: SignalAgendaEvent[];
};

type SignalInvoice = {
  id: string;
  numero: string;
  concepto: string;
  total: number;
  pagado?: number | null;
  pendiente?: number | null;
  estado: string;
  fechaEmision?: Date | string | null;
  fechaVencimiento?: Date | string | null;
  clienteId?: string | null;
  obraId?: string | null;
  client?: { id: string; nombre: string } | null;
  work?: { id: string; titulo: string } | null;
  payments?: Array<{ id?: string | null; importe: number; fecha?: Date | string | null }>;
};

type SignalBudget = {
  id: string;
  numero: string;
  titulo: string;
  total: number;
  iva?: number | null;
  estado: string;
  fechaCreacion?: Date | string | null;
  fechaEnvio?: Date | string | null;
  fechaValidez?: Date | string | null;
  fechaSeguimiento?: Date | string | null;
  clienteId?: string | null;
  obraId?: string | null;
  client?: { id: string; nombre: string } | null;
  work?: { id: string; titulo: string } | null;
};

type SignalWork = {
  id: string;
  titulo: string;
  direccion?: string | null;
  estado: string;
  prioridad?: string | null;
  fechaCreacion?: Date | string | null;
  fechaInicioPrevista?: Date | string | null;
  fechaInicio?: Date | string | null;
  fechaFinPrevista?: Date | string | null;
  updatedAt?: Date | string | null;
  clienteId?: string | null;
  presupuestoAprobado?: number | null;
  costePrevisto?: number | null;
  gastoReal?: number | null;
  margenEstimado?: number | null;
  subcontratasCoste?: number | null;
  client?: { id: string; nombre: string } | null;
  invoices?: SignalInvoice[];
  budgets?: SignalBudget[];
  expenses?: Array<{ id: string; importe: number; categoria?: string | null }>;
  materials?: SignalMaterial[];
  reminders?: SignalReminder[];
  agendaEvents?: SignalAgendaEvent[];
  documents?: Array<{ id: string; nombre: string; url?: string | null; fecha?: Date | string | null }>;
  repositoryDocuments?: SignalDocument[];
};

type SignalMaterial = {
  id: string;
  nombre: string;
  estado: string;
  obraId?: string | null;
  work?: { id: string; titulo: string; client?: { id: string; nombre: string } | null } | null;
};

type SignalReminder = {
  id: string;
  tipo: string;
  estado: string;
  mensaje: string;
  fechaProgramada: Date | string | null;
  clienteId?: string | null;
  obraId?: string | null;
  facturaId?: string | null;
  presupuestoId?: string | null;
  client?: { id: string; nombre: string } | null;
  work?: { id: string; titulo: string } | null;
  invoice?: { id: string; numero: string } | null;
  budget?: { id: string; numero: string } | null;
};

type SignalAgendaEvent = {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  fechaInicio: Date | string | null;
  requiereConfirmacion?: boolean | null;
  confirmadoPorUsuario?: boolean | null;
  clienteId?: string | null;
  obraId?: string | null;
  facturaId?: string | null;
  presupuestoId?: string | null;
  client?: { id: string; nombre: string } | null;
  work?: { id: string; titulo: string } | null;
  invoice?: { id: string; numero: string } | null;
  budget?: { id: string; numero: string } | null;
};

type SignalDocument = {
  id: string;
  name: string;
  url?: string | null;
  category: string;
  createdAt?: Date | string | null;
  clientId?: string | null;
  workId?: string | null;
  budgetId?: string | null;
  invoiceId?: string | null;
  metadata?: unknown;
  client?: { id: string; nombre: string } | null;
  work?: { id: string; titulo: string } | null;
  budget?: { id: string; numero: string } | null;
  invoice?: { id: string; numero: string } | null;
};

type SignalExpense = {
  id: string;
  proveedor: string;
  concepto: string;
  categoria: string;
  importe: number;
  fecha: Date | string | null;
  paymentStatus?: string | null;
  paymentDueDate?: Date | string | null;
  paidAt?: Date | string | null;
  costBehavior?: string | null;
  clienteId?: string | null;
  obraId?: string | null;
  client?: { id: string; nombre: string } | null;
  work?: { id: string; titulo: string } | null;
};

export type BusinessSignalsInput = {
  invoices?: SignalInvoice[];
  clients?: SignalClient[];
  budgets?: SignalBudget[];
  works?: SignalWork[];
  reminders?: SignalReminder[];
  agendaEvents?: SignalAgendaEvent[];
  documents?: SignalDocument[];
  expenses?: SignalExpense[];
  treasuryAlerts?: TreasuryAlert[];
  treasuryQualityIssues?: TreasuryDataQualityIssue[];
  preferences?: Array<{ scopeType: string; scopeValue: string | null; rule: string; weightDelta: number; neverHide: boolean }>;
};

export const BUSINESS_SIGNAL_RULES = [
  {
    id: "invoice_overdue",
    title: "Factura vencida",
    weights: "Base 30 + antiguedad del vencimiento hasta 35 + impacto economico hasta 20 + concentracion del cliente hasta 10 + reclamada 5.",
    modules: ["Facturas", "Cobros", "CRM"]
  },
  {
    id: "invoice_due_soon",
    title: "Factura próxima a vencer",
    weights: "Base 18 + urgencia por dias restantes hasta 18 + impacto economico hasta 18 + dependencia de cliente 6.",
    modules: ["Facturas", "Tesorería"]
  },
  {
    id: "client_debt_concentration",
    title: "Concentración de deuda por cliente",
    weights: "Share de pendiente: >=70% critico, >=50% importante, >=35% atencion; se suma impacto por importe.",
    modules: ["CRM", "Facturas", "Cobros"]
  },
  {
    id: "work_blocked_or_late",
    title: "Obra bloqueada o fuera de fecha",
    weights: "Base por estado/fecha + prioridad de obra + dias sin cambio + impacto de presupuesto o pendiente.",
    modules: ["Obras", "Agenda", "Materiales", "Cobros"]
  },
  {
    id: "profitability_risk",
    title: "Riesgo de rentabilidad",
    weights: "Base por margen bajo o desviacion + porcentaje de desviacion + impacto economico.",
    modules: ["Obras", "Gastos", "Rentabilidad"]
  },
  {
    id: "planning_follow_up",
    title: "Seguimiento y planificación",
    weights: "Base por tarea vencida + dias de retraso + dependencia de cliente/obra.",
    modules: ["Agenda", "Recordatorios", "Visitas"]
  },
  {
    id: "data_quality",
    title: "Calidad de datos",
    weights: "Base 16-30 + impacto de la entidad + bloqueo operativo documentado.",
    modules: ["CRM", "Documentos", "Tesorería"]
  }
] as const;

const ACTIVE_REMINDER_STATUSES = ["borrador", "pendiente_confirmacion", "programado", "fallido"];
const CLOSED_AGENDA_STATUSES = ["realizado", "cancelado"];
const PENDING_BUDGET_STATUSES = ["enviado", "visto", "pendiente_respuesta", "pendiente_revision"];
const FINAL_WORK_STATUSES = ["finalizada", "facturada", "cobrada", "cerrada", "archivada"];

export async function getBusinessSignals(params: BusinessSignalsParams = {}): Promise<BusinessSignalsResult> {
  const now = params.now ?? new Date();
  const input = await loadBusinessSignalInput(now);
  const drafts = buildBusinessSignalsFromData(input, now);
  const states = await loadOrSyncSignalStates(drafts, params.sync !== false, now);
  const signals = mergeSignalStates(drafts, states);
  return filterAndGroupSignals(signals, params, now);
}

export async function getTodaySignalBrief(limit = 4) {
  const result = await getBusinessSignals({ status: "active", limit });
  return {
    summary: result.summary,
    groups: result.groups.slice(0, 3),
    signals: result.signals.slice(0, limit),
    generatedAt: result.generatedAt
  };
}

export function buildBusinessSignalsFromData(input: BusinessSignalsInput, now: Date = new Date()): BusinessSignalDraft[] {
  const drafts = [
    ...buildInvoiceSignals(input.invoices ?? [], input.clients ?? [], now),
    ...buildClientSignals(input.clients ?? [], input.invoices ?? [], now),
    ...buildBudgetSignals(input.budgets ?? [], now),
    ...buildWorkSignals(input.works ?? [], now),
    ...buildReminderSignals(input.reminders ?? [], now),
    ...buildAgendaSignals(input.agendaEvents ?? [], now),
    ...buildDocumentSignals(input.documents ?? [], now),
    ...buildExpenseSignals(input.expenses ?? [], now),
    ...buildTreasurySignals(input.treasuryAlerts ?? [], input.treasuryQualityIssues ?? [], now)
  ];

  return dedupeDrafts(drafts.map((signal) => applySignalPreferences(signal, input.preferences ?? [])));
}

export async function dismissBusinessSignal(fingerprint: string, reason: string, dismissedBy = "usuario") {
  const cleanReason = reason.trim() || "Descartada por el usuario";
  const state = await prisma.businessSignalState.update({
    where: { fingerprint },
    data: {
      status: "dismissed",
      dismissedAt: new Date(),
      dismissedReason: cleanReason,
      dismissedBy,
      snoozedUntil: null,
      snoozeReason: null
    }
  });

  if (shouldLowerFuturePriority(cleanReason, state.amount, state.metadata)) {
    await prisma.businessSignalPreference.upsert({
      where: {
        userKey_scopeType_scopeValue_rule: {
          userKey: "default",
          scopeType: "signal_type",
          scopeValue: state.type,
          rule: "dismissed_low_importance"
        }
      },
      update: { weightDelta: -10, neverHide: true },
      create: {
        userKey: "default",
        scopeType: "signal_type",
        scopeValue: state.type,
        rule: "dismissed_low_importance",
        weightDelta: -10,
        neverHide: true,
        metadata: { reason: cleanReason }
      }
    });
  }
}

export async function snoozeBusinessSignal(fingerprint: string, preset: SignalSnoozePreset, reason?: string) {
  const now = new Date();
  const until = resolveSnoozeUntil(preset, now);
  await prisma.businessSignalState.update({
    where: { fingerprint },
    data: {
      status: "snoozed",
      snoozedUntil: until,
      snoozeReason: reason?.trim() || snoozePresetLabel(preset),
      resolvedAt: null,
      resolution: null
    }
  });
  return until;
}

export async function resolveBusinessSignal(fingerprint: string, resolution = "Resuelta manualmente por el usuario") {
  await prisma.businessSignalState.update({
    where: { fingerprint },
    data: {
      status: "resolved",
      resolvedAt: new Date(),
      resolution,
      snoozedUntil: null,
      snoozeReason: null
    }
  });
}

export function resolveSnoozeUntil(preset: SignalSnoozePreset, now = new Date()) {
  const copy = new Date(now);
  if (preset === "tomorrow") copy.setDate(copy.getDate() + 1);
  if (preset === "week") copy.setDate(copy.getDate() + 7);
  if (preset === "month") copy.setMonth(copy.getMonth() + 1);
  copy.setHours(9, 0, 0, 0);
  return copy;
}

export function previewCurrentSignalStatusForTest({
  status,
  snoozedUntil = null,
  lastPriority = 50,
  ruleVersion = "2026-07-11.1",
  signalPriority = 50,
  signalRuleVersion = "2026-07-11.1",
  signalExpiresAt = null,
  now = new Date()
}: {
  status: BusinessSignalStatus;
  snoozedUntil?: Date | null;
  lastPriority?: number;
  ruleVersion?: string | null;
  signalPriority?: number;
  signalRuleVersion?: string;
  signalExpiresAt?: Date | null;
  now?: Date;
}) {
  return nextStatusForCurrentSignal(
    { status, snoozedUntil, lastPriority, ruleVersion },
    { prioridad: signalPriority, ruleVersion: signalRuleVersion, expiresAt: signalExpiresAt } as BusinessSignalDraft,
    now
  );
}

export function previewMissingSignalStatusForTest({ expiresAt, now = new Date() }: { expiresAt?: Date | null; now?: Date }) {
  return expiresAt && expiresAt < now ? "expired" : "resolved";
}

export function formatSignalLevel(level: BusinessSignalLevel) {
  const labels: Record<BusinessSignalLevel, string> = {
    info: "INFO",
    atencion: "ATENCIÓN",
    importante: "IMPORTANTE",
    critico: "CRÍTICO"
  };
  return labels[level];
}

export function signalStatusLabel(status: BusinessSignalStatus) {
  const labels: Record<BusinessSignalStatus, string> = {
    active: "Activa",
    snoozed: "Pospuesta",
    dismissed: "Descartada",
    resolved: "Resuelta",
    expired: "Expirada"
  };
  return labels[status];
}

export function signalSourceLabel(source: BusinessSignalSource) {
  const labels: Record<BusinessSignalSource, string> = {
    crm: "CRM",
    obras: "Obras",
    facturas: "Facturas",
    cobros: "Cobros",
    tesoreria: "Tesorería",
    agenda: "Agenda",
    documentos: "Documentos",
    materiales: "Materiales",
    rentabilidad: "Rentabilidad",
    chat: "Chat",
    recordatorios: "Recordatorios",
    visitas: "Visitas",
    gastos: "Gastos",
    presupuestos: "Presupuestos",
    datos: "Datos"
  };
  return labels[source];
}

export function levelForScore(score: number): BusinessSignalLevel {
  if (score >= 85) return "critico";
  if (score >= 65) return "importante";
  if (score >= 35) return "atencion";
  return "info";
}

export function signalLevelRank(level: BusinessSignalLevel) {
  return { info: 1, atencion: 2, importante: 3, critico: 4 }[level];
}

async function loadBusinessSignalInput(now: Date): Promise<BusinessSignalsInput> {
  const [
    invoices,
    clients,
    budgets,
    works,
    reminders,
    agendaEvents,
    documents,
    expenses,
    preferences,
    treasury
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: { estado: { notIn: ["borrador", "pendiente_emitir"] } },
      include: {
        client: { select: { id: true, nombre: true } },
        work: { select: { id: true, titulo: true } },
        payments: { select: { id: true, importe: true, fecha: true } }
      },
      orderBy: { fechaVencimiento: "asc" },
      take: 300
    }),
    prisma.client.findMany({
      where: { archivadoAt: null },
      include: {
        invoices: {
          where: { estado: { notIn: ["borrador", "pendiente_emitir"] } },
          include: { payments: { select: { id: true, importe: true, fecha: true } } }
        },
        budgets: true,
        works: { where: { archivada: false }, select: { id: true, titulo: true, estado: true } },
        reminders: { select: { id: true, tipo: true, estado: true, fechaProgramada: true, mensaje: true, clienteId: true, obraId: true, facturaId: true, presupuestoId: true } },
        agendaEvents: { select: { id: true, titulo: true, tipo: true, estado: true, fechaInicio: true, requiereConfirmacion: true, confirmadoPorUsuario: true, clienteId: true, obraId: true, facturaId: true, presupuestoId: true } }
      },
      orderBy: { nombre: "asc" },
      take: 250
    }),
    prisma.budget.findMany({
      where: { estado: { in: ["borrador", "pendiente_revision", "enviado", "visto", "pendiente_respuesta"] } },
      include: {
        client: { select: { id: true, nombre: true } },
        work: { select: { id: true, titulo: true } }
      },
      orderBy: { fechaCreacion: "desc" },
      take: 250
    }),
    prisma.work.findMany({
      where: { archivada: false },
      include: {
        client: { select: { id: true, nombre: true } },
        invoices: { include: { client: { select: { id: true, nombre: true } }, payments: { select: { id: true, importe: true, fecha: true } } } },
        budgets: { include: { client: { select: { id: true, nombre: true } } } },
        expenses: { select: { id: true, importe: true, categoria: true } },
        materials: true,
        reminders: { select: { id: true, tipo: true, estado: true, fechaProgramada: true, mensaje: true, clienteId: true, obraId: true, facturaId: true, presupuestoId: true } },
        agendaEvents: { select: { id: true, titulo: true, tipo: true, estado: true, fechaInicio: true, requiereConfirmacion: true, confirmadoPorUsuario: true, clienteId: true, obraId: true, facturaId: true, presupuestoId: true } },
        documents: { select: { id: true, nombre: true, url: true, fecha: true } },
        repositoryDocuments: { select: { id: true, name: true, url: true, category: true, createdAt: true, clientId: true, workId: true, budgetId: true, invoiceId: true, metadata: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 250
    }),
    prisma.reminder.findMany({
      where: { estado: { in: ["borrador", "pendiente_confirmacion", "programado", "fallido"] } },
      include: {
        client: { select: { id: true, nombre: true } },
        work: { select: { id: true, titulo: true } },
        invoice: { select: { id: true, numero: true } },
        budget: { select: { id: true, numero: true } }
      },
      orderBy: { fechaProgramada: "asc" },
      take: 250
    }),
    prisma.eventoAgenda.findMany({
      where: { estado: { notIn: ["realizado", "cancelado"] } },
      include: {
        client: { select: { id: true, nombre: true } },
        work: { select: { id: true, titulo: true } },
        invoice: { select: { id: true, numero: true } },
        budget: { select: { id: true, numero: true } }
      },
      orderBy: { fechaInicio: "asc" },
      take: 250
    }),
    prisma.document.findMany({
      where: { archivedAt: null },
      include: {
        client: { select: { id: true, nombre: true } },
        work: { select: { id: true, titulo: true } },
        budget: { select: { id: true, numero: true } },
        invoice: { select: { id: true, numero: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 250
    }),
    prisma.expense.findMany({
      include: {
        client: { select: { id: true, nombre: true } },
        work: { select: { id: true, titulo: true } }
      },
      orderBy: { fecha: "desc" },
      take: 300
    }),
    prisma.businessSignalPreference.findMany({ where: { userKey: "default" } }).catch((error) => {
      if (isBusinessSignalTableMissing(error)) return [];
      throw error;
    }),
    getTreasuryOverview({ horizon: "30d", scenario: "base", now }).catch(() => null)
  ]);

  return {
    invoices,
    clients,
    budgets,
    works,
    reminders,
    agendaEvents,
    documents,
    expenses,
    preferences,
    treasuryAlerts: treasury?.alerts ?? [],
    treasuryQualityIssues: treasury?.qualityIssues ?? []
  };
}

async function loadOrSyncSignalStates(drafts: BusinessSignalDraft[], shouldSync: boolean, now: Date) {
  try {
    return shouldSync
      ? await syncBusinessSignalStates(drafts, now)
      : await loadSignalStates(drafts.map((signal) => signal.fingerprint));
  } catch (error) {
    if (isBusinessSignalTableMissing(error)) return new Map<string, SignalState>();
    throw error;
  }
}

async function loadSignalStates(fingerprints: string[]) {
  if (!fingerprints.length) return new Map<string, SignalState>();
  const states = await prisma.businessSignalState.findMany({ where: { fingerprint: { in: fingerprints } } });
  return new Map(states.map((state) => [state.fingerprint, state]));
}

async function syncBusinessSignalStates(drafts: BusinessSignalDraft[], now: Date) {
  const fingerprints = drafts.map((signal) => signal.fingerprint);
  const existing = await prisma.businessSignalState.findMany();
  const existingByFingerprint = new Map(existing.map((state) => [state.fingerprint, state]));
  const current = new Set(fingerprints);

  await prisma.$transaction(async (tx) => {
    for (const signal of drafts) {
      const state = existingByFingerprint.get(signal.fingerprint);
      const nextStatus = nextStatusForCurrentSignal(state, signal, now);
      const baseData = {
        type: signal.type,
        level: signal.level,
        source: signal.source,
        ruleId: signal.ruleId,
        ruleVersion: signal.ruleVersion,
        entityType: signal.entity?.type ?? null,
        entityId: signal.entity?.id ?? null,
        clientId: signal.client?.id ?? null,
        workId: signal.work?.id ?? null,
        invoiceId: signal.entity?.type === "factura" ? signal.entity.id : null,
        budgetId: signal.entity?.type === "presupuesto" ? signal.entity.id : null,
        title: signal.title,
        summary: signal.summary,
        lastPriority: signal.prioridad,
        amount: signal.relatedAmount,
        startsAt: signal.startsAt,
        expiresAt: signal.expiresAt,
        lastDetectedAt: now,
        explanation: signal.explanation as unknown as Prisma.InputJsonValue,
        suggestedActions: signal.suggestedActions as unknown as Prisma.InputJsonValue,
        metadata: signalMetadata(signal)
      } satisfies Prisma.BusinessSignalStateUpdateInput;

      if (!state) {
        await tx.businessSignalState.create({
          data: {
            fingerprint: signal.fingerprint,
            ...baseData,
            status: "active",
            firstDetectedAt: signal.detectedAt,
            shownAt: now
          }
        });
        continue;
      }

      await tx.businessSignalState.update({
        where: { fingerprint: signal.fingerprint },
        data: {
          ...baseData,
          status: nextStatus,
          shownAt: state.shownAt ?? now,
          snoozedUntil: nextStatus === "snoozed" ? state.snoozedUntil : null,
          snoozeReason: nextStatus === "snoozed" ? state.snoozeReason : null,
          resolvedAt: nextStatus === "active" && state.status === "resolved" ? null : state.resolvedAt,
          resolution: nextStatus === "active" && state.status === "resolved" ? null : state.resolution
        }
      });
    }

    const toResolve = existing.filter((state) => !current.has(state.fingerprint) && state.status !== "resolved");
    for (const state of toResolve) {
      const missingStatus = previewMissingSignalStatusForTest({ expiresAt: state.expiresAt, now });
      await tx.businessSignalState.update({
        where: { fingerprint: state.fingerprint },
        data: {
          status: missingStatus,
          resolvedAt: missingStatus === "expired" ? state.resolvedAt : now,
          resolution: missingStatus === "expired" ? "Expirada automáticamente: la señal temporal ya no tiene relevancia operativa." : "Resuelta automáticamente: la condición que generaba la señal ya no aparece en los datos actuales.",
          snoozedUntil: null,
          snoozeReason: null
        }
      });
    }
  });

  const states = await prisma.businessSignalState.findMany();
  return new Map(states.map((state) => [state.fingerprint, state]));
}

function mergeSignalStates(drafts: BusinessSignalDraft[], states: Map<string, SignalState>): BusinessSignal[] {
  const current = new Set(drafts.map((signal) => signal.fingerprint));
  const activeSignals = drafts.map((signal) => {
    const state = states.get(signal.fingerprint);
    const status = state?.status ?? "active";
    return {
      ...signal,
      id: state?.id ?? signal.fingerprint,
      status,
      statusLabel: signalStatusLabel(status),
      shownAt: state?.shownAt ?? null,
      dismissedAt: state?.dismissedAt ?? null,
      dismissedReason: state?.dismissedReason ?? null,
      dismissedBy: state?.dismissedBy ?? null,
      snoozedUntil: state?.snoozedUntil ?? null,
      snoozeReason: state?.snoozeReason ?? null,
      resolvedAt: state?.resolvedAt ?? null,
      resolution: state?.resolution ?? null
    };
  });

  const historicalSignals = [...states.values()]
    .filter((state) => !current.has(state.fingerprint) && state.status !== "active")
    .map(signalFromState);

  return [...activeSignals, ...historicalSignals];
}

function signalFromState(state: SignalState): BusinessSignal {
  const metadata = jsonRecord(state.metadata);
  const entityFromMetadata = businessEntityFromJson(metadata.entity);
  const clientFromMetadata = businessEntityFromJson(metadata.client);
  const workFromMetadata = businessEntityFromJson(metadata.work);
  const entityFallback = state.entityType && state.entityId
    ? entity(state.entityType, state.entityId, state.title, hrefForStateEntity(state.entityType, state.entityId))
    : null;
  const clientFallback = state.clientId ? entity("cliente", state.clientId, "Cliente", `/clientes/${state.clientId}`) : null;
  const workFallback = state.workId ? entity("obra", state.workId, "Obra", `/obras/${state.workId}`) : null;
  const explanation = explanationFromJson(state.explanation, state);
  const suggestedActions = actionsFromJson(state.suggestedActions, entityFromMetadata ?? entityFallback);
  const score = clampScore(state.lastPriority);
  const date = state.startsAt ?? state.lastDetectedAt ?? state.firstDetectedAt;

  return {
    id: state.id,
    fingerprint: state.fingerprint,
    type: state.type,
    tipo: state.type.replaceAll("_", " "),
    title: state.title,
    summary: state.summary ?? explanation.summary,
    level: state.level,
    nivel: state.level,
    levelText: formatSignalLevel(state.level),
    ruleId: state.ruleId ?? state.type,
    ruleVersion: state.ruleVersion ?? "unknown",
    prioridad: score,
    score,
    date,
    fecha: date,
    startsAt: state.startsAt,
    detectedAt: state.lastDetectedAt ?? state.firstDetectedAt,
    source: state.source,
    sourceLabel: signalSourceLabel(state.source),
    entity: entityFromMetadata ?? entityFallback,
    client: clientFromMetadata ?? clientFallback,
    work: workFromMetadata ?? workFallback,
    relatedAmount: state.amount,
    status: state.status,
    statusLabel: signalStatusLabel(state.status),
    explanation,
    suggestedActions,
    expiresAt: state.expiresAt,
    shownAt: state.shownAt,
    dismissedAt: state.dismissedAt,
    dismissedReason: state.dismissedReason,
    dismissedBy: state.dismissedBy,
    snoozedUntil: state.snoozedUntil,
    snoozeReason: state.snoozeReason,
    resolvedAt: state.resolvedAt,
    resolution: state.resolution
  };
}

function filterAndGroupSignals(signals: BusinessSignal[], params: BusinessSignalsParams, now: Date): BusinessSignalsResult {
  const status = params.status ?? "active";
  const level = params.level ?? "all";
  const source = params.source ?? "all";
  const q = (params.q ?? "").trim().toLowerCase();
  const limit = params.limit ?? 150;

  const filtered = signals
    .filter((signal) => {
      if (status === "history") return signal.status !== "active";
      if (status !== "all" && signal.status !== status) return false;
      if (level !== "all" && signal.level !== level) return false;
      if (source !== "all" && signal.source !== source) return false;
      if (!q) return true;
      const haystack = [
        signal.title,
        signal.summary,
        signal.type,
        signal.sourceLabel,
        signal.entity?.label,
        signal.client?.label,
        signal.work?.label,
        signal.explanation.why,
        signal.explanation.rule
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    })
    .sort(compareSignals)
    .slice(0, limit);

  return {
    signals: filtered,
    groups: groupSignals(filtered),
    summary: summarizeSignals(signals),
    generatedAt: now,
    filters: {
      status,
      level,
      source,
      q,
      includeResolved: params.includeResolved ?? false,
      sync: params.sync ?? true,
      limit
    },
    definitions: BUSINESS_SIGNAL_RULES
  };
}

function buildInvoiceSignals(invoices: SignalInvoice[], clients: SignalClient[], now: Date): BusinessSignalDraft[] {
  const byClient = new Map(clients.map((client) => [client.id, client]));
  const invoicesByClient = groupBy(invoices, (invoice) => invoice.clienteId ?? invoice.client?.id ?? "");
  const today = startOfDay(now);
  const signals: BusinessSignalDraft[] = [];

  for (const invoice of invoices.filter((item) => isBillableInvoiceStatus(item.estado))) {
    const balance = invoiceBalance(invoice);
    const pending = balance.pending;
    if (pending <= 0 && balance.overpaid <= 0) continue;

    const due = toDate(invoice.fechaVencimiento);
    const client = invoice.client ?? byClient.get(invoice.clienteId ?? "") ?? null;
    const clientInvoices = invoicesByClient.get(invoice.clienteId ?? invoice.client?.id ?? "") ?? [];
    const overdueCount = clientInvoices.filter((item) => {
      const itemDue = toDate(item.fechaVencimiento);
      return invoiceBalance(item).pending > 0 && Boolean(itemDue && itemDue < today);
    }).length;
    const clientPending = clientInvoices.reduce((total, item) => total + invoiceBalance(item).pending, 0);

    if (pending > 0 && due && due < today) {
      const days = diffDays(today, due);
      signals.push(makeSignal({
        fingerprint: `invoice:overdue:${invoice.id}`,
        type: "invoice_overdue",
        tipo: "Factura vencida",
        source: "facturas",
        title: `Factura ${invoice.numero} vencida`,
        summary: `${pendingEuros(pending)} pendientes desde hace ${days} días.`,
        date: due,
        entity: entity("factura", invoice.id, invoice.numero, `/dinero/${invoice.id}`),
        client: client ? entity("cliente", client.id, client.nombre, `/clientes/${client.id}`) : null,
        work: invoice.work ? entity("obra", invoice.work.id, invoice.work.titulo, `/obras/${invoice.work.id}`) : null,
        relatedAmount: pending,
        expiresAt: null,
        scoreBreakdown: [
          { label: "Riesgo base", value: 30, detail: "Factura válida con saldo pendiente y vencimiento pasado." },
          { label: "Antigüedad", value: overdueDaysScore(days), detail: `${days} días vencida.` },
          { label: "Impacto económico", value: amountScore(pending, [500, 2000, 5000]), detail: `${pendingEuros(pending)} pendientes.` },
          { label: "Cliente acumulado", value: overdueCount > 1 ? 10 : 0, detail: overdueCount > 1 ? `${overdueCount} facturas vencidas del cliente.` : "No hay acumulación de vencidas del mismo cliente." },
          { label: "Estado reclamado", value: normalizeStatus(invoice.estado) === "reclamada" ? 5 : 0, detail: normalizeStatus(invoice.estado) === "reclamada" ? "La factura ya está reclamada." : "No consta reclamada." }
        ],
        explanation: {
          why: `La factura ${invoice.numero} tiene saldo pendiente y venció hace ${days} días.`,
          dataUsed: [`Pendiente ${pendingEuros(pending)}`, `Vencimiento ${formatDate(due)}`, `Cliente pendiente ${pendingEuros(clientPending)}`, `Estado ${invoice.estado}`],
          rule: "invoice_overdue: saldo pendiente > 0 y fechaVencimiento anterior a hoy.",
          modules: ["Facturas", "Cobros", "CRM"],
          consequence: "Si no se revisa, aumenta el riesgo de cobro y puede distorsionar la previsión de tesorería."
        },
        suggestedActions: [
          { label: "Abrir factura", href: `/dinero/${invoice.id}`, kind: "open" },
          { label: "Registrar pago", href: `/gestion?tipo=pago&facturaId=${invoice.id}&returnTo=/alertas`, kind: "register" }
        ]
      }));
    }

    if (pending > 0 && due && due >= today && diffDays(due, today) <= 7) {
      const daysLeft = diffDays(due, today);
      signals.push(makeSignal({
        fingerprint: `invoice:due-soon:${invoice.id}`,
        type: "invoice_due_soon",
        tipo: "Factura próxima a vencer",
        source: "cobros",
        title: `Factura ${invoice.numero} vence pronto`,
        summary: `${pendingEuros(pending)} pendientes; vence ${daysLeft === 0 ? "hoy" : `en ${daysLeft} días`}.`,
        date: due,
        entity: entity("factura", invoice.id, invoice.numero, `/dinero/${invoice.id}`),
        client: client ? entity("cliente", client.id, client.nombre, `/clientes/${client.id}`) : null,
        work: invoice.work ? entity("obra", invoice.work.id, invoice.work.titulo, `/obras/${invoice.work.id}`) : null,
        relatedAmount: pending,
        expiresAt: addDays(due, 1),
        scoreBreakdown: [
          { label: "Riesgo base", value: 18, detail: "Factura pendiente dentro de los próximos 7 días." },
          { label: "Urgencia", value: Math.max(4, 18 - daysLeft * 2), detail: `${daysLeft} días hasta vencimiento.` },
          { label: "Impacto económico", value: amountScore(pending, [500, 2000, 5000]), detail: `${pendingEuros(pending)} pendientes.` },
          { label: "Dependencia cliente", value: clientPending > pending ? 6 : 0, detail: clientPending > pending ? "El cliente tiene más saldo pendiente." : "Solo consta este saldo principal." }
        ],
        explanation: {
          why: `La factura ${invoice.numero} sigue abierta y vence ${daysLeft === 0 ? "hoy" : `en ${daysLeft} días`}.`,
          dataUsed: [`Pendiente ${pendingEuros(pending)}`, `Vencimiento ${formatDate(due)}`, `Estado ${invoice.estado}`],
          rule: "invoice_due_soon: saldo pendiente > 0 y vencimiento entre hoy y 7 días.",
          modules: ["Facturas", "Tesorería"],
          consequence: "Si no se prepara el seguimiento, puede convertirse en vencida y afectar al forecast de caja."
        },
        suggestedActions: [{ label: "Abrir factura", href: `/dinero/${invoice.id}`, kind: "open" }]
      }));
    }

    if (balance.paid > 0 && pending > 0 && due && diffDays(today, due) >= 5) {
      signals.push(makeSignal({
        fingerprint: `invoice:partial:${invoice.id}`,
        type: "partial_payment_stalled",
        tipo: "Pago parcial pendiente",
        source: "cobros",
        title: `Factura ${invoice.numero} con pago parcial`,
        summary: `Cobrado ${pendingEuros(balance.paid)} y quedan ${pendingEuros(pending)} pendientes.`,
        date: due,
        entity: entity("factura", invoice.id, invoice.numero, `/dinero/${invoice.id}`),
        client: client ? entity("cliente", client.id, client.nombre, `/clientes/${client.id}`) : null,
        work: invoice.work ? entity("obra", invoice.work.id, invoice.work.titulo, `/obras/${invoice.work.id}`) : null,
        relatedAmount: pending,
        expiresAt: null,
        scoreBreakdown: [
          { label: "Riesgo base", value: 22, detail: "Hay pagos registrados pero no cubren el total." },
          { label: "Antigüedad", value: overdueDaysScore(Math.max(0, diffDays(today, due))) / 2, detail: `Vencimiento ${formatDate(due)}.` },
          { label: "Saldo restante", value: amountScore(pending, [500, 2000, 5000]), detail: `${pendingEuros(pending)} siguen abiertos.` }
        ],
        explanation: {
          why: `La factura ${invoice.numero} tiene pagos parciales pero todavía mantiene saldo pendiente.`,
          dataUsed: [`Pagado ${pendingEuros(balance.paid)}`, `Pendiente ${pendingEuros(pending)}`, `Vencimiento ${formatDate(due)}`],
          rule: "partial_payment_stalled: pagos acumulados > 0 y saldo pendiente > 0.",
          modules: ["Facturas", "Cobros"],
          consequence: "Puede dar falsa sensación de cobro completo si no se revisa el saldo restante."
        },
        suggestedActions: [{ label: "Abrir factura", href: `/dinero/${invoice.id}`, kind: "open" }]
      }));
    }

    if (balance.overpaid > 0) {
      signals.push(makeSignal({
        fingerprint: `invoice:overpaid:${invoice.id}`,
        type: "invoice_overpaid",
        tipo: "Cobro superior al total",
        source: "datos",
        title: `Factura ${invoice.numero} tiene sobrepago`,
        summary: `Los pagos superan el total en ${pendingEuros(balance.overpaid)}.`,
        date: due,
        entity: entity("factura", invoice.id, invoice.numero, `/dinero/${invoice.id}`),
        client: client ? entity("cliente", client.id, client.nombre, `/clientes/${client.id}`) : null,
        work: invoice.work ? entity("obra", invoice.work.id, invoice.work.titulo, `/obras/${invoice.work.id}`) : null,
        relatedAmount: balance.overpaid,
        expiresAt: null,
        scoreBreakdown: [
          { label: "Datos inconsistentes", value: 30, detail: "Los pagos registrados superan el total de factura." },
          { label: "Importe", value: amountScore(balance.overpaid, [50, 250, 1000]), detail: `${pendingEuros(balance.overpaid)} de diferencia.` }
        ],
        explanation: {
          why: `Los pagos de la factura ${invoice.numero} superan el total registrado.`,
          dataUsed: [`Total ${pendingEuros(invoice.total)}`, `Pagado ${pendingEuros(balance.paid)}`],
          rule: "invoice_overpaid: pagos acumulados > total de factura.",
          modules: ["Facturas", "Cobros", "Datos"],
          consequence: "La deuda del cliente y los informes de cobro pueden quedar distorsionados."
        },
        suggestedActions: [{ label: "Abrir factura", href: `/dinero/${invoice.id}`, kind: "open" }]
      }));
    }
  }

  return signals;
}

function buildClientSignals(clients: SignalClient[], invoices: SignalInvoice[], now: Date): BusinessSignalDraft[] {
  const today = startOfDay(now);
  const invoicesByClient = groupBy(invoices, (invoice) => invoice.clienteId ?? invoice.client?.id ?? "");
  const totalPending = invoices.reduce((total, invoice) => total + invoiceBalance(invoice).pending, 0);
  const signals: BusinessSignalDraft[] = [];

  for (const client of clients) {
    const clientInvoices = invoicesByClient.get(client.id) ?? client.invoices ?? [];
    const pending = clientInvoices.reduce((total, invoice) => total + invoiceBalance(invoice).pending, 0);
    const overdue = clientInvoices.filter((invoice) => {
      const due = toDate(invoice.fechaVencimiento);
      return invoiceBalance(invoice).pending > 0 && Boolean(due && due < today);
    });

    if (pending > 0 && totalPending > 0) {
      const share = pending / totalPending * 100;
      if (share >= 35) {
        signals.push(makeSignal({
          fingerprint: `client:debt-concentration:${client.id}`,
          type: "client_debt_concentration",
          tipo: "Concentración de deuda",
          source: "crm",
          title: `${client.nombre} concentra deuda pendiente`,
          summary: `${pendingEuros(pending)} pendientes; ${round(share)}% del saldo abierto total.`,
          date: latestDate(clientInvoices.map((invoice) => invoice.fechaVencimiento)),
          entity: entity("cliente", client.id, client.nombre, `/clientes/${client.id}`),
          client: entity("cliente", client.id, client.nombre, `/clientes/${client.id}`),
          work: null,
          relatedAmount: pending,
          expiresAt: null,
          scoreBreakdown: [
            { label: "Concentración", value: share >= 70 ? 70 : share >= 50 ? 55 : 40, detail: `${round(share)}% del pendiente total.` },
            { label: "Impacto económico", value: amountScore(pending, [1000, 5000, 10000]), detail: `${pendingEuros(pending)} abiertos.` },
            { label: "Vencidas", value: overdue.length >= 2 ? 10 : overdue.length === 1 ? 5 : 0, detail: `${overdue.length} facturas vencidas.` }
          ],
          explanation: {
            why: `${client.nombre} concentra ${round(share)}% del saldo pendiente registrado.`,
            dataUsed: [`Pendiente cliente ${pendingEuros(pending)}`, `Pendiente total ${pendingEuros(totalPending)}`, `${overdue.length} vencidas`],
            rule: "client_debt_concentration: pendiente del cliente >= 35% del pendiente total.",
            modules: ["CRM", "Facturas", "Cobros"],
            consequence: "La caja depende demasiado de un solo cliente; si se retrasa, impacta en tesorería."
          },
          suggestedActions: [
            { label: "Ver cliente", href: `/clientes/${client.id}`, kind: "open" },
            { label: "Ver cobros", href: "/dinero?filtro=pendientes", kind: "review" }
          ]
        }));
      }
    }

    if (overdue.length >= 2) {
      const overdueAmount = overdue.reduce((total, invoice) => total + invoiceBalance(invoice).pending, 0);
      signals.push(makeSignal({
        fingerprint: `client:multiple-overdue:${client.id}`,
        type: "client_multiple_overdue",
        tipo: "Cliente con varias vencidas",
        source: "cobros",
        title: `${client.nombre} acumula facturas vencidas`,
        summary: `${overdue.length} facturas vencidas por ${pendingEuros(overdueAmount)}.`,
        date: oldestDate(overdue.map((invoice) => invoice.fechaVencimiento)),
        entity: entity("cliente", client.id, client.nombre, `/clientes/${client.id}`),
        client: entity("cliente", client.id, client.nombre, `/clientes/${client.id}`),
        work: null,
        relatedAmount: overdueAmount,
        expiresAt: null,
        scoreBreakdown: [
          { label: "Base", value: 35, detail: "El cliente tiene varias facturas vencidas." },
          { label: "Número de incidencias", value: Math.min(20, overdue.length * 5), detail: `${overdue.length} vencidas.` },
          { label: "Importe vencido", value: amountScore(overdueAmount, [500, 2000, 5000]), detail: `${pendingEuros(overdueAmount)} vencidos.` }
        ],
        explanation: {
          why: `${client.nombre} acumula ${overdue.length} facturas vencidas.`,
          dataUsed: overdue.slice(0, 3).map((invoice) => `${invoice.numero}: ${pendingEuros(invoiceBalance(invoice).pending)}`),
          rule: "client_multiple_overdue: cliente con dos o más facturas vencidas y saldo pendiente.",
          modules: ["CRM", "Facturas", "Cobros"],
          consequence: "El seguimiento individual por factura puede perder contexto; conviene revisar el cliente completo."
        },
        suggestedActions: [{ label: "Ver cliente", href: `/clientes/${client.id}`, kind: "open" }]
      }));
    }

    const missing = [
      client.nifCif ? null : "NIF/CIF",
      client.telefono ? null : "teléfono",
      client.direccion ? null : "dirección"
    ].filter(Boolean) as string[];
    const hasCommercialActivity = (client.budgets?.length ?? 0) > 0 || clientInvoices.length > 0 || (client.works?.length ?? 0) > 0;
    if (missing.length && hasCommercialActivity) {
      signals.push(makeSignal({
        fingerprint: `client:data:${client.id}`,
        type: "client_data_incomplete",
        tipo: "Datos de cliente incompletos",
        source: "datos",
        title: `${client.nombre} tiene datos incompletos`,
        summary: `Faltan ${missing.join(", ")}.`,
        date: toDate(client.ultimaInteraccion) ?? null,
        entity: entity("cliente", client.id, client.nombre, `/clientes/${client.id}`),
        client: entity("cliente", client.id, client.nombre, `/clientes/${client.id}`),
        work: null,
        relatedAmount: pending || null,
        expiresAt: null,
        scoreBreakdown: [
          { label: "Base", value: 20, detail: "Cliente activo con datos incompletos." },
          { label: "Campos críticos", value: missing.includes("NIF/CIF") ? 12 : 6, detail: `Faltan ${missing.join(", ")}.` },
          { label: "Actividad", value: hasCommercialActivity ? 8 : 0, detail: "Tiene presupuestos, facturas u obras asociadas." }
        ],
        explanation: {
          why: `${client.nombre} tiene actividad registrada pero faltan datos operativos o fiscales.`,
          dataUsed: [`Faltan ${missing.join(", ")}`, `${clientInvoices.length} facturas`, `${client.budgets?.length ?? 0} presupuestos`],
          rule: "client_data_incomplete: cliente no archivado con actividad y campos básicos vacíos.",
          modules: ["CRM", "Datos", "Documentos"],
          consequence: "Puede bloquear documentos, facturación o contacto de seguimiento."
        },
        suggestedActions: [{ label: "Completar cliente", href: `/clientes/${client.id}`, kind: "complete" }]
      }));
    }
  }

  return signals;
}

function buildBudgetSignals(budgets: SignalBudget[], now: Date): BusinessSignalDraft[] {
  const today = startOfDay(now);
  const signals: BusinessSignalDraft[] = [];
  for (const budget of budgets) {
    const status = normalizeStatus(budget.estado);
    if (!PENDING_BUDGET_STATUSES.includes(status)) continue;
    const sentAt = toDate(budget.fechaEnvio ?? budget.fechaCreacion);
    const validUntil = toDate(budget.fechaValidez);
    const daysWaiting = sentAt ? diffDays(today, sentAt) : 0;
    const client = budget.client;

    if (daysWaiting >= 14) {
      signals.push(makeSignal({
        fingerprint: `budget:stalled:${budget.id}`,
        type: "budget_stalled",
        tipo: "Presupuesto parado",
        source: "presupuestos",
        title: `Presupuesto ${budget.numero} sin respuesta`,
        summary: `${budget.titulo} lleva ${daysWaiting} días en estado ${budget.estado}.`,
        date: sentAt,
        entity: entity("presupuesto", budget.id, budget.numero, `/presupuestos/${budget.id}`),
        client: client ? entity("cliente", client.id, client.nombre, `/clientes/${client.id}`) : null,
        work: budget.work ? entity("obra", budget.work.id, budget.work.titulo, `/obras/${budget.work.id}`) : null,
        relatedAmount: budget.total,
        expiresAt: validUntil,
        scoreBreakdown: [
          { label: "Base", value: 22, detail: "Presupuesto pendiente de revisión o respuesta." },
          { label: "Tiempo parado", value: daysWaiting >= 30 ? 28 : 14, detail: `${daysWaiting} días desde envío o creación.` },
          { label: "Importe", value: amountScore(budget.total, [1000, 5000, 10000]), detail: `${pendingEuros(budget.total)} de oportunidad.` }
        ],
        explanation: {
          why: `El presupuesto ${budget.numero} lleva ${daysWaiting} días sin decisión registrada.`,
          dataUsed: [`Estado ${budget.estado}`, `Importe ${pendingEuros(budget.total)}`, `Fecha base ${sentAt ? formatDate(sentAt) : "sin fecha"}`],
          rule: "budget_stalled: presupuesto pendiente durante 14 días o más.",
          modules: ["Presupuestos", "CRM"],
          consequence: "Puede perderse la oportunidad comercial o quedarse sin seguimiento."
        },
        suggestedActions: [{ label: "Abrir presupuesto", href: `/presupuestos/${budget.id}`, kind: "open" }]
      }));
    }

    if (validUntil && validUntil < today) {
      signals.push(makeSignal({
        fingerprint: `budget:expired-open:${budget.id}`,
        type: "budget_expired_open",
        tipo: "Presupuesto caducado sin cerrar",
        source: "presupuestos",
        title: `Presupuesto ${budget.numero} superó su validez`,
        summary: `Validez vencida el ${formatDate(validUntil)} y sigue en ${budget.estado}.`,
        date: validUntil,
        entity: entity("presupuesto", budget.id, budget.numero, `/presupuestos/${budget.id}`),
        client: client ? entity("cliente", client.id, client.nombre, `/clientes/${client.id}`) : null,
        work: budget.work ? entity("obra", budget.work.id, budget.work.titulo, `/obras/${budget.work.id}`) : null,
        relatedAmount: budget.total,
        expiresAt: null,
        scoreBreakdown: [
          { label: "Base", value: 35, detail: "La fecha de validez ha pasado." },
          { label: "Días vencido", value: Math.min(20, diffDays(today, validUntil)), detail: `${diffDays(today, validUntil)} días desde validez.` },
          { label: "Importe", value: amountScore(budget.total, [1000, 5000, 10000]), detail: `${pendingEuros(budget.total)} de presupuesto.` }
        ],
        explanation: {
          why: `El presupuesto ${budget.numero} ya no está dentro de su fecha de validez.`,
          dataUsed: [`Validez ${formatDate(validUntil)}`, `Estado ${budget.estado}`, `Total ${pendingEuros(budget.total)}`],
          rule: "budget_expired_open: fechaValidez anterior a hoy y estado pendiente.",
          modules: ["Presupuestos", "CRM"],
          consequence: "Puede necesitar revisión antes de aceptarlo, porque precios y costes pueden haber cambiado."
        },
        suggestedActions: [{ label: "Abrir presupuesto", href: `/presupuestos/${budget.id}`, kind: "open" }]
      }));
    } else if (validUntil && diffDays(validUntil, today) <= 5) {
      signals.push(makeSignal({
        fingerprint: `budget:expires-soon:${budget.id}`,
        type: "budget_expires_soon",
        tipo: "Presupuesto próximo a caducar",
        source: "presupuestos",
        title: `Presupuesto ${budget.numero} caduca pronto`,
        summary: `Quedan ${diffDays(validUntil, today)} días de validez.`,
        date: validUntil,
        entity: entity("presupuesto", budget.id, budget.numero, `/presupuestos/${budget.id}`),
        client: client ? entity("cliente", client.id, client.nombre, `/clientes/${client.id}`) : null,
        work: budget.work ? entity("obra", budget.work.id, budget.work.titulo, `/obras/${budget.work.id}`) : null,
        relatedAmount: budget.total,
        expiresAt: addDays(validUntil, 1),
        scoreBreakdown: [
          { label: "Base", value: 18, detail: "Presupuesto pendiente cerca de su vencimiento." },
          { label: "Urgencia", value: Math.max(4, 14 - diffDays(validUntil, today) * 2), detail: `${diffDays(validUntil, today)} días restantes.` },
          { label: "Importe", value: amountScore(budget.total, [1000, 5000, 10000]), detail: `${pendingEuros(budget.total)} de oportunidad.` }
        ],
        explanation: {
          why: `El presupuesto ${budget.numero} está pendiente y caduca pronto.`,
          dataUsed: [`Validez ${formatDate(validUntil)}`, `Estado ${budget.estado}`, `Total ${pendingEuros(budget.total)}`],
          rule: "budget_expires_soon: presupuesto pendiente con fechaValidez dentro de 5 días.",
          modules: ["Presupuestos", "CRM"],
          consequence: "Si no se revisa, puede caducar sin seguimiento comercial."
        },
        suggestedActions: [{ label: "Abrir presupuesto", href: `/presupuestos/${budget.id}`, kind: "open" }]
      }));
    }
  }
  return signals;
}

function buildWorkSignals(works: SignalWork[], now: Date): BusinessSignalDraft[] {
  const today = startOfDay(now);
  const signals: BusinessSignalDraft[] = [];
  for (const work of works) {
    const status = normalizeStatus(work.estado);
    const client = work.client;
    const workEntity = entity("obra", work.id, work.titulo, `/obras/${work.id}`);
    const clientEntity = client ? entity("cliente", client.id, client.nombre, `/clientes/${client.id}`) : null;
    const updatedAt = toDate(work.updatedAt ?? work.fechaCreacion);
    const daysSinceUpdate = updatedAt ? diffDays(today, startOfDay(updatedAt)) : 0;
    const financial = calculateWorkFinancials(work);
    const financialImpact = financial.pending || financial.invoiced || financial.budgeted || work.presupuestoAprobado || 0;

    if (["pausada", "parada", "pendiente_material", "pendiente_cliente"].includes(status)) {
      signals.push(makeSignal({
        fingerprint: `work:blocked:${work.id}`,
        type: "work_blocked",
        tipo: "Obra bloqueada",
        source: "obras",
        title: `${work.titulo} está en ${work.estado}`,
        summary: `Estado bloqueante; última actualización hace ${daysSinceUpdate} días.`,
        date: updatedAt,
        entity: workEntity,
        client: clientEntity,
        work: workEntity,
        relatedAmount: financialImpact || null,
        expiresAt: null,
        scoreBreakdown: [
          { label: "Estado bloqueante", value: status === "parada" ? 45 : 35, detail: `Estado actual ${work.estado}.` },
          { label: "Prioridad obra", value: priorityScore(work.prioridad), detail: `Prioridad ${work.prioridad ?? "media"}.` },
          { label: "Sin actualización", value: Math.min(20, Math.floor(daysSinceUpdate / 3) * 4), detail: `${daysSinceUpdate} días desde actualización.` },
          { label: "Impacto", value: amountScore(financialImpact, [1000, 5000, 10000]), detail: `${pendingEuros(financialImpact)} asociados.` }
        ],
        explanation: {
          why: `La obra ${work.titulo} está en un estado bloqueante.`,
          dataUsed: [`Estado ${work.estado}`, `Última actualización ${updatedAt ? formatDate(updatedAt) : "sin fecha"}`, `Prioridad ${work.prioridad ?? "media"}`],
          rule: "work_blocked: estado en pausada, parada, pendiente_material o pendiente_cliente.",
          modules: ["Obras", "Agenda", "Materiales"],
          consequence: "Puede retrasar planificación, compras, visitas y facturación."
        },
        suggestedActions: [{ label: "Abrir obra", href: `/obras/${work.id}`, kind: "open" }]
      }));
    }

    const finish = toDate(work.fechaFinPrevista);
    if (finish && finish < today && !FINAL_WORK_STATUSES.includes(status)) {
      const lateDays = diffDays(today, finish);
      signals.push(makeSignal({
        fingerprint: `work:late:${work.id}`,
        type: "work_late_finish",
        tipo: "Fin previsto vencido",
        source: "obras",
        title: `${work.titulo} superó la fecha fin prevista`,
        summary: `${lateDays} días de retraso sobre la fecha prevista.`,
        date: finish,
        entity: workEntity,
        client: clientEntity,
        work: workEntity,
        relatedAmount: financialImpact || null,
        expiresAt: null,
        scoreBreakdown: [
          { label: "Base", value: 35, detail: "La fecha fin prevista ya pasó." },
          { label: "Retraso", value: Math.min(25, lateDays), detail: `${lateDays} días de retraso.` },
          { label: "Prioridad", value: priorityScore(work.prioridad), detail: `Prioridad ${work.prioridad ?? "media"}.` },
          { label: "Impacto", value: amountScore(financialImpact, [1000, 5000, 10000]), detail: `${pendingEuros(financialImpact)} asociados.` }
        ],
        explanation: {
          why: `La obra ${work.titulo} no está cerrada y su fecha fin prevista ya pasó.`,
          dataUsed: [`Fin previsto ${formatDate(finish)}`, `Estado ${work.estado}`, `Cliente ${client?.nombre ?? "sin cliente"}`],
          rule: "work_late_finish: fechaFinPrevista anterior a hoy y estado no final.",
          modules: ["Obras", "Agenda"],
          consequence: "Puede afectar a agenda, costes y fecha de facturación."
        },
        suggestedActions: [{ label: "Abrir obra", href: `/obras/${work.id}`, kind: "open" }]
      }));
    }

    const hasFutureFollowUp = (work.agendaEvents ?? []).some((item) => {
      const date = toDate(item.fechaInicio);
      return date && date >= today && !CLOSED_AGENDA_STATUSES.includes(normalizeStatus(item.estado));
    }) || (work.reminders ?? []).some((item) => {
      const date = toDate(item.fechaProgramada);
      return date && date >= today && ACTIVE_REMINDER_STATUSES.includes(normalizeStatus(item.estado));
    });
    if (isActiveWorkStatus(status) && daysSinceUpdate >= 14 && !hasFutureFollowUp) {
      signals.push(makeSignal({
        fingerprint: `work:no-activity:${work.id}`,
        type: "work_no_activity",
        tipo: "Obra sin actividad",
        source: "agenda",
        title: `${work.titulo} no tiene seguimiento próximo`,
        summary: `Sin actualización en ${daysSinceUpdate} días y sin próxima visita o recordatorio.`,
        date: updatedAt,
        entity: workEntity,
        client: clientEntity,
        work: workEntity,
        relatedAmount: financialImpact || null,
        expiresAt: null,
        scoreBreakdown: [
          { label: "Base", value: 28, detail: "Obra activa sin próxima acción." },
          { label: "Tiempo sin actividad", value: daysSinceUpdate >= 30 ? 25 : 12, detail: `${daysSinceUpdate} días sin actualización.` },
          { label: "Prioridad", value: priorityScore(work.prioridad), detail: `Prioridad ${work.prioridad ?? "media"}.` }
        ],
        explanation: {
          why: `La obra ${work.titulo} está activa pero no tiene actividad ni seguimiento próximo registrado.`,
          dataUsed: [`Estado ${work.estado}`, `Última actualización ${updatedAt ? formatDate(updatedAt) : "sin fecha"}`, "Sin agenda futura ni recordatorios futuros"],
          rule: "work_no_activity: obra activa, 14 días sin actualización y sin seguimiento futuro.",
          modules: ["Obras", "Agenda", "Recordatorios"],
          consequence: "Puede quedar olvidada sin visita, llamada ni tarea de cierre."
        },
        suggestedActions: [
          { label: "Abrir obra", href: `/obras/${work.id}`, kind: "open" },
          { label: "Agendar visita", href: `/gestion?tipo=eventoAgenda&obraId=${work.id}&returnTo=/alertas`, kind: "schedule" }
        ]
      }));
    }

    if ((work.materials ?? []).some((material) => ["pendiente", "falta"].includes(normalizeStatus(material.estado)))) {
      const pendingMaterials = (work.materials ?? []).filter((material) => ["pendiente", "falta"].includes(normalizeStatus(material.estado)));
      signals.push(makeSignal({
        fingerprint: `work:materials:${work.id}`,
        type: "materials_pending",
        tipo: "Material pendiente",
        source: "materiales",
        title: `${work.titulo} tiene material pendiente`,
        summary: `${pendingMaterials.length} materiales pendientes o en falta.`,
        date: updatedAt,
        entity: workEntity,
        client: clientEntity,
        work: workEntity,
        relatedAmount: financialImpact || null,
        expiresAt: null,
        scoreBreakdown: [
          { label: "Base", value: 30, detail: "Hay materiales en pendiente o falta." },
          { label: "Cantidad", value: Math.min(20, pendingMaterials.length * 5), detail: `${pendingMaterials.length} materiales afectados.` },
          { label: "Estado obra", value: status === "pendiente_material" ? 18 : 0, detail: status === "pendiente_material" ? "La obra ya está bloqueada por materiales." : "La obra no está marcada como bloqueada por materiales." }
        ],
        explanation: {
          why: `${work.titulo} tiene materiales pendientes: ${pendingMaterials.slice(0, 3).map((item) => item.nombre).join(", ")}.`,
          dataUsed: pendingMaterials.slice(0, 3).map((item) => `${item.nombre}: ${item.estado}`),
          rule: "materials_pending: materiales asociados con estado pendiente o falta.",
          modules: ["Materiales", "Obras"],
          consequence: "Puede bloquear inicio, avance o remates de la obra."
        },
        suggestedActions: [{ label: "Ver gastos y materiales", href: "/gastos-materiales", kind: "review" }]
      }));
    }

    const revenueBase = financial.invoiced || financial.budgeted;
    if (revenueBase > 0 && financial.marginPercent < 15) {
      signals.push(makeSignal({
        fingerprint: `work:low-margin:${work.id}`,
        type: "work_low_margin",
        tipo: "Margen bajo",
        source: "rentabilidad",
        title: `${work.titulo} tiene margen bajo`,
        summary: `Margen calculado ${round(financial.marginPercent)}%.`,
        date: updatedAt,
        entity: workEntity,
        client: clientEntity,
        work: workEntity,
        relatedAmount: Math.abs(financial.benefit),
        expiresAt: null,
        scoreBreakdown: [
          { label: "Base", value: 35, detail: "La obra tiene ingresos o presupuesto y margen bajo." },
          { label: "Margen", value: financial.marginPercent < 5 ? 30 : 18, detail: `Margen ${round(financial.marginPercent)}%.` },
          { label: "Impacto", value: amountScore(revenueBase, [1000, 5000, 10000]), detail: `${pendingEuros(revenueBase)} de base de ingresos.` }
        ],
        explanation: {
          why: `La obra ${work.titulo} tiene margen ${round(financial.marginPercent)}% sobre ingresos o presupuesto registrado.`,
          dataUsed: [`Ingresos/presupuesto ${pendingEuros(revenueBase)}`, `Coste real ${pendingEuros(financial.realCost)}`, `Beneficio ${pendingEuros(financial.benefit)}`],
          rule: "work_low_margin: margen calculado inferior al 15%.",
          modules: ["Obras", "Gastos", "Rentabilidad"],
          consequence: "La obra puede dejar poco beneficio o entrar en pérdidas si crecen los costes."
        },
        suggestedActions: [{ label: "Abrir obra", href: `/obras/${work.id}`, kind: "open" }]
      }));
    }

    if (financial.forecastCost > 0 && financial.deviation > 0) {
      const deviationRate = financial.deviation / financial.forecastCost * 100;
      if (deviationRate >= 10 || financial.deviation >= 500) {
        signals.push(makeSignal({
          fingerprint: `work:cost-deviation:${work.id}`,
          type: "work_cost_deviation",
          tipo: "Desviación de costes",
          source: "gastos",
          title: `${work.titulo} supera el coste previsto`,
          summary: `Desviación ${pendingEuros(financial.deviation)} (${round(deviationRate)}%).`,
          date: updatedAt,
          entity: workEntity,
          client: clientEntity,
          work: workEntity,
          relatedAmount: financial.deviation,
          expiresAt: null,
          scoreBreakdown: [
            { label: "Base", value: 30, detail: "Coste real superior al coste previsto." },
            { label: "Porcentaje", value: deviationRate >= 25 ? 25 : 14, detail: `${round(deviationRate)}% de desviación.` },
            { label: "Importe", value: amountScore(financial.deviation, [500, 2000, 5000]), detail: `${pendingEuros(financial.deviation)} de desviación.` }
          ],
          explanation: {
            why: `Los costes de ${work.titulo} superan el coste previsto.`,
            dataUsed: [`Coste previsto ${pendingEuros(financial.forecastCost)}`, `Coste real ${pendingEuros(financial.realCost)}`, `Desviación ${pendingEuros(financial.deviation)}`],
            rule: "work_cost_deviation: coste real > coste previsto y desviación >= 10% o >= 500 EUR.",
            modules: ["Obras", "Gastos", "Rentabilidad"],
            consequence: "Puede erosionar margen y beneficio si no se revisa el alcance o los costes."
          },
          suggestedActions: [{ label: "Abrir obra", href: `/obras/${work.id}`, kind: "open" }]
        }));
      }
    }
  }
  return signals;
}

function buildReminderSignals(reminders: SignalReminder[], now: Date): BusinessSignalDraft[] {
  const today = startOfDay(now);
  return reminders.flatMap((reminder) => {
    const status = normalizeStatus(reminder.estado);
    const date = toDate(reminder.fechaProgramada);
    if (!date || !ACTIVE_REMINDER_STATUSES.includes(status)) return [];
    const isOverdue = date < today;
    const days = isOverdue ? diffDays(today, date) : diffDays(date, today);
    if (!isOverdue && days > 1) return [];
    const client = reminder.client ? entity("cliente", reminder.client.id, reminder.client.nombre, `/clientes/${reminder.client.id}`) : null;
    const work = reminder.work ? entity("obra", reminder.work.id, reminder.work.titulo, `/obras/${reminder.work.id}`) : null;
    return [makeSignal({
      fingerprint: `reminder:${isOverdue ? "overdue" : "due"}:${reminder.id}`,
      type: isOverdue ? "reminder_overdue" : "reminder_due",
      tipo: isOverdue ? "Recordatorio vencido" : "Recordatorio próximo",
      source: "recordatorios",
      title: isOverdue ? `Recordatorio vencido: ${reminder.tipo}` : `Recordatorio próximo: ${reminder.tipo}`,
      summary: reminder.mensaje,
      date,
      entity: entity("recordatorio", reminder.id, reminder.tipo.replaceAll("_", " "), "/recordatorios"),
      client,
      work,
      relatedAmount: null,
      expiresAt: isOverdue ? null : addDays(date, 1),
      scoreBreakdown: [
        { label: "Base", value: isOverdue ? 32 : 18, detail: isOverdue ? "Recordatorio pasado." : "Recordatorio próximo." },
        { label: "Tiempo", value: isOverdue ? Math.min(20, days * 3) : Math.max(4, 10 - days * 4), detail: isOverdue ? `${days} días de retraso.` : `${days} días restantes.` },
        { label: "Dependencia", value: reminder.facturaId || reminder.presupuestoId || reminder.obraId ? 8 : 0, detail: "Vinculado a entidad de negocio." }
      ],
      explanation: {
        why: isOverdue ? `El recordatorio debió revisarse hace ${days} días.` : "El recordatorio está programado para las próximas 24 horas.",
        dataUsed: [`Fecha ${formatDate(date)}`, `Estado ${reminder.estado}`, `Tipo ${reminder.tipo}`],
        rule: isOverdue ? "reminder_overdue: recordatorio activo con fecha anterior a hoy." : "reminder_due: recordatorio activo entre hoy y mañana.",
        modules: ["Recordatorios", "Agenda"],
        consequence: "Puede quedar sin seguimiento una llamada, cobro, material o confirmación."
      },
      suggestedActions: [{ label: "Abrir recordatorios", href: "/recordatorios", kind: "review" }]
    })];
  });
}

function buildAgendaSignals(events: SignalAgendaEvent[], now: Date): BusinessSignalDraft[] {
  const today = startOfDay(now);
  return events.flatMap((eventItem) => {
    const status = normalizeStatus(eventItem.estado);
    const date = toDate(eventItem.fechaInicio);
    if (!date || CLOSED_AGENDA_STATUSES.includes(status)) return [];
    const isOverdue = date < today;
    const dueToday = sameDay(date, today);
    const needsConfirmation = Boolean(eventItem.requiereConfirmacion && !eventItem.confirmadoPorUsuario);
    if (!isOverdue && !(dueToday && needsConfirmation)) return [];
    const client = eventItem.client ? entity("cliente", eventItem.client.id, eventItem.client.nombre, `/clientes/${eventItem.client.id}`) : null;
    const work = eventItem.work ? entity("obra", eventItem.work.id, eventItem.work.titulo, `/obras/${eventItem.work.id}`) : null;
    const days = isOverdue ? diffDays(today, date) : 0;
    return [makeSignal({
      fingerprint: `agenda:${isOverdue ? "overdue" : "unconfirmed"}:${eventItem.id}`,
      type: isOverdue ? "agenda_event_overdue" : "visit_unconfirmed_today",
      tipo: isOverdue ? "Visita o tarea vencida" : "Visita sin confirmar",
      source: eventItem.tipo === "visita" ? "visitas" : "agenda",
      title: isOverdue ? `Agenda vencida: ${eventItem.titulo}` : `Pendiente confirmar: ${eventItem.titulo}`,
      summary: `${eventItem.tipo.replaceAll("_", " ")} · ${formatDate(date)}.`,
      date,
      entity: entity("agenda", eventItem.id, eventItem.titulo, "/agenda"),
      client,
      work,
      relatedAmount: null,
      expiresAt: isOverdue ? null : addDays(date, 1),
      scoreBreakdown: [
        { label: "Base", value: isOverdue ? 34 : 24, detail: isOverdue ? "Evento pasado sin cerrar." : "Evento de hoy pendiente de confirmar." },
        { label: "Tiempo", value: isOverdue ? Math.min(20, days * 3) : 8, detail: isOverdue ? `${days} días de retraso.` : "Requiere confirmación hoy." },
        { label: "Entidad vinculada", value: eventItem.obraId || eventItem.clienteId ? 8 : 0, detail: "Vinculado a cliente u obra." }
      ],
      explanation: {
        why: isOverdue ? `El evento ${eventItem.titulo} ya pasó y no está marcado como realizado o cancelado.` : `El evento ${eventItem.titulo} requiere confirmación y es para hoy.`,
        dataUsed: [`Fecha ${formatDate(date)}`, `Estado ${eventItem.estado}`, `Tipo ${eventItem.tipo}`],
        rule: isOverdue ? "agenda_event_overdue: evento no cerrado con fecha anterior a hoy." : "visit_unconfirmed_today: evento de hoy requiere confirmación y no está confirmado.",
        modules: ["Agenda", "Visitas"],
        consequence: "Puede generar una visita olvidada, una llamada pendiente o una planificación poco fiable."
      },
      suggestedActions: [{ label: "Abrir agenda", href: "/agenda", kind: "review" }]
    })];
  });
}

function buildDocumentSignals(documents: SignalDocument[], now: Date): BusinessSignalDraft[] {
  return documents
    .filter((document) => !document.url)
    .slice(0, 80)
    .map((document) => {
      const client = document.client ? entity("cliente", document.client.id, document.client.nombre, `/clientes/${document.client.id}`) : null;
      const work = document.work ? entity("obra", document.work.id, document.work.titulo, `/obras/${document.work.id}`) : null;
      const docDate = toDate(document.createdAt) ?? now;
      return makeSignal({
        fingerprint: `document:missing-url:${document.id}`,
        type: "document_incomplete",
        tipo: "Documento incompleto",
        source: "documentos",
        title: `Documento sin archivo: ${document.name}`,
        summary: `Ficha documental ${document.category} sin URL de archivo.`,
        date: docDate,
        entity: entity("documento", document.id, document.name, "/documentos"),
        client,
        work,
        relatedAmount: null,
        expiresAt: null,
        scoreBreakdown: [
          { label: "Base", value: 22, detail: "Existe ficha de documento sin archivo." },
          { label: "Entidad", value: document.invoiceId || document.budgetId ? 10 : document.workId ? 6 : 2, detail: "Vinculado a documento operativo." },
          { label: "Antigüedad", value: Math.min(10, Math.max(0, Math.floor(diffDays(startOfDay(now), startOfDay(docDate)) / 7))), detail: `${diffDays(startOfDay(now), startOfDay(docDate))} días desde alta.` }
        ],
        explanation: {
          why: `El documento ${document.name} existe como ficha pero no tiene archivo asociado.`,
          dataUsed: [`Categoría ${document.category}`, `Creado ${formatDate(docDate)}`, `URL vacía`],
          rule: "document_incomplete: documento activo sin url.",
          modules: ["Documentos", "Datos"],
          consequence: "Puede parecer que la documentación está preparada cuando falta el archivo real."
        },
        suggestedActions: [{ label: "Abrir documentos", href: "/documentos", kind: "review" }]
      });
    });
}

function buildExpenseSignals(expenses: SignalExpense[], now: Date): BusinessSignalDraft[] {
  const today = startOfDay(now);
  const signals: BusinessSignalDraft[] = [];
  for (const expense of expenses) {
    const due = toDate(expense.paymentDueDate);
    const status = normalizeStatus(expense.paymentStatus);
    const isPending = status === "pending" || status === "unknown";
    const client = expense.client ? entity("cliente", expense.client.id, expense.client.nombre, `/clientes/${expense.client.id}`) : null;
    const work = expense.work ? entity("obra", expense.work.id, expense.work.titulo, `/obras/${expense.work.id}`) : null;

    if (isPending && due && due < today) {
      const days = diffDays(today, due);
      signals.push(makeSignal({
        fingerprint: `expense:payment-overdue:${expense.id}`,
        type: "expense_payment_overdue",
        tipo: "Pago de gasto vencido",
        source: "gastos",
        title: `Gasto vencido: ${expense.proveedor}`,
        summary: `${expense.concepto} por ${pendingEuros(expense.importe)} venció hace ${days} días.`,
        date: due,
        entity: entity("gasto", expense.id, expense.concepto, "/gastos-materiales"),
        client,
        work,
        relatedAmount: expense.importe,
        expiresAt: null,
        scoreBreakdown: [
          { label: "Base", value: 30, detail: "Gasto pendiente con fecha de pago vencida." },
          { label: "Antigüedad", value: Math.min(25, days * 4), detail: `${days} días vencido.` },
          { label: "Importe", value: amountScore(expense.importe, [250, 1000, 3000]), detail: `${pendingEuros(expense.importe)} de pago.` }
        ],
        explanation: {
          why: `El gasto ${expense.concepto} sigue pendiente y la fecha de pago ya pasó.`,
          dataUsed: [`Proveedor ${expense.proveedor}`, `Importe ${pendingEuros(expense.importe)}`, `Vence ${formatDate(due)}`],
          rule: "expense_payment_overdue: gasto pending/unknown con paymentDueDate anterior a hoy.",
          modules: ["Gastos", "Tesorería"],
          consequence: "Puede generar tensión con proveedores y distorsionar pagos previstos."
        },
        suggestedActions: [{ label: "Abrir gastos", href: "/gastos-materiales", kind: "review" }]
      }));
    }

    if (isPending && !due && expense.importe >= 250) {
      signals.push(makeSignal({
        fingerprint: `expense:payment-unscheduled:${expense.id}`,
        type: "expense_payment_unscheduled",
        tipo: "Gasto pendiente sin fecha",
        source: "tesoreria",
        title: `Gasto sin fecha de pago: ${expense.proveedor}`,
        summary: `${expense.concepto} por ${pendingEuros(expense.importe)} no tiene vencimiento de pago.`,
        date: toDate(expense.fecha),
        entity: entity("gasto", expense.id, expense.concepto, "/gastos-materiales"),
        client,
        work,
        relatedAmount: expense.importe,
        expiresAt: null,
        scoreBreakdown: [
          { label: "Base", value: 18, detail: "Gasto pendiente sin fecha de pago." },
          { label: "Importe", value: amountScore(expense.importe, [250, 1000, 3000]), detail: `${pendingEuros(expense.importe)} sin planificar.` },
          { label: "Tesorería", value: 10, detail: "Sin fecha no entra bien en forecast." }
        ],
        explanation: {
          why: `El gasto ${expense.concepto} está pendiente pero no tiene fecha de pago.`,
          dataUsed: [`Importe ${pendingEuros(expense.importe)}`, `Estado ${expense.paymentStatus ?? "unknown"}`, "paymentDueDate vacío"],
          rule: "expense_payment_unscheduled: gasto pendiente >= 250 EUR sin paymentDueDate.",
          modules: ["Gastos", "Tesorería"],
          consequence: "La previsión de caja puede infravalorar salidas próximas."
        },
        suggestedActions: [{ label: "Abrir gastos", href: "/gastos-materiales", kind: "review" }]
      }));
    }

    if (normalizeStatus(expense.costBehavior) === "unknown" && expense.importe >= 500) {
      signals.push(makeSignal({
        fingerprint: `expense:cost-behavior:${expense.id}`,
        type: "expense_cost_unclassified",
        tipo: "Coste sin clasificar",
        source: "rentabilidad",
        title: `Gasto sin comportamiento de coste`,
        summary: `${expense.concepto} no está clasificado como fijo o variable.`,
        date: toDate(expense.fecha),
        entity: entity("gasto", expense.id, expense.concepto, "/gastos-materiales"),
        client,
        work,
        relatedAmount: expense.importe,
        expiresAt: null,
        scoreBreakdown: [
          { label: "Base", value: 18, detail: "Coste sin comportamiento fijo/variable." },
          { label: "Importe", value: amountScore(expense.importe, [500, 1500, 4000]), detail: `${pendingEuros(expense.importe)} sin clasificar.` }
        ],
        explanation: {
          why: `El gasto ${expense.concepto} no está clasificado para análisis de rentabilidad y punto de equilibrio.`,
          dataUsed: [`Importe ${pendingEuros(expense.importe)}`, `Categoría ${expense.categoria}`, `costBehavior ${expense.costBehavior ?? "unknown"}`],
          rule: "expense_cost_unclassified: gasto >= 500 EUR con costBehavior unknown.",
          modules: ["Gastos", "Rentabilidad"],
          consequence: "El punto de equilibrio y análisis de margen pueden ser menos útiles."
        },
        suggestedActions: [{ label: "Abrir gastos", href: "/gastos-materiales", kind: "review" }]
      }));
    }
  }
  return signals;
}

function buildTreasurySignals(alerts: TreasuryAlert[], qualityIssues: TreasuryDataQualityIssue[], now: Date): BusinessSignalDraft[] {
  const alertSignals = alerts.map((alert) => {
    const score = alert.level === "danger" ? 85 : alert.level === "warning" ? 68 : 32;
    return makeSignal({
      fingerprint: `treasury:alert:${alert.id}`,
      type: `treasury_${alert.type}`,
      tipo: "Riesgo de tesorería",
      source: "tesoreria",
      title: alert.title,
      summary: alert.detail,
      date: alert.date,
      entity: entity("tesoreria", alert.id, alert.title, alert.href ?? "/tesoreria"),
      client: null,
      work: null,
      relatedAmount: alert.amount,
      expiresAt: null,
      scoreBreakdown: [
        { label: "Nivel tesorería", value: score, detail: `Alerta de tesorería ${alert.level}.` }
      ],
      explanation: {
        why: alert.detail,
        dataUsed: [`Importe ${alert.amount === null ? "sin importe" : pendingEuros(alert.amount)}`, `Fecha ${alert.date ? formatDate(alert.date) : "sin fecha"}`],
        rule: `treasury_alert:${alert.type}: señal generada por el módulo determinista de tesorería.`,
        modules: ["Tesorería", "Flujo de caja"],
        consequence: "Puede afectar a saldo disponible, cobertura o pagos próximos."
      },
      suggestedActions: [{ label: alert.action ?? "Abrir tesorería", href: alert.href ?? "/tesoreria", kind: "review" }]
    });
  });

  const qualitySignals = qualityIssues
    .filter((issue) => issue.count > 0)
    .map((issue) => makeSignal({
      fingerprint: `treasury:quality:${issue.id}`,
      type: "treasury_data_quality",
      tipo: "Datos de tesorería incompletos",
      source: "datos",
      title: issue.title,
      summary: `${issue.count} registros afectados. ${issue.description}`,
      date: now,
      entity: entity("tesoreria", issue.id, issue.title, issue.href),
      client: null,
      work: null,
      relatedAmount: null,
      expiresAt: null,
      scoreBreakdown: [
        { label: "Base", value: 22, detail: "Incidencia de calidad de datos de tesorería." },
        { label: "Volumen", value: Math.min(25, issue.count * 5), detail: `${issue.count} registros afectados.` }
      ],
      explanation: {
        why: issue.description,
        dataUsed: [`Registros afectados ${issue.count}`, `Origen ${issue.href}`],
        rule: `treasury_quality:${issue.id}: issue de calidad con count > 0.`,
        modules: ["Tesorería", "Datos"],
        consequence: "La previsión de caja puede perder precisión si faltan fechas, estados o cuentas."
      },
      suggestedActions: [{ label: "Abrir tesorería", href: issue.href, kind: "review" }]
    }));

  return [...alertSignals, ...qualitySignals];
}

function makeSignal(input: {
  fingerprint: string;
  type: string;
  tipo: string;
  source: BusinessSignalSource;
  title: string;
  summary: string;
  date: Date | string | null | undefined;
  entity: BusinessSignalEntity | null;
  client: BusinessSignalEntity | null;
  work: BusinessSignalEntity | null;
  relatedAmount: number | null;
  expiresAt: Date | string | null | undefined;
  scoreBreakdown: BusinessSignalScorePart[];
  explanation: Omit<BusinessSignalExplanation, "summary" | "scoreBreakdown">;
  suggestedActions: BusinessSignalAction[];
}): BusinessSignalDraft {
  const score = clampScore(input.scoreBreakdown.reduce((total, part) => total + part.value, 0));
  const level = levelForScore(score);
  const date = toDate(input.date);
  const expiresAt = toDate(input.expiresAt);
  return {
    fingerprint: input.fingerprint,
    type: input.type,
    tipo: input.tipo,
    title: input.title,
    summary: input.summary,
    level,
    nivel: level,
    levelText: formatSignalLevel(level),
    ruleId: input.type,
    ruleVersion: "2026-07-11.1",
    prioridad: score,
    score,
    date,
    fecha: date,
    startsAt: date,
    detectedAt: new Date(),
    source: input.source,
    sourceLabel: signalSourceLabel(input.source),
    entity: input.entity,
    client: input.client,
    work: input.work,
    relatedAmount: input.relatedAmount === null ? null : roundMoney(input.relatedAmount),
    explanation: {
      ...input.explanation,
      summary: input.summary,
      scoreBreakdown: input.scoreBreakdown
    },
    suggestedActions: input.suggestedActions,
    expiresAt
  };
}

function applySignalPreferences(signal: BusinessSignalDraft, preferences: BusinessSignalsInput["preferences"]): BusinessSignalDraft {
  const delta = preferences
    ?.filter((preference) => preference.scopeType === "signal_type" && preference.scopeValue === signal.type)
    .reduce((total, preference) => total + preference.weightDelta, 0) ?? 0;
  if (!delta) return signal;
  const score = clampScore(signal.score + delta);
  const level = levelForScore(score);
  return {
    ...signal,
    score,
    prioridad: score,
    level,
    nivel: level,
    levelText: formatSignalLevel(level),
    explanation: {
      ...signal.explanation,
      scoreBreakdown: [
        ...signal.explanation.scoreBreakdown,
        { label: "Preferencia determinista", value: delta, detail: "Ajuste por descartes previos; la señal no se oculta automáticamente." }
      ]
    }
  };
}

function dedupeDrafts(drafts: BusinessSignalDraft[]) {
  const byFingerprint = new Map<string, BusinessSignalDraft>();
  for (const signal of drafts) {
    const existing = byFingerprint.get(signal.fingerprint);
    if (!existing || compareSignals(signalWithActiveState(signal), signalWithActiveState(existing)) < 0) {
      byFingerprint.set(signal.fingerprint, signal);
    }
  }
  return [...byFingerprint.values()].sort((a, b) => compareSignals(signalWithActiveState(a), signalWithActiveState(b)));
}

function groupSignals(signals: BusinessSignal[]): BusinessSignalGroup[] {
  const buckets = groupBy(signals, (signal) => `${signal.type}:${signal.source}:${signal.status}`);
  return [...buckets.entries()]
    .map(([key, items]) => {
      const sorted = [...items].sort(compareSignals);
      const first = sorted[0];
      const totalAmount = sorted.reduce((total, signal) => total + safeNumber(signal.relatedAmount), 0);
      const status: BusinessSignalStatus | "mixed" = sorted.every((signal) => signal.status === first.status) ? first.status : "mixed";
      return {
        key,
        title: groupTitle(first, sorted.length),
        source: first.source,
        level: sorted.reduce((max, signal) => signalLevelRank(signal.level) > signalLevelRank(max) ? signal.level : max, first.level),
        status,
        count: sorted.length,
        totalAmount,
        maxScore: first.score,
        topSignals: sorted.slice(0, 3),
        explanation: sorted.length > 1
          ? `Agrupa ${sorted.length} señales del mismo tipo para evitar avisos repetidos. Se muestran las 3 más prioritarias por impacto, urgencia y riesgo.`
          : first.explanation.why
      };
    })
    .sort((a, b) => b.maxScore - a.maxScore || b.totalAmount - a.totalAmount || a.title.localeCompare(b.title));
}

function summarizeSignals(signals: BusinessSignal[]): BusinessSignalsSummary {
  const active = signals.filter((signal) => signal.status === "active");
  return {
    total: signals.length,
    active: active.length,
    snoozed: signals.filter((signal) => signal.status === "snoozed").length,
    dismissed: signals.filter((signal) => signal.status === "dismissed").length,
    resolved: signals.filter((signal) => signal.status === "resolved").length,
    expired: signals.filter((signal) => signal.status === "expired").length,
    critical: active.filter((signal) => signal.level === "critico").length,
    important: active.filter((signal) => signal.level === "importante").length,
    attention: active.filter((signal) => signal.level === "atencion").length,
    info: active.filter((signal) => signal.level === "info").length,
    totalAmount: active.reduce((total, signal) => total + safeNumber(signal.relatedAmount), 0),
    top: active.sort(compareSignals)[0] ?? null
  };
}

function compareSignals(a: Pick<BusinessSignal, "score" | "relatedAmount" | "date" | "detectedAt">, b: Pick<BusinessSignal, "score" | "relatedAmount" | "date" | "detectedAt">) {
  return b.score - a.score
    || safeNumber(b.relatedAmount) - safeNumber(a.relatedAmount)
    || timeValue(a.date) - timeValue(b.date)
    || timeValue(b.detectedAt) - timeValue(a.detectedAt);
}

function nextStatusForCurrentSignal(state: { status: BusinessSignalStatus; snoozedUntil: Date | null; lastPriority?: number; ruleVersion?: string | null } | undefined, signal: BusinessSignalDraft, now: Date): BusinessSignalStatus {
  if (signal.expiresAt && signal.expiresAt < now) return "expired";
  if (!state) return "active";
  if (state.status === "dismissed") {
    const materiallyChanged = signal.prioridad >= (state.lastPriority ?? signal.prioridad) + 20 || Boolean(state.ruleVersion && state.ruleVersion !== signal.ruleVersion);
    return materiallyChanged ? "active" : "dismissed";
  }
  if (state.status === "snoozed" && state.snoozedUntil && state.snoozedUntil > now) return "snoozed";
  return "active";
}

function signalMetadata(signal: BusinessSignalDraft): Prisma.InputJsonObject {
  return {
    sourceLabel: signal.sourceLabel,
    levelText: signal.levelText,
    entity: signal.entity as unknown as Prisma.InputJsonValue,
    client: signal.client as unknown as Prisma.InputJsonValue,
    work: signal.work as unknown as Prisma.InputJsonValue
  };
}

function shouldLowerFuturePriority(reason: string, amountValue: number | null, metadata: Prisma.JsonValue | null) {
  const normalized = normalizeStatus(reason);
  const amount = amountValue ?? (typeof metadata === "object" && metadata && "relatedAmount" in metadata
    ? Number((metadata as Record<string, unknown>).relatedAmount)
    : 0);
  return amount > 0 && amount < 100 && /(no_importante|importe_bajo|pequeno|pequena|menor)/.test(normalized);
}

function isBusinessSignalTableMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  return maybe.code === "P2021" || /BusinessSignal(State|Preference).*does not exist|table .*BusinessSignal(State|Preference).*does not exist/i.test(maybe.message ?? "");
}

function signalWithActiveState(signal: BusinessSignalDraft): BusinessSignal {
  return {
    ...signal,
    id: signal.fingerprint,
    status: "active",
    statusLabel: "Activa",
    shownAt: null,
    dismissedAt: null,
    dismissedReason: null,
    dismissedBy: null,
    snoozedUntil: null,
    snoozeReason: null,
    resolvedAt: null,
    resolution: null
  };
}

function entity(type: string, id: string, label: string, href: string): BusinessSignalEntity {
  return { type, id, label, href };
}

function businessEntityFromJson(value: unknown): BusinessSignalEntity | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.type !== "string" || typeof item.id !== "string" || typeof item.label !== "string" || typeof item.href !== "string") return null;
  return { type: item.type, id: item.id, label: item.label, href: item.href };
}

function actionsFromJson(value: unknown, fallbackEntity: BusinessSignalEntity | null): BusinessSignalAction[] {
  if (!Array.isArray(value)) {
    return fallbackEntity ? [{ label: "Abrir", href: fallbackEntity.href, kind: "open" }] : [{ label: "Abrir alertas", href: "/alertas", kind: "review" }];
  }
  const actions = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const action = item as Record<string, unknown>;
      if (typeof action.label !== "string" || typeof action.href !== "string") return null;
      const kind = typeof action.kind === "string" && ["review", "open", "register", "complete", "schedule"].includes(action.kind)
        ? action.kind as BusinessSignalAction["kind"]
        : "review";
      return { label: action.label, href: action.href, kind };
    })
    .filter((item): item is BusinessSignalAction => Boolean(item));
  return actions.length ? actions : actionsFromJson(null, fallbackEntity);
}

function explanationFromJson(value: unknown, state: SignalState): BusinessSignalExplanation {
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    const scoreBreakdown = Array.isArray(item.scoreBreakdown)
      ? item.scoreBreakdown
        .map((part) => {
          if (!part || typeof part !== "object") return null;
          const scorePart = part as Record<string, unknown>;
          if (typeof scorePart.label !== "string" || typeof scorePart.detail !== "string") return null;
          return { label: scorePart.label, value: Number(scorePart.value ?? 0), detail: scorePart.detail };
        })
        .filter((part): part is BusinessSignalScorePart => Boolean(part))
      : [];
    return {
      summary: typeof item.summary === "string" ? item.summary : state.summary ?? state.title,
      why: typeof item.why === "string" ? item.why : state.summary ?? state.title,
      dataUsed: Array.isArray(item.dataUsed) ? item.dataUsed.filter((entry): entry is string => typeof entry === "string") : [],
      rule: typeof item.rule === "string" ? item.rule : `${state.ruleId ?? state.type}: histórico persistido.`,
      modules: Array.isArray(item.modules) ? item.modules.filter((entry): entry is string => typeof entry === "string") : [signalSourceLabel(state.source)],
      consequence: typeof item.consequence === "string" ? item.consequence : "Se conserva como histórico para trazabilidad.",
      scoreBreakdown: scoreBreakdown.length ? scoreBreakdown : [{ label: "Última prioridad", value: state.lastPriority, detail: "Score persistido en la última detección." }]
    };
  }

  return {
    summary: state.summary ?? state.title,
    why: state.summary ?? state.title,
    dataUsed: ["Histórico persistido en BusinessSignalState."],
    rule: `${state.ruleId ?? state.type}: histórico persistido.`,
    modules: [signalSourceLabel(state.source)],
    consequence: "Se conserva como histórico para trazabilidad.",
    scoreBreakdown: [{ label: "Última prioridad", value: state.lastPriority, detail: "Score persistido en la última detección." }]
  };
}

function jsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function hrefForStateEntity(type: string, id: string) {
  if (type === "cliente") return `/clientes/${id}`;
  if (type === "obra") return `/obras/${id}`;
  if (type === "factura") return `/dinero/${id}`;
  if (type === "presupuesto") return `/presupuestos/${id}`;
  if (type === "documento") return "/documentos";
  if (type === "recordatorio") return "/recordatorios";
  if (type === "agenda") return "/agenda";
  if (type === "gasto") return "/gastos-materiales";
  return "/alertas";
}

function groupTitle(signal: BusinessSignal, count: number) {
  if (count <= 1) return signal.title;
  const plural: Record<string, string> = {
    invoice_overdue: `${count} facturas vencidas`,
    invoice_due_soon: `${count} facturas próximas a vencer`,
    client_debt_concentration: `${count} clientes concentran deuda`,
    budget_stalled: `${count} presupuestos parados`,
    work_blocked: `${count} obras bloqueadas`,
    work_no_activity: `${count} obras sin actividad`,
    materials_pending: `${count} obras con material pendiente`,
    reminder_overdue: `${count} recordatorios vencidos`,
    agenda_event_overdue: `${count} eventos de agenda vencidos`,
    expense_payment_overdue: `${count} pagos de gastos vencidos`,
    treasury_data_quality: `${count} incidencias de datos de tesorería`
  };
  return plural[signal.type] ?? `${count} señales: ${signal.tipo}`;
}

function amountScore(value: number, thresholds: [number, number, number]) {
  const amount = safeNumber(value);
  if (amount >= thresholds[2]) return 20;
  if (amount >= thresholds[1]) return 14;
  if (amount >= thresholds[0]) return 8;
  return amount > 0 ? 3 : 0;
}

function overdueDaysScore(days: number) {
  if (days >= 60) return 35;
  if (days >= 30) return 25;
  if (days >= 10) return 15;
  return 5;
}

function priorityScore(priority: string | null | undefined) {
  const normalized = normalizeStatus(priority);
  if (normalized === "urgente") return 16;
  if (normalized === "alta") return 10;
  if (normalized === "media") return 5;
  return 0;
}

function snoozePresetLabel(preset: SignalSnoozePreset) {
  if (preset === "tomorrow") return "Recuérdamelo mañana";
  if (preset === "week") return "No volver esta semana";
  return "Posponer un mes";
}

function normalizeStatus(value: string | null | undefined) {
  return normalizeWorkStatus(value);
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(item);
  }
  return groups;
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function sameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function diffDays(a: Date, b: Date) {
  return Math.max(0, Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000));
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function timeValue(value: Date | string | null | undefined) {
  return toDate(value)?.getTime() ?? 0;
}

function latestDate(values: Array<Date | string | null | undefined>) {
  const dates = values.map(toDate).filter((value): value is Date => Boolean(value));
  return dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
}

function oldestDate(values: Array<Date | string | null | undefined>) {
  const dates = values.map(toDate).filter((value): value is Date => Boolean(value));
  return dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : null;
}

function clampScore(score: number) {
  return Math.max(1, Math.min(100, Math.round(score)));
}

function roundMoney(value: number) {
  return Math.round(safeNumber(value) * 100) / 100;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function pendingEuros(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: Math.abs(value) % 1 === 0 ? 0 : 2
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}
