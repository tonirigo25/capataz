import { summarizeActiveTask } from "@/lib/capataz-chat-engine";
import { buildClientContacts } from "@/lib/contacts";
import { normalizeQueryText, type ChatIntentClassification, type PendingDetailCategory } from "@/lib/capataz-chat-query";
import { getAgendaItems, itemsForDay as agendaItemsForDay, itemsBetween as agendaItemsBetween, addDays as agendaAddDays, startOfDay as agendaStartOfDay } from "@/lib/agenda";
import type { WorkStatus } from "@prisma/client";
import { getNotificationItems } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { buildWorkDocuments, calculateWorkFinancials } from "@/lib/works";
import { requireCompanyContext } from "@/lib/auth/session";
import { findLatestPendingTaskForCompany } from "@/lib/orqena/conversation-repository";
import { findClientMatches, normalizeConversationContext } from "@/lib/orqena/application/capataz/conversation-use-cases";
import { ChatActionResult, ChatCommandContext, ChatCommandResult, conversationTenantContext } from "@/lib/orqena/application/capataz/orchestration";
import { formatEuros } from "@/lib/orqena/application/capataz/shared-helpers";
import { withLastQuery } from "@/lib/orqena/application/capataz/workflow-queries";

async function queryExpensesSummary(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const expenses = await prisma.expense.findMany({ where: { companyId, ...expensePeriodWhere(intent.period) }, select: { importe: true } });
  const total = expenses.reduce((sum, expense) => sum + expense.importe, 0);
  return {
    handled: true,
    text: expenses.length
      ? `${periodText(intent.period, "gastos")}: ${formatEuros(total)} en ${expenses.length} gastos registrados.`
      : `${periodText(intent.period, "gastos")}: no hay gastos registrados.`
  };
}

// Retained for deterministic query compatibility.
void queryExpensesSummary;

export async function queryClientBudgets(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  if (!intent.clientName) return { handled: true, text: "Dime de qué cliente quieres consultar los presupuestos." };
  const client = await clientForQuery(intent.clientName);
  if (!client) return noClientResult(intent.clientName);
  const budgets = await prisma.budget.findMany({ where: { companyId, clienteId: client.id }, orderBy: { fechaCreacion: "desc" }, take: 10, include: { client: true, work: true } });
  return compactListResult(budgets, `presupuestos de ${client.nombre}`, (budget) => `${budget.numero} · ${budget.titulo} · ${formatEuros(budget.total)} · ${budget.estado} · /presupuestos/${budget.id}`);
}

export async function queryClientPayments(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  if (!intent.clientName) return { handled: true, text: "Dime de qué cliente quieres consultar los pagos." };
  const client = await clientForQuery(intent.clientName);
  if (!client) return noClientResult(intent.clientName);
  const payments = await prisma.payment.findMany({ where: { companyId, clienteId: client.id }, orderBy: { fecha: "desc" }, take: 10, include: { invoice: true } });
  const total = payments.reduce((sum, payment) => sum + payment.importe, 0);
  return {
    handled: true,
    text: payments.length
      ? `${client.nombre} ha pagado ${formatEuros(total)} en ${payments.length} pagos registrados.\n${payments.map((payment, index) => `${index + 1}. ${formatDateShort(payment.fecha)} · ${formatEuros(payment.importe)} · ${payment.invoice.numero} · /dinero/${payment.facturaId}`).join("\n")}`
      : `No hay pagos registrados para ${client.nombre}.`
  };
}

export async function queryClientContacts(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  if (!intent.clientName) return { handled: true, text: "Dime de qué cliente quieres consultar los contactos." };
  const client = await prisma.client.findFirst({
    where: { companyId, OR: [{ nombre: { contains: intent.clientName, mode: "insensitive" } }, { razonSocial: { contains: intent.clientName, mode: "insensitive" } }, { nombreComercial: { contains: intent.clientName, mode: "insensitive" } }] },
    include: { contacts: { orderBy: [{ archivedAt: "asc" }, { isPrimary: "desc" }, { nombre: "asc" }] } }
  });
  if (!client) return noClientResult(intent.clientName);
  const contacts = buildClientContacts(client);
  return compactListResult(contacts, `contactos de ${client.nombre}`, (contact) => `${contact.name} · ${contact.role} · ${contact.flags.join(", ") || "sin marca"} · ${contact.phone ?? contact.email ?? "sin teléfono/email"}`);
}

