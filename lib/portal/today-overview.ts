import type { CompanyContext } from "@/lib/auth/session";
import { getAgendaItems } from "@/lib/agenda";
import { resolveAuthorization, resolveScopedEntityIds } from "@/lib/commercial/authorization";
import { prisma } from "@/lib/prisma";

export type TodayPriority = {
  id: string;
  kind: "budget" | "invoice" | "agenda" | "document" | "followup";
  title: string;
  status: string;
  tone: "review" | "urgent" | "agenda" | "pending" | "followup";
  source: string;
  due: string;
  owner: string;
  href: string;
  action: string;
};

export type TodayAgendaRow = {
  id: string;
  time: string;
  title: string;
  context: string;
  href: string;
};

export type TodayActivityRow = {
  id: string;
  title: string;
  detail: string;
  time: string;
  href: string;
};

export type TodayWorkRow = {
  id: string;
  title: string;
  status: string;
  progress: number | null;
  href: string;
};

export type TodayMoneyRow = {
  id: string;
  label: string;
  amount: number;
  due: string;
  href: string;
};

export type TodayOverview = {
  priorities: TodayPriority[];
  agenda: TodayAgendaRow[];
  activity: TodayActivityRow[];
  works: TodayWorkRow[];
  collections: TodayMoneyRow[];
  payments: TodayMoneyRow[];
  summary: {
    updatedAt: Date;
    urgentPriorities: number;
    visits: number;
    completedVisits: number;
    pendingDocuments: number;
    followups: number;
  };
};

