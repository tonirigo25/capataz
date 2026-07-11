export const ACTIVE_WORK_STATUSES = ["pendiente_inicio", "planificada", "preparacion", "en_curso", "pausada", "parada", "pendiente_material", "pendiente_cliente", "pendiente_remates", "parcialmente_terminada", "facturada_parcialmente", "pendiente_cobro"];
export const ATTENTION_BUDGET_STATUSES = ["borrador", "pendiente_revision", "pendiente_respuesta", "enviado", "visto"];
export const BILLABLE_INVOICE_EXCLUDED_STATUSES = ["borrador"];

type DateLike = Date | string | null | undefined;

export type DashboardClient = {
  id: string;
  nombre: string;
  estado: string;
  fechaCreacion?: DateLike;
  ultimaInteraccion?: DateLike;
};

export type DashboardWork = {
  id: string;
  titulo: string;
  direccion?: string | null;
  tipoTrabajo?: string | null;
  estado: string;
  fechaInicio?: DateLike;
  fechaFinPrevista?: DateLike;
  presupuestoAprobado?: number;
  gastoReal?: number;
  margenEstimado?: number;
  client: { nombre: string };
  invoices?: Array<{ pendiente: number }>;
  materials?: Array<{ estado: string }>;
};

export type DashboardBudget = {
  id: string;
  numero: string;
  titulo: string;
  total: number;
  estado: string;
  fechaCreacion: DateLike;
  fechaEnvio?: DateLike;
  fechaSeguimiento?: DateLike;
  client: { nombre: string };
  work?: { titulo: string } | null;
};

export type DashboardInvoice = {
  id: string;
  numero: string;
  concepto: string;
  total: number;
  pendiente: number;
  pagado?: number;
  estado: string;
  fechaEmision: DateLike;
  fechaVencimiento: DateLike;
  client: { nombre: string };
  work?: { titulo: string } | null;
  payments?: Array<{ id: string; importe: number; fecha: DateLike; metodo?: string; tipo?: string }>;
};

export type DashboardExpense = {
  id: string;
  proveedor: string;
  concepto: string;
  importe: number;
  fecha: DateLike;
  work?: { titulo: string; client?: { nombre: string } } | null;
};

export type DashboardMaterial = {
  id?: string;
  nombre: string;
  cantidad?: string;
  estado: string;
  work?: { titulo: string; client?: { nombre: string } } | null;
};

export type DashboardReminder = {
  id: string;
  tipo: string;
  estado: string;
  mensaje: string;
  fechaProgramada: DateLike;
  client?: { nombre: string } | null;
  invoice?: { numero: string } | null;
  budget?: { numero: string } | null;
  work?: { titulo: string } | null;
};

export type DashboardAgendaItem = {
  id: string;
  source: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  estado: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  clienteId: string | null;
  clienteNombre: string | null;
  obraId: string | null;
  obraTitulo: string | null;
  presupuestoId: string | null;
  presupuestoNumero: string | null;
  facturaId: string | null;
  facturaNumero: string | null;
  direccion: string | null;
  notas: string | null;
  editable: boolean;
  href: string;
};

export type DashboardInput = {
  clients: DashboardClient[];
  works: DashboardWork[];
  budgets: DashboardBudget[];
  invoices: DashboardInvoice[];
  materials: DashboardMaterial[];
  reminders: DashboardReminder[];
  expenses: DashboardExpense[];
  agendaItems: DashboardAgendaItem[];
};

export type DashboardModel = ReturnType<typeof buildTodayDashboard>;

