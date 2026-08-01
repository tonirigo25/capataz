"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileText,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

export type WorkBillingTone = "neutral" | "info" | "success" | "warning" | "danger";
export type WorkBillingMetricKind = "contracted" | "certified" | "issued" | "pending" | "retained" | "upcoming";

export type WorkBillingMetric = {
  kind: WorkBillingMetricKind;
  value: number | null;
  percent?: number | null;
  detail?: string | null;
  secondaryValue?: number | null;
  secondaryLabel?: string | null;
  secondaryTone?: WorkBillingTone;
};

export type WorkBillingCertification = {
  id: string;
  code?: string | null;
  period?: string | null;
  grossAmount?: number | null;
  retentionAmount?: number | null;
  netAmount?: number | null;
  status?: string | null;
  statusTone?: WorkBillingTone;
  detailHref?: string | null;
};

export type WorkBillingInvoice = {
  id: string;
  number?: string | null;
  certificationCode?: string | null;
  issuedAt?: string | null;
  dueAt?: string | null;
  amount?: number | null;
  status?: string | null;
  statusTone?: WorkBillingTone;
  collectedAmount?: number | null;
  detailHref?: string | null;
};

export type WorkBillingTableTotals = {
  grossAmount?: number | null;
  retentionAmount?: number | null;
  netAmount?: number | null;
  invoiceAmount?: number | null;
  collectedAmount?: number | null;
};

export type WorkBillingTimelineItem = {
  id: string;
  date?: string | null;
  code?: string | null;
  title: string;
  detail?: string | null;
  amount?: number | null;
  status?: string | null;
  statusTone?: WorkBillingTone;
  href?: string | null;
};

export type WorkBillingForecastPoint = {
  id: string;
  label: string;
  expectedAmount?: number | null;
  collectedAmount?: number | null;
};

export type WorkBillingForecastSummary = {
  expectedRemaining?: number | null;
  collectedTotal?: number | null;
  pendingExpected?: number | null;
  nextThirtyDays?: number | null;
};

export type WorkBillingDraftStep = {
  id: string;
  label: string;
  status?: "complete" | "pending" | null;
};

export type WorkBillingDraft = {
  id: string;
  title: string;
  subtitle?: string | null;
  grossAmount?: number | null;
  retentionAmount?: number | null;
  netAmount?: number | null;
  progressPercent?: number | null;
  steps?: WorkBillingDraftStep[];
  editHref?: string | null;
  generateHref?: string | null;
};

export type WorkBillingOverviewProps = {
  workId: string;
  currency?: string;
  metrics: WorkBillingMetric[];
  certifications: WorkBillingCertification[];
  invoices: WorkBillingInvoice[];
  certificationTotals?: WorkBillingTableTotals | null;
  invoiceTotals?: WorkBillingTableTotals | null;
  forecast?: WorkBillingForecastPoint[];
  forecastSummary?: WorkBillingForecastSummary | null;
  timeline?: WorkBillingTimelineItem[];
  draft?: WorkBillingDraft | null;
  certificationsHref?: string | null;
  invoicesHref?: string | null;
  forecastHref?: string | null;
  timelineHref?: string | null;
  className?: string;
};

const metricPresentation: Record<WorkBillingMetricKind, { label: string; icon: typeof CircleDollarSign }> = {
  contracted: { label: "Facturación contratada", icon: CircleDollarSign },
  certified: { label: "Certificado acumulado (neto)", icon: FileCheck2 },
  issued: { label: "Facturas emitidas", icon: ReceiptText },
  pending: { label: "Pendiente de cobro", icon: WalletCards },
  retained: { label: "Retenciones aplicadas", icon: ShieldCheck },
  upcoming: { label: "Próximos cobros", icon: CalendarClock },
};