export async function getTodayOverview(context: CompanyContext, now = new Date()): Promise<TodayOverview> {
  const companyId = context.companyId;
  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);
  const soon = addDays(dayStart, 7);
  const [
    budgetAccess,
    invoiceAccess,
    agendaAccess,
    documentAccess,
    followupAccess,
    workAccess,
    reportsAccess,
    purchaseAccess,
  ] = await Promise.all([
    resolveAuthorization(context, "sales.budgets.view"),
    resolveAuthorization(context, "sales.invoices.view"),
    resolveAuthorization(context, "agenda.view"),
    resolveAuthorization(context, "documents.view"),
    resolveAuthorization(context, "followups.view"),
    resolveAuthorization(context, "work.view"),
    resolveAuthorization(context, "reports.view"),
    resolveAuthorization(context, "purchase_cost.view"),
  ]);

  const [budgetScopes, invoiceScopes, documentIds, followupScopes, workIds] = await Promise.all([
    budgetAccess.allowed ? relationScopes(context, "sales.budgets.view") : Promise.resolve(emptyRelationScopes()),
    invoiceAccess.allowed ? relationScopes(context, "sales.invoices.view") : Promise.resolve(emptyRelationScopes()),
    documentAccess.allowed ? resolveScopedEntityIds(context, "documents.view", "Document") : Promise.resolve([]),
    followupAccess.allowed ? relationScopes(context, "followups.view") : Promise.resolve(emptyRelationScopes()),
    workAccess.allowed ? resolveScopedEntityIds(context, "work.view", "Work") : Promise.resolve([]),
  ]);

  const [agendaItems, budgets, invoices, documents, followups, works, activity, expenses] = await Promise.all([
    agendaAccess.allowed ? getAgendaItems() : Promise.resolve([]),
    budgetAccess.allowed
      ? prisma.budget.findMany({
          where: {
            companyId,
            estado: { in: ["pendiente_revision", "enviado", "visto", "pendiente_respuesta"] },
            ...relationWhere(budgetScopes),
          },
          include: { client: { select: { nombre: true } } },
          orderBy: [{ fechaSeguimiento: "asc" }, { fechaValidez: "asc" }, { fechaCreacion: "asc" }],
          take: 8,
        })
      : Promise.resolve([]),
    invoiceAccess.allowed
      ? prisma.invoice.findMany({
          where: {
            companyId,
            pendiente: { gt: 0 },
            estado: { notIn: ["borrador", "pagada"] },
            fechaVencimiento: { lte: soon },
            ...relationWhere(invoiceScopes),
          },
          include: { client: { select: { nombre: true } } },
          orderBy: { fechaVencimiento: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    documentAccess.allowed
      ? prisma.document.findMany({
          where: {
            companyId,
            archivedAt: null,
            status: { in: ["REVIEW_REQUIRED", "PROCESSING", "UPLOADED"] },
            ...(documentIds === null ? {} : { id: { in: documentIds } }),
          },
          include: { client: { select: { nombre: true } } },
          orderBy: { updatedAt: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    followupAccess.allowed
      ? prisma.followUp.findMany({
          where: {
            companyId,
            archivedAt: null,
            status: { in: ["planned", "due", "in_progress", "waiting_response", "promised"] },
            OR: [{ dueAt: { lte: soon } }, { nextActionAt: { lte: soon } }],
            ...relationWhere(followupScopes),
          },
          orderBy: [{ dueAt: "asc" }, { nextActionAt: "asc" }],
          take: 8,
        })
      : Promise.resolve([]),
    workAccess.allowed
      ? prisma.work.findMany({
          where: {
            companyId,
            archivada: false,
            estado: { in: ["planificada", "preparacion", "pendiente_inicio", "en_curso", "pausada", "parcialmente_terminada", "pendiente_material", "pendiente_cliente", "parada", "pendiente_remates"] },
            ...(workIds === null ? {} : { id: { in: workIds } }),
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    reportsAccess.allowed && reportsAccess.scope === "COMPANY"
      ? prisma.auditLog.findMany({
          where: { companyId },
          include: { userActor: { select: { displayName: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    purchaseAccess.allowed
      ? prisma.expense.findMany({
          where: { companyId, paymentStatus: "pending", paymentDueDate: { lte: soon } },
          orderBy: { paymentDueDate: "asc" },
          take: 4,
        })
      : Promise.resolve([]),
  ]);

  const workTasks = works.length
    ? await prisma.task.findMany({
        where: { companyId, workId: { in: works.map((work) => work.id) }, archivedAt: null },
        select: { workId: true, status: true },
      })
    : [];
  const tasksByWork = new Map<string, Array<{ status: string }>>();
  for (const task of workTasks) {
    if (!task.workId) continue;
    const rows = tasksByWork.get(task.workId) ?? [];
    rows.push(task);
    tasksByWork.set(task.workId, rows);
  }

  const todayAgenda = agendaItems
    .filter((item) => item.estado !== "cancelado" && item.fechaInicio >= dayStart && item.fechaInicio < dayEnd)
    .slice(0, 5);
  const priorities: TodayPriority[] = [];
  const budget = budgets[0];
  if (budget) priorities.push({
    id: `budget-${budget.id}`,
    kind: "budget",
    title: "Presupuesto pendiente de revisión",
    status: "Revisión",
    tone: "review",
    source: `${budget.numero} · ${budget.client.nombre}`,
    due: dueLabel(budget.fechaSeguimiento ?? budget.fechaValidez, now),
    owner: context.displayName,
    href: `/presupuestos/${budget.id}`,
    action: "Revisar",
  });
  const invoice = invoices[0];
  if (invoice) priorities.push({
    id: `invoice-${invoice.id}`,
    kind: "invoice",
    title: "Factura próxima a vencer",
    status: invoice.fechaVencimiento < now ? "Urgente" : "Vencimiento",
    tone: "urgent",
    source: `${invoice.numero} · ${invoice.client.nombre}`,
    due: dueLabel(invoice.fechaVencimiento, now),
    owner: context.displayName,
    href: `/dinero/${invoice.id}`,
    action: "Ver factura",
  });
  const visit = todayAgenda.find((item) => item.tipo === "visita") ?? todayAgenda[0];
  if (visit) priorities.push({
    id: `agenda-${visit.id}`,
    kind: "agenda",
    title: visit.tipo === "visita" ? "Visita técnica programada" : visit.titulo,
    status: "Agenda",
    tone: "agenda",
    source: visit.obraTitulo ?? visit.clienteNombre ?? visit.titulo,
    due: dueLabel(visit.fechaInicio, now),
    owner: context.displayName,
    href: visit.href,
    action: "Ver detalle",
  });
  const document = documents[0];
  if (document) priorities.push({
    id: `document-${document.id}`,
    kind: "document",
    title: "Documento por confirmar",
    status: "Pendiente",
    tone: "pending",
    source: `${document.category} · ${document.client?.nombre ?? document.name}`,
    due: dueLabel(document.updatedAt, now),
    owner: context.displayName,
    href: `/documentos/${document.id}`,
    action: "Confirmar",
  });
  const followup = followups[0];
  if (followup) priorities.push({
    id: `followup-${followup.id}`,
    kind: "followup",
    title: "Seguimiento comercial",
    status: "Seguimiento",
    tone: "followup",
    source: followup.title,
    due: dueLabel(followup.dueAt ?? followup.nextActionAt, now),
    owner: context.displayName,
    href: `/seguimientos/${followup.id}`,
    action: "Contactar",
  });

  const orderedPriorities = priorities.slice(0, 5);
  return {
    priorities: orderedPriorities,
    agenda: todayAgenda.map((item) => ({
      id: `${item.source}-${item.id}`,
      time: timeLabel(item.fechaInicio),
      title: item.titulo,
      context: item.obraTitulo ?? item.clienteNombre ?? "Agenda interna",
      href: item.href,
    })),
    activity: activity.map((item) => ({
      id: item.id,
      title: activityTitle(item.action),
      detail: `${item.userActor?.displayName ?? "Equipo"} · ${item.targetType}`,
      time: relativeTime(item.createdAt, now),
      href: auditTargetHref(item.targetType, item.targetId),
    })),
    works: works.map((work) => ({
      id: work.id,
      title: work.titulo,
      status: workStatusLabel(work.estado),
      progress: taskProgress(tasksByWork.get(work.id) ?? []),
      href: `/obras/${work.id}`,
    })),
    collections: invoices.slice(0, 2).map((item) => ({
      id: item.id,
      label: item.client.nombre,
      amount: item.pendiente,
      due: dueLabel(item.fechaVencimiento, now),
      href: `/dinero/${item.id}`,
    })),
    payments: expenses.slice(0, 2).map((item) => ({
      id: item.id,
      label: item.proveedor,
      amount: -Math.abs(item.importe),
      due: dueLabel(item.paymentDueDate, now),
      href: `/gastos-materiales/${item.id}`,
    })),
    summary: {
      updatedAt: now,
      urgentPriorities: orderedPriorities.filter((item) => item.tone === "urgent").length,
      visits: todayAgenda.filter((item) => item.tipo === "visita").length,
      completedVisits: todayAgenda.filter((item) => item.tipo === "visita" && item.estado === "realizado").length,
      pendingDocuments: documents.length,
      followups: followups.length,
    },
  };
}

async function relationScopes(context: CompanyContext, capability: "sales.budgets.view" | "sales.invoices.view" | "followups.view") {
  const [workIds, clientIds] = await Promise.all([
    resolveScopedEntityIds(context, capability, "Work"),
    resolveScopedEntityIds(context, capability, "Client"),
  ]);
  return { workIds, clientIds };
}

function emptyRelationScopes() {
  return { workIds: [] as string[] | null, clientIds: [] as string[] | null };
}

function relationWhere(scopes: { workIds: string[] | null; clientIds: string[] | null }) {
  if (scopes.workIds === null || scopes.clientIds === null) return {};
  const OR: Array<Record<string, unknown>> = [];
  if (scopes.workIds.length) OR.push({ obraId: { in: scopes.workIds } });
  if (scopes.clientIds.length) OR.push({ clienteId: { in: scopes.clientIds } });
  return OR.length ? { OR } : { id: "__none__" };
}

function taskProgress(tasks: Array<{ status: string }>) {
  if (!tasks.length) return null;
  const completed = tasks.filter((task) => task.status === "completed").length;
  return Math.round((completed / tasks.length) * 100);
}

function activityTitle(action: string) {
  const value = action.replaceAll("_", " ").replaceAll(".", " ").trim();
  return value ? value.charAt(0).toLocaleUpperCase("es-ES") + value.slice(1) : "Actividad registrada";
}

function auditTargetHref(targetType: string, targetId: string | null) {
  if (!targetId) return "/auditoria";
  if (/client/i.test(targetType)) return `/clientes/${targetId}`;
  if (/work|obra/i.test(targetType)) return `/obras/${targetId}`;
  if (/budget|presupuesto/i.test(targetType)) return `/presupuestos/${targetId}`;
  if (/invoice|factura/i.test(targetType)) return `/dinero/${targetId}`;
  if (/document/i.test(targetType)) return `/documentos/${targetId}`;
  return "/auditoria";
}

function workStatusLabel(status: string) {
  const labels: Record<string, string> = {
    planificada: "Planificación",
    preparacion: "Preparación",
    pendiente_inicio: "Pendiente",
    en_curso: "En curso",
    pausada: "En pausa",
    parcialmente_terminada: "Remates",
    pendiente_material: "Espera material",
    pendiente_cliente: "Espera cliente",
    parada: "Parada",
    pendiente_remates: "Cierre",
  };
  return labels[status] ?? status;
}

function dueLabel(date: Date | null | undefined, now: Date) {
  if (!date) return "Sin fecha";
  const today = startOfDay(now);
  const target = startOfDay(date);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  const time = date.getHours() || date.getMinutes() ? `, ${timeLabel(date)}` : "";
  if (days < 0) return `Vencido${time}`;
  if (days === 0) return `Hoy${time}`;
  if (days === 1) return `Mañana${time}`;
  return `En ${days} días${time}`;
}

function relativeTime(date: Date, now: Date) {
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 2) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.round(hours / 24)} d`;
}

function timeLabel(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}
