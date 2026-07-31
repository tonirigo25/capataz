import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileText,
  MessageSquareText,
  ReceiptText,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ProductPage } from "@/components/ui-primitives";
import { requireCapability } from "@/lib/commercial/authorization";
import { getTodayOverview, type TodayPriority } from "@/lib/portal/today-overview";

export const dynamic = "force-dynamic";

const priorityIcons: Record<TodayPriority["kind"], LucideIcon> = {
  budget: FileText,
  invoice: ReceiptText,
  agenda: CalendarDays,
  document: FileCheck2,
  followup: MessageSquareText,
};

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

  return (
    <ProductPage layout="operational" className="hoy-page">
      <header className="hoy-header">
        <h1>Hoy</h1>
        <p>Tu actividad prioritaria, agenda y próximos vencimientos en una sola vista.</p>
      </header>

      <section className="hoy-priorities" aria-labelledby="hoy-priorities-title">
        <div className="hoy-section-heading">
          <div className="flex items-center gap-2">
            <h2 id="hoy-priorities-title">Prioridades del día</h2>
            <span className="hoy-count-badge">{overview.priorities.length}</span>
          </div>
          <Link href="/recomendaciones">Ver todas ({overview.priorities.length})</Link>
        </div>

        {overview.priorities.length ? (
          <ol className="hoy-priority-grid">
            {overview.priorities.map((priority) => {
              const Icon = priorityIcons[priority.kind];
              return (
                <li key={priority.id} className="hoy-priority-card">
                  <div className="hoy-priority-card__top">
                    <span className="hoy-priority-card__icon"><Icon size={19} aria-hidden="true" /></span>
                    <span className="hoy-priority-status" data-tone={priority.tone}>{priority.status}</span>
                  </div>
                  <h3>{priority.title}</h3>
                  <p className="hoy-priority-source">{priority.source}</p>
                  <dl>
                    <div><dt><Clock3 size={13} aria-hidden="true" />Vence</dt><dd>{priority.due}</dd></div>
                    <div><dt><UserRound size={13} aria-hidden="true" />Responsable</dt><dd>{priority.owner}</dd></div>
                  </dl>
                  <Link href={priority.href} className="hoy-card-action">{priority.action}<ArrowUpRight size={14} aria-hidden="true" /></Link>
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
        <TodayPanel title="Agenda de hoy" href="/agenda?vista=hoy" linkLabel="Ver agenda">
          {overview.agenda.length ? <ul className="hoy-agenda-list">{overview.agenda.map((item) => (
            <li key={item.id}>
              <Link href={item.href}>
                <time>{item.time}</time>
                <span><strong>{item.title}</strong><small>{item.context}</small></span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </li>
          ))}</ul> : <PanelEmpty label="No hay citas para hoy." />}
          <Link href="/agenda?vista=hoy" className="hoy-panel-footer-link">Ir a mi agenda</Link>
        </TodayPanel>

        <TodayPanel title="Actividad reciente" href="/auditoria" linkLabel="Ver todo">
          {overview.activity.length ? <ul className="hoy-activity-list">{overview.activity.map((item) => (
            <li key={item.id}>
              <Link href={item.href}>
                <span className="hoy-activity-dot" aria-hidden="true" />
                <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                <time>{item.time}</time>
              </Link>
            </li>
          ))}</ul> : <PanelEmpty label="Aún no hay actividad visible." />}
        </TodayPanel>

        <TodayPanel title="Trabajo en curso" href="/obras" linkLabel="Ver todo">
          {overview.works.length ? <ul className="hoy-work-list">{overview.works.map((item) => (
            <li key={item.id}>
              <Link href={item.href}>
                <div><strong>{item.title}</strong><span>{item.status}</span></div>
                {item.progress === null ? <small>Sin tareas medibles</small> : <>
                  <div className="hoy-progress" role="progressbar" aria-label={`Progreso de ${item.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress}><span style={{ width: `${item.progress}%` }} /></div>
                  <small>{item.progress}%</small>
                </>}
              </Link>
            </li>
          ))}</ul> : <PanelEmpty label="No hay trabajos activos dentro de tu alcance." />}
        </TodayPanel>
      </div>

      <div className="hoy-bottom-grid">
        <section className="hoy-panel hoy-money-panel" aria-label="Próximos cobros y pagos">
          <MoneyColumn title="Próximos cobros" icon={Banknote} rows={overview.collections} empty="Sin cobros próximos." />
          <MoneyColumn title="Próximos pagos" icon={ReceiptText} rows={overview.payments} empty="Sin pagos próximos." />
        </section>

        <section className="hoy-panel hoy-summary-panel" aria-labelledby="hoy-summary-title">
          <div className="hoy-panel__heading"><h2 id="hoy-summary-title">Resumen del día</h2><span>Actualizado {formatTime(overview.summary.updatedAt)}</span></div>
          <dl>
            <div><dt>Prioridades</dt><dd>{overview.priorities.length}<small>{overview.summary.urgentPriorities} urgentes</small></dd></div>
            <div><dt>Visitas técnicas</dt><dd>{overview.summary.visits}<small>{overview.summary.completedVisits} completadas</small></dd></div>
            <div><dt>Documentos</dt><dd>{overview.summary.pendingDocuments}<small>pendientes de revisión</small></dd></div>
            <div><dt>Seguimientos</dt><dd>{overview.summary.followups}<small>activos</small></dd></div>
          </dl>
        </section>
      </div>
    </ProductPage>
  );
}

function TodayPanel({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return <section className="hoy-panel"><div className="hoy-panel__heading"><h2>{title}</h2><Link href={href}>{linkLabel}</Link></div>{children}</section>;
}

function MoneyColumn({ title, icon: Icon, rows, empty }: { title: string; icon: LucideIcon; rows: Array<{ id: string; label: string; amount: number; due: string; href: string }>; empty: string }) {
  return <div className="hoy-money-column"><div className="hoy-money-column__heading"><span><Icon size={16} aria-hidden="true" /></span><h2>{title}</h2></div>{rows.length ? <ul>{rows.map((row) => <li key={row.id}><Link href={row.href}><span><strong>{row.label}</strong><small>{row.due}</small></span><b>{formatCurrency(row.amount)}</b></Link></li>)}</ul> : <PanelEmpty label={empty} />}</div>;
}

function PanelEmpty({ label }: { label: string }) {
  return <p className="hoy-panel-empty">{label}</p>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(value);
}

function isContinuousReviewStateProbe() {
  return process.env.NEXT_PUBLIC_APP_ENV === "preview" && process.env.CREDENTIAL_SCOPE === "preview";
}
