import type { CompanyContext } from "@/lib/auth/session";
import type { Prisma } from "@prisma/client";
import { getAgendaItems, type AgendaItem } from "@/lib/agenda";
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
  tone: "green" | "blue" | "orange" | "purple" | "slate";
};

export type TodayActivityRow = {
  id: string;
  title: string;
  detail: string;
  time: string;
  href: string;
  kind: "budget" | "invoice" | "agenda" | "document" | "client" | "generic";
};

export type TodayWorkRow = {
  id: string;
  title: string;
  status: string;
  progress: number | null;
  progressLabel: string;
  href: string;
};

export type TodayMoneyRow = {
  id: string;
  reference: string;
  label: string;
  context: string;
  amount: number;
  due: string;
  dueAt: Date | null;
  dueDay: string;
  dueMonth: string;
  tone: "urgent" | "soon" | "neutral";
  href: string;
};

export type TodayOverview = {
  priorities: TodayPriority[];
  totalPriorities: number;
  agenda: TodayAgendaRow[];
  activity: TodayActivityRow[];
  works: TodayWorkRow[];
  collections: TodayMoneyRow[];
  payments: TodayMoneyRow[];
  access: {
    budget: boolean;
    invoice: boolean;
    agenda: boolean;
    document: boolean;
    followup: boolean;
    work: boolean;
    activity: boolean;
    payments: boolean;
    recommendations: boolean;
  };
  summary: {
    updatedAt: string;
    urgentPriorities: number;
    visits: number;
    completedVisits: number;
    pendingDocuments: number;
    documentsToConfirm: number;
    followups: number;
    followupsDueToday: number;
  };
};

