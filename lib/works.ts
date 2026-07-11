import type { ExpenseCategory, WorkPriority, WorkStatus } from "@prisma/client";

type DateLike = Date | string | null | undefined;

export type WorkStatusMeta = {
  label: string;
  icon: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  phase: "entrada" | "planificacion" | "ejecucion" | "bloqueo" | "cierre" | "archivo";
  allowedActions: string[];
};

export const WORK_STATUS_META: Record<string, WorkStatusMeta> = {
  borrador: { label: "Borrador", icon: "FileText", tone: "neutral", phase: "entrada", allowedActions: ["planificar", "editar", "presupuestar"] },
  pendiente_aprobacion: { label: "Pendiente aprobación", icon: "Hourglass", tone: "warning", phase: "entrada", allowedActions: ["enviar_presupuesto", "recordatorio", "editar"] },
  planificada: { label: "Planificada", icon: "CalendarDays", tone: "info", phase: "planificacion", allowedActions: ["preparar", "agendar_visita", "comprar_material"] },
  preparacion: { label: "Preparación", icon: "ClipboardList", tone: "info", phase: "planificacion", allowedActions: ["iniciar", "comprar_material", "crear_tarea"] },
  pendiente_inicio: { label: "Pendiente inicio", icon: "CalendarClock", tone: "info", phase: "planificacion", allowedActions: ["iniciar", "agendar_visita", "editar"] },
  en_curso: { label: "En curso", icon: "Hammer", tone: "warning", phase: "ejecucion", allowedActions: ["registrar_gasto", "registrar_visita", "facturar"] },
  pausada: { label: "Pausada", icon: "PauseCircle", tone: "danger", phase: "bloqueo", allowedActions: ["retomar", "crear_recordatorio", "registrar_nota"] },
  parada: { label: "Parada", icon: "OctagonPause", tone: "danger", phase: "bloqueo", allowedActions: ["retomar", "crear_recordatorio", "registrar_nota"] },
  pendiente_material: { label: "Pendiente materiales", icon: "PackageSearch", tone: "warning", phase: "bloqueo", allowedActions: ["comprar_material", "crear_recordatorio", "registrar_gasto"] },
  pendiente_cliente: { label: "Pendiente cliente", icon: "UserRoundCheck", tone: "warning", phase: "bloqueo", allowedActions: ["recordatorio", "whatsapp", "email"] },
  pendiente_remates: { label: "Pendiente remates", icon: "ListChecks", tone: "warning", phase: "ejecucion", allowedActions: ["registrar_visita", "finalizar", "facturar"] },
  parcialmente_terminada: { label: "Parcialmente terminada", icon: "SplitSquareHorizontal", tone: "warning", phase: "ejecucion", allowedActions: ["remates", "facturar", "registrar_visita"] },
  finalizada: { label: "Finalizada", icon: "CheckCircle2", tone: "success", phase: "cierre", allowedActions: ["facturar", "cobrar", "archivar"] },
  facturada_parcialmente: { label: "Facturada parcialmente", icon: "ReceiptText", tone: "warning", phase: "cierre", allowedActions: ["emitir_factura", "registrar_pago", "recordatorio_cobro"] },
  facturada: { label: "Facturada", icon: "Receipt", tone: "info", phase: "cierre", allowedActions: ["registrar_pago", "recordatorio_cobro"] },
  pendiente_cobro: { label: "Pendiente cobro", icon: "WalletCards", tone: "warning", phase: "cierre", allowedActions: ["registrar_pago", "recordatorio_cobro", "reclamar"] },
  cobrada: { label: "Cobrada", icon: "BadgeEuro", tone: "success", phase: "cierre", allowedActions: ["archivar", "garantia", "cerrar"] },
  cerrada: { label: "Cerrada", icon: "Archive", tone: "success", phase: "archivo", allowedActions: ["reabrir", "ver_documentos"] },
  archivada: { label: "Archivada", icon: "ArchiveX", tone: "neutral", phase: "archivo", allowedActions: ["reabrir"] }
};

