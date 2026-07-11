import type { BudgetStatus, ClientStatus, EventoAgendaTipo, InvoiceStatus, Prisma, ReminderStatus, WorkStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_WORK_STATUSES,
  OPEN_REMINDER_STATUSES,
  PENDING_BUDGET_STATUSES,
  buildBudgetSummary,
  buildFinancialSummary,
  classifyClientType,
  detectDuplicateClients,
  displayClientName,
  fiscalClientName,
  getClientPendingFields,
  isActiveWorkStatus,
  isBillableInvoiceStatus,
  lastContactDate,
  latestDate,
  normalizePhone,
  normalizeStatus,
  pendingAmountForInvoice,
  primaryContactLabel,
  type CrmClientFieldsInput,
  type DuplicateMatch
} from "@/lib/client-crm-calculations";

export const CLIENT_PAGE_SIZE = 10;
const PRISMA_BILLABLE_INVOICE_EXCLUDED_STATUSES = ["borrador"];
const CLIENT_STATUSES = [
  "nuevo",
  "pendiente_datos",
  "visita_pendiente",
  "presupuesto_pendiente",
  "presupuesto_enviado",
  "seguimiento_pendiente",
  "aceptado",
  "rechazado",
  "obra_activa",
  "finalizado",
  "pendiente_cobro"
];

export type ClientListQuery = {
  buscar?: string;
  estado?: string;
  tipo?: string;
  archivo?: string;
  filtros?: string;
  ordenar?: string;
  pagina?: string;
};

export type ClientListItem = {
  id: string;
  displayName: string;
  fiscalName: string;
  typeLabel: string;
  typeRaw: string;
  status: string;
  phone: string;
  email: string | null;
  primaryContact: string;
  primaryContactDetail: string;
  fiscalId: string | null;
  activeWorksCount: number;
  totalWorksCount: number;
  budgetedTotal: number;
  billedTotal: number;
  paidTotal: number;
  pendingTotal: number;
  pendingInvoicesCount: number;
  overdueInvoicesCount: number;
  pendingBudgetsCount: number;
  pendingFields: string[];
  lastActivityAt: Date | null;
  lastContactAt: Date | null;
  archivedAt: Date | null;
  nextAction: string;
};

export type ClientListResult = {
  items: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  typeOptions: string[];
  activeFilters: Array<{ id: string; label: string }>;
};

export type ClientCrmSummary = Awaited<ReturnType<typeof getClientCrmSummary>>;