export function WorkBillingOverview({
  workId,
  currency = "EUR",
  metrics,
  certifications,
  invoices,
  certificationTotals,
  invoiceTotals,
  forecast = [],
  forecastSummary,
  timeline = [],
  draft,
  certificationsHref,
  invoicesHref,
  forecastHref,
  timelineHref,
  className = "",
}: WorkBillingOverviewProps) {
  const money = useMemo(() => new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }), [currency]);

  return (
    <section className={`grid min-w-0 gap-3 ${className}`} aria-labelledby={`work-billing-${workId}`}>
      <header className="sr-only">
        <h2 id={`work-billing-${workId}`}>Resumen de facturación de esta obra</h2>
        <p>Esta vista contiene únicamente certificaciones, facturas, retenciones y cobros vinculados a la obra; no es el historial global del Cliente 360.</p>
      </header>

      {metrics.length ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores de facturación vinculados a esta obra">
          {metrics.map((metric) => <BillingMetricCard key={metric.kind} metric={metric} money={money} />)}
        </div>
      ) : <HonestEmpty icon={CircleDollarSign} title="Sin indicadores de facturación" detail="No se han recibido importes consolidados para esta obra." compact />}

      <div className="grid min-w-0 gap-3 xl:grid-cols-[1.08fr_.92fr]">
        <div className="grid min-w-0 content-start gap-3">
          <BillingPanel title="Certificaciones" href={certificationsHref} hrefLabel="Ver todas">
            {certifications.length ? <><CertificationDesktopTable rows={certifications} totals={certificationTotals} money={money} /><CertificationMobileList rows={certifications} money={money} /></> : <HonestEmpty icon={FileCheck2} title="Sin certificaciones" detail="No hay certificaciones recibidas para esta obra." />}
          </BillingPanel>

          <BillingPanel title="Facturas emitidas" href={invoicesHref} hrefLabel="Ver todas">
            {invoices.length ? <><InvoiceDesktopTable rows={invoices} totals={invoiceTotals} money={money} /><InvoiceMobileList rows={invoices} money={money} /></> : <HonestEmpty icon={ReceiptText} title="Sin facturas de obra" detail="No hay facturas emitidas vinculadas a esta obra." />}
          </BillingPanel>

          <BillingPanel title="Previsión de cobros" href={forecastHref} hrefLabel="Ver detalle">
            {forecast.length ? <BillingForecast points={forecast} summary={forecastSummary} money={money} /> : <HonestEmpty icon={CalendarClock} title="Sin previsión recibida" detail="No se dibuja una previsión sin fechas e importes autorizados." />}
          </BillingPanel>
        </div>

        <div className="grid min-w-0 content-start gap-3">
          <BillingPanel title="Línea de tiempo de facturación" href={timelineHref} hrefLabel="Ver calendario">
            {timeline.length ? <BillingTimeline items={timeline} money={money} /> : <HonestEmpty icon={Clock3} title="Sin hitos registrados" detail="La cronología aparecerá cuando existan registros de facturación de esta obra." />}
          </BillingPanel>

          <BillingPanel title="Preparación de próxima factura">
            {draft ? <BillingDraft draft={draft} money={money} /> : <HonestEmpty icon={FileText} title="Sin borrador preparado" detail="No se crea una certificación, hito, retención ni factura si no llega como registro autorizado." />}
          </BillingPanel>
        </div>
      </div>
    </section>
  );
}

function BillingMetricCard({ metric, money }: { metric: WorkBillingMetric; money: Intl.NumberFormat }) {
  const presentation = metricPresentation[metric.kind];
  const Icon = presentation.icon;
  return (
    <article className="min-w-0 rounded-xl border border-border bg-surface p-3">
      <div className="flex min-w-0 items-center gap-2 text-content-secondary"><Icon size={15} className="shrink-0" aria-hidden="true" /><h3 className="truncate text-[9px] font-bold">{presentation.label}</h3></div>
      <strong className="mt-2 block truncate text-lg font-black tabular-nums text-content" title={formatMoney(metric.value, money)}>{formatMoney(metric.value, money)}</strong>
      <p className="mt-1 min-h-4 truncate text-[9px] text-content-secondary">{metric.detail ?? (finite(metric.percent) ? formatPercent(metric.percent) : "Dato no informado")}</p>
      {finite(metric.percent) ? <progress className="mt-2 h-1.5 w-full accent-brand" max={100} value={clampPercent(metric.percent)} aria-label={`${presentation.label}: ${formatPercent(metric.percent)}`}>{formatPercent(metric.percent)}</progress> : <span className="mt-2 block h-1.5 rounded-full bg-border" aria-hidden="true" />}
      <p className={`mt-2 min-h-4 truncate border-t border-border pt-2 text-[8px] ${toneText(metric.secondaryTone)}`} title={metric.secondaryLabel ?? undefined}>{metric.secondaryLabel ?? "Sin detalle adicional"}{finite(metric.secondaryValue) ? ` ${formatMoney(metric.secondaryValue, money)}` : ""}</p>
    </article>
  );
}