export async function queryWorkDocuments(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  if (!intent.clientName) return { handled: true, text: "Dime de qué obra quieres consultar los documentos." };
  const work = await prisma.work.findFirst({
    where: {
      companyId,
      OR: [
        { titulo: { contains: intent.clientName, mode: "insensitive" } },
        { codigo: { contains: intent.clientName, mode: "insensitive" } },
        { numeroInterno: { contains: intent.clientName, mode: "insensitive" } },
        { client: { nombre: { contains: intent.clientName, mode: "insensitive" } } }
      ]
    },
    include: {
      budgets: true,
      invoices: true,
      documents: true,
      repositoryDocuments: true,
      client: true
    }
  });
  if (!work) return { handled: true, diagnostics: { resultCount: 0 }, text: `No he encontrado una obra que coincida con “${intent.clientName}”.` };
  const documents = buildWorkDocuments(work);
  return compactListResult(documents, `documentos de ${work.titulo}`, (document) => `${document.type} · ${document.name} · ${document.source}${document.href ? ` · ${document.href}` : ""}`);
}

export async function queryInternalNotes(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  if (!intent.clientName) return { handled: true, text: "Dime de qué cliente u obra quieres consultar las notas internas." };
  const notes = await prisma.internalNote.findMany({
    where: {
      companyId,
      archivedAt: null,
      OR: [
        { client: { nombre: { contains: intent.clientName, mode: "insensitive" } } },
        { client: { razonSocial: { contains: intent.clientName, mode: "insensitive" } } },
        { work: { titulo: { contains: intent.clientName, mode: "insensitive" } } }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { client: true, work: true, budget: true, invoice: true }
  });
  return compactListResult(notes, `notas internas de ${intent.clientName}`, (note) => `${formatDateShort(note.createdAt)} · ${note.client?.nombre ?? note.work?.titulo ?? note.budget?.numero ?? note.invoice?.numero ?? "Entidad"} · ${note.content}`);
}

export async function queryAgendaToday(): Promise<ChatCommandResult> {
  const items = agendaItemsForDay(await getAgendaItems(), new Date()).filter((item) => item.estado !== "cancelado");
  return compactListResult(items, "agenda de hoy", (item) => `${formatDateShort(item.fechaInicio)} · ${item.titulo} · ${item.clienteNombre ?? item.contactName ?? item.obraTitulo ?? "Interno"} · ${item.href}`);
}

export async function queryUpcomingVisits(): Promise<ChatCommandResult> {
  const start = agendaStartOfDay(new Date());
  const end = agendaAddDays(start, 7);
  const items = agendaItemsBetween(await getAgendaItems(), start, end).filter((item) => item.tipo === "visita" && item.estado !== "cancelado");
  return compactListResult(items, "próximas visitas", (item) => `${formatDateShort(item.fechaInicio)} · ${item.titulo} · ${item.clienteNombre ?? item.contactName ?? item.obraTitulo ?? "Sin entidad"} · ${item.href}`);
}

export async function queryPendingRemindersCount(): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const count = await prisma.reminder.count({ where: { companyId, estado: { in: ["borrador", "pendiente_confirmacion", "programado"] } } });
  return { handled: true, diagnostics: { resultCount: count }, text: count ? `Tienes ${count} recordatorios pendientes o programados.` : "No tienes recordatorios pendientes." };
}

export async function queryPendingNotifications(): Promise<ChatCommandResult> {
  const notifications = (await getNotificationItems()).filter((item) => !item.readAt);
  return compactListResult(notifications, "notificaciones pendientes", (item) => `${item.priority} · ${item.title} · ${item.body} · ${item.href}`);
}

export async function queryWorksByStatus(statuses: string[], label: string): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const works = await prisma.work.findMany({
    where: { companyId, estado: { in: statuses as WorkStatus[] } },
    orderBy: [{ prioridad: "desc" }, { fechaFinPrevista: "asc" }],
    take: 10,
    include: { client: true, budgets: true, invoices: { include: { payments: true } }, expenses: true, materials: true, reminders: true, agendaEvents: true }
  });
  return compactListResult(works, label, (work) => renderWorkQueryLine(work), { resultCount: works.length });
}

