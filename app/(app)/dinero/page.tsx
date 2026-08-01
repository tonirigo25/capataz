import Link from "next/link";
import {
  AlertTriangle,
  BellPlus,
  CalendarClock,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  Search,
  WalletCards,
} from "lucide-react";
import { prepareCollectionReminder } from "@/app/(app)/dinero/actions";
import { EconomicControlCenter } from "@/components/economic-control-center";
import {
  MoneyRailContext,
  type MoneyRailContextValue,
} from "@/components/portal/money-rail-context";
import { ListWorkspace } from "@/components/workspaces";
import { StatusPill } from "@/components/status-pill";
import {
  CompactTabs,
  KpiCard,
  KpiGrid,
  ModuleHeader,
  ModulePanel,
  RatioRow,
  SoftBadge,
} from "@/components/portal/modules-b/module-frame";
import {
  ActionMenu,
  CompactFilterBar,
  CompactSearch,
  EmptyState,
  MobileList,
  Notice,
  ResponsiveTable,
  ResultCount,
} from "@/components/ui-primitives";
import { formatCurrency, formatDate } from "@/lib/format";
import { getTreasuryRecommendations } from "@/lib/business-recommendations";
import { getEconomicControl } from "@/lib/economic-control/queries";
import type { EconomicControlData } from "@/lib/economic-control/types";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";
import {
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";

const tabs = [
  ["pendientes", "Pendientes"],
  ["vencidas", "Vencidas"],
  ["parciales", "Parciales"],
  ["pagadas", "Cobradas"],
  ["borrador", "Borradores"],
  ["emitida", "Emitidas"],
  ["reclamada", "Reclamadas"],
  ["todas", "Todas"],
] as const;

type InvoiceListItem = {
  id: string;
  clienteId: string;
  obraId: string | null;
  numero: string;
  concepto: string;
  estado: string;
  total: number;
  pagado: number;
  pendiente: number;
  fechaEmision: Date;
  fechaVencimiento: Date;
  liveStatus: string;
  client: { nombre: string };
  work: { titulo: string } | null;
  payments: Array<{
    id: string;
    fecha: Date;
    importe: number;
    metodo: string;
    tipo: string;
  }>;
  ui: { update: boolean; collect: boolean; agenda: boolean };
};

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; buscar?: string; periodo?: string }>;
}) {
  const query = await searchParams;
  const filter = query.filtro ?? "pendientes";
  const auth = await requireCapability("sales.invoices.view");
  const { companyId } = auth;
  const economicCapabilities = [
    "treasury.view",
    "banking.view",
    "purchases.received_invoices.view",
    "purchase_cost.view",
    "internal_cost.view",
    "margin_percent.view",
    "margin_amount.view",
    "profitability.view",
  ] as const;
  const economicAccess = await Promise.all(
    economicCapabilities.map((capability) =>
      resolveAuthorization(auth, capability),
    ),
  );
  const canSeeCompanyEconomicCenter =
    auth.scope === "COMPANY" &&
    economicAccess.every(
      (decision) => decision.allowed && decision.scope === "COMPANY",
    );

  if (canSeeCompanyEconomicCenter) {
    const [exportDecision, manageDecision, invoiceCreateDecision, purchaseManageDecision, data, recommendations] =
      await Promise.all([
        resolveAuthorization(auth, "reports.export"),
        resolveAuthorization(auth, "treasury.manage"),
        resolveAuthorization(auth, "sales.invoices.create"),
        resolveAuthorization(auth, "purchases.received_invoices.manage"),
        getEconomicControl({ area: "resumen", period: query.periodo }),
        getTreasuryRecommendations(5, companyId),
      ]);
    const railContext = buildMoneyRailContext(data);

    return (
      <>
        <MoneyRailContext context={railContext} />
        <EconomicControlCenter
          surface="money"
          data={data}
          recommendations={recommendations.recommendations}
          canExport={exportDecision.allowed && exportDecision.scope === "COMPANY"}
          canManage={manageDecision.allowed && manageDecision.scope === "COMPANY"}
          canCreateInvoice={invoiceCreateDecision.allowed && invoiceCreateDecision.scope === "COMPANY"}
          canManagePurchases={purchaseManageDecision.allowed && purchaseManageDecision.scope === "COMPANY"}
        />
      </>
    );
  }

  const [workIds, clientIds] = await Promise.all([
    resolveScopedEntityIds(auth, "sales.invoices.view", "Work"),
    resolveScopedEntityIds(auth, "sales.invoices.view", "Client"),
  ]);
  const scopeWhere = relationScope(auth.scope, workIds, clientIds);
  const [createDecision, updateDecision, collectDecision, agendaDecision] =
    await Promise.all([
      resolveAuthorization(auth, "sales.invoices.create"),
      resolveAuthorization(auth, "sales.invoices.create"),
      resolveAuthorization(auth, "treasury.collections.register"),
      resolveAuthorization(auth, "agenda.manage"),
    ]);
  const [
    updateWorkIds,
    updateClientIds,
    collectWorkIds,
    collectClientIds,
    agendaWorkIds,
    agendaClientIds,
  ] = await Promise.all([
    updateDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.invoices.create", "Work")
      : Promise.resolve([]),
    updateDecision.allowed
      ? resolveScopedEntityIds(auth, "sales.invoices.create", "Client")
      : Promise.resolve([]),
    collectDecision.allowed
      ? resolveScopedEntityIds(auth, "treasury.collections.register", "Work")
      : Promise.resolve([]),
    collectDecision.allowed
      ? resolveScopedEntityIds(auth, "treasury.collections.register", "Client")
      : Promise.resolve([]),
    agendaDecision.allowed
      ? resolveScopedEntityIds(auth, "agenda.manage", "Work")
      : Promise.resolve([]),
    agendaDecision.allowed
      ? resolveScopedEntityIds(auth, "agenda.manage", "Client")
      : Promise.resolve([]),
  ]);
  const invoices = await prisma.invoice.findMany({
    where: { companyId, ...scopeWhere },
    orderBy: { fechaVencimiento: "asc" },
    include: { client: true, work: true, payments: true },
  });
  const invoicesWithStatus: InvoiceListItem[] = invoices.map((invoice) => ({
    ...invoice,
    liveStatus:
      invoice.estado === "borrador"
        ? "borrador"
        : deriveInvoiceStatus(
            invoice.total,
            invoice.pendiente,
            invoice.fechaVencimiento,
          ),
    ui: {
      update:
        updateDecision.allowed &&
        relationAllowed(
          updateDecision.scope,
          updateWorkIds,
          updateClientIds,
          invoice,
        ),
      collect:
        collectDecision.allowed &&
        relationAllowed(
          collectDecision.scope,
          collectWorkIds,
          collectClientIds,
          invoice,
        ),
      agenda:
        agendaDecision.allowed &&
        relationAllowed(
          agendaDecision.scope,
          agendaWorkIds,
          agendaClientIds,
          invoice,
        ),
    },
  }));
  const visibleInvoices = invoicesWithStatus.filter((invoice) => {
    const statusMatch =
      filter === "todas" ||
      invoice.estado === filter ||
      invoice.liveStatus === filter ||
      (filter === "pendientes" && invoice.pendiente > 0) ||
      (filter === "vencidas" && invoice.liveStatus === "vencida") ||
      (filter === "parciales" &&
        invoice.liveStatus === "parcialmente_pagada") ||
      (filter === "pagadas" && invoice.liveStatus === "pagada");
    const search = normalize(query.buscar ?? "");
    return (
      statusMatch &&
      (!search ||
        normalize(
          `${invoice.numero} ${invoice.client.nombre} ${invoice.work?.titulo ?? ""} ${invoice.concepto}`,
        ).includes(search))
    );
  });
  const pendingTotal = invoices.reduce(
    (sum, invoice) => sum + invoice.pendiente,
    0,
  );
  const collectedThisMonth = invoices.reduce(
    (sum, invoice) =>
      sum +
      invoice.payments.reduce((paymentSum, payment) => {
        const date = new Date(payment.fecha);
        const now = new Date();
        return date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
          ? paymentSum + payment.importe
          : paymentSum;
      }, 0),
    0,
  );
  const overdue = invoicesWithStatus.filter(
    (invoice) => invoice.liveStatus === "vencida",
  );
  const partial = invoicesWithStatus.filter(
    (invoice) => invoice.liveStatus === "parcialmente_pagada",
  );
  const invoicedTotal = invoices.reduce(
    (sum, invoice) => sum + invoice.total,
    0,
  );
  const paidTotal = invoices.reduce((sum, invoice) => sum + invoice.pagado, 0);
  const overdueTotal = overdue.reduce(
    (sum, invoice) => sum + invoice.pendiente,
    0,
  );
  const upcomingInvoices = invoicesWithStatus
    .filter((invoice) => invoice.pendiente > 0)
    .slice(0, 5);
  const exposureBase = invoicedTotal || 1;
  const hasCriteria = filter !== "todas" || Boolean(query.buscar);

  return (
    <ListWorkspace>
      <ModuleHeader
        eyebrow="Control financiero"
        title="Dinero"
        description="Facturación, cobros y vencimientos reales, protegidos por el alcance financiero de tu perfil."
        action={
          createDecision.allowed && createDecision.scope === "COMPANY" ? (
            <Link
              href="/gestion?tipo=factura&returnTo=/dinero"
              className="primary-button"
            >
              <Plus size={18} /> Nueva factura
            </Link>
          ) : undefined
        }
      />

      <KpiGrid>
        <KpiCard
          href="/dinero?filtro=pendientes"
          label="Por cobrar"
          value={formatCurrency(pendingTotal)}
          detail="Saldo abierto de facturas visibles"
          icon={WalletCards}
          tone={pendingTotal ? "warning" : "success"}
        />
        <KpiCard
          href="/dinero?filtro=pagadas"
          label="Cobrado este mes"
          value={formatCurrency(collectedThisMonth)}
          detail="Pagos registrados en el periodo"
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          href="/dinero?filtro=vencidas"
          label="Vencido"
          value={formatCurrency(overdueTotal)}
          detail={`${overdue.length} facturas requieren seguimiento`}
          icon={AlertTriangle}
          tone={overdue.length ? "danger" : "neutral"}
        />
        <KpiCard
          href="/dinero?filtro=parciales"
          label="Cobro parcial"
          value={String(partial.length)}
          detail="Facturas con pago incompleto"
          icon={Clock}
          tone={partial.length ? "warning" : "neutral"}
        />
      </KpiGrid>

      <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,.85fr)]">
        <ModulePanel
          title="Posición de cobro"
          description="Distribución calculada sólo con facturas autorizadas"
        >
          <div className="grid gap-5 p-4 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <RatioRow
              label="Cobrado"
              value={(paidTotal / exposureBase) * 100}
              amount={formatCurrency(paidTotal)}
              tone="green"
            />
            <RatioRow
              label="Pendiente"
              value={(pendingTotal / exposureBase) * 100}
              amount={formatCurrency(pendingTotal)}
              tone="blue"
            />
            <RatioRow
              label="Vencido"
              value={(overdueTotal / exposureBase) * 100}
              amount={formatCurrency(overdueTotal)}
              tone="red"
            />
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
            Importe facturado visible:{" "}
            <strong className="text-obra-ink tabular-nums">
              {formatCurrency(invoicedTotal)}
            </strong>
            . No se estima caja ni rentabilidad sin datos confirmados.
          </div>
        </ModulePanel>
        <ModulePanel
          title="Próximos vencimientos"
          description="Ordenados por fecha registrada"
        >
          <div className="divide-y divide-slate-100">
            {upcomingInvoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/dinero/${invoice.id}`}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xs font-black text-slate-700">
                  {invoice.fechaVencimiento.getDate()}
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-obra-ink">
                    {invoice.numero} · {invoice.client.nombre}
                  </strong>
                  <span className="type-meta block truncate">
                    Vence {formatDate(invoice.fechaVencimiento)}
                  </span>
                </span>
                <span className="text-right">
                  <strong className="block text-sm text-obra-ink tabular-nums">
                    {formatCurrency(invoice.pendiente)}
                  </strong>
                  <SoftBadge
                    tone={
                      invoice.liveStatus === "vencida" ? "danger" : "neutral"
                    }
                  >
                    {invoice.liveStatus === "vencida" ? "Vencida" : "Pendiente"}
                  </SoftBadge>
                </span>
              </Link>
            ))}
            {!upcomingInvoices.length ? (
              <p className="p-4 text-sm text-slate-500">
                No hay vencimientos en tu alcance.
              </p>
            ) : null}
          </div>
        </ModulePanel>
      </div>

      <Notice
        className="mb-4"
        tone="warning"
        title="Revisión fiscal"
        description="Las facturas en borrador deben revisarse con tu gestoría antes de usarlas como documento legal."
      />

      <CompactFilterBar className="mb-4">
        <form
          action="/dinero"
          className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_auto]"
        >
          <input type="hidden" name="filtro" value={filter} />
          <label>
            <span className="label mb-1 block">Buscar</span>
            <CompactSearch
              name="buscar"
              defaultValue={query.buscar ?? ""}
              placeholder="Factura, cliente, trabajo o concepto…"
            />
          </label>
          <button className="primary-button self-end" type="submit">
            <Search size={18} /> Buscar
          </button>
        </form>
        <CompactTabs label="Estados de factura">
          {tabs.map(([id, label]) => (
            <Link
              key={id}
              href={invoiceHref(id, query.buscar)}
              aria-current={filter === id ? "page" : undefined}
              className={`inline-flex min-h-9 shrink-0 items-center rounded-lg px-3 py-1.5 text-sm font-bold ${filter === id ? "bg-obra-ink text-white" : "text-slate-600 hover:bg-white"}`}
            >
              {label}
            </Link>
          ))}
        </CompactTabs>
      </CompactFilterBar>

      <ResultCount
        shown={visibleInvoices.length}
        total={invoices.length}
        noun="facturas"
        context={
          hasCriteria ? (
            <Link
              href="/dinero?filtro=todas"
              className="font-bold text-obra-ink underline underline-offset-4"
            >
              Limpiar filtros
            </Link>
          ) : null
        }
      />

      {visibleInvoices.length ? (
        <>
          <ResponsiveTable
            label="Facturas y cobros"
            className="mt-4 overflow-hidden rounded-xl border border-slate-200"
          >
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Factura
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Cliente y obra
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Vencimiento
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Total
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Cobrado
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Pendiente
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Estado
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visibleInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <Link
                        href={`/dinero/${invoice.id}`}
                        className="font-black text-obra-ink hover:underline"
                      >
                        {invoice.numero}
                      </Link>
                      <p className="mt-1 max-w-xs text-xs text-slate-500">
                        {invoice.concepto}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-obra-ink">
                        {invoice.client.nombre}
                      </p>
                      <p className="text-xs text-slate-500">
                        {invoice.work?.titulo ?? "Sin obra"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      {formatDate(invoice.fechaVencimiento)}
                    </td>
                    <td className="px-4 py-4 text-right font-bold">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-600">
                      {formatCurrency(invoice.pagado)}
                    </td>
                    <td
                      className={`px-4 py-4 text-right font-black ${invoice.pendiente ? "text-red-700" : "text-emerald-700"}`}
                    >
                      {formatCurrency(invoice.pendiente)}
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill status={invoice.liveStatus} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/dinero/${invoice.id}`}
                        className="secondary-button"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
          <MobileList className="mt-4">
            {visibleInvoices.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} />
            ))}
          </MobileList>
        </>
      ) : (
        <div className="mt-4">
          <EmptyState
            title={
              invoices.length
                ? "No hay facturas para estos filtros"
                : "Todavía no hay facturas"
            }
            description={
              invoices.length
                ? "Prueba otra búsqueda o limpia los filtros activos."
                : "No hay facturas disponibles en tu alcance."
            }
            icon={Search}
            action={
              invoices.length ? (
                <Link href="/dinero?filtro=todas" className="secondary-button">
                  Limpiar filtros
                </Link>
              ) : createDecision.allowed &&
                createDecision.scope === "COMPANY" ? (
                <Link
                  href="/gestion?tipo=factura&returnTo=/dinero"
                  className="primary-button"
                >
                  Crear factura
                </Link>
              ) : undefined
            }
          />
        </div>
      )}
    </ListWorkspace>
  );
}

