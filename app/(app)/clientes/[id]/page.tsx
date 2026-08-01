import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import {
  Archive,
  Bell,
  Bot,
  CalendarClock,
  ClipboardList,
  FileText,
  FolderOpen,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Receipt,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { archiveClient, restoreClient } from "@/app/(app)/clientes/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SectionHeader } from "@/components/section-header";
import { StatusPill } from "@/components/status-pill";
import {
  EmptyState,
} from "@/components/ui-primitives";
import { getClientCrmSummary } from "@/lib/client-crm";
import { Client360Canonical } from "@/components/portal/modules-a/client-360-canonical";
import { Client360Restricted } from "@/components/portal/modules-a/client-360-restricted";
import {
  ClientActivityWorkspace,
  ClientBudgetsWorkspace,
  ClientDocumentsWorkspace,
  ClientConversationsWorkspace,
  ClientFilesWorkspace,
  ClientInvoicesWorkspace,
  ClientOpportunitiesWorkspace,
  ClientWorksWorkspace,
} from "@/components/portal/modules-a/client-360-real-workspaces";
import { getClientOperationalContext } from "@/lib/operational-intelligence/queries";
import type { OperationalSignal } from "@/lib/operational-intelligence/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import { getEconomicControl } from "@/lib/economic-control/queries";
import { prisma } from "@/lib/prisma";
import { brand } from "@/lib/brand";
import {
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";

type DetailSearchParams = { vista?: string; tab?: string; q?: string };

const tabs = [
  { id: "resumen", label: "Resumen" },
  { id: "obras", label: "Obras" },
  { id: "oportunidades", label: "Oportunidades" },
  { id: "actividad", label: "Actividad" },
  { id: "presupuestos", label: "Presupuestos" },
  { id: "facturas", label: "Facturas" },
  { id: "conversaciones", label: "Conversaciones" },
  { id: "documentos", label: "Documentos" },
  { id: "archivos", label: "Archivos" },
] as const;

const legacyClientAreas = [
  ["resumen", "Resumen"],
  ["trabajos", "Trabajo/Obras"],
  ["dinero", "Dinero"],
  ["archivos", "Archivos"],
] as const;

type ClientTabId = (typeof tabs)[number]["id"];

const legacyTabs: Record<string, ClientTabId> = {
  resumen: "resumen",
  trabajos: "obras",
  dinero: "facturas",
  archivos: "archivos",
  obras: "obras",
  oportunidades: "oportunidades",
  actividad: "actividad",
  contactos: "conversaciones",
  conversaciones: "conversaciones",
  datos: "resumen",
  documentos: "documentos",
  economia: "facturas",
  presupuestos: "presupuestos",
  facturas: "facturas",
  pagos: "facturas",
  finanzas: "facturas",
  visitas: "actividad",
  notas: "actividad",
  relacion: "actividad",
  operacion: "obras",
};

function normalizeClientView(value: string | undefined) {
  if (!value) return undefined;
  const knownLegacyArea = legacyClientAreas.find(([id]) => id === value);
  return legacyTabs[knownLegacyArea?.[0] ?? value] ?? value;
}

function clientViewHref(clientId: string, view: ClientTabId) {
  return view === "resumen" ? `/clientes/${clientId}` : `/clientes/${clientId}?vista=${view}`;
}

function signalMatchesClientView(
  signal: OperationalSignal,
  view: ClientTabId,
) {
  if (view === "resumen") return true;
  if (view === "obras") {
    return signal.entity.type === "obra";
  }
  if (view === "oportunidades") {
    return signal.category === "ventas";
  }
  if (view === "actividad") {
    return (
      signal.entity.type === "agenda" ||
      signal.entity.type === "tarea" ||
      signal.category === "planificacion"
    );
  }
  if (view === "presupuestos") {
    return signal.entity.type === "presupuesto";
  }
  if (view === "facturas") {
    return signal.entity.type === "factura" || signal.category === "cobros";
  }
  if (view === "documentos" || view === "archivos") {
    return (
      signal.entity.type === "factura_recibida" ||
      signal.category === "compras_documentacion"
    );
  }
  return false;
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<DetailSearchParams>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const auth = await requireCapability("clients.view");
  const requestedView = normalizeClientView(query.vista) ?? (query.tab ? normalizeClientView(query.tab) : "resumen");
  const activeTab = tabs.some(({ id: tab }) => tab === requestedView) ? requestedView as ClientTabId : "resumen";
  const scopedClientIds = await resolveScopedEntityIds(
    auth,
    "clients.view",
    "Client",
  );
  if (scopedClientIds !== null && !scopedClientIds.includes(id)) notFound();
  const fullCapabilities = [
    "work.view",
    "work.create",
    "work.update",
    "sales.budgets.view",
    "sales.budgets.create",
    "sales.budgets.update",
    "sales.invoices.view",
    "sales.invoices.create",
    "treasury.view",
    "banking.view",
    "purchases.received_invoices.view",
    "purchase_cost.view",
    "internal_cost.view",
    "margin_percent.view",
    "margin_amount.view",
    "profitability.view",
    "agenda.view",
    "agenda.manage",
    "followups.view",
    "followups.manage",
    "documents.view",
    "documents.manage",
    "tasks.view",
    "clients.update",
  ] as const;
  const fullAccess = await Promise.all(
    fullCapabilities.map((capability) =>
      resolveAuthorization(auth, capability),
    ),
  );
  if (
    fullAccess.some(
      (decision) => !decision.allowed || decision.scope !== "COMPANY",
    )
  ) {
    const client = await prisma.client.findFirst({
      where: { id, companyId: auth.companyId },
      select: {
        id: true,
        nombre: true,
        nombreComercial: true,
        razonSocial: true,
        estado: true,
        origen: true,
        archivadoAt: true,
        telefono: true,
        email: true,
      },
    });
    if (!client) notFound();
    return <ScopedClientDetail auth={auth} client={client} activeTab={activeTab} />;
  }
  const [summary, operationalContext, archiveDecision, aiDecision, uploadDecision] = await Promise.all([
    getClientCrmSummary(id, auth.companyId),
    getClientOperationalContext(id),
    resolveAuthorization(auth, "clients.archive"),
    resolveAuthorization(auth, "orqena.use"),
    resolveAuthorization(auth, "documents.upload"),
  ]);
  if (!summary) notFound();
  const aiClientIds = aiDecision.allowed
    ? await resolveScopedEntityIds(auth, "orqena.use", "Client")
    : [];
  const canUseAiForClient =
    aiDecision.allowed &&
    (aiClientIds === null || aiClientIds.includes(summary.client.id));

  const client = summary.client;
  const returnTo = clientViewHref(client.id, activeTab);

  const timeline = [
    ...summary.upcomingEvents.map((event) => ({
      id: event.id,
      title: event.titulo,
      date: event.fechaInicio,
      href: `/gestion?tipo=eventoAgenda&id=${event.id}&returnTo=${encodeURIComponent(returnTo)}`,
    })),
    ...summary.pendingReminders.map((reminder) => ({
      id: reminder.id,
      title: statusLabel(reminder.tipo),
      date: reminder.fechaProgramada,
      href: `/gestion?tipo=recordatorio&id=${reminder.id}&returnTo=${encodeURIComponent(returnTo)}`,
    })),
  ].sort((left, right) => left.date.getTime() - right.date.getTime());
  const nextTouch = timeline[0] ?? null;
  const contactEmail =
    summary.contacts[0]?.email ?? summary.listItem.email ?? undefined;
  const contactPhone =
    summary.contacts[0]?.phone ?? summary.listItem.phone ?? undefined;
  const incidents = summary.client.works.flatMap((work) =>
    work.photos
      .filter((photo) => photo.categoria === "incidencia")
      .map((photo) => ({
        id: photo.id,
        title: photo.titulo,
        detail: `Evidencia de incidencia · ${work.titulo}`,
        href: `/obras/${work.id}?vista=progreso&modo=galeria`,
      })),
  );
  const principal = operationalContext.principal;
  const clientWorkIds = new Set(summary.client.works.map((work) => work.id));
  const scopedSignals = operationalContext.signals.filter(
    (signal) =>
      signal.entity.clientId === client.id ||
      (signal.entity.type === "cliente" && signal.entity.id === client.id) ||
      Boolean(signal.entity.workId && clientWorkIds.has(signal.entity.workId)),
  );
  const principalBelongsToClient = Boolean(
    principal &&
      (principal.entity.clientId === client.id ||
        (principal.entity.type === "cliente" &&
          principal.entity.id === client.id) ||
        Boolean(
          principal.entity.workId && clientWorkIds.has(principal.entity.workId),
        )),
  );
  const scopedPrincipal = principalBelongsToClient ? principal : null;
  const activeSignal =
    activeTab === "resumen"
      ? scopedPrincipal
      : (scopedSignals.find((signal) =>
          signalMatchesClientView(signal, activeTab),
        ) ?? null);
  const recommendationImpact: Array<{ label: string; value: string }> = [];
  if (activeSignal?.amount != null) {
    recommendationImpact.push({
      label: "Importe relacionado",
      value: formatCurrency(activeSignal.amount),
    });
  }
  if (activeSignal?.days != null) {
    recommendationImpact.push({
      label: "Antigüedad de la señal",
      value: `${activeSignal.days} días`,
    });
  }
  const recommendation =
    canUseAiForClient && activeSignal
      ? {
          clientId: client.id,
          title: activeSignal.title,
          description: activeSignal.explanation,
          sourceLabel: statusLabel(activeSignal.category),
          category: activeSignal.category,
          entityType: activeSignal.entity.type,
          impact: recommendationImpact,
          primaryAction: {
            label: "Abrir acción",
            href: activeSignal.entity.href,
          },
          analysisHref: `/capataz?clienteId=${client.id}`,
        }
      : null;
  const insights = scopedSignals.slice(0, 4).map((signal) => ({
    id: signal.id,
    title: signal.title,
    detail: signal.explanation,
    href: signal.entity.href,
  }));
  const nextAction = nextTouch
    ? {
        title: nextTouch.title,
        description:
          scopedSignals[0]?.nextStep ?? "Revisa esta acción antes de confirmar cambios.",
        dateLabel: formatDate(nextTouch.date),
        contactLabel: summary.listItem.primaryContact,
        completeHref: nextTouch.href,
        actionLabel: "Revisar y completar",
      }
    : scopedPrincipal
      ? {
          title: scopedPrincipal.title,
          description: scopedPrincipal.nextStep,
          dateLabel: scopedPrincipal.referenceDate
            ? formatDate(scopedPrincipal.referenceDate)
            : undefined,
          contactLabel: summary.listItem.primaryContact,
          completeHref: scopedPrincipal.entity.href,
          actionLabel: "Abrir acción",
        }
      : null;

  return (
    <div className="client-360-page">
      <Client360Canonical
        summary={summary}
        activeView={activeTab}
        nextAction={nextAction}
        insights={insights}
        incidents={incidents}
        recommendation={recommendation}
        showAiRail={canUseAiForClient}
        hrefs={{
          back: "/clientes",
          sendMessage: contactEmail ? `mailto:${contactEmail}` : undefined,
          call: contactPhone
            ? `tel:${contactPhone.replace(/\s+/g, "")}`
            : undefined,
          newOpportunity: client.archivadoAt
            ? undefined
            : `/gestion?tipo=presupuesto&clienteId=${client.id}&returnTo=${encodeURIComponent(returnTo)}`,
          newOpportunityLabel: "Nuevo presupuesto",
          activity: `/clientes/${client.id}?vista=actividad`,
          budgets: `/clientes/${client.id}?vista=presupuestos`,
          works: `/clientes/${client.id}?vista=obras`,
          invoices: `/clientes/${client.id}?vista=facturas`,
          payments: `/clientes/${client.id}?vista=facturas#cobros`,
          contacts: `/clientes/${client.id}?vista=conversaciones#contactos`,
          documents: `/clientes/${client.id}?vista=documentos`,
          allRecommendations: `/capataz?clienteId=${client.id}`,
        }}
        moreActions={
          <ClientActions
            clientId={client.id}
            clientName={summary.listItem.displayName}
            returnTo={returnTo}
            archived={Boolean(client.archivadoAt)}
            canArchive={
              archiveDecision.allowed && archiveDecision.scope === "COMPANY"
            }
            canUseAi={canUseAiForClient}
          />
        }
      >
        {activeTab === "obras" ? (
          <ClientWorksWorkspace summary={summary} returnTo={returnTo} />
        ) : null}
        {activeTab === "oportunidades" ? (
          <ClientOpportunitiesWorkspace summary={summary} returnTo={returnTo} />
        ) : null}
        {activeTab === "actividad" ? (
          <ClientActivityWorkspace summary={summary} returnTo={returnTo} />
        ) : null}
        {activeTab === "presupuestos" ? (
          <ClientBudgetsWorkspace summary={summary} returnTo={returnTo} />
        ) : null}
        {activeTab === "facturas" ? (
          <div id="facturas"><ClientInvoicesWorkspace summary={summary} returnTo={returnTo} /></div>
        ) : null}
        {activeTab === "conversaciones" ? (
          <ClientConversationsWorkspace summary={summary} returnTo={returnTo} />
        ) : null}
        {activeTab === "documentos" ? (
          <ClientDocumentsWorkspace summary={summary} returnTo={returnTo} canUpload={uploadDecision.allowed} />
        ) : null}
        {activeTab === "archivos" ? (
          <ClientFilesWorkspace summary={summary} returnTo={returnTo} canUpload={uploadDecision.allowed} companyId={auth.companyId} searchQuery={query.q} />
        ) : null}
      </Client360Canonical>
    </div>
  );
}

async function ScopedClientDetail({
  auth,
  client,
  activeTab,
}: {
  auth: Awaited<ReturnType<typeof requireCapability>>;
  client: {
    id: string;
    nombre: string;
    nombreComercial: string | null;
    razonSocial: string | null;
    estado: string;
    origen: string;
    archivadoAt: Date | null;
    telefono: string | null;
    email: string | null;
  };
  activeTab: ClientTabId;
}) {
  const name = client.nombreComercial ?? client.razonSocial ?? client.nombre;
  const [
    workDecision,
    budgetDecision,
    budgetCreateDecision,
    pricingDecision,
    invoiceDecision,
    clientUpdateDecision,
    followupDecision,
    aiDecision,
  ] = await Promise.all([
    resolveAuthorization(auth, "work.view"),
    resolveAuthorization(auth, "sales.budgets.view"),
    resolveAuthorization(auth, "sales.budgets.create"),
    resolveAuthorization(auth, "sales.pricing.view"),
    resolveAuthorization(auth, "sales.invoices.view"),
    resolveAuthorization(auth, "clients.update"),
    resolveAuthorization(auth, "followups.manage"),
    resolveAuthorization(auth, "orqena.use"),
  ]);
  const [
    workIds,
    budgetWorkIds,
    budgetClientIds,
    budgetCreateWorkIds,
    budgetCreateClientIds,
    pricingWorkIds,
    pricingClientIds,
    invoiceWorkIds,
    invoiceClientIds,
    clientUpdateIds,
    followupWorkIds,
    followupClientIds,
    contacts,
  ] = await Promise.all([
    workDecision.allowed
      ? resolveScopedEntityIds(auth, "work.view", "Work")
      : Promise.resolve([]),
    budgetDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.budgets.view", "Work")
      : Promise.resolve([]),
    budgetDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.budgets.view", "Client")
      : Promise.resolve([]),
    budgetCreateDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.budgets.create", "Work")
      : Promise.resolve([]),
    budgetCreateDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.budgets.create", "Client")
      : Promise.resolve([]),
    pricingDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.pricing.view", "Work")
      : Promise.resolve([]),
    pricingDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.pricing.view", "Client")
      : Promise.resolve([]),
    invoiceDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.invoices.view", "Work")
      : Promise.resolve([]),
    invoiceDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.invoices.view", "Client")
      : Promise.resolve([]),
    clientUpdateDecision.allowed
      ? resolveScopedEntityIds(auth, "clients.update", "Client")
      : Promise.resolve([]),
    followupDecision.allowed
      ? resolveScopedEntityIds(auth, "followups.manage", "Work")
      : Promise.resolve([]),
    followupDecision.allowed
      ? resolveScopedEntityIds(auth, "followups.manage", "Client")
      : Promise.resolve([]),
    prisma.contact.findMany({
      where: {
        companyId: auth.companyId,
        clientId: client.id,
        archivedAt: null,
      },
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        cargo: true,
        telefono: true,
        email: true,
      },
      orderBy: { nombre: "asc" },
      take: 50,
    }),
  ]);
  const [works, budgets, invoices] = await Promise.all([
    workDecision.allowed
      ? prisma.work.findMany({
          where: {
            companyId: auth.companyId,
            clienteId: client.id,
            ...(workIds === null ? {} : { id: { in: workIds } }),
          },
          select: { id: true, titulo: true, estado: true, direccion: true },
          orderBy: { updatedAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
    budgetDecision.allowed
      ? prisma.budget.findMany({
          where: {
            companyId: auth.companyId,
            clienteId: client.id,
            ...relatedClientScope(
              budgetDecision.scope,
              budgetWorkIds,
              budgetClientIds,
            ),
          },
          select: {
            id: true,
            numero: true,
            titulo: true,
            estado: true,
            total: true,
            obraId: true,
          },
          orderBy: { fechaCreacion: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
    invoiceDecision.allowed
      ? prisma.invoice.findMany({
          where: {
            companyId: auth.companyId,
            clienteId: client.id,
            ...relatedClientScope(
              invoiceDecision.scope,
              invoiceWorkIds,
              invoiceClientIds,
            ),
          },
          select: {
            id: true,
            numero: true,
            concepto: true,
            estado: true,
            total: true,
            pendiente: true,
          },
          orderBy: { fechaEmision: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
  ]);
  const canCreateClientBudget =
    budgetCreateDecision.allowed &&
    pricingDecision.allowed &&
    budgetCreateDecision.scope !== "SELECTED_WORKS" &&
    pricingDecision.scope !== "SELECTED_WORKS" &&
    relationAllowedForClient(
      budgetCreateDecision.scope,
      budgetCreateWorkIds,
      budgetCreateClientIds,
      null,
      client.id,
    ) &&
    relationAllowedForClient(
      pricingDecision.scope,
      pricingWorkIds,
      pricingClientIds,
      null,
      client.id,
    );
  const canCreateContact =
    clientUpdateDecision.allowed &&
    (clientUpdateIds === null || clientUpdateIds.includes(client.id));
  const canCreateClientFollowup =
    followupDecision.allowed &&
    followupDecision.scope !== "SELECTED_WORKS" &&
    relationAllowedForClient(
      followupDecision.scope,
      followupWorkIds,
      followupClientIds,
      null,
      client.id,
    );
  const returnTo = clientViewHref(client.id, activeTab);
  const aiClientIds = aiDecision.allowed
    ? await resolveScopedEntityIds(auth, "orqena.use", "Client")
    : [];
  const canUseAiForClient =
    aiDecision.allowed &&
    (aiClientIds === null || aiClientIds.includes(client.id));
  return (
    <div className="client-360-page">
      <Client360Restricted
        activeView={activeTab}
        client={{
          id: client.id,
          displayName: name,
          legalName: client.razonSocial ?? undefined,
          origin: client.origen,
          status: client.estado,
          archived: Boolean(client.archivadoAt),
          phone: client.telefono ?? undefined,
          email: client.email ?? undefined,
        }}
        contacts={contacts.map((contact) => ({
          id: contact.id,
          name: [contact.nombre, contact.apellidos].filter(Boolean).join(" "),
          role: contact.cargo ?? "Contacto",
          phone: contact.telefono ?? undefined,
          email: contact.email ?? undefined,
        }))}
        works={works.map((work) => {
          const canCreateWorkBudget =
            budgetCreateDecision.allowed &&
            pricingDecision.allowed &&
            relationAllowedForClient(
              budgetCreateDecision.scope,
              budgetCreateWorkIds,
              budgetCreateClientIds,
              work.id,
              client.id,
            ) &&
            relationAllowedForClient(
              pricingDecision.scope,
              pricingWorkIds,
              pricingClientIds,
              work.id,
              client.id,
            );
          return {
            id: work.id,
            title: work.titulo,
            status: statusLabel(work.estado),
            address: work.direccion ?? undefined,
            createBudgetHref: canCreateWorkBudget
              ? `/gestion?tipo=presupuesto&clienteId=${client.id}&obraId=${work.id}&returnTo=${encodeURIComponent(returnTo)}`
              : undefined,
          };
        })}
        budgets={budgets.map((budget) => ({
          id: budget.id,
          number: budget.numero,
          title: budget.titulo,
          status: statusLabel(budget.estado),
          total:
            pricingDecision.allowed &&
            relationAllowedForClient(
              pricingDecision.scope,
              pricingWorkIds,
              pricingClientIds,
              budget.obraId,
              client.id,
            )
              ? formatCurrency(budget.total)
              : undefined,
        }))}
        invoices={invoices.map((invoice) => ({
          id: invoice.id,
          number: invoice.numero,
          concept: invoice.concepto,
          status: statusLabel(invoice.estado),
          total: formatCurrency(invoice.total),
          pending: formatCurrency(invoice.pendiente),
        }))}
        visibility={{
          works: workDecision.allowed,
          budgets: budgetDecision.allowed,
          invoices: invoiceDecision.allowed,
        }}
        actions={[
          ...(canCreateClientBudget
            ? [{
                id: "budget" as const,
                label: "Crear presupuesto",
                href: `/gestion?tipo=presupuesto&clienteId=${client.id}&returnTo=${encodeURIComponent(returnTo)}`,
              }]
            : []),
          ...(canCreateContact
            ? [{
                id: "contact" as const,
                label: "Añadir contacto",
                href: `/gestion?tipo=contacto&clientId=${client.id}&returnTo=${encodeURIComponent(returnTo)}`,
              }]
            : []),
          ...(canCreateClientFollowup
            ? [{
                id: "followup" as const,
                label: "Crear seguimiento",
                href: `/gestion?tipo=recordatorio&clienteId=${client.id}&tipoRecordatorio=seguimiento_presupuesto&returnTo=${encodeURIComponent(returnTo)}`,
              }]
            : []),
        ]}
        canUseAi={canUseAiForClient}
      />
    </div>
  );
}
function relatedClientScope(
  scope: string,
  workIds: string[] | null,
  clientIds: string[] | null,
) {
  if (scope === "COMPANY") return {};
  if (scope === "SELECTED_CLIENTS")
    return { clienteId: { in: clientIds ?? [] } };
  if (scope === "SELECTED_WORKS") return { obraId: { in: workIds ?? [] } };
  const OR: Array<Record<string, unknown>> = [];
  if (workIds?.length) OR.push({ obraId: { in: workIds } });
  if (clientIds?.length)
    OR.push({ clienteId: { in: clientIds }, obraId: null });
  return OR.length ? { OR } : { id: { in: [] as string[] } };
}
function relationAllowedForClient(
  scope: string,
  workIds: string[] | null,
  clientIds: string[] | null,
  workId: string | null,
  clientId: string,
) {
  if (scope === "COMPANY") return true;
  if (scope === "SELECTED_WORKS")
    return Boolean(workId && workIds?.includes(workId));
  if (scope === "SELECTED_CLIENTS")
    return Boolean(clientIds?.includes(clientId));
  return workId
    ? Boolean(workIds?.includes(workId))
    : Boolean(clientIds?.includes(clientId));
}

function ClientActions({
  clientId,
  clientName,
  returnTo,
  archived,
  canArchive,
  canUseAi,
}: {
  clientId: string;
  clientName: string;
  returnTo: string;
  archived: boolean;
  canArchive: boolean;
  canUseAi: boolean;
}) {
  const encodedReturn = encodeURIComponent(returnTo);
  const visitDate = encodeURIComponent(tomorrowAtTenInputValue());
  return (
    <details className="relative">
      <summary className="secondary-button cursor-pointer list-none">
        <span className="sr-only">Más acciones</span>
        <MoreHorizontal size={18} aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 grid min-w-64 gap-1 rounded-xl border border-border bg-surface p-2 shadow-xl [&_a]:justify-start">
        <Link
          href={`/gestion?tipo=cliente&id=${clientId}&returnTo=${encodedReturn}`}
          className="secondary-button"
        >
          <UserRound size={18} />
          Editar
        </Link>
        <Link
          href={`/gestion?tipo=presupuesto&clienteId=${clientId}&returnTo=${encodedReturn}`}
          className="secondary-button"
        >
          <FileText size={18} />
          Presupuesto
        </Link>
        <Link
          href={`/gestion?tipo=factura&clienteId=${clientId}&returnTo=${encodedReturn}`}
          className="secondary-button"
        >
          <Receipt size={18} />
          Factura
        </Link>
        <Link
          href={`/gestion?tipo=eventoAgenda&clienteId=${clientId}&tipoEvento=visita&titulo=Visita%20con%20${encodeURIComponent(clientName)}&fechaInicio=${visitDate}&returnTo=${encodedReturn}`}
          className="secondary-button"
        >
          <CalendarClock size={18} />
          Visita
        </Link>
        <Link
          href={`/gestion?tipo=recordatorio&clienteId=${clientId}&tipoRecordatorio=seguimiento_presupuesto&returnTo=${encodedReturn}`}
          className="secondary-button"
        >
          <MessageCircle size={18} />
          Seguimiento
        </Link>
        <Link
          href={`/gestion?tipo=contacto&clientId=${clientId}&returnTo=${encodedReturn}`}
          className="secondary-button"
        >
          <Plus size={18} />
          Contacto
        </Link>
        {canUseAi ? (
          <Link
            href={`/capataz?clienteId=${clientId}`}
            className="secondary-button"
            aria-label={`Preguntar a ${brand.assistantName} sobre ${clientName}`}
          >
            <Bot size={18} />
            Preguntar a {brand.assistantName}
          </Link>
        ) : null}
        {canArchive ? <ArchiveActions id={clientId} archived={archived} /> : null}
      </div>
    </details>
  );
}

function ArchiveActions({ id, archived }: { id: string; archived: boolean }) {
  if (archived) {
    return (
      <form action={restoreClient}>
        <input type="hidden" name="id" value={id} />
        <ConfirmSubmitButton
          className="secondary-button"
          message="¿Restaurar este cliente y volver a mostrarlo entre los activos?"
        >
          <RotateCcw size={18} />
          Restaurar
        </ConfirmSubmitButton>
      </form>
    );
  }

  return (
    <form action={archiveClient}>
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmitButton
        className="danger-button"
        message="El cliente se ocultará de la vista de activos, pero se conservarán sus obras, presupuestos, facturas y pagos."
      >
        <Archive size={18} />
        Archivar
      </ConfirmSubmitButton>
    </form>
  );
}

function ContactsTab({
  summary,
  returnTo,
}: {
  summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>;
  returnTo: string;
}) {
  return (
    <SectionList
      title="Contactos"
      description="Contactos reales del cliente, con respaldo defensivo de los campos antiguos cuando aún no se han migrado manualmente."
      emptyTitle="No hay contactos registrados."
      emptyAction={
        <Link
          href={`/gestion?tipo=contacto&clientId=${summary.client.id}&returnTo=${encodeURIComponent(returnTo)}`}
          className="secondary-button"
        >
          Añadir contacto
        </Link>
      }
    >
      {summary.contacts.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {summary.contacts.map((contact) => (
            <article
              key={contact.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-obra-ink">{contact.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{contact.role}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {contact.flags.map((flag) => (
                    <Badge key={flag}>{flag}</Badge>
                  ))}
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p>
                  <strong className="text-obra-ink">Teléfono:</strong>{" "}
                  {contact.phone ?? "Sin teléfono"}
                </p>
                <p>
                  <strong className="text-obra-ink">Email:</strong>{" "}
                  {contact.email ?? "Sin email"}
                </p>
                {contact.notes ? (
                  <p>
                    <strong className="text-obra-ink">Notas:</strong>{" "}
                    {contact.notes}
                  </p>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={
                    contact.source === "real"
                      ? `/gestion?tipo=contacto&id=${contact.id}&clientId=${summary.client.id}&returnTo=${encodeURIComponent(returnTo)}`
                      : `/gestion?tipo=cliente&id=${summary.client.id}&returnTo=${encodeURIComponent(returnTo)}`
                  }
                  className="secondary-button"
                >
                  Editar
                </Link>
                <Link
                  href={`/gestion?tipo=eventoAgenda&clienteId=${summary.client.id}&tipoEvento=llamada&titulo=Llamada%20${encodeURIComponent(contact.name)}&fechaInicio=${encodeURIComponent(tomorrowAtTenInputValue())}&returnTo=${encodeURIComponent(returnTo)}`}
                  className="secondary-button"
                >
                  Crear llamada
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </SectionList>
  );
}

function ConversationsTab({
  summary,
  returnTo,
}: {
  summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>;
  returnTo: string;
}) {
  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="label">Canales y trazabilidad</p>
        <h2 className="mt-1 text-lg font-black text-obra-ink">
          Conversaciones con {summary.listItem.displayName}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Esta ficha muestra únicamente contactos, actividad y notas realmente
          registradas. No existe un hilo de mensajes persistido, por lo que no
          se reconstruyen conversaciones ni se atribuyen comunicaciones que no
          constan en el sistema.
        </p>
      </section>
      <div id="contactos">
        <ContactsTab summary={summary} returnTo={returnTo} />
      </div>
      <ActivityTab summary={summary} />
      <NotesTab summary={summary} returnTo={returnTo} />
    </div>
  );
}

function PaymentsTab({
  summary,
}: {
  summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>;
}) {
  return (
    <SectionList title="Pagos" emptyTitle="No hay pagos registrados.">
      {summary.payments.length ? (
        <div className="grid gap-3">
          {summary.payments.map((payment) => (
            <article
              key={payment.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="label">{payment.invoice.numero}</p>
                  <h3 className="mt-1 font-black text-obra-ink">
                    {formatCurrency(payment.importe)}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {payment.invoice.concepto}
                  </p>
                </div>
                <StatusPill status={payment.tipo} />
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                <p>
                  <strong className="text-obra-ink">Fecha:</strong>{" "}
                  {formatDate(payment.fecha)}
                </p>
                <p>
                  <strong className="text-obra-ink">Método:</strong>{" "}
                  {payment.metodo}
                </p>
                <p>
                  <strong className="text-obra-ink">Obra:</strong>{" "}
                  {payment.work?.titulo ?? "Sin obra"}
                </p>
              </div>
              {payment.notas ? (
                <p className="mt-3 text-sm text-slate-600">{payment.notas}</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </SectionList>
  );
}

function ClientFinanceTab({
  treasury,
  clientId,
}: {
  treasury: Awaited<ReturnType<typeof getEconomicControl>>;
  clientId: string;
}) {
  const receivables = treasury.receivables.slice(0, 5);
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <SectionList
        title="Posición económica del cliente"
        emptyTitle="Sin métricas financieras."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FinanceBox
            label="Facturado"
            value={formatCurrency(treasury.receivableSummary.documented)}
          />
          <FinanceBox
            label="Cobrado"
            value={formatCurrency(treasury.receivableSummary.settled)}
          />
          <FinanceBox
            label="Pendiente"
            value={formatCurrency(treasury.receivableSummary.pending)}
            tone={treasury.receivableSummary.pending ? "warning" : "neutral"}
          />
          <FinanceBox
            label="Vencido"
            value={formatCurrency(treasury.receivableSummary.overdue)}
            tone={treasury.receivableSummary.overdue ? "danger" : "neutral"}
          />
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Importes trazados a facturas emitidas y pagos registrados. No se
          presenta una puntuación ni un saldo bancario atribuido al cliente.
        </p>
      </SectionList>
      <SectionList
        title="Próximos cobros"
        emptyTitle="Sin cobros próximos registrados."
      >
        {receivables.length ? (
          <div className="grid gap-3">
            {receivables.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <p className="label">
                  {item.pending > 0 ? "Pendiente" : "Liquidada"}
                </p>
                <h3 className="mt-1 font-black text-obra-ink">{item.number}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {formatCurrency(item.pending)} ·{" "}
                  {item.dueDate ? formatDate(item.dueDate) : "sin vencimiento"}
                </p>
              </Link>
            ))}
          </div>
        ) : null}
        <Link
          href={`/tesoreria?vista=cobros&periodo=30d&cliente=${clientId}`}
          className="primary-button mt-4 inline-flex"
        >
          Abrir control económico
        </Link>
      </SectionList>
    </div>
  );
}

function FinanceBox({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-red-50 text-red-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-800"
        : tone === "success"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-50 text-obra-ink";
  return (
    <div className={`rounded-lg p-3 ${toneClass}`}>
      <p className="text-xs font-bold uppercase opacity-75">{label}</p>
      <p className="mt-1 font-black tabular-nums">{value}</p>
    </div>
  );
}

function VisitsTab({
  summary,
  returnTo,
}: {
  summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>;
  returnTo: string;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionList
        title="Visitas y reuniones"
        emptyTitle="No hay visitas registradas."
        emptyAction={
          <Link
            href={`/gestion?tipo=eventoAgenda&clienteId=${summary.client.id}&tipoEvento=visita&fechaInicio=${encodeURIComponent(tomorrowAtTenInputValue())}&returnTo=${encodeURIComponent(returnTo)}`}
            className="secondary-button"
          >
            Registrar visita
          </Link>
        }
      >
        {summary.client.agendaEvents.map((event) => (
          <CompactRow
            key={event.id}
            icon={CalendarClock}
            title={event.titulo}
            detail={`${statusLabel(event.tipo)} · ${statusLabel(event.estado)} · ${formatDate(event.fechaInicio)}`}
            href={`/gestion?tipo=eventoAgenda&id=${event.id}&returnTo=${encodeURIComponent(returnTo)}`}
          />
        ))}
      </SectionList>

      <SectionList
        title="Seguimientos"
        emptyTitle="No hay seguimientos pendientes."
        emptyAction={
          <Link
            href={`/gestion?tipo=recordatorio&clienteId=${summary.client.id}&tipoRecordatorio=seguimiento_presupuesto&returnTo=${encodeURIComponent(returnTo)}`}
            className="secondary-button"
          >
            Crear seguimiento
          </Link>
        }
      >
        {summary.client.reminders.map((reminder) => (
          <CompactRow
            key={reminder.id}
            icon={Bell}
            title={statusLabel(reminder.tipo)}
            detail={`${statusLabel(reminder.estado)} · ${formatDate(reminder.fechaProgramada)} · ${reminder.canal}`}
            href={`/gestion?tipo=recordatorio&id=${reminder.id}&returnTo=${encodeURIComponent(returnTo)}`}
          />
        ))}
      </SectionList>
    </div>
  );
}

function ActivityTab({
  summary,
}: {
  summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>;
}) {
  return (
    <SectionList
      title="Actividad reciente"
      emptyTitle="Sin actividad reciente."
    >
      {summary.activity.length ? (
        <div className="card divide-y divide-slate-100">
          {summary.activity.map((event) => (
            <div key={event.id} className="flex gap-3 p-4">
              <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-obra-yellow/25 text-obra-yellowDark">
                <ClipboardList size={18} />
              </span>
              <div className="min-w-0">
                <p className="font-black text-obra-ink">{event.text}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {event.type} · {formatDate(event.date)}
                </p>
                {event.href ? (
                  <Link
                    href={event.href}
                    className="mt-2 inline-flex text-sm font-bold text-obra-ink underline underline-offset-4"
                  >
                    Ver entidad
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </SectionList>
  );
}

function NotesTab({
  summary,
  returnTo,
}: {
  summary: NonNullable<Awaited<ReturnType<typeof getClientCrmSummary>>>;
  returnTo: string;
}) {
  const notes = [
    summary.client.notas
      ? {
          id: "client",
          title: "Nota interna del cliente",
          text: summary.client.notas,
          date:
            summary.client.ultimaInteraccion ?? summary.client.fechaCreacion,
        }
      : null,
    ...summary.client.internalNotes
      .filter((note) => !note.archivedAt)
      .map((note) => ({
        id: note.id,
        title: note.work
          ? `Obra: ${note.work.titulo}`
          : note.budget
            ? `Presupuesto: ${note.budget.numero}`
            : note.invoice
              ? `Factura: ${note.invoice.numero}`
              : "Nota interna",
        text: note.content,
        date: note.createdAt,
      })),
    ...summary.client.works
      .filter((work) => work.notas)
      .map((work) => ({
        id: `work-${work.id}`,
        title: `Obra: ${work.titulo}`,
        text: work.notas ?? "",
        date: work.fechaInicio ?? summary.client.fechaCreacion,
      })),
    ...summary.client.agendaEvents
      .filter((event) => event.notas)
      .map((event) => ({
        id: `event-${event.id}`,
        title: event.titulo,
        text: event.notas ?? "",
        date: event.fechaInicio,
      })),
    ...summary.client.reminders
      .filter((reminder) => reminder.mensaje)
      .map((reminder) => ({
        id: `reminder-${reminder.id}`,
        title: statusLabel(reminder.tipo),
        text: reminder.mensaje,
        date: reminder.fechaProgramada,
      })),
  ].filter(Boolean) as Array<{
    id: string;
    title: string;
    text: string;
    date: Date;
  }>;

  return (
    <SectionList
      title="Notas internas"
      description="Notas internas estructuradas. No se usan en PDFs ni en mensajes a clientes."
      emptyTitle="No hay notas internas registradas."
      emptyAction={
        <Link
          href={`/gestion?tipo=notaInterna&clientId=${summary.client.id}&returnTo=${encodeURIComponent(returnTo)}`}
          className="secondary-button"
        >
          Añadir nota
        </Link>
      }
    >
      {notes.length ? (
        <div className="grid gap-3">
          {notes.map((note) => (
            <article
              key={note.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <p className="label">{formatDate(note.date)}</p>
              <h3 className="mt-1 font-black text-obra-ink">{note.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {note.text}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </SectionList>
  );
}

function WorkCard({
  work,
  returnTo,
  compact = false,
}: {
  work: NonNullable<
    Awaited<ReturnType<typeof getClientCrmSummary>>
  >["client"]["works"][number];
  returnTo: string;
  compact?: boolean;
}) {
  const invoiceTotal = work.invoices.reduce(
    (sum, invoice) => sum + invoice.total,
    0,
  );
  const pendingTotal = work.invoices.reduce(
    (sum, invoice) =>
      sum +
      Math.max(
        0,
        invoice.total -
          invoice.payments.reduce((paid, payment) => paid + payment.importe, 0),
      ),
    0,
  );
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="label">{work.tipoTrabajo}</p>
          <h3 className="mt-1 font-black text-obra-ink">{work.titulo}</h3>
          <p className="mt-1 text-sm text-slate-500">{work.direccion}</p>
        </div>
        <StatusPill status={work.estado} />
      </div>
      <div
        className={`mt-3 grid gap-2 text-sm text-slate-600 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-4"}`}
      >
        <p>
          <strong className="text-obra-ink">Inicio:</strong>{" "}
          {formatDate(work.fechaInicio)}
        </p>
        <p>
          <strong className="text-obra-ink">Última:</strong>{" "}
          {formatDate(work.agendaEvents[0]?.fechaInicio ?? work.fechaInicio)}
        </p>
        <p>
          <strong className="text-obra-ink">Facturado:</strong>{" "}
          {formatCurrency(invoiceTotal)}
        </p>
        <p>
          <strong className="text-obra-ink">Pendiente:</strong>{" "}
          {formatCurrency(pendingTotal)}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/gestion?tipo=obra&id=${work.id}&returnTo=${encodeURIComponent(returnTo)}`}
          className="secondary-button"
        >
          Editar
        </Link>
        <Link
          href={`/gestion?tipo=presupuesto&clienteId=${work.clienteId}&obraId=${work.id}&returnTo=${encodeURIComponent(returnTo)}`}
          className="secondary-button"
        >
          Crear presupuesto
        </Link>
        <Link
          href={`/gestion?tipo=eventoAgenda&clienteId=${work.clienteId}&obraId=${work.id}&tipoEvento=visita&fechaInicio=${encodeURIComponent(tomorrowAtTenInputValue())}&returnTo=${encodeURIComponent(returnTo)}`}
          className="secondary-button"
        >
          Registrar visita
        </Link>
      </div>
    </article>
  );
}

function BudgetCard({
  budget,
  returnTo,
  compact = false,
}: {
  budget: NonNullable<
    Awaited<ReturnType<typeof getClientCrmSummary>>
  >["client"]["budgets"][number];
  returnTo: string;
  compact?: boolean;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="label">{budget.numero}</p>
          <h3 className="mt-1 font-black text-obra-ink">{budget.titulo}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {budget.work?.titulo ?? "Sin obra asociada"}
          </p>
        </div>
        <StatusPill status={budget.estado} />
      </div>
      <div
        className={`mt-3 grid gap-2 text-sm text-slate-600 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-5"}`}
      >
        <p>
          <strong className="text-obra-ink">Base:</strong>{" "}
          {formatCurrency(budget.subtotal)}
        </p>
        <p>
          <strong className="text-obra-ink">IVA:</strong>{" "}
          {formatCurrency(budget.iva)}
        </p>
        <p>
          <strong className="text-obra-ink">Total:</strong>{" "}
          {formatCurrency(budget.total)}
        </p>
        <p>
          <strong className="text-obra-ink">Validez:</strong>{" "}
          {formatDate(budget.fechaValidez)}
        </p>
        <p>
          <strong className="text-obra-ink">Actualizado:</strong>{" "}
          {formatDate(budget.fechaEnvio ?? budget.fechaCreacion)}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/presupuestos/${budget.id}`} className="secondary-button">
          Ver
        </Link>
        <Link
          href={`/gestion?tipo=presupuesto&id=${budget.id}&returnTo=${encodeURIComponent(returnTo)}`}
          className="secondary-button"
        >
          Editar
        </Link>
        <Link
          href={`/presupuestos/${budget.id}/pdf`}
          className="secondary-button"
        >
          Ver PDF
        </Link>
      </div>
    </article>
  );
}

function InvoiceCard({
  invoice,
  returnTo,
  compact = false,
}: {
  invoice: NonNullable<
    Awaited<ReturnType<typeof getClientCrmSummary>>
  >["client"]["invoices"][number];
  returnTo: string;
  compact?: boolean;
}) {
  const paid = invoice.payments.reduce(
    (sum, payment) => sum + payment.importe,
    0,
  );
  const pending = Math.max(0, invoice.total - paid);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="label">{invoice.numero}</p>
          <h3 className="mt-1 font-black text-obra-ink">{invoice.concepto}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {invoice.work?.titulo ?? "Sin obra asociada"}
          </p>
        </div>
        <StatusPill status={invoice.estado} />
      </div>
      <div
        className={`mt-3 grid gap-2 text-sm text-slate-600 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-5"}`}
      >
        <p>
          <strong className="text-obra-ink">Total:</strong>{" "}
          {formatCurrency(invoice.total)}
        </p>
        <p>
          <strong className="text-obra-ink">Pagado:</strong>{" "}
          {formatCurrency(paid)}
        </p>
        <p>
          <strong className="text-obra-ink">Pendiente:</strong>{" "}
          {formatCurrency(pending)}
        </p>
        <p>
          <strong className="text-obra-ink">Emisión:</strong>{" "}
          {formatDate(invoice.fechaEmision)}
        </p>
        <p>
          <strong className="text-obra-ink">Vence:</strong>{" "}
          {formatDate(invoice.fechaVencimiento)}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/dinero/${invoice.id}`} className="secondary-button">
          Ver
        </Link>
        <Link
          href={`/gestion?tipo=factura&id=${invoice.id}&returnTo=${encodeURIComponent(returnTo)}`}
          className="secondary-button"
        >
          Editar
        </Link>
        <Link href={`/dinero/${invoice.id}/pdf`} className="secondary-button">
          Ver PDF
        </Link>
        {pending > 0 ? (
          <Link
            href={`/gestion?tipo=pago&facturaId=${invoice.id}&returnTo=${encodeURIComponent(returnTo)}`}
            className="secondary-button"
          >
            Registrar pago
          </Link>
        ) : null}
      </div>
    </article>
  );
}

// Keep the previous compact cards available to the scoped-access fallback while
// the full Client 360 workspaces remain company-scoped server components.
void [WorkCard, BudgetCard, InvoiceCard];
void [PaymentsTab, ClientFinanceTab, FinanceBox];
void VisitsTab;
void ConversationsTab;

function SectionList({
  title,
  description,
  emptyTitle,
  emptyAction,
  children,
}: {
  title: string;
  description?: string;
  emptyTitle: string;
  emptyAction?: ReactNode;
  children?: ReactNode;
}) {
  const childArray = children
    ? Array.isArray(children)
      ? children
      : [children]
    : [];
  const hasContent = childArray.some(Boolean);
  return (
    <section>
      <SectionHeader level={2} title={title} description={description} />
      {hasContent ? (
        <div className="grid gap-3">{children}</div>
      ) : (
        <EmptyState title={emptyTitle} icon={FolderOpen} action={emptyAction} />
      )}
    </section>
  );
}

function CompactRow({
  icon: Icon,
  title,
  detail,
  href,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  detail: string;
  href?: string;
}) {
  const content = (
    <span className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-obra-graphite">
        <Icon size={19} />
      </span>
      <span className="min-w-0">
        <span className="block font-black text-obra-ink">{title}</span>
        <span className="mt-1 block text-sm text-slate-500">{detail}</span>
      </span>
    </span>
  );
  return href ? (
    <Link href={href} className="block transition hover:scale-[0.995]">
      {content}
    </Link>
  ) : (
    content
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
      {children}
    </span>
  );
}

function tomorrowAtTenInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
