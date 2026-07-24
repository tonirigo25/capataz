import type { NotificationPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";
import { requireCompanyContext, type CompanyContext } from "@/lib/auth/session";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";
import { getEffectiveCapabilities, resolveScopedEntityIds } from "@/lib/commercial/authorization";

export type NotificationItem = {
  sourceKey: string;
  type: string;
  title: string;
  body: string;
  href: string;
  priority: NotificationPriority;
  date: Date;
  entityType: string;
  entityId: string;
  readAt: Date | null;
};

export async function getNotificationItems(provided?: { context: CompanyContext; domains: string[] }): Promise<NotificationItem[]> {
  const context = provided?.context ?? await requireCompanyContext();
  const manifest = await buildPortalManifest(context);
  const domains = provided?.domains ?? manifest.notificationDomains;
  const derived = await deriveNotifications(context, new Set(domains), manifest.documentClasses);
  const readStates = await prisma.notification.findMany({
    where: { companyId: context.companyId, sourceKey: { in: derived.map((item) => item.sourceKey) }, archivedAt: null },
    select: { sourceKey: true, readAt: true }
  });
  const readMap = new Map(readStates.map((item) => [item.sourceKey, item.readAt]));
  return derived.map((item) => ({ ...item, readAt: readMap.get(item.sourceKey) ?? null })).sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || b.date.getTime() - a.date.getTime());
}

export async function getUnreadNotificationCount(context: CompanyContext, domains: string[]) {
  const items = await getNotificationItems({ context, domains });
  return items.filter((item) => !item.readAt).length;
}

export async function markNotificationRead(sourceKey: string) {
  const context = await requireCompanyContext();
  const manifest = await buildPortalManifest(context);
  const domains = new Set(manifest.notificationDomains);
  const { companyId } = context;
  const item = (await deriveNotifications(context, domains, manifest.documentClasses)).find((notification) => notification.sourceKey === sourceKey);
  if (!item) return;
  const updated = await prisma.notification.updateMany({ where: { sourceKey, companyId }, data: { readAt: new Date(), archivedAt: null } });
  if (updated.count === 0) await prisma.notification.create({
    data: {
      companyId,
      sourceKey,
      type: item.type,
      title: item.title,
      body: item.body,
      href: item.href,
      priority: item.priority,
      entityType: item.entityType,
      entityId: item.entityId,
      readAt: new Date()
    }
  });
}

export async function markAllNotificationsRead() {
  const context = await requireCompanyContext();
  const manifest = await buildPortalManifest(context);
  const items = await deriveNotifications(context, new Set(manifest.notificationDomains), manifest.documentClasses);
  for (const item of items) await markNotificationRead(item.sourceKey);
}