const clientSelect = {
  id: true,
  nombre: true,
  nombreComercial: true,
  razonSocial: true,
  nifCif: true,
  telefono: true,
  email: true,
  direccion: true,
  direccionFiscal: true,
  codigoPostal: true,
  municipio: true,
  provincia: true,
  pais: true,
  emailFacturacion: true,
  telefonoFacturacion: true,
  contactoPrincipalNombre: true,
  contactoPrincipalCargo: true,
  contactoPrincipalTelefono: true,
  contactoPrincipalEmail: true,
  contactoFacturacionNombre: true,
  tipo: true,
  estado: true,
  origen: true,
  notas: true,
  fechaCreacion: true,
  ultimaInteraccion: true,
  archivadoAt: true,
  budgets: {
    orderBy: { fechaCreacion: "desc" },
    select: {
      id: true,
      numero: true,
      titulo: true,
      subtotal: true,
      iva: true,
      descuento: true,
      total: true,
      margenEstimado: true,
      estado: true,
      fechaCreacion: true,
      fechaEnvio: true,
      fechaValidez: true,
      fechaSeguimiento: true,
      condiciones: true,
      observaciones: true,
      obraId: true,
      work: { select: { id: true, titulo: true, direccion: true, estado: true } }
    }
  },
  invoices: {
    orderBy: { fechaVencimiento: "asc" },
    select: {
      id: true,
      numero: true,
      concepto: true,
      importeBase: true,
      iva: true,
      total: true,
      pagado: true,
      pendiente: true,
      fechaEmision: true,
      fechaVencimiento: true,
      estado: true,
      observaciones: true,
      metodoPago: true,
      obraId: true,
      work: { select: { id: true, titulo: true, direccion: true, estado: true } },
      payments: {
        orderBy: { fecha: "desc" },
        select: { id: true, importe: true, metodo: true, fecha: true, tipo: true, notas: true }
      }
    }
  },
  payments: {
    orderBy: { fecha: "desc" },
    select: {
      id: true,
      facturaId: true,
      obraId: true,
      importe: true,
      metodo: true,
      fecha: true,
      tipo: true,
      notas: true,
      invoice: { select: { id: true, numero: true, concepto: true, total: true } },
      work: { select: { id: true, titulo: true } }
    }
  },
  works: {
    orderBy: { fechaInicio: "desc" },
    select: {
      id: true,
      clienteId: true,
      titulo: true,
      direccion: true,
      tipoTrabajo: true,
      estado: true,
      fechaInicio: true,
      fechaFinPrevista: true,
      presupuestoAprobado: true,
      gastoReal: true,
      margenEstimado: true,
      notas: true,
      budgets: {
        orderBy: { fechaCreacion: "desc" },
        select: { id: true, numero: true, titulo: true, total: true, estado: true, fechaCreacion: true }
      },
      invoices: {
        orderBy: { fechaEmision: "desc" },
        select: {
          id: true,
          numero: true,
          concepto: true,
          total: true,
          pagado: true,
          pendiente: true,
          estado: true,
          fechaEmision: true,
          fechaVencimiento: true,
          payments: { select: { id: true, importe: true, fecha: true } }
        }
      },
      expenses: {
        orderBy: { fecha: "desc" },
        select: { id: true, proveedor: true, concepto: true, categoria: true, importe: true, fecha: true, notas: true }
      },
      agendaEvents: {
        orderBy: { fechaInicio: "asc" },
        select: { id: true, titulo: true, tipo: true, estado: true, fechaInicio: true, fechaFin: true }
      }
    }
  },
  expenses: {
    orderBy: { fecha: "desc" },
    select: {
      id: true,
      obraId: true,
      proveedor: true,
      concepto: true,
      categoria: true,
      importe: true,
      fecha: true,
      notas: true,
      work: { select: { id: true, titulo: true } }
    }
  },
  reminders: {
    orderBy: { fechaProgramada: "asc" },
    select: {
      id: true,
      obraId: true,
      facturaId: true,
      presupuestoId: true,
      tipo: true,
      canal: true,
      mensaje: true,
      fechaProgramada: true,
      estado: true,
      requiereConfirmacion: true,
      confirmadoPorUsuario: true,
      work: { select: { id: true, titulo: true } },
      invoice: { select: { id: true, numero: true, concepto: true } },
      budget: { select: { id: true, numero: true, titulo: true } }
    }
  },
  agendaEvents: {
    orderBy: { fechaInicio: "desc" },
    select: {
      id: true,
      titulo: true,
      descripcion: true,
      tipo: true,
      estado: true,
      fechaInicio: true,
      fechaFin: true,
      horaInicio: true,
      horaFin: true,
      obraId: true,
      presupuestoId: true,
      facturaId: true,
      direccion: true,
      notas: true,
      requiereConfirmacion: true,
      work: { select: { id: true, titulo: true } },
      invoice: { select: { id: true, numero: true, concepto: true } },
      budget: { select: { id: true, numero: true, titulo: true } }
    }
  }
} satisfies Prisma.ClientSelect;

type ClientCrmRecord = Prisma.ClientGetPayload<{ select: typeof clientSelect }>;

export async function getClientList(query: ClientListQuery): Promise<ClientListResult> {
  const now = new Date();
  const where = buildClientWhere(query);
  const [clients, typeOptions] = await Promise.all([
    prisma.client.findMany({
      where,
      select: clientSelect
    }),
    getClientTypeOptions()
  ]);

  const filters = parseFilters(query.filtros);
  const allItems = clients
    .map((client) => toListItem(client, now))
    .filter((item) => matchesComputedFilters(item, filters));
  const sortedItems = sortClientItems(allItems, query.ordenar ?? "ultimaActividad_desc");

  const total = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(total / CLIENT_PAGE_SIZE));
  const requestedPage = Number.parseInt(query.pagina ?? "1", 10);
  const page = Math.min(Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1), totalPages);
  const start = (page - 1) * CLIENT_PAGE_SIZE;
  const items = sortedItems.slice(start, start + CLIENT_PAGE_SIZE);

  return {
    items,
    total,
    page,
    pageSize: CLIENT_PAGE_SIZE,
    totalPages,
    typeOptions,
    activeFilters: activeFilterLabels(query, filters)
  };
}

