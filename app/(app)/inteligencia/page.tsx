import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Download,
  FileQuestion,
  Info,
  Receipt,
  ShieldAlert,
  TrendingUp
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CompactFilterBar, EmptyState, PageHeader, TableShell } from "@/components/ui-primitives";
import {
  formatCurrency,
  formatDate,
  getBusinessIntelligenceSummary,
  type BusinessAlert,
  type BusinessDataQualityIssue,
  type BusinessKpi
} from "@/lib/business-intelligence";
import { round } from "@/lib/business-metrics";
import { requireCompanyContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function BusinessIntelligencePage({
  searchParams
}: {
  searchParams: Promise<{ periodo?: string; from?: string; to?: string }>;
}) {
  const query = await searchParams;
  const { companyId } = await requireCompanyContext();
  const summary = await getBusinessIntelligenceSummary({ companyId, period: query.periodo, from: query.from, to: query.to });
  const periodQuery = new URLSearchParams();
  periodQuery.set("periodo", summary.period.id);
  if (query.from) periodQuery.set("from", query.from);
  if (query.to) periodQuery.set("to", query.to);

  return (
    <main className="screen">
      <PageHeader
        eyebrow="Inteligencia empresarial"
        title="Salud del negocio"
        description={summary.summaryText}
        action={<Link href="#metricas" className="secondary-button"><Info size={18} /> Cómo se calcula</Link>}
        secondaryActions={<Link href={`/inteligencia/export?tipo=summary&${periodQuery.toString()}`} className="secondary-button"><Download size={18} /> CSV resumen</Link>}
      >
        <CompactFilterBar><form action="/inteligencia" className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <label>
            <span className="label mb-1 block">Periodo</span>
            <select className="field" name="periodo" defaultValue={summary.period.id}>
              {summary.periodOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
              <option value="custom">Personalizado</option>
            </select>
          </label>
          <Field name="from" label="Desde" defaultValue={query.from ?? ""} />
          <Field name="to" label="Hasta" defaultValue={query.to ?? ""} />
          <button className="primary-button self-end" type="submit">Actualizar</button>
        </form></CompactFilterBar>
        <p className="mt-3 text-xs font-bold text-slate-500">
          Actualizado {formatDate(summary.updatedAt)} · Zona horaria {summary.period.timezone} · {summary.period.isComplete ? "periodo cerrado" : "periodo en curso"}.
        </p>
      </PageHeader>

      <section className="mb-5 grid gap-4 lg:grid-cols-[0.85fr_1.4fr]">
        <HealthCard health={summary.health} />
        <MoneyFlow money={summary.money} />
      </section>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summary.kpis.map((kpi) => <KpiCard key={kpi.id} kpi={kpi} />)}
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Dónde requiere atención" icon={ShieldAlert} action={<Link href="#calidad" className="secondary-button">Calidad de datos</Link>}>
          <AlertList alerts={summary.alerts} />
        </Panel>
        <Panel title="Presupuestos" icon={Receipt} action={<Link href="/presupuestos" className="secondary-button">Abrir presupuestos</Link>}>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat label="Creados" value={summary.quotes.count} />
            <MiniStat label="Aceptados" value={summary.quotes.acceptedCount} />
            <MiniStat label="Conversión" value={summary.quotes.conversionRate === null ? "Sin datos" : `${round(summary.quotes.conversionRate)}%`} />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Conversión = presupuestos aceptados dividido entre presupuestos decididos. No incluye borradores ni pendientes sin decisión.
          </p>
        </Panel>
      </section>

      <section id="rentabilidad" className="mb-5 grid gap-5">
        <Panel title="Ranking de obras" icon={BarChart3} action={<Link href={`/inteligencia/export?tipo=works&${periodQuery.toString()}`} className="secondary-button"><Download size={18} /> CSV obras</Link>}>
          <RankingTabs
            rows={summary.works.byProfit}
            columns={[
              ["Obra", (work) => <Link href={`/obras/${work.workId}`} className="font-black text-obra-ink underline decoration-obra-yellowDark/40 underline-offset-4">{work.title}</Link>],
              ["Cliente", (work) => work.clientName],
              ["Facturado", (work) => formatCurrency(work.invoiced)],
              ["Gastos", (work) => formatCurrency(work.expenses)],
              ["Beneficio", (work) => formatCurrency(work.profitOnInvoiced)],
              ["Margen", (work) => work.hasEnoughData ? `${round(work.marginOnInvoiced)}%` : "Sin datos"]
            ]}
          />
        </Panel>
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Obras con menor margen" icon={TrendingUp}>
          <CompactWorkList rows={summary.works.byLowestMargin} />
        </Panel>
        <Panel title="Clientes por saldo pendiente" icon={AlertTriangle}>
          <div className="grid gap-3">
            {summary.clients.byDebt.length ? summary.clients.byDebt.map((client) => (
              <article key={client.clientId} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={client.href} className="font-black text-obra-ink underline decoration-obra-yellowDark/40 underline-offset-4">{client.name}</Link>
                    <p className="mt-1 text-sm text-slate-600">{client.workCount} obras · plazo medio {client.averageCollectionDays === null ? "sin datos" : `${round(client.averageCollectionDays)} días`}</p>
                  </div>
                  <p className="text-right text-sm font-black text-obra-ink">{formatCurrency(client.debt)}</p>
                </div>
              </article>
            )) : <EmptyState title="Sin saldos pendientes" description="No hay clientes con deuda calculada." icon={Receipt} />}
          </div>
        </Panel>
      </section>

      <section id="calidad" className="mb-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Calidad de datos" icon={FileQuestion}>
          <QualityList issues={summary.qualityIssues} />
        </Panel>
        <Panel title="Facturas y cobros" icon={Receipt} action={<Link href={`/inteligencia/export?tipo=pending-invoices&${periodQuery.toString()}`} className="secondary-button"><Download size={18} /> CSV pendientes</Link>}>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat label="Emitidas" value={summary.invoices.count} />
            <MiniStat label="Parciales" value={summary.invoices.partialCount} />
            <MiniStat label="Plazo medio" value={summary.invoices.averageCollectionDays === null ? "Sin datos" : `${round(summary.invoices.averageCollectionDays)} días`} />
          </div>
          <div className="mt-4 grid gap-2">
            {summary.invoices.overdueInvoices.slice(0, 4).map((invoice) => (
              <Link key={invoice.id} href={`/dinero/${invoice.id}`} className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
                {invoice.numero} · {invoice.client.nombre} · {formatCurrency(invoice.total)}
              </Link>
            ))}
          </div>
        </Panel>
      </section>

      <section id="metricas" className="mb-5">
        <Panel title="Diccionario de métricas" icon={Info}>
          <div className="grid gap-3">
            {summary.explanations.map((item) => item ? (
              <details key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer text-sm font-black text-obra-ink">{item.name}</summary>
                <div className="mt-2 grid gap-1 text-sm leading-6 text-slate-600">
                  <p><strong>Fórmula:</strong> {item.formula}</p>
                  <p><strong>Incluye:</strong> {item.includes.join(", ")}</p>
                  <p><strong>Excluye:</strong> {item.excludes.join(", ")}</p>
                  <p><strong>Fuente:</strong> {item.source}. Periodo: {item.period}</p>
                </div>
              </details>
            ) : null)}
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <input className="field" type="date" name={name} defaultValue={defaultValue} />
    </label>
  );
}

function Panel({ title, icon: Icon, action, children }: { title: string; icon: LucideIcon; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-obra-ink"><Icon size={20} className="text-obra-yellowDark" /> {title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function HealthCard({ health }: { health: Awaited<ReturnType<typeof getBusinessIntelligenceSummary>>["health"] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-obra-ink p-5 text-white shadow-card">
      <p className="text-sm font-bold text-obra-yellow">Índice de salud</p>
      {health.canCalculate ? (
        <>
          <div className="mt-3 flex items-end gap-3">
            <p className="text-5xl font-black">{health.score}</p>
            <p className="pb-2 text-lg font-black">{health.label}</p>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-obra-yellow" style={{ width: `${health.score ?? 0}%` }} />
          </div>
        </>
      ) : (
        <p className="mt-3 text-lg font-black">{health.label}</p>
      )}
      <ul className="mt-4 grid gap-2 text-sm leading-6 text-white/85">
        {health.factors.slice(0, 4).map((factor) => <li key={factor}>{factor}</li>)}
      </ul>
    </section>
  );
}

function MoneyFlow({ money }: { money: Awaited<ReturnType<typeof getBusinessIntelligenceSummary>>["money"] }) {
  const rows = [
    ["Facturado", money.invoiced],
    ["Cobrado", money.collected],
    ["Pendiente", money.outstanding],
    ["Vencido", money.overdue],
    ["Gastos", money.expenses],
    ["Beneficio facturado", money.profitOnInvoiced]
  ] as const;
  const max = Math.max(1, ...rows.map(([, value]) => Math.abs(value)));
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
      <h2 className="text-lg font-black text-obra-ink">Ingresos, cobros y gastos</h2>
      <div className="mt-4 grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between gap-3 text-sm font-bold">
              <span className="text-slate-600">{label}</span>
              <span className="text-obra-ink">{formatCurrency(value)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${value < 0 ? "bg-red-500" : "bg-obra-yellowDark"}`} style={{ width: `${Math.min(100, Math.abs(value) / max * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">El gráfico tiene alternativa textual en cada fila y no usa colores como único indicador.</p>
    </section>
  );
}

function KpiCard({ kpi }: { kpi: BusinessKpi }) {
  const Icon = kpi.comparison.tone === "negative" ? ArrowDownRight : ArrowUpRight;
  return (
    <Link href={kpi.href} className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft transition hover:border-obra-yellowDark">
      <p className="text-sm font-bold text-slate-500">{kpi.label}</p>
      <p className="mt-2 text-2xl font-black text-obra-ink">{kpi.formatted}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{kpi.definition}</p>
      <p className={`mt-3 flex items-center gap-1 text-sm font-black ${trendClass(kpi.comparison.tone)}`}>
        <Icon size={16} />
        {kpi.comparison.label}
      </p>
    </Link>
  );
}

function AlertList({ alerts }: { alerts: BusinessAlert[] }) {
  if (!alerts.length) return <EmptyState title="Sin alertas relevantes" description="No hay facturas vencidas, márgenes negativos ni desviaciones críticas detectadas." icon={ShieldAlert} />;
  return (
    <div className="grid gap-2">
      {alerts.map((alert) => (
        <Link key={alert.id} href={alert.href} className={`rounded-lg border p-3 ${alert.severity === "danger" ? "border-red-200 bg-red-50 text-red-800" : alert.severity === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-100 bg-blue-50 text-blue-800"}`}>
          <p className="font-black">{alert.title}</p>
          <p className="mt-1 text-sm leading-6">{alert.detail}</p>
        </Link>
      ))}
    </div>
  );
}

function QualityList({ issues }: { issues: BusinessDataQualityIssue[] }) {
  return (
    <div className="grid gap-2">
      {issues.map((issue) => (
        <Link key={issue.id} href={issue.href} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black text-obra-ink">{issue.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{issue.description}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{issue.count}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function RankingTabs<T>({ rows, columns }: { rows: T[]; columns: Array<[string, (row: T) => ReactNode]> }) {
  if (!rows.length) return <EmptyState title="Sin datos de obras" description="Todavía no hay facturas, cobros o gastos suficientes para ordenar obras." icon={BarChart3} />;
  return (
    <TableShell label="Ranking de obras">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
          <tr>{columns.map(([label]) => <th key={label} className="px-3 py-3">{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-100">
              {columns.map(([label, render]) => <td key={label} className="px-3 py-3">{render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}

function CompactWorkList({ rows }: { rows: Awaited<ReturnType<typeof getBusinessIntelligenceSummary>>["works"]["byLowestMargin"] }) {
  if (!rows.length) return <EmptyState title="Sin obras comparables" description="No hay datos suficientes para calcular márgenes." icon={BarChart3} />;
  return (
    <div className="grid gap-3">
      {rows.map((work) => (
        <Link key={work.workId} href={`/obras/${work.workId}`} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black text-obra-ink">{work.title}</p>
              <p className="mt-1 text-sm text-slate-600">{work.clientName} · {formatCurrency(work.profitOnInvoiced)} beneficio</p>
            </div>
            <p className={`text-sm font-black ${work.marginOnInvoiced < 0 ? "text-red-700" : "text-slate-700"}`}>{round(work.marginOnInvoiced)}%</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-obra-ink">{value}</p>
    </div>
  );
}

function trendClass(tone: string) {
  if (tone === "positive") return "text-emerald-700";
  if (tone === "negative") return "text-red-700";
  return "text-slate-500";
}
