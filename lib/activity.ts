import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";

export type ActivityKind =
  | "cliente"
  | "contacto"
  | "obra"
  | "presupuesto"
  | "factura"
  | "pago"
  | "gasto"
  | "agenda"
  | "nota"
  | "documento";

export type ActivityPeriod = "7d" | "30d" | "90d" | "todo";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  label: string;
  title: string;
  detail: string;
  date: Date;
  entity: string;
  href: string;
  actor?: string | null;
};

export const ACTIVITY_KIND_OPTIONS: Array<{ id: ActivityKind | "todos"; label: string }> = [
  { id: "todos", label: "Todo" },
  { id: "cliente", label: "Clientes" },
  { id: "contacto", label: "Contactos" },
  { id: "obra", label: "Obras" },
  { id: "presupuesto", label: "Presupuestos" },
  { id: "factura", label: "Facturas" },
  { id: "pago", label: "Pagos" },
  { id: "gasto", label: "Gastos" },
  { id: "agenda", label: "Agenda" },
  { id: "nota", label: "Notas" },
  { id: "documento", label: "Documentos" }
];

export const ACTIVITY_PERIOD_OPTIONS: Array<{ id: ActivityPeriod; label: string }> = [
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
  { id: "90d", label: "90 días" },
  { id: "todo", label: "Todo" }
];

const TAKE_PER_SOURCE = 16;