export async function getClientCrmSummary(id: string) {
  const client = await prisma.client.findFirst({
    where: { id },
    select: clientSelect
  });

  if (!client) return null;

  const now = new Date();
  const listItem = toListItem(client, now);
  const financial = buildFinancialSummary(client.invoices, now);
  const budgets = buildBudgetSummary(client.budgets);
  const upcomingEvents = client.agendaEvents
    .filter((event) => event.estado !== "cancelado")
    .filter((event) => event.fechaInicio >= now)
    .sort((a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime());
  const pendingReminders = client.reminders.filter((reminder) => OPEN_REMINDER_STATUSES.includes(normalizeStatus(reminder.estado)));
  const activeWorks = client.works.filter((work) => isActiveWorkStatus(work.estado));
  const pendingInvoices = client.invoices.filter((invoice) => pendingAmountForInvoice(invoice) > 0);
  const pendingBudgets = client.budgets.filter((budget) => PENDING_BUDGET_STATUSES.includes(normalizeStatus(budget.estado)));
  const payments = client.payments;
  const contacts = buildDerivedContacts(client);
  const activity = buildActivity(client, now);
  const documents = [
    ...client.budgets.map((budget) => ({
      id: `budget-${budget.id}`,
      name: `Presupuesto ${budget.numero}`,
      type: "Presupuesto",
      date: budget.fechaCreacion,
      relatedLabel: budget.work?.titulo ?? budget.titulo,
      href: `/presupuestos/${budget.id}/pdf`
    })),
    ...client.invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      name: `Factura ${invoice.numero}`,
      type: "Factura",
      date: invoice.fechaEmision,
      relatedLabel: invoice.work?.titulo ?? invoice.concepto,
      href: `/dinero/${invoice.id}/pdf`
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    client,
    listItem,
    kpis: {
      totalWorks: client.works.length,
      activeWorks: activeWorks.length,
      budgetedTotal: budgets.budgetedTotal,
      billedTotal: financial.billedTotal,
      paidTotal: financial.paidTotal,
      pendingTotal: financial.pendingTotal,
      overdueInvoices: financial.overdueInvoicesCount,
      lastContactAt: listItem.lastContactAt
    },
    activeWorks,
    pendingInvoices,
    recentBudgets: client.budgets.slice(0, 5),
    pendingBudgets,
    upcomingEvents,
    pendingReminders,
    contacts,
    payments,
    documents,
    activity
  };
}

export async function findClientDuplicateCandidate(data: CrmClientFieldsInput, excludeId?: string | null): Promise<DuplicateMatch | null> {
  const phone = normalizePhone(data.telefono || data.contactoPrincipalTelefono);
  const nifCif = data.nifCif?.trim();
  const email = data.email?.trim() || data.emailFacturacion?.trim() || data.contactoPrincipalEmail?.trim();
  const name = data.razonSocial?.trim() || data.nombreComercial?.trim() || data.nombre?.trim();
  const phoneFragments = phone.length >= 6 ? [phone.slice(0, 3), phone.slice(-3)] : phone ? [phone] : [];
  const conditions = [
    nifCif ? { nifCif: { equals: nifCif, mode: "insensitive" } } : undefined,
    email
      ? {
          OR: [
            { email: { equals: email, mode: "insensitive" } },
            { emailFacturacion: { equals: email, mode: "insensitive" } },
            { contactoPrincipalEmail: { equals: email, mode: "insensitive" } }
          ]
        }
      : undefined,
    ...phoneFragments.map((fragment) => ({
      OR: [
        { telefono: { contains: fragment } },
        { telefonoFacturacion: { contains: fragment } },
        { contactoPrincipalTelefono: { contains: fragment } }
      ]
    })),
    name ? { nombre: { contains: name, mode: "insensitive" } } : undefined,
    name ? { razonSocial: { contains: name, mode: "insensitive" } } : undefined,
    name ? { nombreComercial: { contains: name, mode: "insensitive" } } : undefined
  ].filter(Boolean) as Prisma.ClientWhereInput[];

  if (!conditions.length) return null;

  const candidates = await prisma.client.findMany({
    where: { OR: conditions },
    take: 20,
    select: {
      id: true,
      nombre: true,
      nombreComercial: true,
      razonSocial: true,
      telefono: true,
      email: true,
      emailFacturacion: true,
      nifCif: true,
      telefonoFacturacion: true,
      contactoPrincipalTelefono: true,
      contactoPrincipalEmail: true
    }
  });

  return detectDuplicateClients(data, candidates, excludeId);
}

function buildClientWhere(query: ClientListQuery): Prisma.ClientWhereInput {
  const and: Prisma.ClientWhereInput[] = [];
  const search = query.buscar?.trim();
  const filters = parseFilters(query.filtros);

  if (search) {
    and.push({
      OR: [
        { nombre: { contains: search, mode: "insensitive" } },
        { razonSocial: { contains: search, mode: "insensitive" } },
        { nombreComercial: { contains: search, mode: "insensitive" } },
        { nifCif: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { emailFacturacion: { contains: search, mode: "insensitive" } },
        { telefono: { contains: search, mode: "insensitive" } },
        { contactoPrincipalNombre: { contains: search, mode: "insensitive" } },
        { contactoPrincipalEmail: { contains: search, mode: "insensitive" } },
        { contactoPrincipalTelefono: { contains: search, mode: "insensitive" } },
        { direccion: { contains: search, mode: "insensitive" } },
        { direccionFiscal: { contains: search, mode: "insensitive" } }
      ]
    });
  }

  if (query.estado && query.estado !== "todos" && CLIENT_STATUSES.includes(query.estado)) and.push({ estado: query.estado as ClientStatus });
  if (query.tipo && query.tipo !== "todos") and.push({ tipo: { equals: query.tipo, mode: "insensitive" } });

  if (query.archivo === "archivados") and.push({ archivadoAt: { not: null } });
  else if (query.archivo !== "todos") and.push({ archivadoAt: null });

  if (filters.has("obras_activas")) and.push({ works: { some: { estado: { in: ACTIVE_WORK_STATUSES as WorkStatus[] } } } });
  if (filters.has("facturas_pendientes")) {
    and.push({
      invoices: {
        some: {
          pendiente: { gt: 0 },
          estado: { notIn: PRISMA_BILLABLE_INVOICE_EXCLUDED_STATUSES as InvoiceStatus[] }
        }
      }
    });
  }
  if (filters.has("facturas_vencidas")) {
    and.push({
      invoices: {
        some: {
          pendiente: { gt: 0 },
          fechaVencimiento: { lt: new Date() },
          estado: { notIn: PRISMA_BILLABLE_INVOICE_EXCLUDED_STATUSES as InvoiceStatus[] }
        }
      }
    });
  }
  if (filters.has("presupuestos_pendientes")) {
    and.push({ budgets: { some: { estado: { in: PENDING_BUDGET_STATUSES as BudgetStatus[] } } } });
  }
  if (filters.has("seguimiento_pendiente")) {
    and.push({
      OR: [
        { reminders: { some: { estado: { in: OPEN_REMINDER_STATUSES as ReminderStatus[] } } } },
        { agendaEvents: { some: { tipo: { in: ["seguimiento_presupuesto", "seguimiento_cobro"] as EventoAgendaTipo[] }, estado: { not: "cancelado" } } } }
      ]
    });
  }
  if (filters.has("sin_actividad_reciente")) {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    and.push({ OR: [{ ultimaInteraccion: null }, { ultimaInteraccion: { lt: date } }] });
  }

  return and.length ? { AND: and } : {};
}

function parseFilters(value?: string) {
  return new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean));
}

