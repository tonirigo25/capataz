import type { getClientCrmSummary } from "@/lib/client-crm";
import { isBillableInvoiceStatus } from "@/lib/business-metrics";
import { safeDocumentUrl } from "@/lib/documents";
import { deriveInvoiceStatus, statusLabel } from "@/lib/status";
import { calculateWorkFinancials } from "@/lib/works";
import {
  Client360ActivityOverview,
  type ClientActivityEvent,
  type ClientActivityKind,
} from "@/components/portal/modules-a/client-360-activity-overview";
import { Client360BudgetsOverview } from "@/components/portal/modules-a/client-360-budgets-overview";
import { Client360DocumentsOverview, type ClientDocumentFileKind } from "@/components/portal/modules-a/client-360-documents-overview";
import { Client360InvoicesOverview } from "@/components/portal/modules-a/client-360-invoices-overview";
import { Client360FilesOverview, type ClientFileKind } from "@/components/portal/modules-a/client-360-files-overview";
import { Client360OpportunitiesOverview } from "@/components/portal/modules-a/client-360-opportunities-overview";
import {
  Client360ConversationsOverview,
  type ClientConversationRecord,
} from "@/components/portal/modules-a/client-360-conversations-overview";
import { Client360WorksOverview, type ClientWorksMode } from "@/components/portal/modules-a/client-360-works-overview";

type Summary = NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>;

type WorkspaceProps = {
  summary: Summary;
  returnTo: string;
  canUpload?: boolean;
  companyId?: string;
  searchQuery?: string;
  worksMode?: ClientWorksMode;
  opportunityMode?: "lista" | "tablero";
};

const opportunityStages = [
  { id: "preparacion", label: "Preparación", tone: "neutral" as const },
  { id: "enviada", label: "Enviada", tone: "info" as const },
  { id: "seguimiento", label: "Seguimiento", tone: "warning" as const },
  { id: "ganada", label: "Ganada", tone: "success" as const },
  { id: "rechazada", label: "Rechazada", tone: "danger" as const },
  { id: "caducada", label: "Caducada", tone: "danger" as const },
] as const;

const opportunityStageByBudgetStatus: Record<string, (typeof opportunityStages)[number]["id"]> = {
  borrador: "preparacion",
  pendiente_revision: "preparacion",
  enviado: "enviada",
  visto: "seguimiento",
  pendiente_respuesta: "seguimiento",
  aceptado: "ganada",
  rechazado: "rechazada",
  caducado: "caducada",
};

function toneForStatus(value: string | null | undefined) {
  const normalized = (value ?? "").toLowerCase();
  if (["pagada", "cobrada", "aceptado", "aceptada", "completada", "finalizada"].includes(normalized)) return "success" as const;
  if (["vencida", "rechazado", "rechazada", "cancelada", "cancelado"].includes(normalized)) return "danger" as const;
  if (["pendiente", "enviado", "enviada", "en_revision", "en_progreso"].includes(normalized)) return "warning" as const;
  return "neutral" as const;
}

