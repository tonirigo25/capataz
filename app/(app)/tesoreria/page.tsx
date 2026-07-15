import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Download,
  Euro,
  FileQuestion,
  Info,
  Landmark,
  Lightbulb,
  Plus,
  Repeat,
  ShieldAlert,
  TrendingUp,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  archiveFinancialAccount,
  createCashMovement,
  createCashTransfer,
  createExpectedCashFlow,
  createFinancialAccount,
  createRecurringExpense,
  saveTreasurySettings
} from "@/app/(app)/tesoreria/actions";
import { EmptyState, Notice, PageHeader, TableShell } from "@/components/ui-primitives";
import { getTreasuryRecommendations, type BusinessRecommendation } from "@/lib/business-recommendations";
import { prisma } from "@/lib/prisma";
import {
  TREASURY_DEFINITIONS,
  formatCurrency,
  getTreasuryOverview,
  type TreasuryForecastItem,
  type TreasuryScenarioId
} from "@/lib/treasury";
import { round } from "@/lib/business-metrics";
import { requireCompanyContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type TreasurySearchParams = {
  horizonte?: string;
  escenario?: string;
  cuenta?: string;
  obra?: string;
  cliente?: string;
  categoria?: string;
  estado?: string;
  from?: string;
  to?: string;
};

export default async function TreasuryPage({
  searchParams
}: {
  searchParams: Promise<TreasurySearchParams>;
}) {
  const query = await searchParams;
  const { companyId } = await requireCompanyContext();
  const overviewPromise = getTreasuryOverview({
    companyId,
    horizon: query.horizonte,
    scenario: query.escenario,
    accountId: query.cuenta,
    workId: query.obra,
    clientId: query.cliente,
    category: query.categoria,
    status: query.estado,
    from: query.from,
    to: query.to
  });
  const [overview, clients, works, invoices, expenses, recommendations] = await Promise.all([
    overviewPromise,
    prisma.client.findMany({ where: { companyId, archivadoAt: null }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    prisma.work.findMany({ where: { companyId, archivada: false }, select: { id: true, titulo: true, client: { select: { nombre: true } } }, orderBy: { titulo: "asc" } }),
    prisma.invoice.findMany({ where: { companyId, pendiente: { gt: 0 } }, select: { id: true, numero: true, client: { select: { nombre: true } } }, orderBy: { fechaVencimiento: "asc" } }),
    prisma.expense.findMany({ where: { companyId }, select: { id: true, concepto: true, proveedor: true }, orderBy: { fecha: "desc" }, take: 80 }),
    getTreasuryRecommendations(5, companyId)
  ]);

  const queryString = exportQueryString(query, overview.scenario);
  const returnTo = `/tesoreria?${queryString}`;

  return (
    <main className="screen">
      <PageHeader
        eyebrow="Tesorería"
        title="Caja, previsión y rentabilidad"
        description="Cuentas manuales, calendario de cobros y pagos, forecast determinista y rentabilidad avanzada. No se muestran saldos bancarios si no hay cuentas registradas."
        action={<Link href="#acciones" className="primary-button"><Plus size={18} /> Registrar</Link>}
        secondaryActions={<Link href={`/tesoreria/export?tipo=forecast&${queryString}`} className="secondary-button"><Download size={18} /> CSV forecast</Link>}
      >
        <TreasuryFilters overview={overview} query={query} clients={clients} works={works} />
        <p className="mt-3 text-xs font-bold text-slate-500">
          Actualizado {formatDateTime(overview.updatedAt)} · Horizonte {overview.horizon.label} · Escenario {scenarioLabel(overview.scenario)}.
        </p>
      </PageHeader>

      {!overview.hasAccounts ? (
        <Notice
          tone="info"
          title="Sin saldo de tesorería registrado"
          description="Configura una cuenta o caja para controlar tu tesorería. Capataz no inventa saldo bancario ni asume dinero disponible sin cuenta."
          action={<a href="#crear-cuenta" className="secondary-button bg-white">Crear cuenta</a>}
        />
      ) : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi icon={Landmark} label="Saldo registrado" value={overview.registeredBalance === null ? "Sin cuentas" : formatCurrency(overview.registeredBalance)} detail={overview.hasAccounts ? `${overview.accounts.length} cuentas/cajas` : "No disponible"} tone={overview.registeredBalance !== null && overview.registeredBalance < 0 ? "danger" : "neutral"} />
        <Kpi icon={ArrowUpRight} label="Cobros previstos" value={formatCurrency(overview.forecast.summary.inflows)} detail={`${formatCurrency(overview.forecast.summary.confirmedInflows)} confirmados`} tone="success" />
        <Kpi icon={ArrowDownRight} label="Pagos previstos" value={formatCurrency(overview.forecast.summary.outflows)} detail={`${formatCurrency(overview.payablesSummary.unscheduledTotal)} sin fecha`} tone={overview.forecast.summary.outflows > overview.forecast.summary.inflows ? "warning" : "neutral"} />
        <Kpi icon={WalletCards} label="Saldo final previsto" value={overview.forecast.summary.finalBalance === null ? "Sin saldo" : formatCurrency(overview.forecast.summary.finalBalance)} detail={overview.forecast.summary.deficitDate ? `Déficit ${formatDay(overview.forecast.summary.deficitDate)}` : "Según escenario"} tone={overview.forecast.summary.finalBalance !== null && overview.forecast.summary.finalBalance < 0 ? "danger" : "neutral"} />
        <Kpi icon={Euro} label="Pendiente cobro" value={formatCurrency(overview.invoices.pending)} detail={`${formatCurrency(overview.invoices.overdue)} vencido`} tone={overview.invoices.overdue > 0 ? "warning" : "success"} />
        <Kpi icon={Banknote} label="Necesidad caja" value={formatCurrency(overview.forecast.summary.cashNeed)} detail={overview.forecast.summary.minBalanceDate ? `Mínimo ${formatDay(overview.forecast.summary.minBalanceDate)}` : "Sin déficit previsto"} tone={overview.forecast.summary.cashNeed > 0 ? "danger" : "success"} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Forecast de caja" icon={TrendingUp} action={<Link href={`/tesoreria/export?tipo=forecast&${queryString}`} className="secondary-button"><Download size={18} /> CSV</Link>}>
          <ForecastChart overview={overview} />
          <Assumptions assumptions={overview.assumptions} />
        </Panel>

        <Panel title="Escenarios" icon={CalendarDays}>
          <div className="grid gap-3">
            {overview.scenarioComparison.map((scenario) => (
              <article key={scenario.scenario} className={`rounded-lg border p-3 ${overview.scenario === scenario.scenario ? "border-obra-yellowDark bg-obra-yellow/15" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-obra-ink">{scenario.label}</p>
                    <p className="mt-1 text-sm text-slate-600">Neto {formatCurrency(scenario.net)}</p>
                  </div>
                  <p className="text-right text-sm font-black text-obra-ink">{scenario.finalBalance === null ? "Sin saldo" : formatCurrency(scenario.finalBalance)}</p>
                </div>
                {scenario.deficitDate ? <p className="mt-2 text-xs font-bold text-red-700">Déficit previsto: {formatDay(scenario.deficitDate)}</p> : null}
              </article>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Alertas de tesorería" icon={ShieldAlert} action={<Link href="/hoy" className="secondary-button">Ver Hoy</Link>}>
          <AlertList alerts={overview.alerts} />
        </Panel>
        <Panel title="Recomendaciones de tesorería" icon={Lightbulb} action={<Link href="/recomendaciones?origen=tesoreria" className="secondary-button">Ver centro</Link>}>
          <TreasuryRecommendationList recommendations={recommendations.recommendations.slice(0, 5)} />
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Cuentas y cajas" icon={Landmark} action={<a href="#crear-cuenta" className="secondary-button">Nueva cuenta</a>}>
          <AccountList accounts={overview.accounts} returnTo={returnTo} />
        </Panel>
        <Panel title="Calendario de cobros" icon={ArrowUpRight} action={<Link href={`/tesoreria/export?tipo=receivables&${queryString}`} className="secondary-button"><Download size={18} /> CSV</Link>}>
          <ForecastList items={overview.receivables.slice(0, 12)} empty="No hay cobros previstos dentro del horizonte." />
        </Panel>
        <Panel title="Calendario de pagos" icon={ArrowDownRight} action={<Link href={`/tesoreria/export?tipo=payables&${queryString}`} className="secondary-button"><Download size={18} /> CSV</Link>}>
          <ForecastList items={overview.payables.slice(0, 12)} empty="No hay pagos previstos dentro del horizonte." />
        </Panel>
      </section>

      <section className="mt-5">
        <Panel title="Movimientos de tesorería" icon={WalletCards} action={<Link href={`/tesoreria/export?tipo=movements&${queryString}`} className="secondary-button"><Download size={18} /> CSV</Link>}>
          <MovementTable movements={overview.movements} />
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Rentabilidad avanzada por obra" icon={TrendingUp} action={<Link href={`/tesoreria/export?tipo=work-profitability&${queryString}`} className="secondary-button"><Download size={18} /> CSV</Link>}>
          <WorkProfitability rows={overview.workProfitability.slice(0, 8)} />
        </Panel>
        <Panel title="Rentabilidad por cliente" icon={Euro} action={<Link href={`/tesoreria/export?tipo=client-profitability&${queryString}`} className="secondary-button"><Download size={18} /> CSV</Link>}>
          <ClientProfitability rows={overview.clientProfitability.slice(0, 8)} />
        </Panel>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel title="Punto de equilibrio" icon={Info}>
          <BreakEven summary={overview.breakEven} />
        </Panel>
        <Panel title="Cobertura de gastos" icon={Banknote}>
          <Coverage summary={overview.coverage} />
        </Panel>
        <Panel title="Calidad de datos" icon={FileQuestion}>
          <QualityList issues={overview.qualityIssues} />
        </Panel>
      </section>

      <section id="acciones" className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Acciones rápidas" icon={Plus}>
          <QuickForms accounts={overview.accounts} clients={clients} works={works} invoices={invoices} expenses={expenses} returnTo={returnTo} />
        </Panel>
        <Panel title="Cómo se calcula" icon={Info}>
          <div className="grid gap-3">
            {TREASURY_DEFINITIONS.map((definition) => (
              <details key={definition.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer font-black text-obra-ink">{definition.name}</summary>
                <p className="mt-2 text-sm leading-6 text-slate-600"><strong>Fórmula:</strong> {definition.formula}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600"><strong>Límite:</strong> {definition.limitation}</p>
              </details>
            ))}
          </div>
        </Panel>
      </section>
    </main>
  );
}

function TreasuryFilters({ overview, query, clients, works }: { overview: Awaited<ReturnType<typeof getTreasuryOverview>>; query: TreasurySearchParams; clients: Array<{ id: string; nombre: string }>; works: Array<{ id: string; titulo: string; client: { nombre: string } }> }) {
  return (
    <form action="/tesoreria" className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <Select name="horizonte" label="Horizonte" value={overview.horizon.id} options={overview.horizonOptions.map((option) => [option.id, option.label])} />
      <Select name="escenario" label="Escenario" value={overview.scenario} options={overview.scenarioOptions.map((option) => [option.id, option.label])} />
      <Select name="cuenta" label="Cuenta" value={query.cuenta ?? "all"} options={[["all", "Todas"], ...overview.accounts.map((account) => [account.id, account.name])]} />
      <Select name="cliente" label="Cliente" value={query.cliente ?? "all"} options={[["all", "Todos"], ...clients.map((client) => [client.id, client.nombre])]} />
      <Select name="obra" label="Obra" value={query.obra ?? "all"} options={[["all", "Todas"], ...works.map((work) => [work.id, `${work.titulo} · ${work.client.nombre}`])]} />
      <button className="primary-button self-end" type="submit">Actualizar</button>
    </form>
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

function Kpi({ icon: Icon, label, value, detail, tone = "neutral" }: { icon: LucideIcon; label: string; value: string; detail: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const toneClass = tone === "danger" ? "bg-red-50 text-red-700" : tone === "warning" ? "bg-amber-50 text-amber-800" : tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600";
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}><Icon size={18} /></span>
      <p className="mt-2 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 break-words text-xl font-black tabular-nums text-obra-ink">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function ForecastChart({ overview }: { overview: Awaited<ReturnType<typeof getTreasuryOverview>> }) {
  const points = overview.forecast.daily.slice(0, 30);
  if (!overview.hasAccounts) {
    return <EmptyState title="Sin gráfico de saldo" description="El gráfico de evolución requiere al menos una cuenta o caja con saldo registrado." icon={TrendingUp} />;
  }
  if (!points.length) return <EmptyState title="Sin puntos de previsión" description="No hay horizonte suficiente para dibujar la evolución." icon={TrendingUp} />;
  const maxAbs = Math.max(1, ...points.flatMap((point) => [Math.abs(point.balance ?? 0), point.inflows, point.outflows]));
  return (
    <div>
      <div className="grid gap-2" aria-label="Evolución diaria de caja">
        {points.map((point) => (
          <div key={point.date.toISOString()} className="grid grid-cols-[4.5rem_1fr_6rem] items-center gap-2 text-xs">
            <span className="font-bold text-slate-500">{formatDay(point.date)}</span>
            <span className="grid gap-1">
              <span className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(2, point.inflows / maxAbs * 100)}%` }} />
              <span className="h-2 rounded-full bg-red-500" style={{ width: `${Math.max(2, point.outflows / maxAbs * 100)}%` }} />
            </span>
            <span className={`text-right font-black ${point.balance !== null && point.balance < 0 ? "text-red-700" : "text-obra-ink"}`}>{point.balance === null ? "Sin saldo" : formatCurrency(point.balance)}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">Verde: entradas del día. Rojo: salidas del día. La cifra textual muestra el saldo acumulado previsto.</p>
    </div>
  );
}

function Assumptions({ assumptions }: { assumptions: string[] }) {
  return (
    <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-sm font-black text-obra-ink">Cómo se calcula</summary>
      <ul className="mt-2 grid gap-1 text-sm leading-6 text-slate-600">
        {assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
      </ul>
    </details>
  );
}

function ForecastList({ items, empty }: { items: TreasuryForecastItem[]; empty: string }) {
  if (!items.length) return <EmptyState title={empty} icon={CalendarDays} />;
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <Link key={item.id} href={item.href ?? "/tesoreria"} className={`rounded-lg border p-3 ${item.direction === "inflow" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : item.effectiveDate ? "border-slate-200 bg-white text-slate-700" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase opacity-70">{item.status.replaceAll("_", " ")} · {item.certainty}</p>
              <p className="mt-1 font-black">{item.title}</p>
              <p className="mt-1 text-sm leading-6">{item.clientName ?? item.workTitle ?? item.sourceLabel} · {item.effectiveDate ? formatDay(item.effectiveDate) : "Sin fecha prevista"}</p>
            </div>
            <p className="text-right font-black tabular-nums">{formatCurrency(item.amount)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

function AlertList({ alerts }: { alerts: Awaited<ReturnType<typeof getTreasuryOverview>>["alerts"] }) {
  if (!alerts.length) return <EmptyState title="Sin alertas de tesorería" description="No hay déficits, vencidos relevantes ni concentración detectada con las reglas actuales." icon={ShieldAlert} />;
  return (
    <div className="grid gap-2">
      {alerts.map((alert) => (
        <Link key={alert.id} href={alert.href ?? "/tesoreria"} className={`rounded-lg border p-3 ${alert.level === "danger" ? "border-red-200 bg-red-50 text-red-800" : alert.level === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-100 bg-blue-50 text-blue-800"}`}>
          <p className="font-black">{alert.title}</p>
          <p className="mt-1 text-sm leading-6">{alert.detail}</p>
          {alert.amount !== null ? <p className="mt-1 text-xs font-black uppercase">Importe: {formatCurrency(alert.amount)}</p> : null}
        </Link>
      ))}
    </div>
  );
}

function TreasuryRecommendationList({ recommendations }: { recommendations: BusinessRecommendation[] }) {
  if (!recommendations.length) return <EmptyState title="Sin recomendaciones de tesorería" description="No hay acciones de caja prioritarias derivadas de señales reales." icon={Lightbulb} />;
  return (
    <div className="grid gap-2">
      {recommendations.map((recommendation) => (
        <Link key={recommendation.fingerprint} href="/recomendaciones?origen=tesoreria" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
          <p className="text-xs font-black uppercase">Prioridad {recommendation.priority} · {recommendation.statusLabel}</p>
          <p className="mt-1 font-black">{recommendation.title}</p>
          <p className="mt-1 text-sm leading-6">{recommendation.summary}</p>
        </Link>
      ))}
    </div>
  );
}

function AccountList({ accounts, returnTo }: { accounts: Awaited<ReturnType<typeof getTreasuryOverview>>["accounts"]; returnTo: string }) {
  if (!accounts.length) return <EmptyState title="No hay cuentas ni cajas" description="Crea una cuenta manual, caja o cuenta de efectivo para registrar saldo real." icon={Landmark} />;
  return (
    <div className="grid gap-3">
      {accounts.map((account) => (
        <article key={account.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black text-obra-ink">{account.name}</p>
              <p className="mt-1 text-sm text-slate-600">{account.type} · {account.currency} · saldo {account.balanceMode === "manual" ? "manual" : "calculado"}</p>
            </div>
            <p className="text-right font-black text-obra-ink">{formatCurrency(account.balance)}</p>
          </div>
          <form action={archiveFinancialAccount} className="mt-3">
            <input type="hidden" name="id" value={account.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button className="secondary-button text-xs" type="submit">Archivar</button>
          </form>
        </article>
      ))}
    </div>
  );
}

function MovementTable({ movements }: { movements: Awaited<ReturnType<typeof getTreasuryOverview>>["movements"] }) {
  if (!movements.length) return <EmptyState title="Sin movimientos" description="Los movimientos aparecerán cuando registres entradas, salidas, ajustes o transferencias." icon={WalletCards} />;
  return (
    <>
      <div className="hidden md:block">
        <TableShell label="Movimientos de tesorería">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
              <tr>
                {["Fecha", "Cuenta", "Descripción", "Entrada", "Salida", "Estado", "Entidad"].map((header) => <th key={header} className="px-3 py-3">{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {movements.slice(0, 80).map((movement) => (
                <tr key={movement.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">{formatDay(movement.date)}</td>
                  <td className="px-3 py-3">{movement.accountName}</td>
                  <td className="px-3 py-3">{movement.description}</td>
                  <td className="px-3 py-3 text-emerald-700">{movement.direction === "inflow" ? formatCurrency(movement.amount) : ""}</td>
                  <td className="px-3 py-3 text-red-700">{movement.direction === "outflow" ? formatCurrency(movement.amount) : ""}</td>
                  <td className="px-3 py-3">{movement.status}</td>
                  <td className="px-3 py-3">{movement.workTitle ?? movement.clientName ?? (movement.isTransfer ? "Transferencia" : "Manual")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </div>
      <div className="grid gap-3 md:hidden">
        {movements.slice(0, 30).map((movement) => (
          <article key={movement.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-black uppercase text-slate-500">{formatDay(movement.date)} · {movement.accountName}</p>
            <p className="mt-1 font-black text-obra-ink">{movement.description}</p>
            <p className={`mt-1 text-lg font-black ${movement.direction === "inflow" ? "text-emerald-700" : "text-red-700"}`}>{movement.direction === "inflow" ? "+" : "-"}{formatCurrency(movement.amount)}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function WorkProfitability({ rows }: { rows: Awaited<ReturnType<typeof getTreasuryOverview>>["workProfitability"] }) {
  if (!rows.length) return <EmptyState title="Sin obras comparables" description="No hay datos suficientes de obras, facturas o gastos." icon={TrendingUp} />;
  return (
    <div className="grid gap-3">
      {rows.map((work) => (
        <Link key={work.workId} href={`/obras/${work.workId}`} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black text-obra-ink">{work.title}</p>
              <p className="mt-1 text-sm text-slate-600">{work.clientName} · caja {formatCurrency(work.cashFlow)}</p>
            </div>
            <p className={`text-right font-black ${work.profitOnInvoiced < 0 ? "text-red-700" : "text-obra-ink"}`}>{formatCurrency(work.profitOnInvoiced)}</p>
          </div>
          <div className="mt-2 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-4">
            <span>Facturado {formatCurrency(work.invoiced)}</span>
            <span>Cobrado {formatCurrency(work.collected)}</span>
            <span>Coste real {formatCurrency(work.realCost)}</span>
            <span>Margen {round(work.marginOnInvoiced)}%</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ClientProfitability({ rows }: { rows: Awaited<ReturnType<typeof getTreasuryOverview>>["clientProfitability"] }) {
  if (!rows.length) return <EmptyState title="Sin clientes comparables" description="No hay facturas o gastos suficientes por cliente." icon={Euro} />;
  return (
    <div className="grid gap-3">
      {rows.map((client) => (
        <Link key={client.clientId} href={client.href} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black text-obra-ink">{client.name}</p>
              <p className="mt-1 text-sm text-slate-600">{client.workCount} obras · plazo {client.averageCollectionDays === null ? "sin datos" : `${round(client.averageCollectionDays)} días`}</p>
            </div>
            <p className="text-right font-black text-obra-ink">{formatCurrency(client.pending)}</p>
          </div>
          <p className="mt-2 text-xs font-bold text-slate-500">Margen {round(client.margin)}% · deuda {round(client.debtShare)}% del total pendiente</p>
        </Link>
      ))}
    </div>
  );
}

function BreakEven({ summary }: { summary: Awaited<ReturnType<typeof getTreasuryOverview>>["breakEven"] }) {
  if (!summary.canCalculate) return <Notice tone="warning" description={summary.explanation} />;
  return (
    <div className="grid gap-3">
      <Mini label="Costes fijos" value={formatCurrency(summary.fixedCosts)} />
      <Mini label="Margen contribución" value={`${round(summary.contributionMarginPercent ?? 0)}%`} />
      <Mini label="Facturación necesaria" value={formatCurrency(summary.breakEvenRevenue ?? 0)} />
      <p className="text-sm leading-6 text-slate-600">{summary.explanation}</p>
    </div>
  );
}

function Coverage({ summary }: { summary: Awaited<ReturnType<typeof getTreasuryOverview>>["coverage"] }) {
  if (!summary.canCalculate) return <Notice tone="info" description={summary.explanation} />;
  return (
    <div className="grid gap-3">
      <Mini label="Gasto medio mensual" value={formatCurrency(summary.monthlyExpenseAverage)} />
      <Mini label="Cobertura con saldo" value={`${round(summary.daysWithBalance ?? 0)} días`} />
      <Mini label="Con cobros confirmados" value={`${round(summary.daysWithConfirmedInflows ?? 0)} días`} />
      <p className="text-sm leading-6 text-slate-600">{summary.explanation}</p>
    </div>
  );
}

function QualityList({ issues }: { issues: Awaited<ReturnType<typeof getTreasuryOverview>>["qualityIssues"] }) {
  return (
    <div className="grid gap-2">
      {issues.map((issue) => (
        <Link key={issue.id} href={issue.href} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black text-obra-ink">{issue.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{issue.description}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${issue.count ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>{issue.count}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function QuickForms({ accounts, clients, works, invoices, expenses, returnTo }: { accounts: Awaited<ReturnType<typeof getTreasuryOverview>>["accounts"]; clients: Array<{ id: string; nombre: string }>; works: Array<{ id: string; titulo: string; client: { nombre: string } }>; invoices: Array<{ id: string; numero: string; client: { nombre: string } }>; expenses: Array<{ id: string; concepto: string; proveedor: string }>; returnTo: string }) {
  return (
    <div className="grid gap-3">
      <details id="crear-cuenta" className="rounded-lg border border-slate-200 bg-white p-3" open={!accounts.length}>
        <summary className="cursor-pointer font-black text-obra-ink">Crear cuenta o caja</summary>
        <form action={createFinancialAccount} className="mt-3 grid gap-3">
          <input type="hidden" name="returnTo" value={returnTo} />
          <Field name="name" label="Nombre" required />
          <Select name="type" label="Tipo" value="bank" options={[["bank", "Cuenta bancaria manual"], ["cash", "Caja"], ["other", "Otra cuenta"]]} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field name="currency" label="Moneda" value="EUR" />
            <Field name="openingBalance" label="Saldo inicial" type="number" value={0} />
            <Field name="minimumBalance" label="Saldo mínimo" type="number" />
          </div>
          <button className="primary-button" type="submit">Guardar cuenta</button>
        </form>
      </details>

      <details className="rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer font-black text-obra-ink">Registrar movimiento</summary>
        <form action={createCashMovement} className="mt-3 grid gap-3">
          <input type="hidden" name="returnTo" value={returnTo} />
          <Relation name="accountId" label="Cuenta" options={accounts.map((account) => [account.id, account.name])} />
          <Select name="type" label="Tipo" value="inflow" options={[["inflow", "Entrada"], ["outflow", "Salida"], ["adjustment", "Ajuste de saldo"]]} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="amount" label="Importe" type="number" required />
            <Field name="date" label="Fecha" type="datetime-local" value={dateTimeValue(new Date())} />
          </div>
          <Field name="description" label="Descripción" required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Relation name="clientId" label="Cliente" optional options={clients.map((client) => [client.id, client.nombre])} />
            <Relation name="workId" label="Obra" optional options={works.map((work) => [work.id, `${work.titulo} · ${work.client.nombre}`])} />
          </div>
          <button className="primary-button" type="submit">Registrar movimiento</button>
        </form>
      </details>

      <details className="rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer font-black text-obra-ink">Transferencia entre cuentas</summary>
        <form action={createCashTransfer} className="mt-3 grid gap-3">
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Relation name="fromAccountId" label="Desde" options={accounts.map((account) => [account.id, account.name])} />
            <Relation name="toAccountId" label="Hasta" options={accounts.map((account) => [account.id, account.name])} />
          </div>
          <Field name="amount" label="Importe" type="number" required />
          <Field name="date" label="Fecha" type="datetime-local" value={dateTimeValue(new Date())} />
          <Field name="description" label="Descripción" value="Transferencia entre cuentas" />
          <button className="primary-button" type="submit">Registrar transferencia</button>
        </form>
      </details>

      <details className="rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer font-black text-obra-ink">Previsión manual</summary>
        <form action={createExpectedCashFlow} className="mt-3 grid gap-3">
          <input type="hidden" name="returnTo" value={returnTo} />
          <Select name="type" label="Tipo" value="expected_inflow" options={[["expected_inflow", "Cobro previsto"], ["expected_outflow", "Pago previsto"]]} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="amount" label="Importe" type="number" required />
            <Field name="expectedDate" label="Fecha prevista" type="datetime-local" value={dateTimeValue(new Date())} />
          </div>
          <Field name="description" label="Concepto" required />
          <Field name="confidenceSource" label="Supuesto o regla" value="Previsión manual revisable" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Relation name="invoiceId" label="Factura" optional options={invoices.map((invoice) => [invoice.id, `${invoice.numero} · ${invoice.client.nombre}`])} />
            <Relation name="expenseId" label="Gasto" optional options={expenses.map((expense) => [expense.id, `${expense.proveedor} · ${expense.concepto}`])} />
          </div>
          <button className="primary-button" type="submit">Crear previsión</button>
        </form>
      </details>

      <details className="rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer font-black text-obra-ink">Gasto recurrente</summary>
        <form action={createRecurringExpense} className="mt-3 grid gap-3">
          <input type="hidden" name="returnTo" value={returnTo} />
          <Field name="name" label="Nombre" required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field name="amount" label="Importe" type="number" required />
            <Select name="frequency" label="Frecuencia" value="monthly" options={[["weekly", "Semanal"], ["monthly", "Mensual"], ["quarterly", "Trimestral"], ["yearly", "Anual"]]} />
          </div>
          <Field name="nextDueDate" label="Próxima fecha" type="datetime-local" value={dateTimeValue(new Date())} />
          <Field name="provider" label="Proveedor" />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input name="fixedCost" type="checkbox" defaultChecked />
            Coste fijo para punto de equilibrio
          </label>
          <button className="primary-button" type="submit"><Repeat size={18} /> Guardar recurrente</button>
        </form>
      </details>

      <details className="rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer font-black text-obra-ink">Colchón y cobertura</summary>
        <form action={saveTreasurySettings} className="mt-3 grid gap-3">
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field name="minimumCashBalance" label="Saldo mínimo" type="number" />
            <Field name="safetyBuffer" label="Colchón" type="number" />
            <Field name="targetCoverageDays" label="Días objetivo" type="number" />
          </div>
          <button className="primary-button" type="submit">Guardar configuración</button>
        </form>
      </details>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-black text-obra-ink">{value}</p>
    </div>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: string[][] }) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <select className="field" name={name} defaultValue={value ?? options[0]?.[0]}>
        {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
      </select>
    </label>
  );
}

function Field({ name, label, value, type = "text", required = false }: { name: string; label: string; value?: string | number | null; type?: string; required?: boolean }) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <input className="field" name={name} type={type} step={type === "number" ? "0.01" : undefined} required={required} defaultValue={value ?? ""} />
    </label>
  );
}

function Relation({ name, label, options, optional = false }: { name: string; label: string; options: string[][]; optional?: boolean }) {
  return (
    <label>
      <span className="label mb-1 block">{label}</span>
      <select className="field" name={name} required={!optional} defaultValue="">
        {optional ? <option value="">Sin asociar</option> : <option value="">Seleccionar</option>}
        {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
      </select>
    </label>
  );
}

function exportQueryString(query: TreasurySearchParams, scenario: TreasuryScenarioId) {
  const params = new URLSearchParams();
  params.set("horizonte", query.horizonte ?? "30d");
  params.set("escenario", query.escenario ?? scenario);
  if (query.cuenta) params.set("cuenta", query.cuenta);
  if (query.obra) params.set("obra", query.obra);
  if (query.cliente) params.set("cliente", query.cliente);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  return params.toString();
}

function scenarioLabel(scenario: TreasuryScenarioId) {
  if (scenario === "conservative") return "Conservador";
  if (scenario === "optimistic") return "Optimista";
  if (scenario === "custom") return "Personalizado";
  return "Base";
}

function formatDay(value: Date | null | undefined) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(value);
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(value);
}

function dateTimeValue(value: Date) {
  const pad = (part: number) => part.toString().padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}