export async function getTodayOverview(context: CompanyContext, now = new Date()): Promise<TodayOverview> {
  const companyId = context.companyId;
  const companyPreferences = await prisma.company.findUnique({
    where: { id: companyId },
    select: { timezone: true, locale: true },
  });
  const timeZone = companyPreferences?.timezone || "Europe/Madrid";
  const locale = companyPreferences?.locale || "es-ES";
  const dayStart = zonedMidnight(now, timeZone, 0);
  const dayEnd = zonedMidnight(now, timeZone, 1);
  const urgentEnd = zonedMidnight(now, timeZone, 2);
  const soon = zonedMidnight(now, timeZone, 7);
  const followupSummaryEnd = zonedMidnight(now, timeZone, 14);
  const [
    budgetAccess,
    invoiceAccess,
    agendaAccess,
    documentAccess,
    followupAccess,
    workAccess,
    reportsAccess,
    purchaseAccess,
    recommendationAccess,
  ] = await Promise.all([
    resolveAuthorization(context, "sales.budgets.view"),
    resolveAuthorization(context, "sales.invoices.view"),
    resolveAuthorization(context, "agenda.view"),
    resolveAuthorization(context, "documents.view"),
    resolveAuthorization(context, "followups.view"),
    resolveAuthorization(context, "work.view"),
    resolveAuthorization(context, "reports.view"),
    resolveAuthorization(context, "purchase_cost.view"),
    resolveAuthorization(context, "orqena.use"),
  ]);

  const [budgetScopes, invoiceScopes, documentIds, followupScopes, workIds, purchaseScopes] = await Promise.all([
    budgetAccess.allowed ? relationScopes(context, "sales.budgets.view") : Promise.resolve(emptyRelationScopes()),
    invoiceAccess.allowed ? relationScopes(context, "sales.invoices.view") : Promise.resolve(emptyRelationScopes()),
    documentAccess.allowed ? resolveScopedEntityIds(context, "documents.view", "Document") : Promise.resolve([]),
    followupAccess.allowed ? relationScopes(context, "followups.view") : Promise.resolve(emptyRelationScopes()),
    workAccess.allowed ? resolveScopedEntityIds(context, "work.view", "Work") : Promise.resolve([]),
    purchaseAccess.allowed ? relationScopes(context, "purchase_cost.view") : Promise.resolve(emptyRelationScopes()),
  ]);

  const budgetWhere: Prisma.BudgetWhereInput = {
    companyId,
    estado: "pendiente_revision",
    ...relationWhere(budgetScopes),
  };
  const invoiceWhere: Prisma.InvoiceWhereInput = {
    companyId,
    pendiente: { gt: 0 },
    estado: { notIn: ["borrador", "pagada"] },
    fechaVencimiento: { lte: soon },
    ...relationWhere(invoiceScopes),
  };
  const documentWhere: Prisma.DocumentWhereInput = {
    companyId,
    archivedAt: null,
    status: { in: ["REVIEW_REQUIRED", "PROCESSING", "UPLOADED"] },
    ...(documentIds === null ? {} : { id: { in: documentIds } }),
  };
  const followupWhere: Prisma.FollowUpWhereInput = {
    companyId,
    archivedAt: null,
    status: { in: ["planned", "due", "in_progress", "waiting_response", "promised"] },
    AND: [
      { OR: [{ dueAt: { lte: soon } }, { nextActionAt: { lte: soon } }] },
      relationWhere(followupScopes),
    ],
  };
  const expenseWhere: Prisma.ExpenseWhereInput = {
    companyId,
    paymentStatus: "pending",
    paymentDueDate: { lte: soon },
    ...relationWhere(purchaseScopes),
  };

  const [agendaItems, budgets, invoices, documents, followups, works, activity, expenses] = await Promise.all([
    agendaAccess.allowed ? getAgendaItems() : Promise.resolve([]),
    budgetAccess.allowed
      ? prisma.budget.findMany({
          where: budgetWhere,
          include: {
            client: { select: { nombre: true } },
            work: { select: { titulo: true, responsable: true, comercial: true } },
          },
          orderBy: [{ fechaSeguimiento: "asc" }, { fechaValidez: "asc" }, { fechaCreacion: "asc" }],
          take: 8,
        })
      : Promise.resolve([]),
    invoiceAccess.allowed
      ? prisma.invoice.findMany({
          where: invoiceWhere,
          include: {
            client: { select: { nombre: true } },
            work: { select: { titulo: true, responsable: true, comercial: true } },
          },
          orderBy: { fechaVencimiento: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    documentAccess.allowed
      ? prisma.document.findMany({
          where: documentWhere,
          include: {
            client: { select: { nombre: true } },
            uploadedBy: { select: { displayName: true } },
          },
          orderBy: { updatedAt: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    followupAccess.allowed
      ? prisma.followUp.findMany({
          where: followupWhere,
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
          where: expenseWhere,
          include: { work: { select: { titulo: true } } },
          orderBy: { paymentDueDate: "asc" },
          take: 4,
        })
      : Promise.resolve([]),
  ]);

  const allTodayAgenda = agendaItems.filter(
    (item) => item.estado !== "cancelado" && item.fechaInicio >= dayStart && item.fechaInicio < dayEnd,
  );
  const agendaWorkIds = [...new Set(allTodayAgenda.flatMap((item) => item.obraId ? [item.obraId] : []))];
  const responsibleIds = [...new Set(followups.flatMap((item) => item.responsibleId ? [item.responsibleId] : []))];
  const [
    workTasks,
    responsibleUsers,
    responsibleMemberships,
    agendaWorks,
    budgetCount,
    invoiceCount,
    documentCount,
    followupCount,
    urgentInvoiceCount,
    pendingDocumentCount,
    followupsDueToday,
    summaryFollowupCount,
  ] = await Promise.all([
    works.length
      ? prisma.task.findMany({
          where: { companyId, workId: { in: works.map((work) => work.id) }, archivedAt: null },
          select: { workId: true, status: true },
        })
      : Promise.resolve([]),
    responsibleIds.length
      ? prisma.user.findMany({ where: { id: { in: responsibleIds } }, select: { id: true, displayName: true } })
      : Promise.resolve([]),
    responsibleIds.length
      ? prisma.companyMembership.findMany({
          where: { companyId, OR: [{ id: { in: responsibleIds } }, { userId: { in: responsibleIds } }] },
          select: { id: true, userId: true, user: { select: { displayName: true } } },
        })
      : Promise.resolve([]),
    agendaWorkIds.length
      ? prisma.work.findMany({
          where: { companyId, id: { in: agendaWorkIds } },
          select: { id: true, numeroInterno: true, codigo: true, titulo: true, responsable: true, comercial: true, jefeObra: true },
        })
      : Promise.resolve([]),
    budgetAccess.allowed ? prisma.budget.count({ where: budgetWhere }) : Promise.resolve(0),
    invoiceAccess.allowed ? prisma.invoice.count({ where: invoiceWhere }) : Promise.resolve(0),
    documentAccess.allowed ? prisma.document.count({ where: documentWhere }) : Promise.resolve(0),
    followupAccess.allowed ? prisma.followUp.count({ where: followupWhere }) : Promise.resolve(0),
    invoiceAccess.allowed
      ? prisma.invoice.count({ where: { ...invoiceWhere, fechaVencimiento: { lt: urgentEnd } } })
      : Promise.resolve(0),
    documentAccess.allowed
      ? prisma.document.count({ where: { ...documentWhere, status: "REVIEW_REQUIRED" } })
      : Promise.resolve(0),
    followupAccess.allowed
      ? prisma.followUp.count({
          where: {
            companyId,
            archivedAt: null,
            status: { in: ["planned", "due", "in_progress", "waiting_response", "promised"] },
            AND: [
              { OR: [{ dueAt: { gte: dayStart, lt: dayEnd } }, { nextActionAt: { gte: dayStart, lt: dayEnd } }] },
              relationWhere(followupScopes),
            ],
          },
        })
      : Promise.resolve(0),
    followupAccess.allowed
      ? prisma.followUp.count({
          where: {
            companyId,
            archivedAt: null,
            status: { in: ["planned", "due", "in_progress", "waiting_response", "promised"] },
            AND: [
              { OR: [{ dueAt: { lte: followupSummaryEnd } }, { nextActionAt: { lte: followupSummaryEnd } }] },
              relationWhere(followupScopes),
            ],
          },
        })
      : Promise.resolve(0),
  ]);
  const tasksByWork = new Map<string, Array<{ status: string }>>();
  for (const task of workTasks) {
    if (!task.workId) continue;
    const rows = tasksByWork.get(task.workId) ?? [];
    rows.push(task);
    tasksByWork.set(task.workId, rows);
  }

  const todayAgenda = allTodayAgenda.slice(0, 5);
  const activeAgendaPriorityCount = allTodayAgenda.filter((item) => item.estado !== "realizado").length;
  const responsibleNames = new Map(responsibleUsers.map((user) => [user.id, user.displayName]));
  for (const membership of responsibleMemberships) {
    responsibleNames.set(membership.id, membership.user.displayName);
    responsibleNames.set(membership.userId, membership.user.displayName);
  }
  const agendaOwners = new Map(
    agendaWorks.map((work) => [work.id, work.responsable ?? work.jefeObra ?? work.comercial ?? context.displayName]),
  );
  const agendaWorkLabels = new Map(
    agendaWorks.map((work) => [work.id, [work.numeroInterno ?? work.codigo, work.titulo].filter(Boolean).join(" · ")]),
  );
  const priorities: TodayPriority[] = [];
  const budget = budgets[0];
  if (budget) priorities.push({
    id: `budget-${budget.id}`,
    kind: "budget",
    title: "Presupuesto pendiente de revisión",
    status: "Revisión",
    tone: "review",
    source: `${budget.numero} · ${budget.client.nombre}`,
    due: dueLabel(budget.fechaSeguimiento ?? budget.fechaValidez, now, timeZone, locale),
    owner: budget.work?.comercial ?? budget.work?.responsable ?? context.displayName,
    href: `/presupuestos/${budget.id}`,
    action: "Revisar",
  });
  const invoice = invoices[0];
  if (invoice) priorities.push({
    id: `invoice-${invoice.id}`,
    kind: "invoice",
    title: "Factura próxima a vencer",
    status: "Urgente",
    tone: "urgent",
    source: `${invoice.numero} · ${invoice.client.nombre}`,
    due: dueLabel(invoice.fechaVencimiento, now, timeZone, locale),
    owner: invoice.work?.responsable ?? invoice.work?.comercial ?? context.displayName,
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
    source: (visit.obraId ? agendaWorkLabels.get(visit.obraId) : null) ?? visit.obraTitulo ?? visit.clienteNombre ?? visit.titulo,
    due: dueLabel(visit.fechaInicio, now, timeZone, locale),
    owner: (visit.obraId ? agendaOwners.get(visit.obraId) : null) ?? context.displayName,
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
    source: `${documentCategoryLabel(document.category)} · ${document.client?.nombre ?? document.name}`,
    due: documentDueLabel(document.metadata, now, timeZone, locale),
    owner: document.uploadedBy?.displayName ?? context.displayName,
    href: documentHref(document),
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
    due: dueLabel(followup.dueAt ?? followup.nextActionAt, now, timeZone, locale),
    owner: (followup.responsibleId ? responsibleNames.get(followup.responsibleId) : null) ?? context.displayName,
    href: `/seguimientos/${followup.id}`,
    action: "Contactar",
  });

  const orderedPriorities = priorities.slice(0, 5);
  return {
    priorities: orderedPriorities,
    totalPriorities: budgetCount + invoiceCount + activeAgendaPriorityCount + documentCount + followupCount,
    agenda: todayAgenda.map((item, index) => ({
      id: `${item.source}-${item.id}`,
      time: timeLabel(item.fechaInicio, timeZone, locale),
      title: item.titulo,
      context: agendaContext(item),
      href: item.href,
      tone: agendaTone(item.tipo, index),
    })),
    activity: activity.map((item) => ({
      id: item.id,
      title: activityTitle(item.action, item.userActor?.displayName ?? "Equipo", item.metadata),
      detail: activityDetail(item.targetType, item.metadata),
      time: relativeTime(item.createdAt, now),
      href: auditTargetHref(item.targetType, item.targetId),
      kind: activityKind(item.targetType),
    })),
    works: works.map((work) => ({
      id: work.id,
      title: [work.numeroInterno ?? work.codigo, work.titulo].filter(Boolean).join(" · "),
      status: workStatusLabel(work.estado),
      progress: taskProgress(tasksByWork.get(work.id) ?? []),
      progressLabel: workProgressLabel(work.estado),
      href: `/obras/${work.id}`,
    })),
    collections: invoices.slice(0, 2).map((item) => ({
      id: item.id,
      reference: `${item.numero} · ${item.client.nombre}`,
      label: item.client.nombre,
      context: item.work?.titulo ?? item.concepto,
      amount: item.pendiente,
      due: dueLabel(item.fechaVencimiento, now, timeZone, locale),
      dueAt: item.fechaVencimiento,
      ...dateTileParts(item.fechaVencimiento, timeZone, locale),
      tone: dueTone(item.fechaVencimiento, now, timeZone),
      href: `/dinero/${item.id}`,
    })),
    payments: expenses.slice(0, 2).map((item) => ({
      id: item.id,
      reference: item.proveedor,
      label: item.proveedor,
      context: item.work?.titulo ?? item.concepto,
      amount: -Math.abs(item.importe),
      due: dueLabel(item.paymentDueDate, now, timeZone, locale),
      dueAt: item.paymentDueDate,
      ...dateTileParts(item.paymentDueDate, timeZone, locale),
      tone: dueTone(item.paymentDueDate, now, timeZone),
      href: `/gastos-materiales?buscar=${encodeURIComponent(item.proveedor)}`,
    })),
    access: {
      budget: budgetAccess.allowed,
      invoice: invoiceAccess.allowed,
      agenda: agendaAccess.allowed,
      document: documentAccess.allowed,
      followup: followupAccess.allowed,
      work: workAccess.allowed,
      activity: reportsAccess.allowed && reportsAccess.scope === "COMPANY",
      payments: purchaseAccess.allowed,
      recommendations: recommendationAccess.allowed,
    },
    summary: {
      updatedAt: timeLabel(now, timeZone, locale),
      urgentPriorities: urgentInvoiceCount + pendingDocumentCount,
      visits: allTodayAgenda.filter((item) => item.tipo === "visita").length,
      completedVisits: allTodayAgenda.filter((item) => item.tipo === "visita" && item.estado === "realizado").length,
      pendingDocuments: documentCount,
      documentsToConfirm: pendingDocumentCount,
      followups: summaryFollowupCount,
      followupsDueToday,
    },
  };
}

async function relationScopes(context: CompanyContext, capability: "sales.budgets.view" | "sales.invoices.view" | "followups.view" | "purchase_cost.view") {
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

function activityTitle(action: string, actor: string, metadata: Prisma.JsonValue) {
  const values = jsonRecord(metadata);
  if (typeof values.headline === "string" && values.headline.trim()) return values.headline.trim();
  const normalized = action.toLocaleLowerCase("es-ES");
  const verb = normalized.includes("paid") || normalized.includes("pagad")
    ? "ha marcado un pago"
    : normalized.includes("complete") || normalized.includes("complet")
      ? "ha completado una acción"
      : normalized.includes("create") || normalized.includes("cread")
        ? "ha creado un registro"
        : normalized.includes("upload") || normalized.includes("subid")
          ? "ha subido un documento"
          : normalized.includes("update") || normalized.includes("actualiz")
            ? "ha actualizado un registro"
            : "ha registrado actividad";
  return `${actor} ${verb}`;
}

function activityDetail(targetType: string, metadata: Prisma.JsonValue) {
  const values = jsonRecord(metadata);
  if (typeof values.detail === "string") return values.detail.trim();
  const label = ["entityLabel", "targetLabel", "reference", "title", "name"]
    .map((key) => values[key])
    .find((value): value is string => typeof value === "string" && Boolean(value.trim()));
  return label?.trim() ?? humanizeIdentifier(targetType);
}

function activityKind(targetType: string): TodayActivityRow["kind"] {
  if (/budget|presupuesto/i.test(targetType)) return "budget";
  if (/invoice|factura|payment|pago/i.test(targetType)) return "invoice";
  if (/agenda|event|visita/i.test(targetType)) return "agenda";
  if (/document/i.test(targetType)) return "document";
  if (/client|lead|cliente/i.test(targetType)) return "client";
  return "generic";
}

function agendaTone(type: string, index: number): TodayAgendaRow["tone"] {
  if (type === "visita") return "blue";
  if (type === "seguimiento") return "purple";
  if (type === "recordatorio") return "orange";
  return (["green", "blue", "orange", "purple", "slate"] as const)[index % 5];
}

function agendaContext(item: AgendaItem) {
  const values = item.obraTitulo
    ? [item.obraTitulo, item.direccion ?? item.clienteNombre]
    : item.presupuestoNumero
      ? [item.clienteNombre, item.presupuestoNumero]
      : item.titulo.toLocaleLowerCase("es-ES").includes("documento")
        ? [item.descripcion, item.clienteNombre]
        : [item.clienteNombre, item.descripcion, item.direccion];
  const normalized = values.filter((value): value is string => Boolean(value?.trim()));
  return [...new Set(normalized)].slice(0, 2).join(" · ") || "Agenda interna";
}

function dueTone(date: Date | null | undefined, now: Date, timeZone: string): TodayMoneyRow["tone"] {
  if (!date) return "neutral";
  const difference = calendarDayNumber(date, timeZone) - calendarDayNumber(now, timeZone);
  if (difference <= 1) return "urgent";
  if (difference <= 5) return "soon";
  return "neutral";
}

function auditTargetHref(targetType: string, targetId: string | null) {
  if (!targetId) return "/auditoria";
  if (/client/i.test(targetType)) return `/clientes/${targetId}`;
  if (/work|obra/i.test(targetType)) return `/obras/${targetId}`;
  if (/budget|presupuesto/i.test(targetType)) return `/presupuestos/${targetId}`;
  if (/invoice|factura/i.test(targetType)) return `/dinero/${targetId}`;
  if (/document/i.test(targetType)) return "/documentos";
  return "/auditoria";
}

function documentHref(document: { id: string; metadata: Prisma.JsonValue }) {
  if (isExpenseReaderDocument(document.metadata)) return `/gastos-materiales/lector/${document.id}`;
  return "/documentos";
}

function isExpenseReaderDocument(metadata: Prisma.JsonValue) {
  return Boolean(
    metadata
      && typeof metadata === "object"
      && !Array.isArray(metadata)
      && metadata.source === "expense_document_reader",
  );
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

function workProgressLabel(status: string) {
  if (status === "planificada") return "Planificación";
  if (["parcialmente_terminada", "pendiente_remates"].includes(status)) return "Cierre";
  if (["pausada", "parada", "pendiente_material", "pendiente_cliente"].includes(status)) return "En pausa";
  return "Ejecución";
}

function documentCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    contrato: "Contrato",
    factura: "Factura",
    albaran: "Albarán",
    presupuesto: "Presupuesto",
    foto: "Fotografía",
    otro: "Documento",
  };
  return labels[category] ?? humanizeIdentifier(category);
}

function documentDueLabel(metadata: Prisma.JsonValue, now: Date, timeZone: string, locale: string) {
  const values = jsonRecord(metadata);
  for (const key of ["reviewDueAt", "dueAt", "expiresAt"]) {
    const raw = values[key];
    if (typeof raw !== "string") continue;
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return dueLabel(date, now, timeZone, locale);
  }
  return "Revisión pendiente";
}

function jsonRecord(value: Prisma.JsonValue) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : {};
}

function humanizeIdentifier(value: string) {
  const normalized = value.replaceAll("_", " ").replaceAll(".", " ").trim();
  return normalized ? normalized.charAt(0).toLocaleUpperCase("es-ES") + normalized.slice(1) : "Registro";
}

function dueLabel(date: Date | null | undefined, now: Date, timeZone: string, locale: string) {
  if (!date) return "Sin fecha";
  const days = calendarDayNumber(date, timeZone) - calendarDayNumber(now, timeZone);
  const parts = zonedParts(date, timeZone);
  const time = parts.hour || parts.minute ? `, ${timeLabel(date, timeZone, locale)}` : "";
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

function timeLabel(date: Date, timeZone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(date);
}

function dateTileParts(date: Date | null, timeZone: string, locale: string) {
  if (!date) return { dueDay: "—", dueMonth: "—" };
  const parts = zonedParts(date, timeZone);
  return {
    dueDay: String(parts.day),
    dueMonth: new Intl.DateTimeFormat(locale, { month: "short", timeZone }).format(date).replace(".", "").toLocaleUpperCase(locale),
  };
}

function calendarDayNumber(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000);
}

function zonedMidnight(date: Date, timeZone: string, days: number) {
  const parts = zonedParts(date, timeZone);
  const target = Date.UTC(parts.year, parts.month - 1, parts.day + days, 0, 0, 0);
  let instant = target;
  for (let index = 0; index < 3; index += 1) {
    const next = target - zonedOffsetMillis(new Date(instant), timeZone);
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant);
}

function zonedOffsetMillis(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone, true);
  const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return representedAsUtc - Math.floor(date.getTime() / 1_000) * 1_000;
}

function zonedParts(date: Date, timeZone: string, includeSeconds = false) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" as const } : {}),
    hourCycle: "h23",
  }).formatToParts(date);
  const record = Object.fromEntries(values.map((part) => [part.type, part.value]));
  return {
    year: Number(record.year),
    month: Number(record.month),
    day: Number(record.day),
    hour: Number(record.hour),
    minute: Number(record.minute),
    second: Number(record.second ?? 0),
  };
}