export async function queryWorkHighestRevenue(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  void intent;
  const { companyId } = await requireCompanyContext();
  const works = await prisma.work.findMany({
    where: { companyId },
    include: { client: true, budgets: true, invoices: { include: { payments: true } }, expenses: true, materials: true, reminders: true, agendaEvents: true }
  });
  const ranked = works
    .map((work) => ({ work, financial: calculateWorkFinancials(work) }))
    .filter((item) => item.financial.invoiced > 0)
    .sort((a, b) => b.financial.invoiced - a.financial.invoiced);
  const top = ranked[0];
  if (!top) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay obras con facturación registrada." };
  return {
    handled: true,
    diagnostics: { resultCount: ranked.length },
    result: {
      type: "found",
      entityType: "project",
      entityId: top.work.id,
      title: "Obra que más factura",
      summary: { obra: top.work.titulo, cliente: top.work.client.nombre, facturado: top.financial.invoiced, margen: top.financial.marginPercent },
      actions: [{ label: "Ver obra", href: `/obras/${top.work.id}`, style: "primary" }, { label: "Ver facturas", href: "/dinero" }]
    },
    text: `La obra que más factura es ${top.work.titulo}, de ${top.work.client.nombre}, con ${formatEuros(top.financial.invoiced)} facturados y margen del ${top.financial.marginPercent}%.`
  };
}

export async function queryWorkLowestMargin(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  void intent;
  const { companyId } = await requireCompanyContext();
  const works = await prisma.work.findMany({
    where: { companyId },
    include: { client: true, budgets: true, invoices: { include: { payments: true } }, expenses: true, materials: true, reminders: true, agendaEvents: true }
  });
  const ranked = works
    .map((work) => ({ work, financial: calculateWorkFinancials(work) }))
    .filter((item) => item.financial.budgeted > 0 || item.financial.invoiced > 0)
    .sort((a, b) => a.financial.marginPercent - b.financial.marginPercent);
  const top = ranked[0];
  if (!top) return { handled: true, diagnostics: { resultCount: 0 }, text: "No hay obras con presupuesto o facturación suficiente para calcular margen." };
  return {
    handled: true,
    diagnostics: { resultCount: ranked.length },
    result: {
      type: "found",
      entityType: "project",
      entityId: top.work.id,
      title: "Obra con menor margen",
      summary: { obra: top.work.titulo, cliente: top.work.client.nombre, margen: top.financial.marginPercent, beneficio: top.financial.benefit },
      actions: [{ label: "Ver obra", href: `/obras/${top.work.id}`, style: "primary" }, { label: "Ver gastos", href: "/gastos-materiales" }]
    },
    text: `La obra con menor margen es ${top.work.titulo}, de ${top.work.client.nombre}: ${top.financial.marginPercent}% y beneficio estimado ${formatEuros(top.financial.benefit)}.`
  };
}

export async function queryWorksStartingThisWeek(): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const range = currentWeekRange();
  const works = await prisma.work.findMany({
    where: {
      companyId,
      OR: [
        { fechaInicioPrevista: range },
        { fechaInicio: range }
      ]
    },
    orderBy: [{ fechaInicioPrevista: "asc" }, { fechaInicio: "asc" }],
    take: 10,
    include: { client: true, budgets: true, invoices: { include: { payments: true } }, expenses: true, materials: true, reminders: true, agendaEvents: true }
  });
  return compactListResult(works, "obras que empiezan esta semana", (work) => `${work.titulo} · ${work.client.nombre} · inicio ${formatDateShort(work.fechaInicioPrevista ?? work.fechaInicio ?? new Date())} · /obras/${work.id}`, { resultCount: works.length });
}

