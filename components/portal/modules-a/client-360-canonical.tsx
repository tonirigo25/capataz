import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  ChevronLeft,
  CircleDollarSign,
  FileText,
  FolderOpen,
  MessageCircle,
  Phone,
  Plus,
  Sparkles,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { ClientCrmSummary } from "@/lib/client-crm";
import type {
  OperationalEntityType,
  OperationalSignalCategory,
} from "@/lib/operational-intelligence/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import { StatusPill } from "@/components/status-pill";
import { Client360RailShell } from "@/components/portal/modules-a/client-360-rail-shell";

type ClientSummary = NonNullable<ClientCrmSummary>;

export const CLIENT_360_CANONICAL_VIEWS = [
  "resumen",
  "obras",
  "oportunidades",
  "actividad",
  "presupuestos",
  "facturas",
  "conversaciones",
  "documentos",
  "archivos",
] as const;

export type Client360CanonicalView =
  (typeof CLIENT_360_CANONICAL_VIEWS)[number];

export type Client360Insight = {
  id: string;
  title: string;
  detail: string;
  href?: string;
};

export type Client360Incident = {
  id: string;
  title: string;
  detail: string;
  status?: string;
  href: string;
};

export type Client360Recommendation = {
  /** Must match summary.client.id. A mismatch is rendered fail-closed. */
  clientId: string;
  title: string;
  description: string;
  sourceLabel?: string;
  category?: OperationalSignalCategory;
  entityType?: OperationalEntityType;
  impact?: Array<{ label: string; value: string }>;
  primaryAction: { label: string; href: string };
  analysisHref?: string;
  dismissControl?: ReactNode;
};

export type Client360CanonicalProps = {
  summary: ClientSummary;
  activeView?: Client360CanonicalView;
  children?: ReactNode;
  moreActions?: ReactNode;
  showAiRail?: boolean;
  nextAction?: {
    title: string;
    description?: string;
    dateLabel?: string;
    contactLabel?: string;
    completeHref?: string;
    actionLabel?: string;
  } | null;
  insights?: Client360Insight[];
  incidents?: Client360Incident[];
  recommendation?: Client360Recommendation | null;
  hrefs: {
    back: string;
    sendMessage?: string;
    call?: string;
    newOpportunity?: string;
    newOpportunityLabel?: string;
    activity: string;
    budgets: string;
    works: string;
    invoices: string;
    payments: string;
    contacts: string;
    documents: string;
    allRecommendations: string;
  };
};

const viewLabels: Record<Client360CanonicalView, string> = {
  resumen: "Resumen",
  obras: "Obras",
  oportunidades: "Oportunidades",
  actividad: "Actividad",
  presupuestos: "Presupuestos",
  facturas: "Facturas",
  conversaciones: "Conversaciones",
  documentos: "Documentos",
  archivos: "Archivos",
};

const viewIcons: Record<Client360CanonicalView, typeof UserRound> = {
  resumen: UserRound,
  obras: BriefcaseBusiness,
  oportunidades: UsersRound,
  actividad: CalendarCheck2,
  presupuestos: FileText,
  facturas: CircleDollarSign,
  conversaciones: MessageCircle,
  documentos: FolderOpen,
  archivos: FolderOpen,
};

const railEmptyCopy: Record<
  Client360CanonicalView,
  { title: string; description: string }
> = {
  resumen: {
    title: "Sin recomendación general activa",
    description:
      "No hay una señal validada para el resumen de este cliente. No se muestran señales de otra ficha.",
  },
  obras: {
    title: "Sin recomendación activa sobre obras",
    description:
      "No hay una señal validada vinculada a las obras de este cliente.",
  },
  oportunidades: {
    title: "Sin seguimiento comercial recomendado",
    description:
      "No hay una señal validada de seguimiento comercial para este cliente.",
  },
  actividad: {
    title: "Sin recomendación de actividad",
    description:
      "No hay una tarea o cita validada que requiera atención en esta vista.",
  },
  presupuestos: {
    title: "Sin recomendación sobre presupuestos",
    description:
      "No hay una señal validada vinculada a un presupuesto de este cliente.",
  },
  facturas: {
    title: "Sin recomendación financiera activa",
    description:
      "No hay una señal validada de facturación o cobro para este cliente.",
  },
  conversaciones: {
    title: "Sin conversación recomendada",
    description:
      "No existe una señal validada de conversación. Los canales mostrados proceden de los contactos registrados.",
  },
  documentos: {
    title: "Sin recomendación documental activa",
    description:
      "No hay una señal documental validada vinculada a este cliente.",
  },
  archivos: {
    title: "Sin recomendación sobre archivos",
    description:
      "No hay una señal validada vinculada a los archivos de este cliente.",
  },
};