async function deriveNotifications(context: CompanyContext, domains: Set<string>, documentClasses: string[]): Promise<Array<Omit<NotificationItem, "readAt">>> {
  const { companyId } = context;
  const now = new Date();
  const week = addDays(startOfDay(now), 7);
  const capabilities = new Set<string>(await getEffectiveCapabilities(context));
  const [invoiceWorkIds, invoiceClientIds, budgetWorkIds, budgetClientIds, reminderWorkIds, eventWorkIds, workIds, clientIds, documentIds] = await Promise.all([
    capabilities.has("sales.invoices.view") ? resolveScopedEntityIds(context, "sales.invoices.view", "Work") : Promise.resolve([]),
    capabilities.has("sales.invoices.view") ? resolveScopedEntityIds(context, "sales.invoices.view", "Client") : Promise.resolve([]),
    capabilities.has("sales.budgets.view") ? resolveScopedEntityIds(context, "sales.budgets.view", "Work") : Promise.resolve([]),
    capabilities.has("sales.budgets.view") ? resolveScopedEntityIds(context, "sales.budgets.view", "Client") : Promise.resolve([]),
    capabilities.has("followups.view") ? resolveScopedEntityIds(context, "followups.view", "Work") : Promise.resolve([]),
    capabilities.has("agenda.view") ? resolveScopedEntityIds(context, "agenda.view", "Work") : Promise.resolve([]),
    capabilities.has("work.view") ? resolveScopedEntityIds(context, "work.view", "Work") : Promise.resolve([]),
    capabilities.has("clients.view") ? resolveScopedEntityIds(context, "clients.view", "Client") : Promise.resolve([]),
    capabilities.has("documents.view") ? resolveScopedEntityIds(context, "documents.view", "Document") : Promise.resolve([])
  ]);
  const [invoices, reminders, events, budgets, works, clients, documents] = await Promise.all([
    capabilities.has("sales.invoices.view") && (domains.has("sales") || domains.has("treasury")) ? prisma.invoice.findMany({
      where: { companyId, pendiente: { gt: 0 }, estado: { not: "borrador" }, ...linkedScope(invoiceWorkIds, invoiceClientIds) },
      take: 25,
      orderBy: { fechaVencimiento: "asc" },
      include: { client: true, work: true }
    }) : Promise.resolve([]),
    capabilities.has("followups.view") && (domains.has("followups") || domains.has("agenda") || domains.has("tasks")) ? prisma.reminder.findMany({
      where: { companyId, estado: { in: ["borrador", "pendiente_confirmacion", "programado"] }, ...workScope(reminderWorkIds) },
      take: 25,
      orderBy: { fechaProgramada: "asc" },
      include: { client: true, work: true }
    }) : Promise.resolve([]),
    capabilities.has("agenda.view") && domains.has("agenda") ? prisma.eventoAgenda.findMany({
      where: { companyId, estado: { not: "cancelado" }, fechaInicio: { gte: startOfDay(now), lte: week }, ...workScope(eventWorkIds) },
      take: 25,
      orderBy: { fechaInicio: "asc" },
      include: { client: true, work: true }
    }) : Promise.resolve([]),
    capabilities.has("sales.budgets.view") && domains.has("sales") ? prisma.budget.findMany({
      where: { companyId, estado: { in: ["enviado", "visto", "pendiente_respuesta"] }, fechaValidez: { not: null, lte: week }, ...linkedScope(budgetWorkIds, budgetClientIds) },
      take: 20,
      orderBy: { fechaValidez: "asc" },
      include: { client: true, work: true }
    }) : Promise.resolve([]),
    domains.has("work") ? prisma.work.findMany({
      where: { companyId, archivada: false, fechaInicioPrevista: { not: null, gte: startOfDay(now), lte: week }, ...(workIds === null ? {} : { id: { in: workIds } }) },
      take: 20,
      orderBy: { fechaInicioPrevista: "asc" },
      include: { client: true }
    }) : Promise.resolve([]),
    domains.has("clients") ? prisma.client.findMany({
      where: {
        companyId,
        archivadoAt: null,
        AND: [{ OR: [{ nifCif: null }, { direccionFiscal: null }, { email: null }] }, ...(clientIds === null ? [] : [{ id: { in: clientIds } }])]
      },
      take: 20,
      orderBy: { nombre: "asc" }
    }) : Promise.resolve([]),
    domains.has("documents") ? prisma.document.findMany({
      where: { companyId, archivedAt: null, url: null, classification: { in: documentClasses as Array<"OPERATIONAL" | "COMMERCIAL" | "FINANCIAL" | "RESTRICTED"> }, ...(documentIds === null ? {} : { id: { in: documentIds } }) },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { client: true, work: true }
    }) : Promise.resolve([])
  ]);

  const items: Array<Omit<NotificationItem, "readAt">> = [];

  for (const invoice of invoices) {
    const status = deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento);
    if (status === "vencida") {
      items.push({
        sourceKey: `invoice-overdue-${invoice.id}`,
        type: "factura_vencida",
        title: `Factura vencida ${invoice.numero}`,
        body: `${invoice.client.nombre} tiene ${invoice.pendiente.toLocaleString("es-ES")} € pendientes.`,
        href: `/dinero/${invoice.id}`,
        priority: "critica",
        date: invoice.fechaVencimiento,
        entityType: "invoice",
        entityId: invoice.id
      });
    }
  }

  for (const reminder of reminders.filter((item) => item.fechaProgramada <= week)) {
    items.push({
      sourceKey: `reminder-${reminder.id}`,
      type: "recordatorio",
      title: reminder.fechaProgramada < now ? "Recordatorio atrasado" : "Recordatorio próximo",
      body: `${reminder.client?.nombre ?? reminder.work?.titulo ?? "Interno"} · ${reminder.mensaje}`,
      href: `/gestion?tipo=recordatorio&id=${reminder.id}&returnTo=/recordatorios`,
      priority: reminder.fechaProgramada < now ? "alta" : "media",
      date: reminder.fechaProgramada,
      entityType: "reminder",
      entityId: reminder.id
    });
  }

  for (const event of events) {
    items.push({
      sourceKey: `agenda-${event.id}`,
      type: "visita_proxima",
      title: event.tipo === "visita" ? "Visita próxima" : "Evento próximo",
      body: `${event.titulo}${event.client ? ` · ${event.client.nombre}` : ""}`,
      href: `/agenda?vista=lista`,
      priority: event.fechaInicio < addDays(now, 1) ? "alta" : "media",
      date: event.fechaInicio,
      entityType: "agenda",
      entityId: event.id
    });
  }

  for (const budget of budgets) {
    items.push({
      sourceKey: `budget-expiry-${budget.id}`,
      type: "presupuesto_caduca",
      title: `Presupuesto próximo a caducar ${budget.numero}`,
      body: `${budget.client.nombre} · ${budget.titulo}`,
      href: `/presupuestos/${budget.id}`,
      priority: "media",
      date: budget.fechaValidez ?? budget.fechaCreacion,
      entityType: "budget",
      entityId: budget.id
    });
  }

  for (const work of works) {
    items.push({
      sourceKey: `work-start-${work.id}`,
      type: "obra_comienza",
      title: "Obra próxima a comenzar",
      body: `${work.titulo} · ${work.client.nombre}`,
      href: `/obras/${work.id}`,
      priority: work.fechaInicioPrevista && work.fechaInicioPrevista < addDays(now, 2) ? "alta" : "media",
      date: work.fechaInicioPrevista ?? now,
      entityType: "work",
      entityId: work.id
    });
  }

  for (const client of clients) {
    items.push({
      sourceKey: `client-incomplete-${client.id}`,
      type: "datos_incompletos",
      title: "Datos importantes incompletos",
      body: `${client.nombre} tiene datos fiscales o de contacto pendientes.`,
      href: `/clientes/${client.id}?tab=datos`,
      priority: "baja",
      date: client.fechaCreacion,
      entityType: "client",
      entityId: client.id
    });
  }

  for (const document of documents) {
    items.push({
      sourceKey: `document-pending-${document.id}`,
      type: "documento_pendiente",
      title: "Documento sin archivo enlazado",
      body: `${document.name} · ${document.work?.titulo ?? document.client?.nombre ?? "Sin entidad"}`,
      href: "/documentos",
      priority: "baja",
      date: document.createdAt,
      entityType: "document",
      entityId: document.id
    });
  }

  return items;
}

function workScope(ids: string[] | null) { return ids === null ? {} : { obraId: { in: ids } }; }
function linkedScope(workIds: string[] | null, clientIds: string[] | null) {
  if (workIds === null && clientIds === null) return {};
  const OR: Array<Record<string, unknown>> = [];
  if (workIds === null) return clientIds === null ? {} : { clienteId: { in: clientIds } };
  if (clientIds === null) return { obraId: { in: workIds } };
  OR.push({ obraId: { in: workIds } }, { clienteId: { in: clientIds } });
  return { OR };
}

function priorityRank(priority: NotificationPriority) {
  return { baja: 1, media: 2, alta: 3, critica: 4 }[priority] ?? 0;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