function matchesComputedFilters(item: ClientListItem, filters: Set<string>) {
  if (filters.has("datos_incompletos") && item.pendingFields.length === 0) return false;
  if (filters.has("facturas_pendientes") && item.pendingInvoicesCount === 0) return false;
  if (filters.has("facturas_vencidas") && item.overdueInvoicesCount === 0) return false;
  if (filters.has("obras_activas") && item.activeWorksCount === 0) return false;
  if (filters.has("presupuestos_pendientes") && item.pendingBudgetsCount === 0) return false;
  return true;
}

function toListItem(client: ClientCrmRecord, now: Date): ClientListItem {
  const financial = buildFinancialSummary(client.invoices, now);
  const budgets = buildBudgetSummary(client.budgets);
  const pendingFields = getClientPendingFields(client);
  const activeWorksCount = client.works.filter((work) => isActiveWorkStatus(work.estado)).length;
  const lastActivityAt = latestDate([
    client.ultimaInteraccion,
    client.fechaCreacion,
    ...client.budgets.flatMap((budget) => [budget.fechaCreacion, budget.fechaEnvio, budget.fechaSeguimiento]),
    ...client.invoices.map((invoice) => invoice.fechaEmision),
    ...client.payments.map((payment) => payment.fecha),
    ...client.works.flatMap((work) => [work.fechaInicio, work.fechaFinPrevista]),
    ...client.expenses.map((expense) => expense.fecha),
    ...client.reminders.map((reminder) => reminder.fechaProgramada),
    ...client.agendaEvents.map((event) => event.fechaInicio)
  ]);
  const lastContactAt = lastContactDate(client.agendaEvents, now);

  return {
    id: client.id,
    displayName: displayClientName(client),
    fiscalName: fiscalClientName(client),
    typeLabel: classifyClientType(client.tipo),
    typeRaw: client.tipo,
    status: client.estado,
    phone: client.contactoPrincipalTelefono ?? client.telefono,
    email: client.contactoPrincipalEmail ?? client.email,
    primaryContact: primaryContactLabel(client),
    primaryContactDetail: client.contactoPrincipalCargo ?? client.email ?? client.telefono,
    fiscalId: client.nifCif,
    activeWorksCount,
    totalWorksCount: client.works.length,
    budgetedTotal: budgets.budgetedTotal,
    billedTotal: financial.billedTotal,
    paidTotal: financial.paidTotal,
    pendingTotal: financial.pendingTotal,
    pendingInvoicesCount: financial.pendingInvoicesCount,
    overdueInvoicesCount: financial.overdueInvoicesCount,
    pendingBudgetsCount: budgets.pendingBudgetsCount,
    pendingFields,
    lastActivityAt,
    lastContactAt,
    archivedAt: client.archivadoAt,
    nextAction: nextActionForClient({ pendingFields, activeWorksCount, financial, pendingBudgetsCount: budgets.pendingBudgetsCount, status: client.estado })
  };
}