export function buildTodayDashboard(input: DashboardInput, now = new Date()) {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const month = monthRange(now);

  const agendaToday = input.agendaItems
    .filter((item) => item.fechaInicio >= today && item.fechaInicio < tomorrow && item.estado !== "cancelado")
    .sort(sortAgendaItems);

  const billableInvoices = input.invoices.filter(isBillableInvoice);
  const pendingInvoices = billableInvoices.filter((invoice) => invoice.pendiente > 0);
  const overdueInvoices = pendingInvoices.filter((invoice) => invoiceLiveStatus(invoice, now) === "vencida");
  const partialInvoices = pendingInvoices.filter((invoice) => invoiceLiveStatus(invoice, now) === "parcialmente_pagada");
  const pendingCollection = sum(pendingInvoices, (invoice) => invoice.pendiente);
  const billedThisMonth = sum(
    billableInvoices.filter((invoice) => isInRange(invoice.fechaEmision, month.start, month.end)),
    (invoice) => invoice.total
  );
  const expensesThisMonth = sum(
    input.expenses.filter((expense) => isInRange(expense.fecha, month.start, month.end)),
    (expense) => expense.importe
  );

  const pendingBudgets = input.budgets.filter((budget) => ATTENTION_BUDGET_STATUSES.includes(budget.estado));
  const activeWorks = input.works.filter((work) => ACTIVE_WORK_STATUSES.includes(work.estado));
  const followUpsToday = agendaToday.filter((item) => item.tipo.includes("seguimiento"));
  const visitsToday = agendaToday.filter((item) => item.tipo === "visita");
  const callsToday = agendaToday.filter((item) => item.tipo === "llamada");
  const remindersToday = agendaToday.filter((item) => item.source === "recordatorio" || item.tipo === "recordatorio_interno");
  const pendingMaterials = input.materials.filter((material) => ["pendiente", "falta"].includes(material.estado));
  const incompleteClients = input.clients.filter((client) => ["pendiente_datos", "nuevo"].includes(client.estado));

  const receivables = pendingInvoices
    .slice()
    .sort((a, b) => invoicePriorityScore(b, now) - invoicePriorityScore(a, now) || toTime(a.fechaVencimiento) - toTime(b.fechaVencimiento) || b.pendiente - a.pendiente)
    .slice(0, 5);

  const budgetAttention = pendingBudgets
    .slice()
    .sort((a, b) => budgetPriorityScore(b) - budgetPriorityScore(a) || toTime(a.fechaSeguimiento ?? a.fechaEnvio ?? a.fechaCreacion) - toTime(b.fechaSeguimiento ?? b.fechaEnvio ?? b.fechaCreacion))
    .slice(0, 5);

  const activeWorkCards = activeWorks
    .slice()
    .sort((a, b) => workPriorityScore(b) - workPriorityScore(a) || toTime(a.fechaFinPrevista) - toTime(b.fechaFinPrevista))
    .slice(0, 5)
    .map((work) => ({
      ...work,
      nextAgendaItem: input.agendaItems.find((item) => item.obraId === work.id && item.fechaInicio >= now && item.estado !== "cancelado") ?? null
    }));

  const priorities = buildPriorities({
    agendaToday,
    overdueInvoices,
    partialInvoices,
    pendingBudgets,
    incompleteClients,
    activeWorks,
    now
  }).slice(0, 5);

  const recentActivity = buildRecentActivity(input).slice(0, 10);

  return {
    counts: {
      visitsToday: visitsToday.length,
      callsToday: callsToday.length,
      followUpsToday: followUpsToday.length,
      remindersToday: remindersToday.length,
      eventsToday: agendaToday.length,
      pendingBudgets: pendingBudgets.length,
      activeWorks: activeWorks.length,
      pendingMaterials: pendingMaterials.length,
      pendingInvoices: pendingInvoices.length,
      overdueInvoices: overdueInvoices.length,
      partialInvoices: partialInvoices.length,
      incompleteClients: incompleteClients.length
    },
    money: {
      pendingCollection,
      billedThisMonth,
      expensesThisMonth,
      overduePending: sum(overdueInvoices, (invoice) => invoice.pendiente)
    },
    agendaToday,
    receivables,
    pendingBudgets: budgetAttention,
    activeWorks: activeWorkCards,
    priorities,
    recentActivity,
    dailySummary: buildDailySummary({
      visitsToday: visitsToday.length,
      followUpsToday: followUpsToday.length,
      overdueInvoices: overdueInvoices.length,
      pendingCollection
    })
  };
}