export const WORK_PRIORITY_META: Record<string, { label: string; tone: "neutral" | "warning" | "danger" | "success"; rank: number }> = {
  baja: { label: "Baja", tone: "neutral", rank: 1 },
  media: { label: "Media", tone: "success", rank: 2 },
  alta: { label: "Alta", tone: "warning", rank: 3 },
  urgente: { label: "Urgente", tone: "danger", rank: 4 }
};

export const ACTIVE_WORK_STATUSES = [
  "pendiente_inicio",
  "planificada",
  "preparacion",
  "en_curso",
  "pausada",
  "parada",
  "pendiente_material",
  "pendiente_cliente",
  "pendiente_remates",
  "parcialmente_terminada",
  "pendiente_cobro",
  "facturada_parcialmente"
];

const BILLABLE_INVOICE_EXCLUDED_STATUSES = ["borrador", "pendiente_emitir"];
const OPEN_INVOICE_STATUSES = ["emitida", "enviada", "pendiente", "pendiente_pago", "parcialmente_pagada", "vencida", "reclamada"];
const OPEN_BUDGET_STATUSES = ["borrador", "pendiente_revision", "pendiente_respuesta", "enviado", "visto"];
const ACCEPTED_BUDGET_STATUSES = ["aceptado"];
const BLOCKED_STATUSES = ["pausada", "parada", "pendiente_material", "pendiente_cliente"];

export function workStatusMeta(status: string | null | undefined) {
  return WORK_STATUS_META[normalizeStatus(status)] ?? WORK_STATUS_META.borrador;
}

export function workPriorityMeta(priority: string | null | undefined) {
  return WORK_PRIORITY_META[normalizeStatus(priority) || "media"] ?? WORK_PRIORITY_META.media;
}

export function isActiveWorkStatus(status: string | null | undefined) {
  return ACTIVE_WORK_STATUSES.includes(normalizeStatus(status));
}

export function isBlockedWorkStatus(status: string | null | undefined) {
  return BLOCKED_STATUSES.includes(normalizeStatus(status));
}

export type WorkFinancialInput = {
  presupuestoAprobado?: number | null;
  costePrevisto?: number | null;
  gastoReal?: number | null;
  margenEstimado?: number | null;
  subcontratasCoste?: number | null;
  budgets?: Array<{ total: number; estado: string }>;
  invoices?: Array<{
    total: number;
    pagado?: number | null;
    pendiente?: number | null;
    estado: string;
    payments?: Array<{ importe: number }>;
  }>;
  expenses?: Array<{ importe: number; categoria?: ExpenseCategory | string | null }>;
};

export function calculateWorkFinancials(work: WorkFinancialInput) {
  const budgets = work.budgets ?? [];
  const invoices = work.invoices ?? [];
  const expenses = work.expenses ?? [];
  const quoted = sum(budgets.filter((budget) => !["rechazado", "caducado"].includes(normalizeStatus(budget.estado))).map((budget) => budget.total));
  const accepted = sum(budgets.filter((budget) => ACCEPTED_BUDGET_STATUSES.includes(normalizeStatus(budget.estado))).map((budget) => budget.total));
  const budgeted = safeNumber(work.presupuestoAprobado) || accepted || quoted;
  const forecastCost = safeNumber(work.costePrevisto) || Math.max(0, budgeted - safeNumber(work.margenEstimado));
  const billableInvoices = invoices.filter((invoice) => !BILLABLE_INVOICE_EXCLUDED_STATUSES.includes(normalizeStatus(invoice.estado)));
  const invoiced = sum(billableInvoices.map((invoice) => invoice.total));
  const paid = sum(billableInvoices.map((invoice) => invoicePaid(invoice)));
  const pending = sum(billableInvoices.map((invoice) => Math.max(0, invoice.total - invoicePaid(invoice))));
  const registeredExpenses = sum(expenses.map((expense) => expense.importe));
  const subcontractorExpenses = sum(expenses.filter((expense) => normalizeStatus(expense.categoria) === "subcontrata").map((expense) => expense.importe));
  const realCost = Math.max(safeNumber(work.gastoReal), registeredExpenses);
  const revenueBase = invoiced || budgeted;
  const benefit = revenueBase - realCost;
  const marginPercent = revenueBase > 0 ? Math.round((benefit / revenueBase) * 1000) / 10 : 0;
  const deviation = realCost - forecastCost;

  return {
    quoted,
    budgeted,
    forecastCost,
    invoiced,
    paid,
    pending,
    registeredExpenses,
    subcontractorExpenses: subcontractorExpenses + safeNumber(work.subcontratasCoste),
    realCost,
    benefit,
    marginPercent,
    deviation,
    invoiceCount: billableInvoices.length,
    openInvoiceCount: billableInvoices.filter((invoice) => OPEN_INVOICE_STATUSES.includes(normalizeStatus(invoice.estado)) && Math.max(0, invoice.total - invoicePaid(invoice)) > 0).length,
    budgetCount: budgets.length
  };
}

