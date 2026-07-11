import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { documentCategoryLabel } from "@/lib/documents";
import { deriveInvoiceStatus } from "@/lib/status";

export type SearchResult = {
  type: string;
  title: string;
  detail: string;
  href: string;
};

const TAKE_PER_GROUP = 8;

export async function globalSearch(query: string) {
  const raw = query.trim();
  if (!raw) return grouped([]);

  const [clients, contacts, works, budgets, invoices, payments, expenses, agendaEvents, documents] = await Promise.all([
    prisma.client.findMany({
      where: {
        OR: [
          contains("nombre", raw),
          contains("nombreComercial", raw),
          contains("razonSocial", raw),
          contains("nifCif", raw),
          contains("email", raw),
          contains("telefono", raw),
          contains("direccion", raw),
          contains("direccionFiscal", raw),
          contains("contactoPrincipalNombre", raw),
          contains("contactoPrincipalEmail", raw),
          contains("contactoPrincipalTelefono", raw)
        ]
      },
      take: TAKE_PER_GROUP,
      orderBy: { nombre: "asc" }
    }),
    prisma.contact.findMany({
      where: {
        archivedAt: null,
        OR: [contains("nombre", raw), contains("apellidos", raw), contains("cargo", raw), contains("telefono", raw), contains("email", raw), contains("notes", raw)]
      },
      take: TAKE_PER_GROUP,
      include: { client: true },
      orderBy: { nombre: "asc" }
    }),
    prisma.work.findMany({
      where: {
        OR: [
          contains("titulo", raw),
          contains("codigo", raw),
          contains("numeroInterno", raw),
          contains("direccion", raw),
          contains("tipoTrabajo", raw),
          contains("descripcion", raw),
          contains("contactoPrincipal", raw),
          { client: { OR: [contains("nombre", raw), contains("razonSocial", raw), contains("nifCif", raw)] } }
        ]
      },
      take: TAKE_PER_GROUP,
      include: { client: true },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.budget.findMany({
      where: {
        OR: [contains("numero", raw), contains("titulo", raw), contains("partidas", raw), contains("observaciones", raw), { client: { OR: [contains("nombre", raw), contains("nifCif", raw)] } }]
      },
      take: TAKE_PER_GROUP,
      include: { client: true, work: true },
      orderBy: { fechaCreacion: "desc" }
    }),
    prisma.invoice.findMany({
      where: {
        OR: [contains("numero", raw), contains("concepto", raw), contains("observaciones", raw), { client: { OR: [contains("nombre", raw), contains("nifCif", raw)] } }]
      },
      take: TAKE_PER_GROUP,
      include: { client: true, work: true },
      orderBy: { fechaEmision: "desc" }
    }),
    prisma.payment.findMany({
      where: { OR: [contains("metodo", raw), contains("notas", raw), { client: { OR: [contains("nombre", raw), contains("nifCif", raw)] } }, { invoice: contains("numero", raw) }] },
      take: TAKE_PER_GROUP,
      include: { client: true, invoice: true },
      orderBy: { fecha: "desc" }
    }),
    prisma.expense.findMany({
      where: { OR: [contains("proveedor", raw), contains("concepto", raw), contains("notas", raw), { work: { OR: [contains("titulo", raw), contains("codigo", raw)] } }] },
      take: TAKE_PER_GROUP,
      include: { work: { include: { client: true } } },
      orderBy: { fecha: "desc" }
    }),
    prisma.eventoAgenda.findMany({
      where: {
        OR: [
          contains("titulo", raw),
          contains("descripcion", raw),
          contains("direccion", raw),
          contains("notas", raw),
          { client: { OR: [contains("nombre", raw), contains("nifCif", raw)] } },
          { work: { OR: [contains("titulo", raw), contains("codigo", raw)] } },
          { contact: { OR: [contains("nombre", raw), contains("email", raw), contains("telefono", raw)] } }
        ]
      },
      take: TAKE_PER_GROUP,
      include: { client: true, work: true, contact: true },
      orderBy: { fechaInicio: "desc" }
    }),
    prisma.document.findMany({
      where: {
        archivedAt: null,
        OR: [
          contains("name", raw),
          contains("originalName", raw),
          contains("mimeType", raw),
          { client: { OR: [contains("nombre", raw), contains("nifCif", raw)] } },
          { work: { OR: [contains("titulo", raw), contains("codigo", raw)] } }
        ]
      },
      take: TAKE_PER_GROUP,
      include: { client: true, work: true, budget: true, invoice: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const results: SearchResult[] = [];

  clients.forEach((client) => results.push({ type: "Clientes", title: client.nombre, detail: `${client.estado} · ${client.telefono} · ${client.nifCif ?? "sin NIF/CIF"}`, href: `/clientes/${client.id}` }));
  contacts.forEach((contact) => results.push({ type: "Contactos", title: `${contact.nombre}${contact.apellidos ? ` ${contact.apellidos}` : ""}`, detail: `${contact.client.nombre} · ${contact.cargo ?? "Contacto"} · ${contact.telefono ?? contact.email ?? "sin contacto"}`, href: `/clientes/${contact.clientId}?tab=contactos` }));
  works.forEach((work) => results.push({ type: "Obras", title: work.titulo, detail: `${work.client.nombre} · ${work.estado} · ${work.codigo ?? work.direccion}`, href: `/obras/${work.id}` }));
  budgets.forEach((budget) => results.push({ type: "Presupuestos", title: `${budget.numero} · ${budget.titulo}`, detail: `${budget.client.nombre} · ${budget.estado} · ${budget.total} €`, href: `/presupuestos/${budget.id}` }));
  invoices.forEach((invoice) => {
    const liveStatus = deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento);
    results.push({ type: "Facturas", title: `${invoice.numero} · ${invoice.client.nombre}`, detail: `${invoice.concepto} · ${liveStatus} · pendiente ${invoice.pendiente} €`, href: `/dinero/${invoice.id}` });
  });
  payments.forEach((payment) => results.push({ type: "Pagos", title: `${payment.client.nombre} · ${payment.importe} €`, detail: `${payment.invoice.numero} · ${payment.metodo} · ${payment.tipo}`, href: `/dinero/${payment.facturaId}` }));
  expenses.forEach((expense) => results.push({ type: "Gastos", title: expense.concepto, detail: `${expense.proveedor} · ${expense.work.titulo} · ${expense.importe} €`, href: `/gastos-materiales?buscar=${encodeURIComponent(raw)}` }));
  agendaEvents.forEach((event) => results.push({ type: "Agenda", title: event.titulo, detail: `${event.tipo} · ${event.client?.nombre ?? event.work?.titulo ?? event.contact?.nombre ?? "sin entidad"}`, href: `/agenda?vista=lista&buscar=${encodeURIComponent(raw)}` }));
  documents.forEach((document) => results.push({ type: "Documentos", title: document.name, detail: `${documentCategoryLabel(document.category)} · ${document.work?.titulo ?? document.client?.nombre ?? document.budget?.numero ?? document.invoice?.numero ?? "sin entidad"}`, href: document.url ?? `/documentos` }));

  return grouped(results);
}

function grouped(results: SearchResult[]) {
  return results.reduce<Record<string, SearchResult[]>>((groups, result) => {
    groups[result.type] = groups[result.type] ?? [];
    groups[result.type].push(result);
    return groups;
  }, {});
}

function contains(field: string, value: string): Record<string, Prisma.StringFilter> {
  return { [field]: { contains: value, mode: "insensitive" } };
}