export function greetingForDate(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function invoiceLiveStatus(invoice: Pick<DashboardInvoice, "total" | "pendiente" | "fechaVencimiento">, now = new Date()) {
  if (invoice.pendiente <= 0) return "pagada";
  if (invoice.pendiente < invoice.total) return "parcialmente_pagada";
  if (startOfDay(toDate(invoice.fechaVencimiento) ?? now) < startOfDay(now)) return "vencida";
  return "pendiente";
}

export function isBillableInvoice(invoice: Pick<DashboardInvoice, "estado">) {
  return !BILLABLE_INVOICE_EXCLUDED_STATUSES.includes(invoice.estado);
}

export function sortAgendaItems(a: DashboardAgendaItem, b: DashboardAgendaItem) {
  const aHasTime = hasSpecificTime(a.fechaInicio);
  const bHasTime = hasSpecificTime(b.fechaInicio);
  if (aHasTime !== bHasTime) return aHasTime ? -1 : 1;
  return a.fechaInicio.getTime() - b.fechaInicio.getTime();
}

export function monthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function buildDailySummary({
  visitsToday,
  followUpsToday,
  overdueInvoices,
  pendingCollection
}: {
  visitsToday: number;
  followUpsToday: number;
  overdueInvoices: number;
  pendingCollection: number;
}) {
  const parts = [];
  if (visitsToday) parts.push(`${visitsToday} ${visitsToday === 1 ? "visita" : "visitas"}`);
  if (followUpsToday) parts.push(`${followUpsToday} ${followUpsToday === 1 ? "seguimiento" : "seguimientos"}`);
  if (overdueInvoices) parts.push(`${overdueInvoices} ${overdueInvoices === 1 ? "factura vencida" : "facturas vencidas"}`);
  if (pendingCollection > 0) parts.push(`${pendingCollection.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })} pendientes de cobro`);

  if (!parts.length) {
    return "Hoy no tienes tareas urgentes. Puedes revisar tus obras o preparar nuevos presupuestos.";
  }

  return `Hoy tienes ${parts.join(", ")}.`;
}

function buildPriorities({
  agendaToday,
  overdueInvoices,
  partialInvoices,
  pendingBudgets,
  incompleteClients,
  activeWorks,
  now
}: {
  agendaToday: DashboardAgendaItem[];
  overdueInvoices: DashboardInvoice[];
  partialInvoices: DashboardInvoice[];
  pendingBudgets: DashboardBudget[];
  incompleteClients: DashboardClient[];
  activeWorks: DashboardWork[];
  now: Date;
}) {
  const items = [
    ...overdueInvoices.map((invoice) => ({
      key: `invoice-${invoice.id}`,
      type: "Factura vencida",
      title: `${invoice.numero} · ${invoice.client.nombre}`,
      detail: `${invoice.concepto}`,
      date: invoice.fechaVencimiento,
      status: "vencida",
      href: `/dinero/${invoice.id}`,
      action: "Ver factura",
      score: 100
    })),
    ...agendaToday.map((item) => ({
      key: `agenda-${item.id}`,
      type: item.tipo.includes("seguimiento") ? "Seguimiento de hoy" : item.tipo === "visita" ? "Visita de hoy" : "Agenda de hoy",
      title: item.titulo,
      detail: item.clienteNombre ?? item.descripcion ?? "Agenda",
      date: item.fechaInicio,
      status: item.estado,
      href: item.href,
      action: item.editable ? "Editar" : "Abrir",
      score: item.fechaInicio >= now ? 80 : 75
    })),
    ...pendingBudgets
      .filter((budget) => ["enviado", "visto", "pendiente_respuesta", "pendiente_revision"].includes(budget.estado))
      .map((budget) => ({
        key: `budget-${budget.id}`,
        type: "Presupuesto pendiente",
        title: `${budget.numero} · ${budget.client.nombre}`,
        detail: budget.titulo,
        date: budget.fechaSeguimiento ?? budget.fechaEnvio ?? budget.fechaCreacion,
        status: budget.estado,
        href: `/presupuestos?buscar=${encodeURIComponent(budget.numero)}`,
        action: "Ver presupuesto",
        score: 70
      })),
    ...partialInvoices.map((invoice) => ({
      key: `partial-${invoice.id}`,
      type: "Pago parcial",
      title: `${invoice.numero} · ${invoice.client.nombre}`,
      detail: `${invoice.concepto}`,
      date: invoice.fechaVencimiento,
      status: "parcialmente_pagada",
      href: `/dinero/${invoice.id}`,
      action: "Registrar pago",
      score: 65
    })),
    ...activeWorks
      .filter((work) => ["pendiente_material", "pendiente_remates", "pendiente_cobro"].includes(work.estado))
      .map((work) => ({
        key: `work-${work.id}`,
        type: "Obra con atención",
        title: work.titulo,
        detail: work.client.nombre,
        date: work.fechaFinPrevista ?? work.fechaInicio,
        status: work.estado,
        href: `/obras?buscar=${encodeURIComponent(work.titulo)}`,
        action: "Ver obra",
        score: 55
      })),
    ...incompleteClients.slice(0, 3).map((client) => ({
      key: `client-${client.id}`,
      type: "Cliente incompleto",
      title: client.nombre,
      detail: "Revisar datos de contacto o facturación",
      date: client.ultimaInteraccion ?? client.fechaCreacion,
      status: client.estado,
      href: `/clientes/${client.id}`,
      action: "Completar datos",
      score: 45
    }))
  ];

  return items.sort((a, b) => b.score - a.score || toTime(a.date) - toTime(b.date));
}

function buildRecentActivity(input: DashboardInput) {
  const activities = [
    ...input.clients.map((client) => ({
      key: `client-${client.id}`,
      icon: "client",
      title: `Cliente creado: ${client.nombre}`,
      href: `/clientes/${client.id}`,
      date: client.fechaCreacion
    })),
    ...input.works.map((work) => ({
      key: `work-${work.id}`,
      icon: "work",
      title: `Obra creada: ${work.titulo}`,
      href: `/obras?buscar=${encodeURIComponent(work.titulo)}`,
      date: work.fechaInicio
    })),
    ...input.budgets.map((budget) => ({
      key: `budget-${budget.id}`,
      icon: "budget",
      title: `Presupuesto ${budget.numero}: ${budget.client.nombre}`,
      href: `/presupuestos/${budget.id}`,
      date: budget.fechaCreacion
    })),
    ...input.invoices.map((invoice) => ({
      key: `invoice-${invoice.id}`,
      icon: "invoice",
      title: `Factura ${invoice.numero}: ${invoice.client.nombre}`,
      href: `/dinero/${invoice.id}`,
      date: invoice.fechaEmision
    })),
    ...input.invoices.flatMap((invoice) =>
      (invoice.payments ?? []).map((payment) => ({
        key: `payment-${payment.id}`,
        icon: "payment",
        title: `Pago registrado en ${invoice.numero}`,
        href: `/dinero/${invoice.id}`,
        date: payment.fecha
      }))
    ),
    ...input.expenses.map((expense) => ({
      key: `expense-${expense.id}`,
      icon: "expense",
      title: `Gasto: ${expense.concepto}`,
      href: `/gastos-materiales?buscar=${encodeURIComponent(expense.concepto)}`,
      date: expense.fecha
    }))
  ];

  return activities
    .filter((activity) => toDate(activity.date))
    .sort((a, b) => toTime(b.date) - toTime(a.date));
}

function invoicePriorityScore(invoice: DashboardInvoice, now: Date) {
  const status = invoiceLiveStatus(invoice, now);
  if (status === "vencida") return 100;
  if (isSameDay(toDate(invoice.fechaVencimiento), now)) return 80;
  if (status === "parcialmente_pagada") return 70;
  return Math.min(60, 30 + invoice.pendiente / 1000);
}

function budgetPriorityScore(budget: DashboardBudget) {
  const scores: Record<string, number> = {
    pendiente_respuesta: 90,
    visto: 80,
    enviado: 75,
    pendiente_revision: 60,
    borrador: 40
  };
  return scores[budget.estado] ?? 0;
}

function workPriorityScore(work: DashboardWork) {
  const scores: Record<string, number> = {
    pendiente_cobro: 90,
    pendiente_material: 80,
    pendiente_remates: 70,
    en_curso: 50,
    pausada: 45,
    pendiente_inicio: 30
  };
  return scores[work.estado] ?? 0;
}

function isInRange(value: DateLike, start: Date, end: Date) {
  const date = toDate(value);
  return Boolean(date && date >= start && date < end);
}

function isSameDay(a: Date | null, b: Date) {
  return Boolean(a && startOfDay(a).getTime() === startOfDay(b).getTime());
}

function hasSpecificTime(date: Date) {
  return date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;
}

function sum<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((total, item) => total + getValue(item), 0);
}

function toDate(value: DateLike) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toTime(value: DateLike) {
  return toDate(value)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}