export type WorkNextActionInput = {
  estado: string;
  fechaInicioPrevista?: DateLike;
  fechaInicio?: DateLike;
  fechaFinPrevista?: DateLike;
  materials?: Array<{ estado: string; nombre: string }>;
  invoices?: Array<{ total: number; estado: string; fechaVencimiento?: DateLike; payments?: Array<{ importe: number }> }>;
  reminders?: Array<{ estado: string; fechaProgramada: DateLike; mensaje: string; tipo: string }>;
  agendaEvents?: Array<{ estado: string; fechaInicio: DateLike; titulo: string; tipo: string }>;
  budgets?: Array<{ estado: string; total: number }>;
};

export function getWorkNextAction(work: WorkNextActionInput, now: Date = new Date()) {
  const pendingMaterial = (work.materials ?? []).find((material) => ["pendiente", "falta"].includes(normalizeStatus(material.estado)));
  if (pendingMaterial) return { label: `Resolver material: ${pendingMaterial.nombre}`, tone: "warning" as const, href: "materiales" };

  const overdue = (work.invoices ?? []).find((invoice) => {
    const due = toDate(invoice.fechaVencimiento);
    return due && due < startOfDay(now) && Math.max(0, invoice.total - invoicePaid(invoice)) > 0;
  });
  if (overdue) return { label: "Reclamar factura vencida", tone: "danger" as const, href: "cobros" };

  const reminder = (work.reminders ?? [])
    .filter((item) => ["borrador", "pendiente_confirmacion", "programado"].includes(normalizeStatus(item.estado)))
    .sort((a, b) => timeValue(a.fechaProgramada) - timeValue(b.fechaProgramada))[0];
  if (reminder) return { label: `Recordatorio: ${reminder.tipo.replaceAll("_", " ")}`, tone: "info" as const, href: "recordatorios" };

  const event = (work.agendaEvents ?? [])
    .filter((item) => !["cancelado", "realizado"].includes(normalizeStatus(item.estado)))
    .sort((a, b) => timeValue(a.fechaInicio) - timeValue(b.fechaInicio))[0];
  if (event) return { label: `${event.tipo.replaceAll("_", " ")}: ${event.titulo}`, tone: "info" as const, href: "visitas" };

  const hasBudget = (work.budgets ?? []).some((budget) => !["rechazado", "caducado"].includes(normalizeStatus(budget.estado)));
  if (!hasBudget) return { label: "Crear presupuesto asociado", tone: "warning" as const, href: "presupuestos" };

  if (["finalizada", "facturada_parcialmente"].includes(normalizeStatus(work.estado))) return { label: "Revisar facturación pendiente", tone: "warning" as const, href: "facturas" };
  if (isActiveWorkStatus(work.estado)) return { label: "Revisar avance y próxima visita", tone: "neutral" as const, href: "resumen" };
  return { label: "Sin acción crítica", tone: "success" as const, href: "resumen" };
}