function sortClientItems(items: ClientListItem[], order: string) {
  return [...items].sort((a, b) => {
    switch (order) {
      case "nombre_asc":
        return a.displayName.localeCompare(b.displayName, "es");
      case "nombre_desc":
        return b.displayName.localeCompare(a.displayName, "es");
      case "alta_desc":
        return compareDates(b.lastActivityAt, a.lastActivityAt);
      case "saldo_desc":
        return b.pendingTotal - a.pendingTotal || a.displayName.localeCompare(b.displayName, "es");
      case "facturacion_desc":
        return b.billedTotal - a.billedTotal || a.displayName.localeCompare(b.displayName, "es");
      case "obras_desc":
        return b.activeWorksCount - a.activeWorksCount || a.displayName.localeCompare(b.displayName, "es");
      case "ultimaActividad_asc":
        return compareDates(a.lastActivityAt, b.lastActivityAt);
      case "ultimaActividad_desc":
      default:
        return compareDates(b.lastActivityAt, a.lastActivityAt);
    }
  });
}

function compareDates(a: Date | null, b: Date | null) {
  return (a?.getTime() ?? 0) - (b?.getTime() ?? 0);
}

function nextActionForClient({
  pendingFields,
  activeWorksCount,
  financial,
  pendingBudgetsCount,
  status
}: {
  pendingFields: string[];
  activeWorksCount: number;
  financial: ReturnType<typeof buildFinancialSummary>;
  pendingBudgetsCount: number;
  status: string;
}) {
  if (pendingFields.length > 0) return "Completar datos";
  if (financial.overdueInvoicesCount > 0) return "Revisar cobro vencido";
  if (financial.pendingTotal > 0) return "Registrar o reclamar pago";
  if (pendingBudgetsCount > 0) return "Hacer seguimiento";
  if (activeWorksCount > 0) return "Revisar obra activa";
  if (status === "nuevo") return "Registrar próxima acción";
  return "Ver ficha";
}