export async function queryWorksEndingToday(): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const range = todayRange();
  const works = await prisma.work.findMany({
    where: { companyId, fechaFinPrevista: range },
    orderBy: { fechaFinPrevista: "asc" },
    take: 10,
    include: { client: true, budgets: true, invoices: { include: { payments: true } }, expenses: true, materials: true, reminders: true, agendaEvents: true }
  });
  return compactListResult(works, "obras que terminan hoy", (work) => `${work.titulo} · ${work.client.nombre} · estado ${work.estado} · /obras/${work.id}`, { resultCount: works.length });
}

export async function queryProjectHighestExpenses(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const expenses = await prisma.expense.findMany({ where: { companyId, ...expensePeriodWhere(intent.period) }, include: { work: { include: { client: true } } } });
  const totals = new Map<string, { workId: string; title: string; client: string; total: number }>();
  for (const expense of expenses) {
    if (!expense.obraId || !expense.work) continue;
    const current = totals.get(expense.obraId) ?? { workId: expense.obraId, title: expense.work.titulo, client: expense.work.client.nombre, total: 0 };
    current.total += expense.importe;
    totals.set(expense.obraId, current);
  }
  const top = [...totals.values()].sort((a, b) => b.total - a.total)[0];
  if (!top) return { handled: true, text: "No hay gastos asociados a obras en ese periodo." };
  return {
    handled: true,
    result: {
      type: "found",
      entityType: "project",
      entityId: top.workId,
      title: "Obra con más gastos",
      summary: { obra: top.title, cliente: top.client, gastos: top.total },
      actions: [{ label: "Ver obras", href: "/obras", style: "primary" }, { label: "Ver gastos", href: "/gastos-materiales" }]
    },
    text: `La obra con más gastos es ${top.title}, de ${top.client}, con ${formatEuros(top.total)} registrados.`
  };
}

function renderWorkQueryLine(work: {
  id: string;
  titulo: string;
  estado: string;
  client: { nombre: string };
  budgets: Array<{ total: number; estado: string }>;
  invoices: Array<{ total: number; pagado: number | null; pendiente: number | null; estado: string; payments: Array<{ importe: number }> }>;
  expenses: Array<{ importe: number; categoria: string }>;
}) {
  const financial = calculateWorkFinancials(work);
  return `${work.titulo} · ${work.client.nombre} · ${work.estado} · facturado ${formatEuros(financial.invoiced)} · margen ${financial.marginPercent}% · /obras/${work.id}`;
}