function recommendationMatchesView(
  recommendation: Client360Recommendation,
  activeView: Client360CanonicalView,
) {
  if (activeView === "resumen") return true;
  if (activeView === "obras") {
    return (
      recommendation.entityType === "obra" ||
      recommendation.category === "economia_obra"
    );
  }
  if (activeView === "oportunidades") {
    return recommendation.category === "ventas";
  }
  if (activeView === "actividad") {
    return (
      recommendation.entityType === "agenda" ||
      recommendation.entityType === "tarea" ||
      recommendation.category === "planificacion"
    );
  }
  if (activeView === "presupuestos") {
    return recommendation.entityType === "presupuesto";
  }
  if (activeView === "facturas") {
    return (
      recommendation.entityType === "factura" ||
      recommendation.category === "cobros"
    );
  }
  if (activeView === "documentos" || activeView === "archivos") {
    return (
      recommendation.entityType === "factura_recibida" ||
      recommendation.category === "compras_documentacion"
    );
  }
  return false;
}

/**
 * Canonical Cliente 360 summary.
 *
 * The component deliberately renders one contextual rail only. It never
 * manufactures commercial insights or an AI recommendation: both arrive as
 * scoped props, and a recommendation for another client is rejected.
 */
export function Client360Canonical({
  summary,
  activeView = "resumen",
  children,
  moreActions,
  insights = [],
  recommendation,
  hrefs,
  showAiRail = true,
}: Client360CanonicalProps) {
  const client = summary.client;
  const displayName = summary.listItem.displayName;
  const scopedRecommendation =
    recommendation?.clientId === client.id ? recommendation : null;
  const activeContacts = summary.contacts.filter((contact) => !contact.archivedAt);
  const primaryContact = activeContacts[0] ?? null;

  if (activeView === "resumen") {
    return (
      <div
        className="client-360-canonical client-360-canonical--reference-summary grid min-w-0 items-stretch"
        data-client-360-canonical
        data-has-client-rail={showAiRail ? "true" : "false"}
      >
        <div className="min-w-0">
          <Client360ReferenceSummary
            summary={summary}
            primaryContact={primaryContact}
            moreActions={moreActions}
            hrefs={hrefs}
          />
        </div>

        {showAiRail ? (
          <Client360RailShell>
            <ClientRecommendationRail
              clientName={displayName}
              activeView="resumen"
              recommendation={scopedRecommendation}
              insights={insights}
              allRecommendationsHref={hrefs.allRecommendations}
            />
          </Client360RailShell>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="client-360-canonical grid min-w-0 items-stretch gap-4"
      data-client-360-canonical
      data-has-client-rail={showAiRail ? "true" : "false"}
    >
      <div className="min-w-0 space-y-4">
        <header>
          <Link
            href={hrefs.back}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-content-secondary hover:text-content"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Clientes
          </Link>
          <h1 className="type-page-title text-content">Cliente 360</h1>
        </header>

        <section
          className="client-360-canonical__identity rounded-xl border border-border bg-surface p-4 shadow-soft lg:p-5"
          aria-labelledby="client-360-identity"
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.8fr)_auto] xl:items-center">
            <div className="flex min-w-0 gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
                <Building2 size={30} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="client-360-identity"
                    className="type-section-title truncate text-content"
                  >
                    {displayName}
                  </h2>
                  <StatusPill
                    status={client.archivadoAt ? "archivado" : client.estado}
                  />
                </div>
                <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2">
                  <Fact label="Segmento" value={summary.listItem.typeLabel} />
                  <Fact label="Origen" value={client.origen} />
                  <Fact label="Desde" value={formatDate(client.fechaCreacion)} />
                  {summary.listItem.fiscalId ? (
                    <Fact label="Identificación fiscal" value={summary.listItem.fiscalId} />
                  ) : null}
                </dl>
                <div className="client-360-canonical__mobile-identity-meta">
                  <p>Cliente desde {formatDate(client.fechaCreacion)}</p>
                  <p>
                    {primaryContact?.name ?? summary.listItem.primaryContact}
                    {primaryContact?.phone || primaryContact?.email
                      ? ` · ${primaryContact.phone ?? primaryContact.email}`
                      : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
              <dl>
                <Fact
                  label="Responsable"
                  value={summary.listItem.responsible ?? "Sin responsable asignado"}
                />
              </dl>
              <div className="mt-4">
                <p className="type-label">Contacto principal</p>
                <p className="mt-1 font-semibold text-content">
                  {primaryContact?.name ?? summary.listItem.primaryContact}
                </p>
                <p className="mt-1 break-words text-sm text-content-secondary">
                  {[primaryContact?.email, primaryContact?.phone]
                    .filter(Boolean)
                    .join(" · ") || summary.listItem.primaryContactDetail}
                </p>
              </div>
            </div>

            <nav className="grid min-w-48 gap-2" aria-label={`Acciones de ${displayName}`}>
              {hrefs.sendMessage ? (
                <Link href={hrefs.sendMessage} className="secondary-button w-full">
                  <MessageCircle size={16} aria-hidden="true" /> Abrir correo
                </Link>
              ) : null}
              {hrefs.call ? (
                <Link href={hrefs.call} className="secondary-button w-full">
                  <Phone size={16} aria-hidden="true" /> Llamar desde el dispositivo
                </Link>
              ) : null}
              {hrefs.newOpportunity ? (
                <span className="client-360-canonical__primary-action relative block">
                  <Link href={hrefs.newOpportunity} className="primary-button w-full">
                    <Plus size={16} aria-hidden="true" /> {hrefs.newOpportunityLabel ?? "Nueva acción"}
                  </Link>
                  {moreActions ? (
                    <span className="client-360-canonical__more-actions">
                      {moreActions}
                    </span>
                  ) : null}
                </span>
              ) : moreActions ? (
                <span className="client-360-canonical__more-actions client-360-canonical__more-actions--standalone">
                  {moreActions}
                </span>
              ) : null}
            </nav>
          </div>
        </section>

        <nav
          className="flex min-w-0 gap-1 overflow-x-auto border-b border-border"
          aria-label="Secciones de Cliente 360"
        >
          {CLIENT_360_CANONICAL_VIEWS.map((view) => {
            const Icon = viewIcons[view];
            return (
              <Link
                key={view}
                href={`/clientes/${client.id}?vista=${view}`}
                aria-current={activeView === view ? "page" : undefined}
                className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
                  activeView === view
                    ? "border-brand text-brand-strong"
                    : "border-transparent text-content-secondary hover:text-content"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {viewLabels[view]}
              </Link>
            );
          })}
        </nav>

        <div className="client-360-canonical__tab-content min-w-0">{children}</div>
      </div>

      {showAiRail ? (
        <Client360RailShell>
          <ClientRecommendationRail
            clientName={displayName}
              activeView={activeView}
              recommendation={scopedRecommendation}
              insights={insights}
              allRecommendationsHref={hrefs.allRecommendations}
          />
        </Client360RailShell>
      ) : null}
    </div>
  );
}

const SUMMARY_PRIMARY_VIEWS: Client360CanonicalView[] = [
    "resumen",
    "obras",
    "presupuestos",
    "facturas",
    "conversaciones",
    "documentos",
];

const SUMMARY_MORE_VIEWS: Client360CanonicalView[] = [
    "oportunidades",
    "actividad",
    "archivos",
];

function Client360ReferenceSummary({
  summary,
  primaryContact,
  moreActions,
  hrefs,
}: {
  summary: ClientSummary;
  primaryContact: ClientSummary["contacts"][number] | null;
  moreActions?: ReactNode;
  hrefs: Client360CanonicalProps["hrefs"];
}) {
  const client = summary.client;
  const displayName = summary.listItem.displayName;
  const address = [
    client.direccion,
    client.codigoPostal,
    client.municipio,
    client.provincia,
  ]
    .filter(Boolean)
    .join(", ");
  const lastActivity = summary.activity[0] ?? null;
  const profileEditHref = `/gestion?tipo=cliente&id=${client.id}&returnTo=${encodeURIComponent(`/clientes/${client.id}`)}`;

  return (
    <div className="client-360-ref">
      <header className="client-360-ref__header">
        <div className="client-360-ref__heading">
          <Link href={hrefs.back} className="client-360-ref__back">
            <ChevronLeft size={14} aria-hidden="true" /> Clientes
          </Link>
          <div className="client-360-ref__title-row">
            <h1>{displayName} · Cliente 360</h1>
            <StatusPill status={client.archivadoAt ? "archivado" : client.estado} />
          </div>
          <dl className="client-360-ref__meta" aria-label={`Datos principales de ${displayName}`}>
            <Fact label="Cliente desde" value={formatDate(client.fechaCreacion)} />
            {summary.listItem.fiscalId ? (
              <Fact label="Identificación" value={summary.listItem.fiscalId} />
            ) : null}
            <Fact label="Segmento" value={summary.listItem.typeLabel} />
            <Fact
              label="Responsable"
              value={summary.listItem.responsible ?? "Sin responsable asignado"}
            />
          </dl>
        </div>
        <nav className="client-360-ref__header-actions" aria-label={`Acciones de ${displayName}`}>
          {hrefs.newOpportunity ? (
            <Link href={hrefs.newOpportunity} className="secondary-button">
              <Plus size={15} aria-hidden="true" />
              {hrefs.newOpportunityLabel ?? "Nueva acción"}
            </Link>
          ) : null}
          {moreActions}
        </nav>
      </header>

      <nav className="client-360-ref__tabs" aria-label="Secciones de Cliente 360">
        {SUMMARY_PRIMARY_VIEWS.map((view) => {
          const Icon = viewIcons[view];
          return (
            <Link
              key={view}
              href={`/clientes/${client.id}?vista=${view}`}
              aria-current={view === "resumen" ? "page" : undefined}
            >
              <Icon size={15} aria-hidden="true" />
              {viewLabels[view]}
            </Link>
          );
        })}
        <details className="client-360-ref__more-tabs">
          <summary>Más</summary>
          <div>
            {SUMMARY_MORE_VIEWS.map((view) => {
              const Icon = viewIcons[view];
              return (
                <Link key={view} href={`/clientes/${client.id}?vista=${view}`}>
                  <Icon size={15} aria-hidden="true" />
                  {viewLabels[view]}
                </Link>
              );
            })}
          </div>
        </details>
      </nav>

      <div className="client-360-ref__overview">
        <section className="client-360-ref__profile" aria-labelledby="client-360-reference-profile">
          <div className="client-360-ref__profile-title">
            <span aria-hidden="true">{initials(displayName)}</span>
            <div>
              <div className="client-360-ref__profile-name">
                <h2 id="client-360-reference-profile">{displayName}</h2>
                <StatusPill status={client.archivadoAt ? "archivado" : client.estado} />
              </div>
              <p>{summary.listItem.typeLabel}</p>
            </div>
          </div>
          <dl className="client-360-ref__contact-list">
            <Fact
              label="Contacto principal"
              value={primaryContact?.name ?? summary.listItem.primaryContact}
            />
            {primaryContact?.role ? <Fact label="Cargo" value={primaryContact.role} /> : null}
            {primaryContact?.email ? <Fact label="Correo" value={primaryContact.email} /> : null}
            {primaryContact?.phone ? <Fact label="Teléfono" value={primaryContact.phone} /> : null}
            {address ? <Fact label="Dirección" value={address} /> : null}
          </dl>
          <Link href={profileEditHref} className="secondary-button mt-auto w-full">
            Editar cliente
          </Link>
        </section>

        <div className="client-360-ref__operating-area">
          <section className="client-360-ref__kpis" aria-label="Indicadores del cliente">
            <ReferenceKpi
              label="Trabajos activos"
              value={String(summary.kpis.activeWorks)}
              detail={`${summary.kpis.totalWorks} trabajos registrados`}
            />
            <ReferenceKpi
              label="Presupuestos abiertos"
              value={String(summary.pendingBudgets.length)}
              detail={formatCurrency(summary.kpis.budgetedTotal)}
            />
            <ReferenceKpi
              label="Facturas pendientes"
              value={String(summary.pendingInvoices.length)}
              detail={formatCurrency(summary.kpis.pendingTotal)}
            />
            <ReferenceKpi
              label="Facturado total"
              value={formatCurrency(summary.kpis.billedTotal)}
              detail={summary.kpis.overdueInvoices ? `${summary.kpis.overdueInvoices} vencidas` : "Sin vencimientos"}
              wide
            />
            <ReferenceKpi
              label="Última actividad"
              value={lastActivity ? formatDate(lastActivity.date) : "Sin actividad"}
              detail={lastActivity?.text ?? "No hay actividad registrada"}
              wide
            />
          </section>

          <div className="client-360-ref__middle-grid">
            <ReferenceCollection title="Trabajos activos" href={hrefs.works} empty="Sin trabajos activos.">
              {summary.activeWorks.slice(0, 3).map((work) => (
                <CompactLink
                  key={work.id}
                  href={`/obras/${work.id}`}
                  title={work.titulo}
                  meta={`${statusLabel(work.estado)}${work.presupuestoAprobado != null ? ` · ${formatCurrency(work.presupuestoAprobado)}` : ""}`}
                />
              ))}
            </ReferenceCollection>

            <ReferenceCollection title="Actividad reciente" href={hrefs.activity} empty="Sin actividad reciente.">
              {summary.activity.slice(0, 4).map((event) => (
                <CompactLink
                  key={event.id}
                  href={event.href}
                  title={event.text}
                  meta={`${event.type} · ${formatDate(event.date)}`}
                />
              ))}
            </ReferenceCollection>

            <ReferenceCollection title="Presupuestos" href={hrefs.budgets} empty="Sin presupuestos.">
              {summary.recentBudgets.slice(0, 3).map((budget) => (
                <CompactLink
                  key={budget.id}
                  href={`/presupuestos/${budget.id}`}
                  title={`${budget.numero} · ${budget.titulo}`}
                  meta={`${statusLabel(budget.estado)} · ${formatCurrency(budget.total)}`}
                />
              ))}
            </ReferenceCollection>
          </div>
        </div>
      </div>

      <div className="client-360-ref__bottom-grid">
        <ReferenceCollection title="Facturas" href={hrefs.invoices} empty="Sin facturas.">
          {summary.client.invoices.slice(0, 3).map((invoice) => (
            <CompactLink
              key={invoice.id}
              href={`/dinero/${invoice.id}`}
              title={`${invoice.numero} · ${invoice.concepto}`}
              meta={`${statusLabel(invoice.estado)} · ${formatCurrency(invoice.total)}`}
            />
          ))}
        </ReferenceCollection>

        <ReferenceCollection title="Documentos recientes" href={hrefs.documents} empty="Sin documentos.">
          {summary.documents.slice(0, 4).map((document) => (
            <CompactLink
              key={document.id}
              href={document.href ?? undefined}
              title={document.name}
              meta={`${document.type} · ${formatDate(document.date)}`}
            />
          ))}
        </ReferenceCollection>

        <section className="client-360-ref__financial" aria-labelledby="client-360-reference-financial">
          <header>
            <span><WalletCards size={17} aria-hidden="true" /></span>
            <h2 id="client-360-reference-financial">Información financiera</h2>
          </header>
          <p>Resumen actual</p>
          <dl>
            <Metric label="Facturado" value={formatCurrency(summary.kpis.billedTotal)} />
            <Metric
              label="Pendiente"
              value={formatCurrency(summary.kpis.pendingTotal)}
              danger={summary.kpis.pendingTotal > 0}
            />
            <Metric label="Cobrado" value={formatCurrency(summary.kpis.paidTotal)} />
          </dl>
          <Link href={hrefs.payments} className="secondary-button mt-auto w-full">
            Ver detalle financiero
          </Link>
        </section>
      </div>
    </div>
  );
}

function ReferenceKpi({
  label,
  value,
  detail,
  wide = false,
}: {
  label: string;
  value: string;
  detail: string;
  wide?: boolean;
}) {
  return (
    <article className={wide ? "client-360-ref__kpi client-360-ref__kpi--wide" : "client-360-ref__kpi"}>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ReferenceCollection({
  title,
  href,
  empty,
  children,
}: {
  title: string;
  href: string;
  empty: string;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="client-360-ref__collection">
      <header>
        <span><FileText size={16} aria-hidden="true" /></span>
        <h2>{title}</h2>
      </header>
      <div>{hasChildren ? children : <EmptyText>{empty}</EmptyText>}</div>
      <Link href={href} className="secondary-button mt-auto w-full">
        Ver todos
      </Link>
    </section>
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ClientRecommendationRail({
  clientName,
  activeView,
  recommendation,
  insights,
  allRecommendationsHref,
}: {
  clientName: string;
  activeView: Client360CanonicalView;
  recommendation: Client360Recommendation | null;
  insights: Client360Insight[];
  allRecommendationsHref: string;
}) {
  const contextualRecommendation =
    recommendation && recommendationMatchesView(recommendation, activeView)
      ? recommendation
      : null;
  const emptyCopy = railEmptyCopy[activeView];

  return (
    <div
      id="client-360-ai-context"
      className="flex flex-col p-5"
      role="region"
      aria-label={`Recomendaciones de Orqena IA para ${clientName}`}
    >
      <p className="type-label">
        {activeView === "resumen" ? "Resumen inteligente" : `${viewLabels[activeView]} · ${clientName}`}
      </p>
      {contextualRecommendation ? (
        <section className="mt-5 flex flex-1 flex-col rounded-xl border border-brand/30 bg-surface p-4 shadow-soft">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <Sparkles size={20} aria-hidden="true" />
          </span>
          <h2 className="mt-5 font-semibold text-content">{contextualRecommendation.title}</h2>
          <p className="mt-4 text-sm leading-6 text-content-secondary">
            {contextualRecommendation.description}
          </p>
          {activeView === "resumen" && insights.length ? (
            <div className="client-360-ref__rail-suggestions">
              <h3>Sugerencias para hoy</h3>
              <ul>
                {insights.slice(0, 3).map((insight) => (
                  <li key={insight.id}>
                    <span><Sparkles size={14} aria-hidden="true" /></span>
                    <div>
                      {insight.href ? <Link href={insight.href}>{insight.title}</Link> : <strong>{insight.title}</strong>}
                      <p>{insight.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {contextualRecommendation.sourceLabel ? (
            <p className="mt-3 text-xs font-semibold text-content-tertiary">
              Origen: {contextualRecommendation.sourceLabel}
            </p>
          ) : null}
          {contextualRecommendation.impact?.length ? (
            <dl className="mt-5 grid gap-3 rounded-xl bg-brand-soft p-4">
              {contextualRecommendation.impact.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3 text-sm">
                  <dt className="text-content-secondary">{item.label}</dt>
                  <dd className="text-right font-semibold text-brand-strong">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-auto grid gap-2 pt-6">
            <Link href={contextualRecommendation.primaryAction.href} className="primary-button w-full">
              {contextualRecommendation.primaryAction.label}
            </Link>
            {contextualRecommendation.analysisHref ? (
              <Link href={contextualRecommendation.analysisHref} className="secondary-button w-full">
                Ver análisis completo
              </Link>
            ) : null}
            {contextualRecommendation.dismissControl}
          </div>
        </section>
      ) : (
        <section className="mt-5 rounded-xl border border-border bg-subtle p-4">
          <h2 className="font-semibold text-content">{emptyCopy.title}</h2>
          <p className="mt-2 text-sm leading-6 text-content-secondary">
            {emptyCopy.description}
          </p>
        </section>
      )}
      <Link
        href={allRecommendationsHref}
        className="mt-auto inline-flex min-h-11 items-center gap-2 pt-6 text-sm font-semibold text-brand-strong hover:underline"
      >
        Ver más recomendaciones en Orqena IA
        <ArrowUpRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}

function CompactLink({
  href,
  title,
  meta,
}: {
  href?: string;
  title: string;
  meta: string;
}) {
  const content = (
    <>
      <span className="block truncate font-semibold text-content">{title}</span>
      <span className="mt-0.5 block truncate text-xs text-content-secondary">{meta}</span>
    </>
  );
  return href ? (
    <Link href={href} className="block min-w-0 py-3 hover:bg-subtle">
      {content}
    </Link>
  ) : (
    <div className="block min-w-0 py-3">{content}</div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="type-label">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-content">{value}</dd>
    </div>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-content-secondary">{label}</dt>
      <dd className={`font-semibold tabular-nums ${danger ? "text-danger" : "text-content"}`}>
        {value}
      </dd>
    </div>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="py-3 text-sm text-content-secondary">{children}</p>;
}