function toneForInvoiceStatus(value: string | null | undefined) {
  const normalized = (value ?? "").toLowerCase();
  if (["pagada", "cobrada"].includes(normalized)) return "success" as const;
  if (["vencida", "reclamada"].includes(normalized)) return "danger" as const;
  if (["pendiente", "pendiente_pago", "pendiente_emitir"].includes(normalized)) return "warning" as const;
  if (["parcialmente_pagada", "emitida", "enviada"].includes(normalized)) return "info" as const;
  return "neutral" as const;
}

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function dateInput(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function clientInvoiceStatus(status: string, total: number, pending: number, dueDate: Date) {
  const stored = status.toLowerCase();
  const financial = deriveInvoiceStatus(total, pending, dueDate);
  if (financial === "pagada" || financial === "parcialmente_pagada") return financial;
  if (financial === "vencida") return stored === "reclamada" ? "reclamada" : financial;
  if (["emitida", "enviada", "reclamada"].includes(stored)) return stored;
  return financial;
}

export function ClientWorksWorkspace({ summary, returnTo, worksMode = "lista" }: WorkspaceProps) {
  const now = Date.now();
  const works = summary.client.works;
  const active = works.filter((work) => !["finalizada", "cancelada"].includes(work.estado));
  const milestones = works.flatMap((work) =>
    work.agendaEvents.filter((event) => isMilestoneEvent(event.tipo, event.titulo) && event.fechaInicio.getTime() >= now),
  );
  const contracted = works.reduce((total, work) => total + (work.presupuestoAprobado ?? 0), 0);
  const financials = works.map((work) => calculateWorkFinancials(work));
  const marginRevenue = financials.reduce((total, item) => total + item.marginRevenueBase, 0);
  const combinedMargin = marginRevenue > 0
    ? financials.reduce((total, item) => total + item.benefit, 0) / marginRevenue * 100
    : null;

  return (
    <Client360WorksOverview
      clientId={summary.client.id}
      metrics={[
        { kind: "active", value: active.length, detail: `${works.length} obra${works.length === 1 ? "" : "s"} vinculada${works.length === 1 ? "" : "s"}` },
        { kind: "contracted", value: contracted, detail: "Presupuesto aprobado registrado" },
        { kind: "estimated_margin", value: combinedMargin, detail: combinedMargin === null ? "No calculable sin ingreso y costes" : "Calculado desde ingresos y gastos registrados" },
        { kind: "upcoming_milestones", value: milestones.length, detail: "Hitos futuros registrados" },
      ]}
      works={works.map((work) => {
        const nextMilestone = work.agendaEvents.find((event) => isMilestoneEvent(event.tipo, event.titulo) && event.fechaInicio.getTime() >= now) ?? null;
        const incidents = work.photos.filter((photo) => photo.categoria === "incidencia");
        const coverPhoto = work.photos.find((photo) => Boolean(photo.url));
        const financial = calculateWorkFinancials(work);
        return {
          id: work.id,
          title: work.titulo,
          segment: work.tipoTrabajo,
          address: work.direccion,
          imageUrl: coverPhoto?.url ?? null,
          imageAlt: coverPhoto?.titulo ?? null,
          status: statusLabel(work.estado),
          statusTone: toneForStatus(work.estado),
          progressPercent: null,
          contractedAmount: work.presupuestoAprobado,
          contractedLabel: "Presupuesto aprobado",
          estimatedMarginPercent: financial.marginRevenueBase > 0 ? financial.marginPercent : null,
          estimatedMarginAmount: financial.marginRevenueBase > 0 ? financial.benefit : null,
          endAt: iso(work.fechaFinPrevista),
          responsibleName: work.responsable,
          href: `/obras/${work.id}`,
          details: {
            nextMilestone: nextMilestone
              ? { title: nextMilestone.titulo, date: iso(nextMilestone.fechaInicio), detail: statusLabel(nextMilestone.estado), href: `/obras/${work.id}?vista=planificacion` }
              : null,
            recentProgress: work.photos
              .filter((photo) => photo.categoria !== "incidencia")
              .slice(0, 3)
              .map((photo) => ({ id: photo.id, text: photo.titulo, href: `/obras/${work.id}?vista=progreso&modo=galeria` })),
            alerts: incidents.slice(0, 3).map((photo) => ({
              title: photo.titulo,
              detail: photo.notas,
              tone: "danger" as const,
              href: `/obras/${work.id}?vista=progreso&modo=galeria`,
            })),
            recentDocuments: work.repositoryDocuments
              .filter((document) => !document.archivedAt)
              .slice(0, 3)
              .map((document) => ({ id: document.id, name: document.name, sizeLabel: document.size ? formatBytes(document.size) : null, href: safeDocumentUrl(document.url) })),
            allDocumentsHref: `/obras/${work.id}/documentos`,
          },
        };
      })}
      mode={worksMode}
      createHref={`/gestion?tipo=obra&clienteId=${summary.client.id}&returnTo=${encodeURIComponent(`${returnTo}&modo=${worksMode}`)}`}
    />
  );
}

export function ClientBudgetsWorkspace({ summary, returnTo }: WorkspaceProps) {
  const budgets = summary.client.budgets;
  return (
    <Client360BudgetsOverview
      clientId={summary.client.id}
      metrics={[
        { kind: "issued", value: budgets.length, detail: "Presupuestos registrados" },
        { kind: "total_amount", value: budgets.reduce((total, budget) => total + budget.total, 0), detail: "Importe total emitido" },
        { kind: "acceptance_rate", value: null, detail: "No se infiere sin una serie comercial suficiente" },
        { kind: "pending_approval", value: summary.pendingBudgets.length, detail: "Pendientes de decisión" },
      ]}
      budgets={budgets.map((budget) => {
        const base = {
          id: budget.id,
          number: budget.numero,
          title: budget.titulo,
          date: iso(budget.fechaCreacion),
          amount: budget.total,
          status: statusLabel(budget.estado),
          statusTone: toneForStatus(budget.estado),
          version: null,
          validUntil: iso(budget.fechaValidez),
          responsibleName: null,
          href: `/presupuestos/${budget.id}`,
        };
        return budget.work
          ? { ...base, scope: "work" as const, workId: budget.work.id, workTitle: budget.work.titulo, workDetail: budget.work.direccion }
          : { ...base, scope: "client" as const };
      })}
      createHref={`/gestion?tipo=presupuesto&clienteId=${summary.client.id}&returnTo=${encodeURIComponent(returnTo)}`}
    />
  );
}

export function ClientInvoicesWorkspace({ summary, returnTo }: WorkspaceProps) {
  const invoices = summary.client.invoices;
  const today = new Date();
  const billableInvoices = invoices.filter((invoice) => isBillableInvoiceStatus(invoice.estado));
  const pendingInvoices = billableInvoices.filter((invoice) => invoice.pendiente > 0);
  const overdue = pendingInvoices.filter((invoice) => deriveInvoiceStatus(invoice.total, invoice.pendiente, invoice.fechaVencimiento) === "vencida");
  const collectedDays = billableInvoices.flatMap((invoice) => {
    if (!invoice.payments.length || invoice.pendiente > 0) return [];
    const latestPayment = invoice.payments.reduce((latest, payment) => payment.fecha > latest ? payment.fecha : latest, invoice.payments[0].fecha);
    return [Math.max(0, Math.round((latestPayment.getTime() - invoice.fechaEmision.getTime()) / 86_400_000))];
  });
  const billedTotal = billableInvoices.reduce((total, invoice) => total + invoice.total, 0);
  const pendingTotal = pendingInvoices.reduce((total, invoice) => total + invoice.pendiente, 0);
  const overdueTotal = overdue.reduce((total, invoice) => total + invoice.pendiente, 0);
  const thirtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
  const ninetyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 89);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  return (
    <Client360InvoicesOverview
      clientId={summary.client.id}
      metrics={[
        { kind: "issued", value: billableInvoices.length, supportingAmount: billedTotal, detail: "Importe facturado", tone: "success" },
        { kind: "pending_collection", value: pendingInvoices.length, supportingAmount: pendingTotal, detail: "Saldo pendiente registrado", comparison: billedTotal > 0 ? `${(pendingTotal / billedTotal * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })}% de lo facturado` : null, tone: "warning" },
        { kind: "overdue", value: overdue.length, supportingAmount: overdueTotal, detail: "Con vencimiento superado", comparison: billedTotal > 0 ? `${(overdueTotal / billedTotal * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })}% de lo facturado` : null, tone: "danger" },
        { kind: "average_collection_days", value: collectedDays.length ? Math.round(collectedDays.reduce((total, days) => total + days, 0) / collectedDays.length) : null, detail: "Calculado sobre facturas cobradas", tone: "neutral" },
      ]}
      datePresets={[
        { id: "last-30", label: "Últimos 30 días", from: dateInput(thirtyDaysAgo), to: dateInput(today) },
        { id: "last-90", label: "Últimos 90 días", from: dateInput(ninetyDaysAgo), to: dateInput(today) },
        { id: "current-year", label: `Año ${today.getFullYear()}`, from: dateInput(yearStart), to: dateInput(today) },
      ]}
      invoices={invoices.map((invoice) => {
        const detailHref = `/facturas-cliente/${invoice.id}?returnTo=${encodeURIComponent(returnTo)}`;
        const liveStatus = isBillableInvoiceStatus(invoice.estado)
          ? clientInvoiceStatus(invoice.estado, invoice.total, invoice.pendiente, invoice.fechaVencimiento)
          : invoice.estado;
        const base = {
          id: invoice.id,
          number: invoice.numero,
          concept: invoice.concepto,
          issuedAt: iso(invoice.fechaEmision),
          dueAt: iso(invoice.fechaVencimiento),
          amount: invoice.total,
          collectedAmount: invoice.pagado,
          pendingAmount: invoice.pendiente,
          status: statusLabel(liveStatus),
          statusTone: toneForInvoiceStatus(liveStatus),
          paymentMethod: invoice.metodoPago,
          href: detailHref,
          moreHref: detailHref,
        };
        return invoice.work
          ? { ...base, scope: "work" as const, workId: invoice.work.id, workTitle: invoice.work.titulo }
          : { ...base, scope: "client" as const };
      })}
      createHref={`/gestion?tipo=factura&clienteId=${summary.client.id}&returnTo=${encodeURIComponent(returnTo)}`}
    />
  );
}