export function buildWorkRisks(work: WorkNextActionInput & WorkFinancialInput, now: Date = new Date()) {
  const financial = calculateWorkFinancials(work);
  const risks: Array<{ key: string; level: "warning" | "danger"; title: string; detail: string }> = [];
  if (financial.marginPercent < 15 && (financial.invoiced || financial.budgeted)) {
    risks.push({ key: "margin", level: financial.marginPercent < 5 ? "danger" : "warning", title: "Margen bajo", detail: `Margen actual ${financial.marginPercent}%.` });
  }
  if (financial.deviation > 0) {
    risks.push({ key: "deviation", level: financial.deviation > financial.forecastCost * 0.15 ? "danger" : "warning", title: "Desviación de coste", detail: "El coste real supera el coste previsto." });
  }
  const due = toDate(work.fechaFinPrevista);
  if (due && due < startOfDay(now) && !["finalizada", "cerrada", "cobrada", "archivada"].includes(normalizeStatus(work.estado))) {
    risks.push({ key: "late", level: "danger", title: "Fin previsto vencido", detail: "La fecha fin prevista ya ha pasado." });
  }
  if ((work.materials ?? []).some((material) => ["pendiente", "falta"].includes(normalizeStatus(material.estado)))) {
    risks.push({ key: "materials", level: "warning", title: "Material pendiente", detail: "Hay materiales sin resolver." });
  }
  if (financial.pending > 0) {
    risks.push({ key: "collection", level: "warning", title: "Cobro pendiente", detail: "Hay saldo pendiente de cobro asociado a la obra." });
  }
  return risks;
}

export type WorkTimelineInput = {
  id: string;
  titulo: string;
  fechaCreacion?: DateLike;
  fechaInicio?: DateLike;
  fechaInicioReal?: DateLike;
  fechaFinReal?: DateLike;
  updatedAt?: DateLike;
  budgets?: Array<{ id: string; numero: string; titulo: string; total: number; estado: string; fechaCreacion: DateLike; fechaEnvio?: DateLike | null }>;
  invoices?: Array<{ id: string; numero: string; concepto: string; total: number; estado: string; fechaEmision: DateLike; payments?: Array<{ id: string; importe: number; fecha: DateLike; metodo: string }> }>;
  expenses?: Array<{ id: string; proveedor: string; concepto: string; importe: number; fecha: DateLike; categoria: string }>;
  materials?: Array<{ id: string; nombre: string; estado: string; notas?: string | null }>;
  reminders?: Array<{ id: string; tipo: string; estado: string; fechaProgramada: DateLike; mensaje: string }>;
  agendaEvents?: Array<{ id: string; titulo: string; tipo: string; estado: string; fechaInicio: DateLike }>;
  documents?: Array<{ id: string; tipo: string; nombre: string; fecha: DateLike; url?: string | null }>;
  photos?: Array<{ id: string; categoria: string; titulo: string; tomadaEn: DateLike; url?: string | null }>;
};

