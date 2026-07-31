import Link from "next/link";
import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Clock3,
  Euro,
  FileCheck2,
  FileText,
  Folder,
  UsersRound,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ProductPage } from "@/components/ui-primitives";
import { requireCapability } from "@/lib/commercial/authorization";
import { getTodayOverview, type TodayOverview, type TodayPriority } from "@/lib/portal/today-overview";

export const dynamic = "force-dynamic";

const priorityIcons: Record<TodayPriority["kind"], LucideIcon> = {
  budget: FileText,
  invoice: Euro,
  agenda: CalendarDays,
  document: Folder,
  followup: UserRound,
};

const activityIcons = {
  budget: FileText,
  invoice: Euro,
  agenda: CalendarDays,
  document: FileCheck2,
  client: UserRound,
  generic: CircleCheck,
} satisfies Record<string, LucideIcon>;

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ __orqena_review_state?: string }>;
}) {
  const query = await searchParams;
  if (isContinuousReviewStateProbe()) {
    if (query.__orqena_review_state === "loading") await new Promise((resolve) => setTimeout(resolve, 1_500));
    if (query.__orqena_review_state === "error") throw new Error("CONTINUOUS_REVIEW_SYNTHETIC_RENDER_ERROR");
  }

  const auth = await requireCapability("company.view");
  const overview = await getTodayOverview(auth);
  const prioritySlots = buildPrioritySlots(overview.priorities, auth.displayName, overview.access);

  return (
    <ProductPage layout="operational" className="hoy-page">
      <header className="hoy-header">
        <h1>Hoy</h1>
        <p>Tus prioridades y lo que necesita tu atención hoy.</p>
      </header>

      <section className="hoy-priorities" aria-labelledby="hoy-priorities-title">
        <div className="hoy-section-heading">
          <div className="flex items-center gap-2">
            <h2 id="hoy-priorities-title">Prioridades del día</h2>
            <span className="hoy-count-badge">{overview.priorities.length}</span>
          </div>
          {overview.access.recommendations ? <Link href="/recomendaciones">Ver todas ({overview.totalPriorities}) <span aria-hidden="true">›</span></Link> : null}
        </div>

        {prioritySlots.length ? (
          <ol className="hoy-priority-grid">
            {prioritySlots.map((priority, index) => {
              const Icon = priorityIcons[priority.kind];
              return (
                <li key={priority.id} className="hoy-priority-card" data-empty={priority.empty ? "true" : "false"}>
                  <div className="hoy-priority-card__top">
                    <span className="hoy-priority-card__icon" data-tone={priority.tone}><Icon size={19} aria-hidden="true" /></span>
                    <span className="hoy-priority-status" data-tone={priority.tone}>{priority.status}</span>
                  </div>
                  <h3>{priority.title}</h3>
                  <p className="hoy-priority-source"><span>Fuente</span>{priority.source}</p>
                  <dl>
                    <div><dt><Clock3 size={13} aria-hidden="true" />Vence</dt><dd>{priority.due}</dd></div>
                    <div><dt>Responsable</dt><dd className="hoy-priority-owner"><span aria-hidden="true">{priority.owner.trim().charAt(0).toUpperCase()}</span>{priority.owner}</dd></div>
                  </dl>
                  <Link href={priority.href} className="hoy-card-action" data-primary={index === 0 && !priority.empty ? "true" : "false"}>{priority.action}</Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="hoy-empty-state">
            <CircleAlert size={20} aria-hidden="true" />
            <div><strong>Sin prioridades dentro de tu alcance</strong><p>La vista se actualizará cuando haya elementos con fecha, revisión o seguimiento pendiente.</p></div>
          </div>
        )}
      </section>

      <div className="hoy-operational-grid">
        {overview.access.agenda ? <TodayPanel title="Agenda de hoy" href="/agenda?vista=hoy" linkLabel="Ver agenda">
          {overview.agenda.length ? <ul className="hoy-agenda-list">{overview.agenda.map((item) => (
            <li key={item.id}>
              <Link href={item.href}>
                <time>{item.time}<span className="hoy-agenda-dot" data-tone={item.tone} aria-hidden="true" /></time>
                <span><strong>{item.title}</strong><small>{item.context}</small></span>
              </Link>
            </li>
          ))}</ul> : <PanelEmpty label="No hay citas para hoy." />}
          <Link href="/agenda?vista=hoy" className="hoy-panel-footer-link">Ir a mi agenda</Link>
        </TodayPanel> : null}

        {overview.access.activity ? <TodayPanel title="Actividad reciente" href="/auditoria" linkLabel="Ver todo">
          {overview.activity.length ? <ul className="hoy-activity-list">{overview.activity.map((item) => (
            <li key={item.id}>
              <Link href={item.href}>
                <span className="hoy-activity-icon" data-tone={item.kind} aria-hidden="true">{renderActivityIcon(item.kind)}</span>
                <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                <time>{item.time}</time>
              </Link>
            </li>
          ))}</ul> : <PanelEmpty label="Aún no hay actividad visible." />}
        </TodayPanel> : null}

        {overview.access.work ? <TodayPanel title="Trabajo en curso" href="/obras" linkLabel="Ver todo">
          {overview.works.length ? <ul className="hoy-work-list">{overview.works.map((item) => (
            <li key={item.id}>
              <Link href={item.href}>
                <div><strong>{item.title}</strong><span>{item.progress === null ? item.progressLabel : `${item.progressLabel} · ${item.progress}%`}</span></div>
                <span className="hoy-work-status" data-status={item.status}>{item.status}</span>
              </Link>
            </li>
          ))}</ul> : <PanelEmpty label="No hay trabajos activos dentro de tu alcance." />}
        </TodayPanel> : null}
      </div>

      <div className="hoy-bottom-grid">
        {overview.access.invoice || overview.access.payments ? <section className="hoy-panel hoy-money-panel" data-columns={overview.access.invoice && overview.access.payments ? "2" : "1"} aria-label="Próximos cobros y pagos">
          {overview.access.invoice ? <MoneyColumn title="Próximos cobros" href="/dinero?vista=cobros" rows={overview.collections} empty="Sin cobros próximos." /> : null}
          {overview.access.payments ? <MoneyColumn title="Próximos pagos" href="/gastos-materiales" rows={overview.payments} empty="Sin pagos próximos." /> : null}
        </section> : null}

        <section className="hoy-panel hoy-summary-panel" aria-labelledby="hoy-summary-title">
          <div className="hoy-panel__heading"><h2 id="hoy-summary-title">Resumen del día</h2><span>Actualizado {overview.summary.updatedAt}</span></div>
          <dl>
            <div><dt><FileText size={14} aria-hidden="true" />{overview.priorities.length} prioridades</dt><dd data-tone="danger">{overview.summary.urgentPriorities} urgentes</dd></div>
            <div><dt><CalendarDays size={14} aria-hidden="true" />{overview.summary.visits} visitas técnicas</dt><dd data-tone="success">{overview.summary.completedVisits} completadas</dd></div>
            <div><dt><FileCheck2 size={14} aria-hidden="true" />{overview.summary.pendingDocuments} documentos pendientes</dt><dd data-tone="warning">{overview.summary.documentsToConfirm} por confirmar</dd></div>
            <div><dt><UsersRound size={14} aria-hidden="true" />{overview.summary.followups} seguimientos comerciales</dt><dd data-tone="success">{overview.summary.followupsDueToday ? `${overview.summary.followupsDueToday} ${overview.summary.followupsDueToday === 1 ? "contacto" : "contactos"} hoy` : "Al día"}</dd></div>
          </dl>
        </section>
      </div>
    </ProductPage>
  );
}

function TodayPanel({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return <section className="hoy-panel"><div className="hoy-panel__heading"><h2>{title}</h2><Link href={href}>{linkLabel}</Link></div>{children}</section>;
}

function MoneyColumn({ title, href, rows, empty }: { title: string; href: string; rows: Array<{ id: string; reference: string; label: string; context: string; amount: number; due: string; dueAt: Date | null; dueDay: string; dueMonth: string; tone: "urgent" | "soon" | "neutral"; href: string }>; empty: string }) {
  return <div className="hoy-money-column"><div className="hoy-money-column__heading"><h2>{title}</h2><Link href={href}>Ver todos</Link></div>{rows.length ? <ul>{rows.map((row) => <li key={row.id}><Link href={row.href}><DateTile date={row.dueAt} day={row.dueDay} month={row.dueMonth} /><span><strong>{row.reference}</strong><small>{row.context}</small></span><span className="hoy-money-amount"><b>{formatCurrency(row.amount)}</b><small data-tone={row.tone}>{row.due}</small></span></Link></li>)}</ul> : <PanelEmpty label={empty} />}</div>;
}

function DateTile({ date, day, month }: { date: Date | null; day: string; month: string }) {
  if (!date) return <span className="hoy-date-tile"><b>—</b><small>—</small></span>;
  return <time className="hoy-date-tile" dateTime={date.toISOString()}><b>{day}</b><small>{month}</small></time>;
}

function PanelEmpty({ label }: { label: string }) {
  return <p className="hoy-panel-empty">{label}</p>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function renderActivityIcon(kind: keyof typeof activityIcons) {
  const Icon = activityIcons[kind];
  return <Icon size={15} />;
}

type PriorityDisplay = TodayPriority & { empty?: boolean };

function buildPrioritySlots(priorities: TodayPriority[], owner: string, access: TodayOverviewAccess): PriorityDisplay[] {
  const byKind = new Map(priorities.map((priority) => [priority.kind, priority]));
  const empty: Record<TodayPriority["kind"], PriorityDisplay> = {
    budget: emptyPriority("budget", "Sin presupuestos pendientes", "Presupuestos revisados", "Ver presupuestos", "/presupuestos", owner),
    invoice: emptyPriority("invoice", "Sin facturas próximas", "No hay vencimientos en tu alcance", "Ver facturas", "/dinero", owner),
    agenda: emptyPriority("agenda", "Agenda sin urgencias", "No hay visitas prioritarias", "Ver agenda", "/agenda", owner),
    document: emptyPriority("document", "Sin documentos pendientes", "Documentación revisada", "Ver documentos", "/documentos", owner),
    followup: emptyPriority("followup", "Sin seguimientos vencidos", "La cartera está al día", "Ver clientes", "/clientes", owner),
  };
  return (["budget", "invoice", "agenda", "document", "followup"] as const)
    .filter((kind) => access[kind])
    .map((kind) => byKind.get(kind) ?? empty[kind]);
}

type TodayOverviewAccess = TodayOverview["access"];

function emptyPriority(kind: TodayPriority["kind"], title: string, source: string, action: string, href: string, owner: string): PriorityDisplay {
  const tone = kind === "invoice" ? "urgent" : kind === "document" ? "pending" : kind === "agenda" ? "agenda" : kind === "followup" ? "followup" : "review";
  return { id: `empty-${kind}`, kind, title, status: "Al día", tone, source, due: "Sin vencimientos", owner, href, action, empty: true };
}

function isContinuousReviewStateProbe() {
  return process.env.NEXT_PUBLIC_APP_ENV === "preview" && process.env.CREDENTIAL_SCOPE === "preview";
}