function activeFilterLabels(query: ClientListQuery, filters: Set<string>) {
  const labels: Array<{ id: string; label: string }> = [];
  if (query.buscar) labels.push({ id: "buscar", label: `Búsqueda: ${query.buscar}` });
  if (query.estado && query.estado !== "todos") labels.push({ id: "estado", label: `Estado: ${query.estado.replaceAll("_", " ")}` });
  if (query.tipo && query.tipo !== "todos") labels.push({ id: "tipo", label: `Tipo: ${query.tipo}` });
  if (query.archivo === "archivados") labels.push({ id: "archivo", label: "Archivados" });
  if (query.archivo === "todos") labels.push({ id: "archivo", label: "Activos y archivados" });
  for (const filter of filters) labels.push({ id: filter, label: filter.replaceAll("_", " ") });
  return labels;
}

async function getClientTypeOptions() {
  const rows = await prisma.client.findMany({
    select: { tipo: true },
    distinct: ["tipo"],
    orderBy: { tipo: "asc" }
  });
  return rows.map((row) => row.tipo).filter(Boolean);
}

function buildDerivedContacts(client: ClientCrmRecord) {
  const contacts: Array<{
    id: string;
    name: string;
    role: string;
    phone: string | null;
    email: string | null;
    flags: string[];
    notes: string | null;
  }> = [];

  const primaryName = client.contactoPrincipalNombre || (classifyClientType(client.tipo) === "Particular" ? client.nombre : null);
  if (primaryName || client.contactoPrincipalTelefono || client.contactoPrincipalEmail) {
    contacts.push({
      id: "primary",
      name: primaryName ?? "Contacto principal",
      role: client.contactoPrincipalCargo ?? "Contacto principal",
      phone: client.contactoPrincipalTelefono ?? client.telefono,
      email: client.contactoPrincipalEmail ?? client.email,
      flags: ["Principal"],
      notes: null
    });
  }

  if (client.contactoFacturacionNombre || client.emailFacturacion || client.telefonoFacturacion) {
    contacts.push({
      id: "billing",
      name: client.contactoFacturacionNombre ?? "Facturación",
      role: "Facturación",
      phone: client.telefonoFacturacion ?? client.telefono,
      email: client.emailFacturacion ?? client.email,
      flags: ["Facturación"],
      notes: "Contacto derivado de los datos de facturación del cliente."
    });
  }

  return contacts;
}

