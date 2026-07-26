import { getEntitlements, requireCapability } from "@/lib/commercial/authorization";
import { planCatalog } from "@/lib/commercial/plans";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { changeLocalPlan, openStripeCustomerPortal, startStripeCheckout } from "./actions";

export default async function PlanUsagePage() {
  const auth = await requireCapability("company.billing.manage");
  const commercial = await getEntitlements(auth.companyId);
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const billingEnabled = process.env.BILLING_ENABLED === "true";
  const [members, usage, documents, storage, aiUsage, priceMappings, billingCustomer] = await Promise.all([
    prisma.companyMembership.count({ where: { companyId: auth.companyId, status: "active" } }),
    prisma.usageRecord.groupBy({ by: ["metric"], where: { companyId: auth.companyId, periodStart: { lt: periodEnd }, periodEnd: { gt: periodStart } }, _sum: { quantity: true } }),
    prisma.document.count({ where: { companyId: auth.companyId, archivedAt: null, createdAt: { gte: periodStart, lt: periodEnd } } }),
    prisma.storedObject.aggregate({ where: { companyId: auth.companyId, deletedAt: null }, _sum: { sizeBytes: true } }),
    prisma.aiUsageEvent.aggregate({ where: { companyId: auth.companyId, createdAt: { gte: periodStart, lt: periodEnd } }, _count: { id: true }, _sum: { inputTokens: true, outputTokens: true, costAmount: true } }),
    auth.role === "OWNER" && billingEnabled ? prisma.billingPriceMapping.findMany({ where: { provider: "stripe", active: true }, orderBy: [{ planKey: "asc" }, { interval: "asc" }] }) : Promise.resolve([]),
    auth.role === "OWNER" ? prisma.billingCustomer.findUnique({ where: { companyId: auth.companyId } }) : Promise.resolve(null)
  ]);
  const storageBytes = storage._sum.sizeBytes ? Number(storage._sum.sizeBytes) : 0;
  const allowLocalSimulation = auth.role === "OWNER" && process.env.NODE_ENV !== "production" && !billingEnabled;
  return <main className="screen"><h1 className="type-page-title">Plan y uso</h1><p className="type-secondary mt-2">Periodo actual: {periodStart.toLocaleDateString("es-ES")}–{new Date(periodEnd.getTime() - 1).toLocaleDateString("es-ES")}. Límites y consumo proceden de registros de la empresa.</p><div className="mt-6 grid gap-4 lg:grid-cols-3"><section className="card p-5 lg:col-span-2"><p className="type-label">Plan actual</p><h2 className="mt-2 text-2xl font-bold">{planCatalog[commercial.planKey as keyof typeof planCatalog]?.name ?? commercial.planKey}</h2><p className="type-secondary mt-2">Estado: {commercial.subscription?.status ?? "Plan base compatible"}</p>{commercial.subscription?.trialEndsAt ? <p className="mt-2 text-sm">Prueba hasta {commercial.subscription.trialEndsAt.toLocaleDateString("es-ES")}</p> : null}</section><UsageCard label="Miembros" value={members} limit={commercial.values.max_members}/></div><section className="card mt-4 p-5"><h2 className="type-section-title">Consumo medido</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><UsageCard label="Documentos del mes" value={documents} limit={commercial.values.max_documents}/><UsageCard label="Almacenamiento" value={formatBytes(storageBytes)} limit={formatBytes(Number(commercial.values.storage_bytes ?? 0))}/><UsageCard label="Operaciones de IA" value={aiUsage._count.id} limit={commercial.values.monthly_orqena_actions}/><UsageCard label="Tokens de IA registrados" value={Number(aiUsage._sum.inputTokens ?? 0) + Number(aiUsage._sum.outputTokens ?? 0)} detail={`${Number(aiUsage._sum.costAmount ?? 0).toFixed(6)} EUR agregados`}/>{usage.map((item) => <UsageCard key={item.metric} label={item.metric} value={String(item._sum.quantity ?? 0)}/>)}</div></section>{auth.role === "OWNER" && priceMappings.length ? <section className="card mt-4 p-5"><h2 className="type-section-title">Suscripción y facturas</h2><p className="type-secondary mt-2">Stripe solo se abre después de tu confirmación. Orqena no aplica cargos por sobreuso.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><form action={startStripeCheckout} className="grid gap-3"><select name="planKey" className="field">{[...new Set(priceMappings.map((item) => item.planKey))].map((key) => <option key={key} value={key}>{planCatalog[key as keyof typeof planCatalog]?.name ?? key}</option>)}</select><select name="interval" className="field"><option value="month">Mensual</option><option value="year">Anual</option></select><input type="hidden" name="confirm" value="CONTINUAR_STRIPE"/><input type="hidden" name="idempotencyKey" value={`checkout:${auth.companyId}:${randomUUID()}`}/><button className="primary-button">Continuar a pago seguro</button></form>{billingCustomer ? <form action={openStripeCustomerPortal} className="grid content-start gap-3"><p className="type-secondary">Gestiona método de pago, facturas y cancelación en el portal del proveedor.</p><input type="hidden" name="confirm" value="ABRIR_PORTAL"/><input type="hidden" name="idempotencyKey" value={`portal:${auth.companyId}:${randomUUID()}`}/><button className="secondary-button">Abrir portal de cliente</button></form> : null}</div></section> : allowLocalSimulation ? <section className="card mt-4 p-5" data-local-plan-simulation="development-only"><h2 className="type-section-title">Simular cambio de plan</h2><p className="type-secondary mt-2">Solo desarrollo local: no cobra, no usa claves y registra el cambio en auditoría.</p><form action={changeLocalPlan} className="mt-4 flex flex-col gap-3 sm:flex-row"><select name="planKey" className="field">{Object.entries(planCatalog).map(([key, plan]) => <option key={key} value={key}>{plan.name}</option>)}</select><input type="hidden" name="confirm" value="CAMBIAR"/><button className="primary-button">Aplicar cambio local</button></form></section> : auth.role === "OWNER" ? <section className="card mt-4 p-5"><h2 className="type-section-title">Gestión comercial no disponible</h2><p className="type-secondary mt-2">La contratación permanece cerrada hasta que el proveedor, los precios y el portal estén configurados de forma completa. No se simulan cambios en producción.</p></section> : null}</main>;
}

function UsageCard({ label, value, limit, detail }: { label: string; value: string | number; limit?: string | number | boolean; detail?: string }) {
  return <article className="rounded-lg bg-subtle p-3"><p className="type-label">{label}</p><p className="mt-2 text-2xl font-bold">{String(value)}{limit !== undefined ? <span className="text-base font-normal text-content-secondary"> / {String(limit)}</span> : null}</p>{detail ? <p className="type-meta mt-1">{detail}</p> : null}</article>;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1_000)), units.length - 1);
  return `${(value / 1_000 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