function InvoiceCard({ invoice }: { invoice: InvoiceListItem }) {
  const hasActions =
    invoice.ui.collect || invoice.ui.update || invoice.ui.agenda;
  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label">{invoice.numero}</p>
          <h2 className="mt-1 truncate text-lg font-black text-obra-ink">
            {invoice.client.nombre}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {invoice.work?.titulo ?? "Sin obra"}
          </p>
        </div>
        <StatusPill status={invoice.liveStatus} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Mini label="Total" value={formatCurrency(invoice.total)} />
        <Mini label="Cobrado" value={formatCurrency(invoice.pagado)} />
        <Mini
          label="Pendiente"
          value={formatCurrency(invoice.pendiente)}
          danger={invoice.pendiente > 0}
        />
        <Mini
          label="Vence"
          value={formatDate(invoice.fechaVencimiento)}
          danger={invoice.liveStatus === "vencida"}
        />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-600">
        Siguiente: {nextInvoiceAction(invoice.liveStatus, invoice.pendiente)}
      </p>
      <div className="mt-4 flex gap-2">
        <Link
          href={`/dinero/${invoice.id}`}
          className="secondary-button flex-1"
        >
          Abrir detalle
        </Link>
        {hasActions ? (
          <ActionMenu>
            {invoice.ui.collect ? (
              <Link
                href={`/gestion?tipo=pago&facturaId=${invoice.id}&returnTo=/dinero`}
              >
                <Plus size={17} /> Registrar cobro
              </Link>
            ) : null}
            {invoice.ui.collect ? (
              <form action={prepareCollectionReminder}>
                <input type="hidden" name="facturaId" value={invoice.id} />
                <input type="hidden" name="canal" value="whatsapp" />
                <button type="submit">
                  <BellPlus size={17} /> Preparar recordatorio
                </button>
              </form>
            ) : null}
            {invoice.ui.update ? (
              <Link
                href={`/gestion?tipo=factura&id=${invoice.id}&returnTo=/dinero`}
              >
                <Pencil size={17} /> Editar
              </Link>
            ) : null}
            {invoice.ui.agenda ? (
              <Link href={`/clientes/${invoice.clienteId}`}>
                <CalendarClock size={17} /> Abrir cliente
              </Link>
            ) : null}
          </ActionMenu>
        ) : null}
      </div>
    </article>
  );
}