function CertificationDesktopTable({ rows, totals, money }: { rows: WorkBillingCertification[]; totals?: WorkBillingTableTotals | null; money: Intl.NumberFormat }) {
  return (
    <div className="hidden overflow-x-auto md:block" tabIndex={0} role="region" aria-label="Tabla desplazable de certificaciones de la obra">
      <table className="w-full min-w-[42rem] border-collapse text-left text-[9px]">
        <thead className="bg-subtle text-content-secondary"><tr><TableHead>N.º</TableHead><TableHead>Periodo</TableHead><TableHead align="right">Importe bruto</TableHead><TableHead align="right">Retención</TableHead><TableHead align="right">Importe neto</TableHead><TableHead>Estado</TableHead></tr></thead>
        <tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.id} className="hover:bg-subtle/70"><td className="px-3 py-2.5 font-bold text-content">{row.detailHref ? <Link href={row.detailHref} className="hover:text-brand-strong hover:underline">{row.code ?? "Sin número"}</Link> : row.code ?? "—"}</td><td className="px-3 py-2.5 text-content-secondary">{row.period ?? "—"}</td><MoneyCell value={row.grossAmount} money={money} /><MoneyCell value={row.retentionAmount} money={money} /><MoneyCell value={row.netAmount} money={money} strong /><td className="px-3 py-2.5">{row.status ? <StatusBadge label={row.status} tone={row.statusTone} /> : <MissingValue />}</td></tr>)}</tbody>
        {totals ? <tfoot className="border-t border-border bg-subtle font-bold text-content"><tr><td className="px-3 py-2.5" colSpan={2}>Totales recibidos</td><MoneyCell value={totals.grossAmount} money={money} strong /><MoneyCell value={totals.retentionAmount} money={money} strong /><MoneyCell value={totals.netAmount} money={money} strong /><td /></tr></tfoot> : null}
      </table>
    </div>
  );
}

function CertificationMobileList({ rows, money }: { rows: WorkBillingCertification[]; money: Intl.NumberFormat }) {
  return (
    <div className="divide-y divide-border md:hidden" role="list">{rows.map((row) => <article key={row.id} role="listitem" className="p-3"><div className="flex items-start justify-between gap-3"><div><strong className="text-xs text-content">{row.code ?? "Sin número"}</strong><span className="mt-1 block text-[9px] text-content-secondary">{row.period ?? "Periodo no informado"}</span></div>{row.status ? <StatusBadge label={row.status} tone={row.statusTone} /> : null}</div><dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3"><MobileMoney label="Bruto" value={row.grossAmount} money={money} /><MobileMoney label="Retención" value={row.retentionAmount} money={money} /><MobileMoney label="Neto" value={row.netAmount} money={money} /></dl>{row.detailHref ? <Link href={row.detailHref} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border text-[9px] font-bold text-content hover:bg-subtle">Ver certificación</Link> : null}</article>)}</div>
  );
}

