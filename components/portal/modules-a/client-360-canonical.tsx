import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  FileText,
  FolderOpen,
  Lightbulb,
  MessageCircle,
  Phone,
  Plus,
  Sparkles,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { ClientCrmSummary } from "@/lib/client-crm";
import { formatCurrency, formatDate } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import { StatusPill } from "@/components/status-pill";
import { Client360RailShell } from "@/components/portal/modules-a/client-360-rail-shell";

type ClientSummary = NonNullable<ClientCrmSummary>;

export const CLIENT_360_CANONICAL_VIEWS = [
  "resumen",
  "relacion",
  "operacion",
  "dinero",
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
  relacion: "Relación",
  operacion: "Operación",
  dinero: "Dinero",
  archivos: "Archivos",
};

const viewIcons: Record<Client360CanonicalView, typeof UserRound> = {
  resumen: UserRound,
  relacion: UsersRound,
  operacion: BriefcaseBusiness,
  dinero: CircleDollarSign,
  archivos: FolderOpen,
};

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
  nextAction,
  insights = [],
  incidents = [],
  recommendation,
  hrefs,
  showAiRail = true,
}: Client360CanonicalProps) {
  const client = summary.client;
  const displayName = summary.listItem.displayName;
  const returnTo = `/clientes/${client.id}`;
  const scopedRecommendation =
    recommendation?.clientId === client.id ? recommendation : null;
  const activeContacts = summary.contacts.filter((contact) => !contact.archivedAt);
  const primaryContact = activeContacts[0] ?? null;

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
                  <MessageCircle size={16} aria-hidden="true" /> Enviar mensaje
                </Link>
              ) : null}
              {hrefs.call ? (
                <Link href={hrefs.call} className="secondary-button w-full">
                  <Phone size={16} aria-hidden="true" /> Llamar
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

        {activeView === "resumen" ? <>
        <div className="client-360-canonical__primary grid gap-4 xl:grid-cols-[0.95fr_1fr_1fr]">
          <Panel title="Próxima acción" icon={CalendarCheck2}>
            {nextAction ? (
              <div className="flex h-full flex-col">
                <h3 className="font-semibold text-content">{nextAction.title}</h3>
                {nextAction.description ? (
                  <p className="mt-1 text-sm text-content-secondary">
                    {nextAction.description}
                  </p>
                ) : null}
                <dl className="mt-4 grid gap-2 text-sm">
                  {nextAction.dateLabel ? (
                    <Fact label="Fecha" value={nextAction.dateLabel} />
                  ) : null}
                  {nextAction.contactLabel ? (
                    <Fact label="Con" value={nextAction.contactLabel} />
                  ) : null}
                </dl>
                {nextAction.completeHref ? (
                  <Link
                    href={nextAction.completeHref}
                    className="primary-button mt-auto w-full pt-3"
                  >
                    <CheckCircle2 size={16} aria-hidden="true" /> {nextAction.actionLabel ?? "Revisar y completar"}
                  </Link>
                ) : null}
              </div>
            ) : (
              <EmptyText>No hay una próxima acción registrada.</EmptyText>
            )}
          </Panel>

          <Panel title="Resumen económico" icon={WalletCards} href={hrefs.payments}>
            <dl className="grid gap-3 text-sm">
              <Metric label="Facturado" value={formatCurrency(summary.kpis.billedTotal)} />
              <Metric label="Cobrado" value={formatCurrency(summary.kpis.paidTotal)} />
              <Metric
                label="Pendiente de cobro"
                value={formatCurrency(summary.kpis.pendingTotal)}
                danger={summary.kpis.pendingTotal > 0}
              />
              <Metric
                label="Facturas vencidas"
                value={String(summary.kpis.overdueInvoices)}
                danger={summary.kpis.overdueInvoices > 0}
              />
            </dl>
          </Panel>

          <Panel title="Insights clave" icon={Lightbulb}>
            {insights.length ? (
              <ul className="grid gap-3">
                {insights.map((insight) => (
                  <li key={insight.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                      <Sparkles size={15} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      {insight.href ? (
                        <Link href={insight.href} className="text-[11px] font-semibold leading-tight text-content hover:underline">
                          {insight.title}
                        </Link>
                      ) : (
                        <p className="text-[11px] font-semibold leading-tight text-content">{insight.title}</p>
                      )}
                      <p className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-content-secondary">{insight.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyText>No hay insights documentados para este cliente.</EmptyText>
            )}
          </Panel>
        </div>

        <div className="client-360-canonical__collections client-360-canonical__collections--primary grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <CollectionPanel title="Actividad reciente" href={hrefs.activity} empty="Sin actividad reciente.">
            {summary.activity.slice(0, 5).map((event) => (
              <CompactLink
                key={event.id}
                href={event.href}
                title={event.text}
                meta={`${event.type} · ${formatDate(event.date)}`}
              />
            ))}
          </CollectionPanel>

          <CollectionPanel title="Presupuestos" href={hrefs.budgets} empty="Sin presupuestos.">
            {summary.recentBudgets.slice(0, 3).map((budget) => (
              <CompactLink
                key={budget.id}
                href={`/presupuestos/${budget.id}`}
                title={budget.numero}
                meta={`${statusLabel(budget.estado)} · ${formatCurrency(budget.total)}`}
              />
            ))}
          </CollectionPanel>

          <CollectionPanel title="Trabajos" href={hrefs.works} empty="Sin trabajos.">
            {summary.client.works.slice(0, 3).map((work) => (
              <CompactLink
                key={work.id}
                href={`/obras/${work.id}`}
                title={work.titulo}
                meta={statusLabel(work.estado)}
              />
            ))}
          </CollectionPanel>

          <CollectionPanel title="Facturas" href={hrefs.invoices} empty="Sin facturas.">
            {summary.client.invoices.slice(0, 3).map((invoice) => (
              <CompactLink
                key={invoice.id}
                href={`/dinero/${invoice.id}`}
                title={invoice.numero}
                meta={`${statusLabel(invoice.estado)} · ${formatCurrency(invoice.total)}`}
              />
            ))}
          </CollectionPanel>
        </div>

        <div className="client-360-canonical__collections client-360-canonical__collections--secondary grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <CollectionPanel title="Cobros" href={hrefs.payments} empty="Sin cobros.">
            {summary.payments.slice(0, 3).map((payment) => (
              <CompactLink
                key={payment.id}
                href={`/dinero/${payment.invoice.id}`}
                title={payment.invoice.numero}
                meta={`${formatCurrency(payment.importe)} · ${formatDate(payment.fecha)}`}
              />
            ))}
          </CollectionPanel>

          <CollectionPanel title="Incidencias" empty="Sin incidencias vinculadas.">
            {incidents.slice(0, 3).map((incident) => (
              <CompactLink
                key={incident.id}
                href={incident.href}
                title={incident.title}
                meta={incident.status ? `${statusLabel(incident.status)} · ${incident.detail}` : incident.detail}
              />
            ))}
          </CollectionPanel>

          <CollectionPanel title="Contactos clave" href={hrefs.contacts} empty="Sin contactos.">
            {activeContacts.slice(0, 3).map((contact) => (
              <CompactLink
                key={contact.id}
                href={
                  contact.source === "real"
                    ? `/gestion?tipo=contacto&id=${contact.id}&clientId=${client.id}&returnTo=${encodeURIComponent(returnTo)}`
                    : undefined
                }
                title={contact.name}
                meta={contact.role}
              />
            ))}
          </CollectionPanel>

          <CollectionPanel title="Documentos recientes" href={hrefs.documents} empty="Sin documentos.">
            {summary.documents.slice(0, 3).map((document) => (
              <CompactLink
                key={document.id}
                href={document.href ?? undefined}
                title={document.name}
                meta={`${document.type} · ${formatDate(document.date)}`}
              />
            ))}
          </CollectionPanel>
        </div>
        </> : <div className="client-360-canonical__tab-content min-w-0">{children}</div>}
      </div>

      {showAiRail ? (
        <Client360RailShell>
          <ClientRecommendationRail
            clientName={displayName}
            recommendation={scopedRecommendation}
            allRecommendationsHref={hrefs.allRecommendations}
          />
        </Client360RailShell>
      ) : null}
    </div>
  );
}

function ClientRecommendationRail({
  clientName,
  recommendation,
  allRecommendationsHref,
}: {
  clientName: string;
  recommendation: Client360Recommendation | null;
  allRecommendationsHref: string;
}) {
  return (
    <div
      id="client-360-ai-context"
      className="flex flex-col p-5"
      role="region"
      aria-label={`Recomendaciones de Orqena IA para ${clientName}`}
    >
      <p className="type-label">Recomendación para {clientName}</p>
      {recommendation ? (
        <section className="mt-5 flex flex-1 flex-col rounded-xl border border-brand/30 bg-surface p-4 shadow-soft">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <Sparkles size={20} aria-hidden="true" />
          </span>
          <h2 className="mt-5 font-semibold text-content">{recommendation.title}</h2>
          <p className="mt-4 text-sm leading-6 text-content-secondary">
            {recommendation.description}
          </p>
          {recommendation.sourceLabel ? (
            <p className="mt-3 text-xs font-semibold text-content-tertiary">
              Origen: {recommendation.sourceLabel}
            </p>
          ) : null}
          {recommendation.impact?.length ? (
            <dl className="mt-5 grid gap-3 rounded-xl bg-brand-soft p-4">
              {recommendation.impact.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3 text-sm">
                  <dt className="text-content-secondary">{item.label}</dt>
                  <dd className="text-right font-semibold text-brand-strong">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-auto grid gap-2 pt-6">
            <Link href={recommendation.primaryAction.href} className="primary-button w-full">
              {recommendation.primaryAction.label}
            </Link>
            {recommendation.analysisHref ? (
              <Link href={recommendation.analysisHref} className="secondary-button w-full">
                Ver análisis completo
              </Link>
            ) : null}
            {recommendation.dismissControl}
          </div>
        </section>
      ) : (
        <section className="mt-5 rounded-xl border border-border bg-subtle p-4">
          <h2 className="font-semibold text-content">Sin recomendación contextual</h2>
          <p className="mt-2 text-sm leading-6 text-content-secondary">
            No hay una recomendación validada para este cliente. No se muestran señales de otra ficha.
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

function Panel({
  title,
  icon: Icon,
  href,
  children,
}: {
  title: string;
  icon: typeof FileText;
  href?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-soft">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 font-semibold text-content">
          <Icon size={17} aria-hidden="true" />
          {title}
        </h2>
        {href ? (
          <Link href={href} className="text-xs font-semibold text-brand-strong hover:underline">
            Ver detalle
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function CollectionPanel({
  title,
  href,
  empty,
  children,
}: {
  title: string;
  href?: string;
  empty: string;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-soft">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-content">{title}</h2>
        {href ? (
          <Link href={href} className="text-xs font-semibold text-brand-strong hover:underline">
            Ver todos
          </Link>
        ) : null}
      </header>
      <div className="mt-3 divide-y divide-border">
        {hasChildren ? children : <EmptyText>{empty}</EmptyText>}
      </div>
    </section>
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