export function buildWorkTimeline(work: WorkTimelineInput) {
  const items: Array<{ key: string; date: Date; title: string; detail: string; icon: string; href?: string }> = [];
  addTimeline(items, work.fechaCreacion, `Obra creada: ${work.titulo}`, "Registro inicial de la obra.", "BriefcaseBusiness");
  addTimeline(items, work.fechaInicioReal ?? work.fechaInicio, "Inicio de obra", "Fecha de arranque registrada.", "PlayCircle");
  addTimeline(items, work.fechaFinReal, "Fin real de obra", "La obra tiene fecha fin real registrada.", "Flag");

  for (const budget of work.budgets ?? []) {
    addTimeline(items, budget.fechaCreacion, `Presupuesto ${budget.numero}`, `${budget.titulo} · ${budget.estado}`, "FileText", `/presupuestos/${budget.id}`);
    addTimeline(items, budget.fechaEnvio, `Presupuesto enviado ${budget.numero}`, "Seguimiento comercial disponible.", "Send", `/presupuestos/${budget.id}`);
  }
  for (const invoice of work.invoices ?? []) {
    addTimeline(items, invoice.fechaEmision, `Factura ${invoice.numero}`, `${invoice.concepto} · ${invoice.estado}`, "Receipt", `/dinero/${invoice.id}`);
    for (const payment of invoice.payments ?? []) {
      addTimeline(items, payment.fecha, `Cobro recibido`, `${payment.metodo} · ${payment.importe}`, "WalletCards", `/dinero/${invoice.id}`);
    }
  }
  for (const expense of work.expenses ?? []) {
    addTimeline(items, expense.fecha, `Gasto registrado`, `${expense.proveedor} · ${expense.concepto}`, "Banknote", "/gastos-materiales");
  }
  for (const event of work.agendaEvents ?? []) {
    addTimeline(items, event.fechaInicio, `${event.tipo.replaceAll("_", " ")}: ${event.titulo}`, event.estado, "CalendarClock", "/agenda");
  }
  for (const reminder of work.reminders ?? []) {
    addTimeline(items, reminder.fechaProgramada, `Recordatorio ${reminder.tipo.replaceAll("_", " ")}`, reminder.estado, "Bell", "/recordatorios");
  }
  for (const document of work.documents ?? []) {
    addTimeline(items, document.fecha, `Documento: ${document.nombre}`, document.tipo, "FileArchive", document.url ?? undefined);
  }
  for (const photo of work.photos ?? []) {
    addTimeline(items, photo.tomadaEn, `Foto: ${photo.titulo}`, photo.categoria, "Image", photo.url ?? undefined);
  }

  return items.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function buildWorkDocuments(work: {
  id: string;
  documents?: Array<{ id: string; tipo: string; nombre: string; url?: string | null; fecha: DateLike; entityType?: string | null; entityId?: string | null }>;
  repositoryDocuments?: Array<{ id: string; name: string; category: string; url?: string | null; createdAt: DateLike }>;
  budgets?: Array<{ id: string; numero: string; titulo: string; fechaCreacion: DateLike }>;
  invoices?: Array<{ id: string; numero: string; concepto: string; fechaEmision: DateLike }>;
}) {
  return [
    ...(work.budgets ?? []).map((budget) => ({
      key: `budget-${budget.id}`,
      type: "Presupuesto",
      name: `${budget.numero} · ${budget.titulo}`,
      href: `/presupuestos/${budget.id}/pdf?preview=1`,
      date: budget.fechaCreacion,
      source: "Presupuesto PDF"
    })),
    ...(work.invoices ?? []).map((invoice) => ({
      key: `invoice-${invoice.id}`,
      type: "Factura",
      name: `${invoice.numero} · ${invoice.concepto}`,
      href: `/dinero/${invoice.id}/pdf?preview=1`,
      date: invoice.fechaEmision,
      source: "Factura PDF"
    })),
    ...(work.documents ?? []).map((document) => ({
      key: `document-${document.id}`,
      type: document.tipo,
      name: document.nombre,
      href: document.url ?? null,
      date: document.fecha,
      source: "Documento de obra legacy"
    })),
    ...(work.repositoryDocuments ?? []).map((document) => ({
      key: `repository-${document.id}`,
      type: document.category.replaceAll("_", " "),
      name: document.name,
      href: document.url ?? null,
      date: document.createdAt,
      source: document.url ? "Repositorio documental" : "Ficha documental sin archivo adjunto"
    }))
  ].sort((a, b) => timeValue(b.date) - timeValue(a.date));
}

function addTimeline(items: Array<{ key: string; date: Date; title: string; detail: string; icon: string; href?: string }>, value: DateLike, title: string, detail: string, icon: string, href?: string) {
  const date = toDate(value);
  if (!date) return;
  items.push({ key: `${icon}-${items.length}-${date.getTime()}`, date, title, detail, icon, href });
}

export function normalizeStatus(status: string | null | undefined) {
  return String(status ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export function safeNumber(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function invoicePaid(invoice: { total?: number; pagado?: number | null; payments?: Array<{ importe: number }> }) {
  const payments = sum((invoice.payments ?? []).map((payment) => payment.importe));
  return Math.max(payments, safeNumber(invoice.pagado));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + safeNumber(value), 0);
}

function toDate(value: DateLike) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timeValue(value: DateLike) {
  return toDate(value)?.getTime() ?? 0;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function validWorkPriority(value: string | null | undefined): WorkPriority {
  const normalized = normalizeStatus(value);
  return ["baja", "media", "alta", "urgente"].includes(normalized) ? normalized as WorkPriority : "media";
}

export function validWorkStatus(value: string | null | undefined): WorkStatus {
  const normalized = normalizeStatus(value);
  return Object.keys(WORK_STATUS_META).includes(normalized) ? normalized as WorkStatus : "pendiente_inicio";
}