export async function getActivityFeed({
  kind = "todos",
  period = "30d"
}: {
  kind?: ActivityKind | "todos";
  period?: ActivityPeriod;
} = {}) {
  const since = periodStart(period);
  const { companyId } = await requireCompanyContext();

  const [clients, contacts, works, budgets, invoices, payments, expenses, agendaEvents, notes, documents] = await Promise.all([
    prisma.client.findMany({
      where: { companyId, ...(since ? { OR: [{ fechaCreacion: { gte: since } }, { ultimaInteraccion: { gte: since } }] } : {}) },
      select: { id: true, nombre: true, estado: true, fechaCreacion: true, ultimaInteraccion: true },
      orderBy: { fechaCreacion: "desc" },
      take: TAKE_PER_SOURCE
    }),
    prisma.contact.findMany({
      where: { companyId, ...(since ? { createdAt: { gte: since } } : {}) },
      select: { id: true, nombre: true, apellidos: true, isPrimary: true, isBillingContact: true, isSiteContact: true, createdAt: true, client: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: "desc" },
      take: TAKE_PER_SOURCE
    }),
    prisma.work.findMany({
      where: { companyId, ...(since ? { OR: [{ fechaCreacion: { gte: since } }, { updatedAt: { gte: since } }] } : {}) },
      select: { id: true, titulo: true, estado: true, fechaCreacion: true, updatedAt: true, client: { select: { nombre: true } } },
      orderBy: { updatedAt: "desc" },
      take: TAKE_PER_SOURCE
    }),
    prisma.budget.findMany({
      where: { companyId, ...(since ? { OR: [{ fechaCreacion: { gte: since } }, { fechaEnvio: { gte: since } }] } : {}) },
      select: { id: true, numero: true, titulo: true, estado: true, fechaCreacion: true, fechaEnvio: true, client: { select: { nombre: true } } },
      orderBy: { fechaCreacion: "desc" },
      take: TAKE_PER_SOURCE
    }),
    prisma.invoice.findMany({
      where: { companyId, ...(since ? { fechaEmision: { gte: since } } : {}) },
      select: { id: true, numero: true, concepto: true, estado: true, total: true, pendiente: true, fechaEmision: true, client: { select: { nombre: true } } },
      orderBy: { fechaEmision: "desc" },
      take: TAKE_PER_SOURCE
    }),
    prisma.payment.findMany({
      where: { companyId, ...(since ? { fecha: { gte: since } } : {}) },
      select: { id: true, importe: true, metodo: true, fecha: true, invoice: { select: { id: true, numero: true } }, client: { select: { nombre: true } } },
      orderBy: { fecha: "desc" },
      take: TAKE_PER_SOURCE
    }),
    prisma.expense.findMany({
      where: { companyId, ...(since ? { fecha: { gte: since } } : {}) },
      select: { id: true, proveedor: true, concepto: true, importe: true, fecha: true, work: { select: { id: true, titulo: true } } },
      orderBy: { fecha: "desc" },
      take: TAKE_PER_SOURCE
    }),
    prisma.eventoAgenda.findMany({
      where: { companyId, ...(since ? { OR: [{ createdAt: { gte: since } }, { fechaInicio: { gte: since } }] } : {}) },
      select: { id: true, titulo: true, tipo: true, estado: true, createdAt: true, fechaInicio: true, client: { select: { nombre: true } }, work: { select: { id: true, titulo: true } } },
      orderBy: { fechaInicio: "desc" },
      take: TAKE_PER_SOURCE
    }),
    prisma.internalNote.findMany({
      where: { companyId, archivedAt: null, ...(since ? { createdAt: { gte: since } } : {}) },
      select: { id: true, content: true, createdAt: true, authorId: true, client: { select: { id: true, nombre: true } }, work: { select: { id: true, titulo: true } }, budget: { select: { id: true, numero: true } }, invoice: { select: { id: true, numero: true } } },
      orderBy: { createdAt: "desc" },
      take: TAKE_PER_SOURCE
    }),
    prisma.document.findMany({
      where: { companyId, archivedAt: null, ...(since ? { createdAt: { gte: since } } : {}) },
      select: { id: true, name: true, category: true, createdAt: true, uploadedById: true, client: { select: { id: true, nombre: true } }, work: { select: { id: true, titulo: true } }, budget: { select: { id: true, numero: true } }, invoice: { select: { id: true, numero: true } } },
      orderBy: { createdAt: "desc" },
      take: TAKE_PER_SOURCE
    })
  ]);

  const items: ActivityItem[] = [];

  for (const client of clients) {
    add(items, {
      id: `client-created-${client.id}`,
      kind: "cliente",
      label: "Cliente creado",
      title: client.nombre,
      detail: `Estado actual: ${client.estado}`,
      date: client.fechaCreacion,
      entity: "Cliente",
      href: `/clientes/${client.id}`
    });
    if (client.ultimaInteraccion && timeDifference(client.ultimaInteraccion, client.fechaCreacion) > 60_000) {
      add(items, {
        id: `client-interaction-${client.id}`,
        kind: "cliente",
        label: "Cliente actualizado",
        title: client.nombre,
        detail: "Tiene una interacción reciente registrada.",
        date: client.ultimaInteraccion,
        entity: "Cliente",
        href: `/clientes/${client.id}`
      });
    }
  }

  for (const contact of contacts) {
    add(items, {
      id: `contact-created-${contact.id}`,
      kind: "contacto",
      label: "Contacto creado",
      title: fullName(contact.nombre, contact.apellidos),
      detail: `${contact.client.nombre} · ${contactFlags(contact).join(", ") || "Contacto"}`,
      date: contact.createdAt,
      entity: "Contacto",
      href: `/clientes/${contact.client.id}?tab=contactos`
    });
  }

  for (const work of works) {
    add(items, {
      id: `work-created-${work.id}`,
      kind: "obra",
      label: "Obra creada",
      title: work.titulo,
      detail: `${work.client.nombre} · ${work.estado}`,
      date: work.fechaCreacion,
      entity: "Obra",
      href: `/obras/${work.id}`
    });
    if (timeDifference(work.updatedAt, work.fechaCreacion) > 60_000) {
      add(items, {
        id: `work-updated-${work.id}`,
        kind: "obra",
        label: "Obra actualizada",
        title: work.titulo,
        detail: `${work.client.nombre} · ${work.estado}`,
        date: work.updatedAt,
        entity: "Obra",
        href: `/obras/${work.id}`
      });
    }
  }

  for (const budget of budgets) {
    add(items, {
      id: `budget-created-${budget.id}`,
      kind: "presupuesto",
      label: "Presupuesto creado",
      title: `${budget.numero} · ${budget.titulo}`,
      detail: `${budget.client.nombre} · ${budget.estado}`,
      date: budget.fechaCreacion,
      entity: "Presupuesto",
      href: `/presupuestos/${budget.id}`
    });
    if (budget.fechaEnvio) {
      add(items, {
        id: `budget-sent-${budget.id}`,
        kind: "presupuesto",
        label: "Presupuesto enviado",
        title: `${budget.numero} · ${budget.titulo}`,
        detail: budget.client.nombre,
        date: budget.fechaEnvio,
        entity: "Presupuesto",
        href: `/presupuestos/${budget.id}`
      });
    }
  }

  for (const invoice of invoices) {
    add(items, {
      id: `invoice-created-${invoice.id}`,
      kind: "factura",
      label: "Factura creada",
      title: `${invoice.numero} · ${invoice.concepto}`,
      detail: `${invoice.client.nombre} · ${invoice.estado}`,
      date: invoice.fechaEmision,
      entity: "Factura",
      href: `/dinero/${invoice.id}`
    });
  }

  for (const payment of payments) {
    add(items, {
      id: `payment-created-${payment.id}`,
      kind: "pago",
      label: "Pago registrado",
      title: `${payment.client.nombre} · ${payment.importe} EUR`,
      detail: `${payment.invoice.numero} · ${payment.metodo}`,
      date: payment.fecha,
      entity: "Pago",
      href: `/dinero/${payment.invoice.id}`
    });
  }

  for (const expense of expenses) {
    add(items, {
      id: `expense-created-${expense.id}`,
      kind: "gasto",
      label: "Gasto registrado",
      title: expense.concepto,
      detail: `${expense.proveedor} · ${expense.work.titulo} · ${expense.importe} EUR`,
      date: expense.fecha,
      entity: "Gasto",
      href: `/obras/${expense.work.id}?tab=gastos`
    });
  }

  for (const event of agendaEvents) {
    add(items, {
      id: `event-created-${event.id}`,
      kind: "agenda",
      label: "Evento registrado",
      title: event.titulo,
      detail: `${event.tipo} · ${event.client?.nombre ?? event.work?.titulo ?? "Interno"} · ${event.estado}`,
      date: event.createdAt,
      entity: "Agenda",
      href: `/agenda?vista=lista&buscar=${encodeURIComponent(event.titulo)}`
    });
  }

  for (const note of notes) {
    const target = note.client?.nombre ?? note.work?.titulo ?? note.budget?.numero ?? note.invoice?.numero ?? "Entidad interna";
    add(items, {
      id: `note-created-${note.id}`,
      kind: "nota",
      label: "Nota interna añadida",
      title: target,
      detail: truncate(note.content),
      date: note.createdAt,
      entity: "Nota",
      href: note.client ? `/clientes/${note.client.id}?tab=notas` : note.work ? `/obras/${note.work.id}?tab=notas` : "/buscar",
      actor: note.authorId
    });
  }

  for (const document of documents) {
    const target = document.client?.nombre ?? document.work?.titulo ?? document.budget?.numero ?? document.invoice?.numero ?? "Repositorio";
    add(items, {
      id: `document-created-${document.id}`,
      kind: "documento",
      label: "Documento registrado",
      title: document.name,
      detail: `${document.category} · ${target}`,
      date: document.createdAt,
      entity: "Documento",
      href: document.client ? `/clientes/${document.client.id}?tab=documentos` : document.work ? `/obras/${document.work.id}?tab=documentos` : "/documentos",
      actor: document.uploadedById
    });
  }

  return items
    .filter((item) => (kind === "todos" ? true : item.kind === kind))
    .filter((item) => (since ? item.date >= since : true))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 60);
}

function add(items: ActivityItem[], item: ActivityItem) {
  items.push({ ...item, date: new Date(item.date) });
}

function periodStart(period: ActivityPeriod) {
  if (period === "todo") return null;
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

function timeDifference(a: Date, b: Date) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime());
}

function fullName(nombre: string, apellidos?: string | null) {
  return `${nombre}${apellidos ? ` ${apellidos}` : ""}`;
}

function contactFlags(contact: { isPrimary: boolean; isBillingContact: boolean; isSiteContact: boolean }) {
  const flags: string[] = [];
  if (contact.isPrimary) flags.push("Principal");
  if (contact.isBillingContact) flags.push("Facturacion");
  if (contact.isSiteContact) flags.push("Obra");
  return flags;
}

function truncate(value: string) {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}
