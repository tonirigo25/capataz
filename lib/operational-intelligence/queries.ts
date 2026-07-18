import { requireCompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { buildOperationalContext, buildOperationalSignals, selectDiverseSignals } from "@/lib/operational-intelligence/rules";
import type { OperationalContext, OperationalSignal, OperationalSignalCategory } from "@/lib/operational-intelligence/types";

type Scope = { clientId?: string; workId?: string };

export async function getOperationalIntelligence(options: Scope & { category?: string; limit?: number; now?: Date } = {}) {
  const { companyId } = await requireCompanyContext();
  const now = options.now ?? new Date();
  const entityWhere = options.workId ? { workId: options.workId } : options.clientId ? { clientId: options.clientId } : {};
  const workWhere = options.workId ? { id: options.workId } : options.clientId ? { clienteId: options.clientId } : {};
  const invoiceWhere = options.workId ? { obraId: options.workId } : options.clientId ? { clienteId: options.clientId } : {};
  const purchaseWhere = options.workId ? { workId: options.workId } : {};
  const partnerWhere = options.workId ? { workLinks: { some: { companyId, workId: options.workId } } } : {};

  const [tasks, followUps, agenda, invoices, budgets, works, purchaseInvoices, partners] = await Promise.all([
    prisma.task.findMany({ where: { companyId, archivedAt: null, ...entityWhere }, select: { id: true, title: true, status: true, dueAt: true, clientId: true, workId: true }, orderBy: { dueAt: "asc" }, take: 200 }),
    prisma.followUp.findMany({ where: { companyId, archivedAt: null, ...entityWhere }, select: { id: true, title: true, status: true, nextActionAt: true, clientId: true, workId: true }, orderBy: { nextActionAt: "asc" }, take: 200 }),
    prisma.eventoAgenda.findMany({ where: { companyId, ...(options.workId ? { obraId: options.workId } : options.clientId ? { clienteId: options.clientId } : {}) }, select: { id: true, titulo: true, estado: true, tipo: true, fechaInicio: true, clienteId: true, obraId: true }, orderBy: { fechaInicio: "asc" }, take: 200 }),
    prisma.invoice.findMany({ where: { companyId, ...invoiceWhere }, select: { id: true, numero: true, estado: true, total: true, pagado: true, fechaVencimiento: true, client: { select: { id: true, nombre: true } }, work: { select: { id: true, titulo: true } }, payments: { select: { id: true, importe: true } } }, orderBy: { fechaVencimiento: "asc" }, take: 200 }),
    prisma.budget.findMany({ where: { companyId, ...invoiceWhere }, select: { id: true, numero: true, titulo: true, estado: true, fechaCreacion: true, fechaEnvio: true, fechaSeguimiento: true, client: { select: { id: true, nombre: true } }, work: { select: { id: true, titulo: true } } }, orderBy: { fechaSeguimiento: "asc" }, take: 200 }),
    prisma.work.findMany({ where: { companyId, archivada: false, ...workWhere }, select: { id: true, titulo: true, estado: true, updatedAt: true, presupuestoAprobado: true, costePrevisto: true, gastoReal: true, client: { select: { id: true, nombre: true } }, invoices: { select: { id: true, estado: true, total: true, pagado: true, payments: { select: { id: true, importe: true } } } }, expenses: { select: { importe: true } }, budgets: { select: { total: true, estado: true } }, internalNotes: { where: { archivedAt: null }, select: { createdAt: true, updatedAt: true } }, photos: { select: { tomadaEn: true, createdAt: true } }, documents: { select: { fecha: true, updatedAt: true } }, agendaEvents: { select: { updatedAt: true } } }, orderBy: { updatedAt: "desc" }, take: 200 }),
    prisma.purchaseInvoice.findMany({ where: { companyId, ...purchaseWhere }, select: { id: true, invoiceNumber: true, status: true, dueDate: true, pendingAmount: true, voidedAt: true, businessPartner: { select: { id: true, commercialName: true } }, work: { select: { id: true, titulo: true } } }, orderBy: { dueDate: "asc" }, take: 200 }),
    prisma.businessPartner.findMany({ where: { companyId, archivedAt: null, ...partnerWhere }, select: { id: true, commercialName: true, documentStatus: true, documentExpiresAt: true }, orderBy: { documentExpiresAt: "asc" }, take: 200 })
  ]);

  let signals = buildOperationalSignals({
    tasks,
    followUps,
    agenda: agenda.map((item) => ({ id: item.id, title: item.titulo, status: item.estado, type: item.tipo, startsAt: item.fechaInicio, clientId: item.clienteId, workId: item.obraId })),
    invoices,
    budgets,
    works: works.map((work) => ({ ...work, activityDates: [work.updatedAt, ...work.internalNotes.flatMap((item) => [item.createdAt, item.updatedAt]), ...work.photos.flatMap((item) => [item.tomadaEn, item.createdAt]), ...work.documents.flatMap((item) => [item.fecha, item.updatedAt]), ...work.agendaEvents.map((item) => item.updatedAt)] })),
    purchaseInvoices,
    partners
  }, now);

  if (isCategory(options.category)) signals = signals.filter((item) => item.category === options.category);
  return { companyId, signals: options.limit ? selectDiverseSignals(signals, options.limit) : signals, context: buildOperationalContext(signals), updatedAt: now };
}

export async function getTodayOperationalSignals(options: { category?: string; limit?: number } = {}) {
  return getOperationalIntelligence({ category: options.category, limit: options.limit ?? 5 });
}

export async function getClientOperationalContext(clientId: string): Promise<OperationalContext> {
  return (await getOperationalIntelligence({ clientId })).context;
}

export async function getWorkOperationalContext(workId: string): Promise<OperationalContext> {
  return (await getOperationalIntelligence({ workId })).context;
}

export async function getOperationalContextsForClients(clientIds: string[]) {
  const all = (await getOperationalIntelligence()).signals;
  return contextMap(clientIds, all, (signal, id) => signal.entity.clientId === id);
}

export async function getOperationalContextsForWorks(workIds: string[]) {
  const all = (await getOperationalIntelligence()).signals;
  return contextMap(workIds, all, (signal, id) => signal.entity.workId === id);
}

export function buildOperationalHealth(signals: OperationalSignal[]) {
  const count = (category: OperationalSignalCategory) => signals.filter((item) => item.category === category).length;
  return {
    urgent: signals.filter((item) => item.level === "urgente").length,
    planning: count("planificacion"),
    collections: count("cobros"),
    inactiveWorks: signals.filter((item) => item.rule === "obra_sin_actividad").length,
    documentation: count("compras_documentacion")
  };
}

function contextMap(ids: string[], signals: OperationalSignal[], matches: (signal: OperationalSignal, id: string) => boolean) {
  return new Map(ids.map((id) => [id, buildOperationalContext(signals.filter((signal) => matches(signal, id)))]));
}

function isCategory(value: string | undefined): value is OperationalSignalCategory {
  return ["planificacion", "actividad", "ventas", "cobros", "compras_documentacion", "economia_obra"].includes(value ?? "");
}

