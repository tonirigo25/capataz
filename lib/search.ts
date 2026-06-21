import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";

export type SearchResult = {
  type: string;
  title: string;
  detail: string;
  href: string;
};

export async function globalSearch(query: string) {
  const q = normalize(query);
  if (!q) return grouped([]);

  const [clients, works, budgets, invoices, payments, expenses, materials, reminders, agendaEvents, companies] = await Promise.all([
    prisma.client.findMany({ include: { budgets: true, invoices: true, works: true } }),
    prisma.work.findMany({ include: { client: true } }),
    prisma.budget.findMany({ include: { client: true } }),
    prisma.invoice.findMany({ include: { client: true, work: true } }),
    prisma.payment.findMany({ include: { client: true, invoice: true } }),
    prisma.expense.findMany({ include: { work: { include: { client: true } } } }),
    prisma.material.findMany({ include: { work: { include: { client: true } } } }),
    prisma.reminder.findMany({ include: { client: true, invoice: true, budget: true, work: true } }),
    prisma.eventoAgenda.findMany({ include: { client: true, work: true, invoice: true, budget: true } }),
    prisma.empresa.findMany()
  ]);

  const results: SearchResult[] = [];

  clients.forEach((client) => {
    const pending = client.invoices.reduce((sum, invoice) => sum + invoice.pendiente, 0);
    pushIfMatch(results, q, {
      type: "Clientes",
      title: client.nombre,
      detail: `${client.estado} · ${client.telefono} · pendiente ${pending} € · ${client.notas ?? ""}`,
      href: `/clientes?buscar=${encodeURIComponent(query)}`
    });
  });

  works.forEach((work) =>
    pushIfMatch(results, q, {
      type: "Obras",
      title: work.titulo,
      detail: `${work.client.nombre} · ${work.estado} · ${work.notas ?? ""}`,
      href: `/obras?buscar=${encodeURIComponent(query)}`
    })
  );

  budgets.forEach((budget) =>
    pushIfMatch(results, q, {
      type: "Presupuestos",
      title: `${budget.numero} · ${budget.titulo}`,
      detail: `${budget.client.nombre} · ${budget.estado} · ${budget.total} €`,
      href: `/presupuestos/${budget.id}`
    })
  );

  invoices.forEach((invoice) => {
    const liveStatus = deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento);
    const forceMatch = q.includes("factura vencida") && liveStatus === "vencida";
    pushIfMatch(results, q, {
      type: "Facturas",
      title: `${invoice.numero} · ${invoice.client.nombre}`,
      detail: `${invoice.concepto} · ${liveStatus} · pendiente ${invoice.pendiente} €`,
      href: `/dinero/${invoice.id}`
    }, forceMatch);
  });

  payments.forEach((payment) =>
    pushIfMatch(results, q, {
      type: "Pagos",
      title: `${payment.client.nombre} · ${payment.importe} €`,
      detail: `${payment.invoice.numero} · ${payment.metodo} · ${payment.tipo}`,
      href: `/dinero/${payment.facturaId}`
    })
  );

  expenses.forEach((expense) =>
    pushIfMatch(results, q, {
      type: "Gastos",
      title: expense.concepto,
      detail: `${expense.proveedor} · ${expense.work.titulo} · ${expense.importe} €`,
      href: `/gastos-materiales?buscar=${encodeURIComponent(query)}`
    })
  );

  materials.forEach((material) =>
    pushIfMatch(results, q, {
      type: "Materiales",
      title: material.nombre,
      detail: `${material.cantidad} · ${material.estado} · ${material.work.titulo}`,
      href: `/gastos-materiales?filtro=pendientes&buscar=${encodeURIComponent(query)}`
    })
  );

  reminders.forEach((reminder) =>
    pushIfMatch(results, q, {
      type: "Recordatorios",
      title: reminder.client?.nombre ?? "Recordatorio interno",
      detail: `${reminder.tipo} · ${reminder.estado} · ${reminder.mensaje}`,
      href: `/recordatorios?filtro=${reminder.estado}`
    })
  );

  agendaEvents.forEach((event) =>
    pushIfMatch(results, q, {
      type: "Agenda",
      title: event.titulo,
      detail: `${event.tipo} · ${event.estado} · ${event.client?.nombre ?? ""} · ${event.descripcion ?? ""}`,
      href: `/agenda?vista=lista&buscar=${encodeURIComponent(query)}`
    })
  );

  companies.forEach((company) => {
    const forceMatch = ["logo", "datos fiscales", "cif", "nif"].some((keyword) => q.includes(keyword));
    pushIfMatch(results, q, {
      type: "Configuración",
      title: company.nombreComercial,
      detail: `${company.razonSocial ?? ""} · ${company.nifCif ?? ""} · ${company.direccionFiscal ?? ""}`,
      href: "/configuracion"
    }, forceMatch);
  });

  return grouped(results);
}

function grouped(results: SearchResult[]) {
  return results.reduce<Record<string, SearchResult[]>>((groups, result) => {
    groups[result.type] = groups[result.type] ?? [];
    groups[result.type].push(result);
    return groups;
  }, {});
}

function pushIfMatch(results: SearchResult[], query: string, result: SearchResult, force = false) {
  const haystack = normalize(`${result.title} ${result.detail} ${result.type}`);
  const tokens = query.split(/\s+/).filter(Boolean);
  const tokenMatch = tokens.every((token) => haystack.includes(token));
  if (force || tokenMatch || haystack.includes(query)) results.push(result);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