export async function queryRecentDocuments(intent: ChatIntentClassification): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const [budgets, invoices] = await Promise.all([
    prisma.budget.findMany({ where: { companyId, ...budgetPeriodWhere(intent.period) }, orderBy: { fechaCreacion: "desc" }, take: 5, include: { client: true } }),
    prisma.invoice.findMany({ where: { companyId, ...invoicePeriodWhere(intent.period) }, orderBy: { fechaEmision: "desc" }, take: 5, include: { client: true } })
  ]);
  const docs = [
    ...budgets.map((budget) => ({ date: budget.fechaCreacion, line: `Presupuesto ${budget.numero} · ${budget.client.nombre} · ${formatEuros(budget.total)} · /presupuestos/${budget.id}` })),
    ...invoices.map((invoice) => ({ date: invoice.fechaEmision, line: `Factura ${invoice.numero} · ${invoice.client.nombre} · ${formatEuros(invoice.total)} · /dinero/${invoice.id}` }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
  return compactListResult(docs, "documentos recientes", (doc) => doc.line);
}

export function withPendingDetailLastQuery(context: ChatCommandContext | null, category: PendingDetailCategory, resultIds: string[]) {
  return withLastQuery(context, {
    type: "pending_detail",
    category,
    filters: { category },
    resultIds,
    handler: "queryPendingTaskDetails",
    timestamp: new Date().toISOString()
  });
}

export function compactListResult<T>(
  items: T[],
  label: string,
  render: (item: T) => string,
  options: { context?: ChatCommandContext | null; resultCount?: number } = {}
): ChatCommandResult {
  if (!items.length) {
    return {
      handled: true,
      context: options.context,
      diagnostics: { resultCount: options.resultCount ?? 0 },
      text: `No hay ${label} registrados ahora mismo.`
    };
  }
  return {
    handled: true,
    context: options.context,
    diagnostics: { resultCount: options.resultCount ?? items.length },
    text: `Estos son los ${label} que veo ahora:\n\n${items.map((item, index) => `${index + 1}. ${render(item)}`).join("\n")}${items.length >= 10 ? "\n\nTe muestro 10 como máximo. Puedes pedirme que filtre por cliente, estado o fecha." : ""}`
  };
}

export function budgetQueryCard(title: string, budget: {
  id: string;
  numero: string;
  titulo: string;
  subtotal: number;
  iva: number;
  total: number;
  estado: string;
  fechaCreacion: Date;
  client: { nombre: string };
  work: { titulo: string } | null;
}): ChatActionResult {
  return {
    type: "found",
    entityType: "quote",
    entityId: budget.id,
    title,
    summary: {
      numero: budget.numero,
      cliente: budget.client.nombre,
      obra: budget.work?.titulo ?? budget.titulo,
      importe: budget.subtotal,
      iva: budget.iva,
      total: budget.total,
      estado: budget.estado,
      fecha: formatDateShort(budget.fechaCreacion)
    },
    actions: [
      { label: "Ver presupuesto", href: `/presupuestos/${budget.id}`, style: "primary" },
      { label: "Editar", href: `/gestion?tipo=presupuesto&id=${budget.id}&returnTo=/capataz` },
      { label: "Ver PDF", href: `/presupuestos/${budget.id}/pdf?preview=1` }
    ]
  };
}

export function invoiceQueryCard(title: string, invoice: {
  id: string;
  numero: string;
  concepto: string;
  importeBase: number;
  iva: number;
  total: number;
  pagado: number;
  pendiente: number;
  estado: string;
  fechaEmision: Date;
  client: { nombre: string };
  work: { titulo: string } | null;
}): ChatActionResult {
  return {
    type: "found",
    entityType: "invoice",
    entityId: invoice.id,
    title,
    summary: {
      numero: invoice.numero,
      cliente: invoice.client.nombre,
      obra: invoice.work?.titulo ?? invoice.concepto,
      base: invoice.importeBase,
      iva: invoice.iva,
      total: invoice.total,
      pagado: invoice.pagado,
      pendiente: invoice.pendiente,
      estado: invoice.estado,
      fecha: formatDateShort(invoice.fechaEmision)
    },
    actions: [
      { label: "Ver factura", href: `/dinero/${invoice.id}`, style: "primary" },
      { label: "Editar", href: `/gestion?tipo=factura&id=${invoice.id}&returnTo=/capataz` },
      { label: "Ver PDF", href: `/dinero/${invoice.id}/pdf?preview=1` }
    ]
  };
}

export async function clientForQuery(clientName?: string) {
  if (!clientName) return null;
  const matches = await findClientMatches(clientName);
  return matches[0] ?? null;
}

export function noClientResult(clientName: string): ChatCommandResult {
  return {
    handled: true,
    text: `No encuentro ningún cliente llamado ${clientName}. No he creado ni modificado nada.`
  };
}

export function budgetPeriodWhere(period?: ChatIntentClassification["period"]) {
  const range = dateRangeForPeriod(period);
  return range ? { fechaCreacion: range } : {};
}

export function invoicePeriodWhere(period?: ChatIntentClassification["period"]) {
  const range = dateRangeForPeriod(period);
  return range ? { fechaEmision: range } : {};
}

const collectibleInvoiceStates = ["emitida", "enviada", "pendiente", "pendiente_pago", "parcialmente_pagada", "vencida", "reclamada"] as const;

export async function findOpenInvoiceBalances(where: Record<string, unknown> = {}) {
  const { companyId } = await requireCompanyContext();
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      ...where,
      estado: { in: [...collectibleInvoiceStates] }
    },
    include: { client: true, work: true, payments: true }
  });
  return invoices
    .map((invoice) => {
      const paymentsTotal = Array.isArray(invoice.payments)
        ? invoice.payments.reduce((sum, payment) => sum + payment.importe, 0)
        : 0;
      const paid = Math.max(paymentsTotal, invoice.pagado ?? 0);
      const pending = Math.max(0, invoice.total - paid);
      return { invoice, paid, pending };
    })
    .filter(({ pending }) => pending > 0.009);
}

