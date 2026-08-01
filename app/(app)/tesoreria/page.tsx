import { EconomicControlCenter } from "@/components/economic-control-center";
import {
  requireCapability,
  resolveAuthorization,
} from "@/lib/commercial/authorization";
import { getTreasuryRecommendations } from "@/lib/business-recommendations";
import { getEconomicControl } from "@/lib/economic-control/queries";
import { PageHeader } from "@/components/ui-primitives";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { resolveScopedEntityIds } from "@/lib/commercial/authorization";

export const dynamic = "force-dynamic";

type TreasurySearchParams = {
  vista?: string;
  periodo?: string;
  cliente?: string;
  obra?: string;
  estado?: string;
};

export default async function TreasuryPage({
  searchParams,
}: {
  searchParams: Promise<TreasurySearchParams>;
}) {
  const query = await searchParams;
  const auth = await requireCapability("treasury.view");
  const { companyId } = auth;
  const combinedCapabilities = [
    "sales.budgets.view",
    "sales.invoices.view",
    "banking.view",
    "purchases.received_invoices.view",
    "purchase_cost.view",
    "internal_cost.view",
    "margin_percent.view",
    "margin_amount.view",
    "profitability.view",
  ] as const;
  const combinedAccess = await Promise.all(
    combinedCapabilities.map((capability) =>
      resolveAuthorization(auth, capability),
    ),
  );
  if (
    combinedAccess.some(
      (decision) => !decision.allowed || decision.scope !== "COMPANY",
    )
  ) {
    const [invoiceDecision, purchaseDecision, bankingDecision] =
      await Promise.all([
        resolveAuthorization(auth, "sales.invoices.view"),
        resolveAuthorization(auth, "purchases.received_invoices.view"),
        resolveAuthorization(auth, "banking.view"),
      ]);
    const [
      treasuryWorkIds,
      treasuryClientIds,
      invoiceWorkIds,
      invoiceClientIds,
      purchaseWorkIds,
      purchaseClientIds,
    ] = await Promise.all([
      resolveScopedEntityIds(auth, "treasury.view", "Work"),
      resolveScopedEntityIds(auth, "treasury.view", "Client"),
      invoiceDecision.allowed
        ? resolveScopedEntityIds(auth, "sales.invoices.view", "Work")
        : Promise.resolve([]),
      invoiceDecision.allowed
        ? resolveScopedEntityIds(auth, "sales.invoices.view", "Client")
        : Promise.resolve([]),
      purchaseDecision.allowed
        ? resolveScopedEntityIds(
            auth,
            "purchases.received_invoices.view",
            "Work",
          )
        : Promise.resolve([]),
      purchaseDecision.allowed
        ? resolveScopedEntityIds(
            auth,
            "purchases.received_invoices.view",
            "Client",
          )
        : Promise.resolve([]),
    ]);
    const [invoices, allPurchases, bankAccounts] = await Promise.all([
      invoiceDecision.allowed
        ? prisma.invoice.findMany({
            where: {
              companyId,
              AND: [
                relationScope(auth.scope, treasuryWorkIds, treasuryClientIds),
                relationScope(
                  invoiceDecision.scope,
                  invoiceWorkIds,
                  invoiceClientIds,
                ),
              ],
            },
            select: { pendiente: true, fechaVencimiento: true },
          })
        : Promise.resolve([]),
      purchaseDecision.allowed
        ? prisma.purchaseInvoice.findMany({
            where: { companyId, status: { not: "VOID" } },
            select: {
              workId: true,
              pendingAmount: true,
              dueDate: true,
              expense: { select: { clienteId: true } },
            },
          })
        : Promise.resolve([]),
      bankingDecision.allowed &&
      bankingDecision.scope === "COMPANY" &&
      auth.scope === "COMPANY"
        ? prisma.financialAccount.findMany({
            where: { companyId, isActive: true, archivedAt: null },
            select: {
              openingBalance: true,
              currentManualBalance: true,
              movements: {
                where: { archivedAt: null, status: "confirmed" },
                select: { type: true, amount: true },
              },
            },
          })
        : Promise.resolve([]),
    ]);
    const purchases = allPurchases.filter(
      (invoice) =>
        relationAllowed(
          auth.scope,
          treasuryWorkIds,
          treasuryClientIds,
          invoice.workId,
          invoice.expense?.clienteId ?? null,
        ) &&
        relationAllowed(
          purchaseDecision.scope,
          purchaseWorkIds,
          purchaseClientIds,
          invoice.workId,
          invoice.expense?.clienteId ?? null,
        ),
    );
    const now = new Date();
    const cards = [
      ...(invoiceDecision.allowed
        ? [
            {
              label: "Pendiente de cobro",
              value: invoices.reduce((sum, item) => sum + item.pendiente, 0),
              detail: `${invoices.filter((item) => item.pendiente > 0 && item.fechaVencimiento < now).length} vencidas`,
            },
          ]
        : []),
      ...(purchaseDecision.allowed
        ? [
            {
              label: "Pendiente de pago",
              value: purchases.reduce(
                (sum, item) => sum + item.pendingAmount,
                0,
              ),
              detail: `${purchases.filter((item) => item.pendingAmount > 0 && item.dueDate < now).length} vencidas`,
            },
          ]
        : []),
      ...(bankAccounts.length
        ? [
            {
              label: "Caja registrada",
              value: bankAccounts.reduce(
                (sum, item) =>
                  sum +
                  (item.currentManualBalance ??
                    item.openingBalance +
                      item.movements.reduce(
                        (movementSum, movement) =>
                          movementSum +
                          (["inflow", "transfer_in", "adjustment_in"].includes(
                            movement.type,
                          )
                            ? movement.amount
                            : -movement.amount),
                        0,
                      )),
                0,
              ),
              detail: `${bankAccounts.length} cuentas activas`,
            },
          ]
        : []),
    ];
    return (
      <main className="screen">
        <PageHeader
          eyebrow="Tesorería"
          title="Posición autorizada"
          description="Cobros, pagos y banca se muestran de forma independiente según tus permisos y alcance."
        />
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <article key={card.label} className="card p-4">
              <p className="label">{card.label}</p>
              <p className="mt-2 text-2xl font-black text-obra-ink">
                {formatCurrency(card.value)}
              </p>
              <p className="mt-1 text-sm text-slate-500">{card.detail}</p>
            </article>
          ))}
        </section>
        {!cards.length ? (
          <p className="card mt-4 p-4 text-slate-600">
            No hay datos de tesorería dentro de tu alcance.
          </p>
        ) : null}
      </main>
    );
  }
  const [exportDecision, manageDecision, invoiceCreateDecision, purchaseManageDecision] =
    await Promise.all([
      resolveAuthorization(auth, "reports.export"),
      resolveAuthorization(auth, "treasury.manage"),
      resolveAuthorization(auth, "sales.invoices.create"),
      resolveAuthorization(auth, "purchases.received_invoices.manage"),
    ]);
  const [data, recommendations] = await Promise.all([
    getEconomicControl({
      area: query.vista,
      period: query.periodo,
      clientId: query.cliente,
      workId: query.obra,
      status: query.estado,
    }),
    getTreasuryRecommendations(5, companyId),
  ]);

  return (
    <EconomicControlCenter
      data={data}
      recommendations={recommendations.recommendations}
      canExport={
        auth.scope === "COMPANY" &&
        exportDecision.allowed &&
        exportDecision.scope === "COMPANY"
      }
      canManage={
        auth.scope === "COMPANY" &&
        manageDecision.allowed &&
        manageDecision.scope === "COMPANY"
      }
      canCreateInvoice={
        auth.scope === "COMPANY" &&
        invoiceCreateDecision.allowed &&
        invoiceCreateDecision.scope === "COMPANY"
      }
      canManagePurchases={
        auth.scope === "COMPANY" &&
        purchaseManageDecision.allowed &&
        purchaseManageDecision.scope === "COMPANY"
      }
    />
  );
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
  workId: string | null,
  clientId: string | null,
) {
  if (scope === "COMPANY") return true;
  if (scope === "SELECTED_WORKS")
    return Boolean(workId && workIds?.includes(workId));
  if (scope === "SELECTED_CLIENTS")
    return Boolean(clientId && clientIds?.includes(clientId));
  return workId
    ? Boolean(workIds?.includes(workId))
    : Boolean(clientId && clientIds?.includes(clientId));
}
