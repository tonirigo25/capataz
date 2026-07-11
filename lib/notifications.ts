import type { NotificationPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";

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

export async function getNotificationItems(): Promise<NotificationItem[]> {
  const derived = await deriveNotifications();
  const readStates = await prisma.notification.findMany({
    where: { sourceKey: { in: derived.map((item) => item.sourceKey) }, archivedAt: null },
    select: { sourceKey: true, readAt: true }
  });
  const readMap = new Map(readStates.map((item) => [item.sourceKey, item.readAt]));
  return derived.map((item) => ({ ...item, readAt: readMap.get(item.sourceKey) ?? null })).sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || b.date.getTime() - a.date.getTime());
}

export async function getUnreadNotificationCount() {
  const items = await getNotificationItems();
  return items.filter((item) => !item.readAt).length;
}

export async function markNotificationRead(sourceKey: string) {
  const item = (await deriveNotifications()).find((notification) => notification.sourceKey === sourceKey);
  if (!item) return;
  await prisma.notification.upsert({
    where: { sourceKey },
    create: {
      sourceKey,
      type: item.type,
      title: item.title,
      body: item.body,
      href: item.href,
      priority: item.priority,
      entityType: item.entityType,
      entityId: item.entityId,
      readAt: new Date()
    },
    update: { readAt: new Date(), archivedAt: null }
  });
}

export async function markAllNotificationsRead() {
  const items = await deriveNotifications();
  await prisma.$transaction(
    items.map((item) =>
      prisma.notification.upsert({
        where: { sourceKey: item.sourceKey },
        create: {
          sourceKey: item.sourceKey,
          type: item.type,
          title: item.title,
          body: item.body,
          href: item.href,
          priority: item.priority,
          entityType: item.entityType,
          entityId: item.entityId,
          readAt: new Date()
        },
        update: { readAt: new Date(), archivedAt: null }
      })
    )
  );
}

async function deriveNotifications(): Promise<Array<Omit<NotificationItem, "readAt">>> {
  const now = new Date();
  const week = addDays(startOfDay(now), 7);
  const [invoices, reminders, events, budgets, works, clients, documents] = await Promise.all([
    prisma.invoice.findMany({
      where: { pendiente: { gt: 0 }, estado: { not: "borrador" } },
      take: 25,
      orderBy: { fechaVencimiento: "asc" },
      include: { client: true, work: true }
    }),
    prisma.reminder.findMany({
      where: { estado: { in: ["borrador", "pendiente_confirmacion", "programado"] } },
      take: 25,
      orderBy: { fechaProgramada: "asc" },
      include: { client: true, work: true }
    }),
    prisma.eventoAgenda.findMany({
      where: { estado: { not: "cancelado" }, fechaInicio: { gte: startOfDay(now), lte: week } },
      take: 25,
      orderBy: { fechaInicio: "asc" },
      include: { client: true, work: true }
    }),
    prisma.budget.findMany({
      where: { estado: { in: ["enviado", "visto", "pendiente_respuesta"] }, fechaValidez: { not: null, lte: week } },
      take: 20,
      orderBy: { fechaValidez: "asc" },
      include: { client: true, work: true }
    }),
    prisma.work.findMany({
      where: { archivada: false, fechaInicioPrevista: { not: null, gte: startOfDay(now), lte: week } },
      take: 20,
      orderBy: { fechaInicioPrevista: "asc" },
      include: { client: true }
    }),
    prisma.client.findMany({
      where: {
        archivadoAt: null,
        OR: [{ nifCif: null }, { direccionFiscal: null }, { email: null }]
      },
      take: 20,
      orderBy: { nombre: "asc" }
    }),
    prisma.document.findMany({
      where: { archivedAt: null, url: null },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { client: true, work: true }
    })
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