function expensePeriodWhere(period?: ChatIntentClassification["period"]) {
  const range = dateRangeForPeriod(period);
  return range ? { fecha: range } : {};
}

function dateRangeForPeriod(period?: ChatIntentClassification["period"]) {
  const now = new Date();
  if (!period || period === "all") return null;
  if (period === "this_week") {
    const start = startOfDay(now);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { gte: start, lt: end };
  }
  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { gte: start, lt: end };
  }
  if (period === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    return { gte: start, lt: end };
  }
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  return { gte: start, lt: end };
}

function currentWeekRange() {
  const start = startOfDay(new Date());
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { gte: start, lt: end };
}

function todayRange() {
  const start = startOfDay(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

export function periodText(period: ChatIntentClassification["period"], label: string) {
  if (period === "this_week") return `Resumen de ${label} de esta semana`;
  if (period === "this_month") return `Resumen de ${label} de este mes`;
  if (period === "last_month") return `Resumen de ${label} del mes pasado`;
  if (period === "this_year") return `Resumen de ${label} de este año`;
  return `Resumen de ${label}`;
}

export function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function formatDateShort(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function lowerInitial(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function pendingCountLabel(label: string, count: number) {
  if (count !== 1) return lowerInitial(label);
  const singular: Record<string, string> = {
    "Presupuestos pendientes": "presupuesto pendiente",
    "Presupuestos pendientes de enviar": "presupuesto pendiente de enviar",
    "Presupuestos pendientes de aceptar": "presupuesto pendiente de aceptar",
    "Facturas pendientes de cobro": "factura pendiente de cobro",
    "Facturas vencidas": "factura vencida",
    "Pagos parciales": "pago parcial",
    "Visitas pendientes": "visita pendiente",
    "Visitas por confirmar": "visita por confirmar",
    "Seguimientos pendientes": "seguimiento pendiente",
    "Recordatorios pendientes": "recordatorio pendiente",
    "Clientes con datos incompletos": "cliente con datos incompletos",
    "Obras activas con tareas pendientes": "obra activa con tareas pendientes",
    "Documentos pendientes de completar": "documento pendiente de completar"
  };
  return singular[label] ?? lowerInitial(label);
}

export function clientLooksIncomplete(client: { telefono: string | null; email?: string | null; direccion: string | null; estado?: string | null; notas?: string | null }) {
  const notes = normalizeQueryText(client.notas ?? "");
  return client.estado === "pendiente_datos"
    || !client.telefono
    || client.telefono === "Pendiente"
    || !client.email
    || !client.direccion
    || client.direccion === "Dirección pendiente"
    || (!notes.includes("nif") && !notes.includes("cif"));
}

export async function continueLatestPendingTask(): Promise<ChatCommandResult> {
  const conversations = await findLatestPendingTaskForCompany(await conversationTenantContext());
  const taskContext = conversations
    .map((conversation) => normalizeConversationContext(conversation.activeTask))
    .find((context) => context?.activeTask || context?.parkedTask);

  if (!taskContext?.activeTask && !taskContext?.parkedTask) {
    return {
      handled: true,
      text: "No encuentro una tarea pendiente reciente para retomar. Puedes abrir una conversación del historial o decirme cliente y documento.",
      context: null
    };
  }

  const activeTask = taskContext.activeTask ?? taskContext.parkedTask!;
  const resumedContext = {
    ...taskContext,
    activeTask: { ...activeTask, status: "activo" as const, updatedAt: new Date().toISOString() },
    parkedTask: undefined
  };

  return {
    handled: true,
    context: resumedContext,
    text: `${summarizeActiveTask(resumedContext.activeTask)}\n\nHe retomado esta tarea porque lo has pedido explícitamente.`
  };
}