function Mini({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p
        className={`mt-1 font-black ${danger ? "text-red-700" : "text-obra-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}
function nextInvoiceAction(status: string, pending: number) {
  if (status === "pagada" || pending <= 0) return "Sin acciones pendientes";
  if (status === "vencida") return "Preparar recordatorio";
  if (status === "parcialmente_pagada") return "Registrar próximo cobro";
  return "Vigilar vencimiento";
}
function invoiceHref(filter: string, search?: string) {
  const params = new URLSearchParams({ filtro: filter });
  if (search) params.set("buscar", search);
  return `/dinero?${params.toString()}`;
}
function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function buildMoneyRailContext(
  data: EconomicControlData,
): MoneyRailContextValue {
  const negativeForecast = data.forecast.points.filter(
    (point) => point.balance != null && point.balance < 0,
  );
  const minimumBalance = negativeForecast.reduce<number | null>(
    (minimum, point) =>
      minimum == null || (point.balance ?? 0) < minimum
        ? point.balance
        : minimum,
    null,
  );

  if (minimumBalance != null) {
    return {
      title: "Riesgo de falta de liquidez detectado",
      description: `La previsión registrada alcanza un saldo mínimo de ${formatCurrency(minimumBalance)} dentro del periodo seleccionado.`,
      status: "risk",
      amountLabel: "Déficit máximo previsto",
      amount: formatCurrency(minimumBalance),
      periodLabel: "Tramos en riesgo",
      periodValue: String(negativeForecast.length),
      recommendations: [
        "Prioriza las facturas vencidas con mayor saldo.",
        "Revisa los pagos programados del periodo.",
        "Confirma compras no esenciales antes de ejecutarlas.",
      ],
      detailHref: "/tesoreria?vista=prevision&periodo=90d",
    };
  }

  if (data.receivableSummary.overdue > 0) {
    return {
      title: "Cobros vencidos que requieren revisión",
      description: `${data.receivableSummary.overdueCount} facturas acumulan ${formatCurrency(data.receivableSummary.overdue)} pendientes fuera de plazo.`,
      status: "attention",
      amountLabel: "Saldo vencido",
      amount: formatCurrency(data.receivableSummary.overdue),
      periodLabel: "Facturas afectadas",
      periodValue: String(data.receivableSummary.overdueCount),
      recommendations: [
        "Revisa primero los saldos vencidos de mayor importe.",
        "Comprueba el historial antes de preparar recordatorios.",
        "Confirma cada comunicación antes de enviarla.",
      ],
      detailHref: "/tesoreria?vista=cobros&estado=vencido",
    };
  }

  return {
    title: "Posición financiera sin alertas críticas",
    description:
      "La información registrada no muestra déficits previstos ni cobros vencidos dentro del periodo seleccionado.",
    status: "stable",
    amountLabel: "Saldo previsto",
    amount:
      data.forecast.closingBalance == null
        ? "Sin saldo registrado"
        : formatCurrency(data.forecast.closingBalance),
    periodLabel: "Alertas críticas",
    periodValue: "0",
    recommendations: [
      "Mantén actualizados los vencimientos de cobros y pagos.",
      "Revisa la rentabilidad registrada por obra.",
      "Confirma cualquier ajuste financiero antes de aplicarlo.",
    ],
    detailHref: "/tesoreria?vista=prevision&periodo=90d",
  };
}
function relationScope(
  scope: string,
  workIds: string[] | null,
  clientIds: string[] | null,
) {
  if (scope === "COMPANY") return {};
  if (scope === "SELECTED_WORKS") return { obraId: { in: workIds ?? [] } };
  if (scope === "SELECTED_CLIENTS")
    return { clienteId: { in: clientIds ?? [] } };
  const OR: Array<Record<string, unknown>> = [];
  if (workIds?.length) OR.push({ obraId: { in: workIds } });
  if (clientIds?.length)
    OR.push({ clienteId: { in: clientIds }, obraId: null });
  return OR.length ? { OR } : { id: { in: [] as string[] } };
}
function relationAllowed(
  scope: string,
  workIds: string[] | null,
  clientIds: string[] | null,
  entity: { obraId: string | null; clienteId: string },
) {
  if (scope === "COMPANY") return true;
  if (scope === "SELECTED_WORKS")
    return Boolean(entity.obraId && workIds?.includes(entity.obraId));
  if (scope === "SELECTED_CLIENTS")
    return Boolean(clientIds?.includes(entity.clienteId));
  return entity.obraId
    ? Boolean(workIds?.includes(entity.obraId))
    : Boolean(clientIds?.includes(entity.clienteId));
}