function InvoiceDesktopTable({ rows, totals, money }: { rows: WorkBillingInvoice[]; totals?: WorkBillingTableTotals | null; money: Intl.NumberFormat }) {
  return (
    <div className="hidden overflow-x-auto md:block" tabIndex={0} role="region" aria-label="Tabla desplazable de facturas emitidas de la obra">
      <table className="w-full min-w-[46rem] border-collapse text-left text-[9px]">
        <thead className="bg-subtle text-content-secondary"><tr><TableHead>Factura</TableHead><TableHead>Certificación</TableHead><TableHead>Emisión</TableHead><TableHead>Vencimiento</TableHead><TableHead align="right">Importe</TableHead><TableHead>Estado</TableHead><TableHead align="right">Cobrado</TableHead></tr></thead>
        <tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.id} className="hover:bg-subtle/70"><td className="px-3 py-2.5 font-bold text-content">{row.detailHref ? <Link href={row.detailHref} className="hover:text-brand-strong hover:underline">{row.number ?? "Sin número"}</Link> : row.number ?? "—"}</td><td className="px-3 py-2.5 text-content-secondary">{row.certificationCode ?? "—"}</td><td className="px-3 py-2.5 text-content-secondary">{formatDate(row.issuedAt)}</td><td className="px-3 py-2.5 text-content-secondary">{formatDate(row.dueAt)}</td><MoneyCell value={row.amount} money={money} /><td className="px-3 py-2.5">{row.status ? <StatusBadge label={row.status} tone={row.statusTone} /> : <MissingValue />}</td><MoneyCell value={row.collectedAmount} money={money} /></tr>)}</tbody>
        {totals ? <tfoot className="border-t border-border bg-subtle font-bold text-content"><tr><td className="px-3 py-2.5" colSpan={4}>Totales recibidos</td><MoneyCell value={totals.invoiceAmount} money={money} strong /><td /><MoneyCell value={totals.collectedAmount} money={money} strong /></tr></tfoot> : null}
      </table>
    </div>
  );
}

function InvoiceMobileList({ rows, money }: { rows: WorkBillingInvoice[]; money: Intl.NumberFormat }) {
  return (
    <div className="divide-y divide-border md:hidden" role="list">{rows.map((row) => <article key={row.id} role="listitem" className="p-3"><div className="flex items-start justify-between gap-3"><div><strong className="text-xs text-content">{row.number ?? "Sin número"}</strong><span className="mt-1 block text-[9px] text-content-secondary">{row.certificationCode ? `Certificación ${row.certificationCode}` : "Sin certificación vinculada"}</span></div>{row.status ? <StatusBadge label={row.status} tone={row.statusTone} /> : null}</div><dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3"><MobileText label="Emisión" value={formatDate(row.issuedAt)} /><MobileText label="Vencimiento" value={formatDate(row.dueAt)} /><MobileMoney label="Importe" value={row.amount} money={money} /><MobileMoney label="Cobrado" value={row.collectedAmount} money={money} /></dl>{row.detailHref ? <Link href={row.detailHref} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border text-[9px] font-bold text-content hover:bg-subtle">Ver factura</Link> : null}</article>)}</div>
  );
}

function BillingForecast({ points, summary, money }: { points: WorkBillingForecastPoint[]; summary?: WorkBillingForecastSummary | null; money: Intl.NumberFormat }) {
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.expectedAmount ?? 0, point.collectedAmount ?? 0]).filter(Number.isFinite));
  return (
    <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_11rem]">
      <div className="min-w-0 overflow-x-auto" tabIndex={0} role="region" aria-label="Previsión de cobros por periodo">
        <div className="grid min-w-[28rem] grid-cols-[repeat(auto-fit,minmax(3.25rem,1fr))] items-end gap-2" role="list">
          {points.map((point) => <div key={point.id} role="listitem" className="grid min-w-0 gap-1"><span className="truncate text-center text-[8px] text-content-secondary">{point.label}</span><label className="grid gap-0.5"><span className="sr-only">Previsto: {formatMoney(point.expectedAmount, money)}</span><progress className="h-2 w-full accent-success" max={maxValue} value={finite(point.expectedAmount) ? Math.max(0, point.expectedAmount) : 0}>{formatMoney(point.expectedAmount, money)}</progress></label><label className="grid gap-0.5"><span className="sr-only">Cobrado: {formatMoney(point.collectedAmount, money)}</span><progress className="h-2 w-full accent-brand" max={maxValue} value={finite(point.collectedAmount) ? Math.max(0, point.collectedAmount) : 0}>{formatMoney(point.collectedAmount, money)}</progress></label></div>)}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[8px] text-content-secondary"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-success" aria-hidden="true" /> Previsto</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-brand" aria-hidden="true" /> Cobrado</span></div>
      </div>
      {summary ? <dl className="grid content-start gap-2 border-t border-border pt-3 text-[9px] lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0"><SummaryAmount label="Previsto resto de obra" value={summary.expectedRemaining} money={money} /><SummaryAmount label="Total cobrado" value={summary.collectedTotal} money={money} /><SummaryAmount label="Por cobrar previsto" value={summary.pendingExpected} money={money} /><SummaryAmount label="Próximos 30 días" value={summary.nextThirtyDays} money={money} /></dl> : null}
    </div>
  );
}