export function ClientActivityWorkspace({ summary }: WorkspaceProps) {
  const events: ClientActivityEvent[] = summary.activity.map((event) => {
    const scope = activityScope(event.id);
    return {
      id: event.id,
      kind: activityKind(event.type),
      typeLabel: event.type,
      title: event.text,
      occurredAt: event.date.toISOString(),
      scope: { clientId: summary.client.id, entityType: scope.entityType, entityId: scope.entityId, authorized: true },
      href: event.href ? { href: event.href, authorized: true } : null,
    };
  });
  return (
    <Client360ActivityOverview
      clientId={summary.client.id}
      events={events}
      metrics={[
        { kind: "interactions", value: events.length, detail: "Eventos trazables" },
        { kind: "pending_tasks", value: null, detail: "Sin inferir tareas desde actividad" },
        { kind: "sent_budgets", value: summary.client.budgets.filter((budget) => budget.fechaEnvio).length, detail: "Con fecha de envío" },
        { kind: "collected_invoices", value: summary.client.invoices.filter((invoice) => invoice.pagado > 0 && invoice.pendiente <= 0).length, detail: "Cobradas completamente" },
      ]}
    />
  );
}

export function ClientConversationsWorkspace({
  clientId,
  conversations,
  selectedConversationId,
  newMessageHref,
  scheduleCallHref,
  createNoteHref,
}: {
  clientId: string;
  conversations: ClientConversationRecord[];
  selectedConversationId?: string | null;
  newMessageHref?: string | null;
  scheduleCallHref?: string | null;
  createNoteHref?: string | null;
}) {
  const responseDurations: number[] = [];
  for (const conversation of conversations) {
    let pendingUserMessageAt: number | null = null;
    for (const message of conversation.messages) {
      const timestamp = message.sentAt ? Date.parse(message.sentAt) : Number.NaN;
      if (!Number.isFinite(timestamp)) continue;
      if (message.direction === "outbound") pendingUserMessageAt = timestamp;
      if (message.direction === "inbound" && pendingUserMessageAt != null) {
        responseDurations.push(Math.max(0, timestamp - pendingUserMessageAt));
        pendingUserMessageAt = null;
      }
    }
  }
  const averageResponseMs = responseDurations.length
    ? responseDurations.reduce((total, value) => total + value, 0) / responseDurations.length
    : null;
  const latestInteraction = conversations
    .map((conversation) => conversation.lastMessageAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
  const unanswered = conversations.filter(
    (conversation) => conversation.messages.at(-1)?.direction === "outbound",
  ).length;
  return (
    <Client360ConversationsOverview
      clientId={clientId}
      conversations={conversations}
      selectedConversationId={selectedConversationId}
      metrics={[
        { kind: "active", authorized: true, value: conversations.length, detail: "Hilos vinculados de forma explícita" },
        { kind: "unanswered", authorized: true, value: unanswered, detail: "Último mensaje del usuario sin respuesta posterior" },
        { kind: "average_response", authorized: true, value: formatResponseDuration(averageResponseMs), detail: "Entre mensaje de usuario y respuesta" },
        { kind: "latest_interaction", authorized: true, value: latestInteraction ? new Date(latestInteraction).toLocaleDateString("es-ES") : null, detail: "Último mensaje vinculado" },
      ]}
      newMessageHref={newMessageHref ? { href: newMessageHref, authorized: true } : null}
      scheduleCallHref={scheduleCallHref ? { href: scheduleCallHref, authorized: true } : null}
      createNoteHref={createNoteHref ? { href: createNoteHref, authorized: true } : null}
    />
  );
}

function formatResponseDuration(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  const minutes = Math.max(0, Math.round(value / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${hours.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h`;
}

export function ClientDocumentsWorkspace({ summary, canUpload = false }: WorkspaceProps) {
  const documents = summary.documents.filter((document) => document.scope !== "unscoped");
  return (
    <Client360DocumentsOverview
      clientId={summary.client.id}
      metrics={[
        { kind: "active", value: documents.length, detail: "Documentos autorizados" },
        { kind: "contracts", value: documents.filter((document) => document.type === "Contrato").length },
        { kind: "budgets", value: documents.filter((document) => document.type === "Presupuesto").length },
        { kind: "invoices", value: documents.filter((document) => document.type === "Factura").length },
        { kind: "pending_signatures", value: null, detail: "Sin estado de firma persistido" },
      ]}
      folders={[]}
      documents={documents.map((document) => {
        const base = {
          id: document.id,
          name: document.name,
          fileKind: fileKind(document.mimeType),
          sizeBytes: document.sizeBytes,
          category: document.type,
          createdAt: document.date.toISOString(),
          sourceLabel: document.source,
          viewHref: safeDocumentUrl(document.href),
        };
        return document.scope === "work"
          ? { ...base, scope: "work" as const, workId: document.workId!, workTitle: document.workTitle }
          : { ...base, scope: "client" as const };
      })}
      uploadHref={canUpload ? `/gestion?tipo=documento&clientId=${summary.client.id}&returnTo=${encodeURIComponent(`/clientes/${summary.client.id}?vista=documentos`)}` : null}
    />
  );
}

export function ClientFilesWorkspace({ summary, canUpload = false, companyId, searchQuery = "" }: WorkspaceProps) {
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("es");
  const files = summary.documents.filter((document) =>
    document.scope !== "unscoped" &&
    document.source === "Archivo asociado" &&
    (!normalizedQuery || `${document.name} ${document.type} ${document.relatedLabel}`.toLocaleLowerCase("es").includes(normalizedQuery)),
  );
  const scopeVerified = Boolean(companyId && summary.client.id);
  return (
    <Client360FilesOverview
      scope={{ companyId: companyId ?? null, clientId: summary.client.id, tenantScopeVerified: scopeVerified, clientScopeVerified: scopeVerified }}
      categories={[]}
      folders={[]}
      files={files.map((file) => ({
        companyId: companyId!,
        clientId: summary.client.id,
        id: file.id,
        name: file.name,
        kind: clientFileKind(file.mimeType),
        typeLabel: file.type,
        versionLabel: null,
        dateLabel: file.date.toLocaleDateString("es-ES"),
        sizeBytes: file.sizeBytes ?? null,
        tags: [],
        openAction: { label: "Abrir", href: safeDocumentUrl(file.href), allowed: Boolean(safeDocumentUrl(file.href)) },
      }))}
      storage={null}
      detail={null}
      pagination={null}
      search={{ allowed: true, actionHref: `/clientes/${summary.client.id}`, value: searchQuery, hiddenFields: [{ name: "vista", value: "archivos" }] }}
      uploadAction={canUpload ? { label: "Subir archivo", href: `/gestion?tipo=documento&clientId=${summary.client.id}&returnTo=${encodeURIComponent(`/clientes/${summary.client.id}?vista=archivos`)}`, allowed: true } : null}
      newFolderAction={null}
    />
  );
}

export function ClientOpportunitiesWorkspace({ summary, returnTo, opportunityMode = "lista" }: WorkspaceProps) {
  const budgets = summary.client.budgets;
  const canonicalReturnTo = `${returnTo}&modo=${opportunityMode}`;
  const createHref = `/gestion?tipo=presupuesto&clienteId=${summary.client.id}&returnTo=${encodeURIComponent(canonicalReturnTo)}`;
  const stageRecords = opportunityStages.map((stage) => {
    const stageBudgets = budgets.filter((budget) => opportunityStageByBudgetStatus[budget.estado] === stage.id);
    return {
      id: stage.id,
      clientId: summary.client.id,
      label: stage.label,
      count: stageBudgets.length,
      totalAmount: stageBudgets.reduce((total, budget) => total + budget.total, 0),
      tone: stage.tone,
      opportunities: stageBudgets.map((budget) => ({
        id: budget.id,
        clientId: summary.client.id,
        title: budget.titulo,
        amount: budget.total,
        probabilityPercent: null,
        nextStep: budget.fechaSeguimiento ? `Seguimiento registrado para ${budget.fechaSeguimiento.toLocaleDateString("es-ES")}` : null,
        dateLabel: budget.fechaValidez ? `Válido hasta ${budget.fechaValidez.toLocaleDateString("es-ES")}` : null,
        statusLabel: statusLabel(budget.estado),
        statusTone: toneForStatus(budget.estado),
        openAction: { label: "Abrir presupuesto", href: `/presupuestos/${budget.id}`, allowed: true },
      })),
      addAction: { label: "Nuevo presupuesto", href: createHref, allowed: true },
    };
  });
  const terminalWonCount = budgets.filter((budget) => budget.estado === "aceptado").length;
  return (
    <Client360OpportunitiesOverview
      scope={{ clientId: summary.client.id, clientName: summary.listItem.displayName, verifiedClientScope: true }}
      summary={{
        clientId: summary.client.id,
        totalCount: { value: budgets.length },
        totalValue: { value: budgets.reduce((total, budget) => total + budget.total, 0) },
        weightedValue: { value: null, detail: "Sin probabilidad comercial persistida" },
        averageProbabilityPercent: { value: null, detail: "No se infiere" },
        wonCount: { value: terminalWonCount, detail: "Presupuestos aceptados" },
      }}
      stages={stageRecords}
      currency="EUR"
      actions={{ create: { label: "Nuevo presupuesto", href: createHref, allowed: true } }}
      views={{
        active: opportunityMode === "tablero" ? "board" : "list",
        board: { label: "Tablero", href: `/clientes/${summary.client.id}?vista=oportunidades&modo=tablero`, allowed: true },
        list: { label: "Lista", href: `/clientes/${summary.client.id}?vista=oportunidades&modo=lista`, allowed: true },
      }}
    />
  );
}

function fileKind(mime: string | null | undefined): ClientDocumentFileKind {
  if (!mime) return "other";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "spreadsheet";
  if (mime.includes("word") || mime.includes("document")) return "word";
  return "other";
}

function clientFileKind(mime: string | null | undefined): ClientFileKind {
  if (!mime) return "other";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "spreadsheet";
  if (mime.includes("word") || mime.includes("document")) return "word";
  if (mime.includes("message") || mime.includes("email")) return "email";
  return "other";
}

function activityKind(value: string): ClientActivityKind {
  const normalized = value.toLowerCase();
  if (normalized.includes("presupuesto")) return "budget";
  if (normalized.includes("factura")) return "invoice";
  if (normalized.includes("pago") || normalized.includes("cobro")) return "payment";
  if (normalized.includes("document")) return "document";
  if (normalized.includes("recordatorio") || normalized.includes("tarea")) return "task";
  if (normalized.includes("agenda") || normalized.includes("visita") || normalized.includes("reunión")) return "meeting";
  if (normalized.includes("nota")) return "comment";
  return "other";
}

function activityScope(id: string) {
  const separators = ["budget-sent-", "budget-", "invoice-overdue-", "invoice-", "payment-", "agenda-", "reminder-", "expense-", "note-", "document-"];
  const prefix = separators.find((candidate) => id.startsWith(candidate));
  return { entityType: prefix?.replace(/-$/, "") ?? "activity", entityId: prefix ? id.slice(prefix.length) : id };
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isMilestoneEvent(type: string, title: string) {
  return type === "fin_previsto_obra" || (type === "tarea_obra" && /(?:^|\s)(?:hito|milestone)(?:\s|:|$)/i.test(title));
}