function buildActivity(client: ClientCrmRecord, now: Date) {
  const events: Array<{ id: string; type: string; text: string; date: Date; href?: string }> = [
    { id: `client-${client.id}`, type: "Cliente", text: "Cliente creado", date: client.fechaCreacion, href: `/clientes/${client.id}` }
  ];

  for (const work of client.works) {
    if (work.fechaInicio) events.push({ id: `work-${work.id}`, type: "Obra", text: `Obra creada: ${work.titulo}`, date: work.fechaInicio, href: `/obras` });
    if (work.fechaFinPrevista && ["finalizada", "cerrada"].includes(work.estado)) {
      events.push({ id: `work-closed-${work.id}`, type: "Obra", text: `Obra cerrada: ${work.titulo}`, date: work.fechaFinPrevista, href: `/obras` });
    }
  }
  for (const budget of client.budgets) {
    events.push({ id: `budget-${budget.id}`, type: "Presupuesto", text: `Presupuesto ${budget.numero} creado`, date: budget.fechaCreacion, href: `/presupuestos/${budget.id}` });
    if (budget.fechaEnvio) events.push({ id: `budget-sent-${budget.id}`, type: "Presupuesto", text: `Presupuesto ${budget.numero} enviado`, date: budget.fechaEnvio, href: `/presupuestos/${budget.id}` });
  }
  for (const invoice of client.invoices) {
    if (!isBillableInvoiceStatus(invoice.estado)) continue;
    events.push({ id: `invoice-${invoice.id}`, type: "Factura", text: `Factura ${invoice.numero} creada`, date: invoice.fechaEmision, href: `/dinero/${invoice.id}` });
    if (pendingAmountForInvoice(invoice) > 0 && invoice.fechaVencimiento < now) {
      events.push({ id: `invoice-overdue-${invoice.id}`, type: "Cobro", text: `Factura ${invoice.numero} vencida`, date: invoice.fechaVencimiento, href: `/dinero/${invoice.id}` });
    }
  }
  for (const payment of client.payments) {
    events.push({ id: `payment-${payment.id}`, type: "Pago", text: `Pago registrado en ${payment.invoice.numero}`, date: payment.fecha, href: `/dinero/${payment.invoice.id}` });
  }
  for (const event of client.agendaEvents) {
    if (event.estado === "cancelado") continue;
    events.push({ id: `agenda-${event.id}`, type: "Agenda", text: event.titulo, date: event.fechaInicio, href: `/gestion?tipo=eventoAgenda&id=${event.id}&returnTo=/clientes/${client.id}` });
  }
  for (const reminder of client.reminders) {
    if (reminder.estado === "cancelado") continue;
    events.push({ id: `reminder-${reminder.id}`, type: "Recordatorio", text: reminder.mensaje, date: reminder.fechaProgramada, href: `/gestion?tipo=recordatorio&id=${reminder.id}&returnTo=/clientes/${client.id}` });
  }
  for (const expense of client.expenses) {
    events.push({ id: `expense-${expense.id}`, type: "Gasto", text: `Gasto registrado: ${expense.concepto}`, date: expense.fecha, href: `/gastos-materiales` });
  }

  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function clientDuplicateRedirectUrl(data: CrmClientFieldsInput & { estado?: string | null; origen?: string | null; notas?: string | null }, duplicate: DuplicateMatch) {
  const params = new URLSearchParams({ tipo: "cliente", duplicateOf: duplicate.client.id, duplicateStrength: duplicate.strength, duplicateReason: duplicate.reason });
  for (const [key, value] of Object.entries(data)) {
    if (key === "tipo") {
      if (typeof value === "string" && value.trim()) params.set("tipoCliente", value);
      continue;
    }
    if (typeof value === "string" && value.trim()) params.set(key, value);
  }
  return `/gestion?${params.toString()}`;
}

export function clientDraftFromFormData(formData: FormData): CrmClientFieldsInput & {
  estado?: string | null;
  origen?: string | null;
  notas?: string | null;
} {
  return {
    nombre: optionalFormText(formData, "nombre"),
    nombreComercial: optionalFormText(formData, "nombreComercial"),
    razonSocial: optionalFormText(formData, "razonSocial"),
    nifCif: optionalFormText(formData, "nifCif"),
    telefono: optionalFormText(formData, "telefono"),
    email: optionalFormText(formData, "email"),
    direccion: optionalFormText(formData, "direccion"),
    direccionFiscal: optionalFormText(formData, "direccionFiscal"),
    codigoPostal: optionalFormText(formData, "codigoPostal"),
    municipio: optionalFormText(formData, "municipio"),
    provincia: optionalFormText(formData, "provincia"),
    pais: optionalFormText(formData, "pais"),
    emailFacturacion: optionalFormText(formData, "emailFacturacion"),
    telefonoFacturacion: optionalFormText(formData, "telefonoFacturacion"),
    contactoPrincipalNombre: optionalFormText(formData, "contactoPrincipalNombre"),
    contactoPrincipalTelefono: optionalFormText(formData, "contactoPrincipalTelefono"),
    contactoPrincipalEmail: optionalFormText(formData, "contactoPrincipalEmail"),
    contactoPrincipalCargo: optionalFormText(formData, "contactoPrincipalCargo"),
    contactoFacturacionNombre: optionalFormText(formData, "contactoFacturacionNombre"),
    tipo: optionalFormText(formData, "tipoCliente"),
    estado: optionalFormText(formData, "estado"),
    origen: optionalFormText(formData, "origen"),
    notas: optionalFormText(formData, "notas")
  };
}

function optionalFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