function BillingTimeline({ items, money }: { items: WorkBillingTimelineItem[]; money: Intl.NumberFormat }) {
  return (
    <ol className="divide-y divide-border px-3">{items.map((item) => <li key={item.id} className="grid min-h-16 grid-cols-[5.5rem_1rem_minmax(0,1fr)_auto] items-center gap-2 py-2.5 text-[9px]"><span className="text-content-secondary">{formatDate(item.date)}</span><span className={`h-2.5 w-2.5 rounded-full ${toneDot(item.statusTone)}`} aria-hidden="true" /><span className="min-w-0">{item.href ? <Link href={item.href} className="block truncate font-bold text-content hover:text-brand-strong hover:underline">{item.code ? `${item.code} · ` : ""}{item.title}</Link> : <strong className="block truncate text-content">{item.code ? `${item.code} · ` : ""}{item.title}</strong>}{item.detail ? <span className="mt-0.5 block truncate text-[8px] text-content-secondary">{item.detail}</span> : null}</span><span className="text-right"><strong className="block tabular-nums text-content">{formatMoney(item.amount, money)}</strong>{item.status ? <span className="mt-1 inline-flex"><StatusBadge label={item.status} tone={item.statusTone} /></span> : null}</span></li>)}</ol>
  );
}

function BillingDraft({ draft, money }: { draft: WorkBillingDraft; money: Intl.NumberFormat }) {
  return (
    <div className="p-3">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xs font-bold text-content">{draft.title}</h3>{draft.subtitle ? <p className="mt-1 text-[9px] text-content-secondary">{draft.subtitle}</p> : null}</div>{draft.editHref ? <Link href={draft.editHref} className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-[9px] font-bold text-content hover:bg-subtle">Editar borrador</Link> : null}</div>
      <dl className="mt-4 grid gap-2 text-[10px]"><SummaryAmount label="Importe bruto certificado" value={draft.grossAmount} money={money} /><SummaryAmount label="Retención" value={draft.retentionAmount} money={money} /><SummaryAmount label="Importe neto a facturar" value={draft.netAmount} money={money} strong /></dl>
      {finite(draft.progressPercent) ? <div className="mt-4"><div className="flex items-center justify-between gap-3 text-[9px] text-content-secondary"><span>Progreso de preparación</span><strong className="text-content">{formatPercent(draft.progressPercent)}</strong></div><progress className="mt-2 h-2 w-full accent-brand" max={100} value={clampPercent(draft.progressPercent)}>{formatPercent(draft.progressPercent)}</progress></div> : null}
      {draft.steps?.length ? <ul className="mt-4 grid gap-2">{draft.steps.map((step) => <li key={step.id} className="flex min-h-7 items-center gap-2 text-[9px] text-content-secondary">{step.status === "complete" ? <CheckCircle2 size={14} className="shrink-0 text-success" aria-hidden="true" /> : step.status === "pending" ? <Circle size={14} className="shrink-0 text-warning" aria-hidden="true" /> : <Circle size={14} className="shrink-0 text-content-tertiary" aria-hidden="true" />}<span>{step.label}</span></li>)}</ul> : null}
      {draft.generateHref ? <Link href={draft.generateHref} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-[10px] font-bold text-on-brand hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Generar factura</Link> : null}
    </div>
  );
}

function BillingPanel({ title, href, hrefLabel, children }: { title: string; href?: string | null; hrefLabel?: string; children: React.ReactNode }) {
  return <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface"><header className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-3"><h3 className="text-xs font-black text-content">{title}</h3>{href ? <Link href={href} className="inline-flex min-h-10 items-center text-[9px] font-bold text-brand-strong hover:underline">{hrefLabel ?? "Ver detalle"}</Link> : null}</header>{children}</article>;
}

function TableHead({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th scope="col" className={`whitespace-nowrap px-3 py-2.5 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function MoneyCell({ value, money, strong = false }: { value?: number | null; money: Intl.NumberFormat; strong?: boolean }) {
  return <td className={`px-3 py-2.5 text-right tabular-nums text-content ${strong ? "font-bold" : ""}`}>{formatMoney(value, money)}</td>;
}

function MobileMoney({ label, value, money }: { label: string; value?: number | null; money: Intl.NumberFormat }) {
  return <div className="min-w-0"><dt className="truncate text-[8px] text-content-tertiary">{label}</dt><dd className="mt-1 truncate text-[9px] font-bold tabular-nums text-content" title={formatMoney(value, money)}>{formatMoney(value, money)}</dd></div>;
}

function MobileText({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="truncate text-[8px] text-content-tertiary">{label}</dt><dd className="mt-1 truncate text-[9px] font-semibold text-content">{value}</dd></div>;
}

function SummaryAmount({ label, value, money, strong = false }: { label: string; value?: number | null; money: Intl.NumberFormat; strong?: boolean }) {
  return <div className="flex min-h-7 items-center justify-between gap-3 border-b border-border last:border-0"><dt className="text-content-secondary">{label}</dt><dd className={`text-right tabular-nums text-content ${strong ? "font-black" : "font-bold"}`}>{formatMoney(value, money)}</dd></div>;
}

function StatusBadge({ label, tone }: { label: string; tone?: WorkBillingTone }) {
  return <span className={`inline-flex min-h-6 items-center rounded-md border px-2 py-1 text-[8px] font-bold ${toneBadge(tone)}`}>{label}</span>;
}

function MissingValue() {
  return <span className="text-content-tertiary">—</span>;
}

function HonestEmpty({ icon: Icon, title, detail, compact = false }: { icon: typeof CircleDollarSign; title: string; detail: string; compact?: boolean }) {
  return <div className={`grid place-content-center justify-items-center p-6 text-center ${compact ? "min-h-32" : "min-h-44"}`}><Icon size={22} className="text-content-tertiary" aria-hidden="true" /><h4 className="mt-3 text-xs font-bold text-content">{title}</h4><p className="mt-1 max-w-sm text-[10px] leading-5 text-content-secondary">{detail}</p></div>;
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function formatMoney(value: number | null | undefined, money: Intl.NumberFormat) {
  return finite(value) ? money.format(value) : "—";
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }).format(value / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no válida" : new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function toneText(tone: WorkBillingTone | undefined) {
  if (tone === "danger") return "text-danger";
  if (tone === "warning") return "text-warning";
  if (tone === "success") return "text-success";
  if (tone === "info") return "text-brand-strong";
  return "text-content-secondary";
}

function toneBadge(tone: WorkBillingTone | undefined) {
  if (tone === "danger") return "border-danger/20 bg-danger/10 text-danger";
  if (tone === "warning") return "border-warning/20 bg-warning/10 text-warning";
  if (tone === "success") return "border-success/20 bg-success/10 text-success";
  if (tone === "info") return "border-brand/20 bg-brand-soft text-brand-strong";
  return "border-border bg-subtle text-content-secondary";
}

function toneDot(tone: WorkBillingTone | undefined) {
  if (tone === "danger") return "bg-danger";
  if (tone === "warning") return "bg-warning";
  if (tone === "success") return "bg-success";
  if (tone === "info") return "bg-brand";
  return "bg-content-tertiary";
}
