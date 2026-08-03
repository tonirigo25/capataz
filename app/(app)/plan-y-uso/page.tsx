import { randomUUID } from "node:crypto";
import Link from "next/link";
import {
  Bot,
  Building2,
  Check,
  CircleAlert,
  CreditCard,
  Database,
  FileText,
  Gauge,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { InternalBreadcrumbs } from "@/components/internal-breadcrumbs";
import { stripePriceForPlan } from "@/lib/billing/config";
import { commercialAccessPolicy } from "@/lib/commercial/access-policy";
import { getEntitlements, requireCapability } from "@/lib/commercial/authorization";
import { planCatalog, type PlanKey } from "@/lib/commercial/plans";
import { prisma } from "@/lib/prisma";
import {
  changeLocalPlan,
  changeStripeSubscription,
  openStripeCustomerPortal,
  scheduleStripeDowngrade,
  startStripeCheckout,
} from "./actions";
import styles from "./plan-usage.module.css";

const CHECKOUT_PLAN_KEYS = ["STARTER", "PROFESSIONAL", "BUSINESS"] as const;
const FEATURE_CATALOG = [
  { key: "multi_company", label: "Varias empresas", icon: Building2 },
  { key: "advanced_permissions", label: "Permisos avanzados", icon: ShieldCheck },
  { key: "custom_roles", label: "Roles personalizados", icon: Users },
  { key: "team_management", label: "Gestión de equipo", icon: Users },
  { key: "team_scopes", label: "Ámbitos de equipo", icon: ShieldCheck },
  { key: "orqena_chat", label: "Asistente Orqena IA", icon: Sparkles },
  { key: "orqena_actions", label: "Acciones de IA supervisadas", icon: Bot },
  { key: "orqena_memory", label: "Memoria contextual", icon: Database },
  { key: "document_extraction", label: "Extracción documental", icon: FileText },
  { key: "advanced_reports", label: "Informes avanzados", icon: Gauge },
  { key: "exports", label: "Exportaciones", icon: FileText },
  { key: "automations", label: "Automatizaciones", icon: Workflow },
  { key: "priority_support", label: "Soporte prioritario", icon: ShieldCheck },
  { key: "audit_log", label: "Registro de auditoría", icon: LockKeyhole },
  { key: "custom_branding", label: "Marca personalizada", icon: Settings2 },
  { key: "api_access", label: "Acceso API", icon: Workflow },
  { key: "increased_storage", label: "Almacenamiento ampliado", icon: Database },
] as const;

export const dynamic = "force-dynamic";

export default async function PlanUsagePage() {
  const auth = await requireCapability("company.billing.manage");
  const commercial = await getEntitlements(auth.companyId);
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const billingEnabled = process.env.BILLING_ENABLED === "true";
  const billingCatalogReady = billingEnabled && hasCompleteStripeCatalog();

  const [members, usage, documents, storage, aiUsage, automations, billingCustomer, billingCustomerLink] = await Promise.all([
    prisma.companyMembership.count({ where: { companyId: auth.companyId, status: "active" } }),
    prisma.usageRecord.groupBy({ by: ["metric"], where: { companyId: auth.companyId, periodStart: { lt: periodEnd }, periodEnd: { gt: periodStart } }, _sum: { quantity: true } }),
    prisma.document.count({ where: { companyId: auth.companyId, archivedAt: null } }),
    prisma.storedObject.aggregate({ where: { companyId: auth.companyId, deletedAt: null }, _sum: { sizeBytes: true } }),
    prisma.aiUsageEvent.aggregate({ where: { companyId: auth.companyId, createdAt: { gte: periodStart, lt: periodEnd } }, _count: { id: true }, _sum: { inputTokens: true, outputTokens: true, costAmount: true } }),
    prisma.automationDefinition.count({ where: { companyId: auth.companyId, archivedAt: null } }),
    auth.role === "OWNER" ? prisma.billingCustomer.findUnique({ where: { companyId: auth.companyId } }) : Promise.resolve(null),
    auth.role === "OWNER" ? prisma.billingCustomerCompanyLink.findFirst({ where: { provider: "stripe", companyId: auth.companyId } }) : Promise.resolve(null),
  ]);

  const plan = planCatalog[commercial.planKey as PlanKey];
  const planName = commercial.subscription?.plan.name ?? plan?.name ?? commercial.planKey;
  const planDescription = commercial.subscription?.plan.description ?? plan?.description ?? "Configuración asignada a la empresa";
  const storageBytes = storage._sum.sizeBytes ? Number(storage._sum.sizeBytes) : 0;
  const inputTokens = Number(aiUsage._sum.inputTokens ?? 0);
  const outputTokens = Number(aiUsage._sum.outputTokens ?? 0);
  const aiCost = Number(aiUsage._sum.costAmount ?? 0);
  const memberLimit = numericLimit(commercial.values.max_members);
  const documentLimit = numericLimit(commercial.values.max_documents);
  const storageLimit = numericLimit(commercial.values.storage_bytes);
  const aiLimit = numericLimit(commercial.values.monthly_orqena_actions);
  const automationLimit = numericLimit(commercial.values.max_automations);
  const allowLocalSimulation = auth.role === "OWNER" && process.env.NODE_ENV !== "production" && !billingEnabled;
  const access = commercial.subscription
    ? commercialAccessPolicy({
        status: commercial.subscription.status,
        graceEndsAt: commercial.subscription.graceEndsAt,
        currentPeriodEnd: commercial.subscription.currentPeriodEnd,
        now,
      })
    : { access: "FULL" as const, reason: "base_plan" };
  const enabledFeatures = FEATURE_CATALOG.filter((feature) => commercial.values[feature.key] === true).length;

  return (
    <main className={`screen ${styles.page}`} data-plan-usage-workspace>
      <InternalBreadcrumbs items={[{ label: "Configuración", href: "/configuracion" }, { label: "Plan y uso" }]} />

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Suscripción y capacidad</p>
          <h1>Plan y uso</h1>
          <p>Consulta el plan, los límites y el consumo real de {auth.companyName}. Los cambios comerciales permanecen cerrados mientras billing esté apagado.</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.periodChip}>Periodo IA · {shortDate(periodStart)}–{shortDate(new Date(periodEnd.getTime() - 1))}</span>
          <Link className={styles.secondaryAction} href="/configuracion">
            <Settings2 size={15} aria-hidden="true" /> Configuración
          </Link>
        </div>
      </header>

      <section className={styles.kpiGrid} aria-label="Resumen del plan">
        <KpiCard icon={CreditCard} label="Plan activo" value={planName} detail={subscriptionStatusLabel(commercial.subscription?.status)} tone="green" />
        <KpiCard icon={Users} label="Usuarios incluidos" value={`${members} / ${formatLimit(memberLimit)}`} detail={usageState(members, memberLimit).label} tone={usageState(members, memberLimit).tone} />
        <KpiCard icon={Bot} label="Operaciones IA este mes" value={`${aiUsage._count.id} / ${formatLimit(aiLimit)}`} detail={usageState(aiUsage._count.id, aiLimit).label} tone={usageState(aiUsage._count.id, aiLimit).tone} />
        <KpiCard icon={ShieldCheck} label="Estado de acceso" value={accessLabel(access.access)} detail={accessReasonLabel(access.reason)} tone={access.access === "FULL" ? "green" : access.access === "READ_ONLY" ? "amber" : "red"} />
      </section>

      <div className={styles.primaryGrid}>
        <section className={styles.panel} data-plan-subscription>
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Suscripción</p>
              <h2>{planName}</h2>
              <p>{planDescription}</p>
            </div>
            <span className={styles.statusBadge} data-tone={access.access === "FULL" ? "green" : "amber"}>{subscriptionStatusLabel(commercial.subscription?.status)}</span>
          </div>

          <dl className={styles.definitionGrid}>
            <Definition label="Empresa" value={auth.companyName} />
            <Definition label="Proveedor" value={commercial.subscription?.provider === "stripe" ? "Stripe" : "Gestión interna"} />
            <Definition label="Inicio del periodo" value={commercial.subscription ? longDate(commercial.subscription.currentPeriodStart) : "Sin ciclo de cobro"} />
            <Definition label="Fin del periodo" value={commercial.subscription ? longDate(commercial.subscription.currentPeriodEnd) : "No aplicable"} />
            <Definition label="Renovación" value={renewalLabel(commercial.subscription)} />
            <Definition label="Plan programado" value={commercial.subscription?.scheduledPlanKey ? planLabel(commercial.subscription.scheduledPlanKey) : "Sin cambios pendientes"} />
            {commercial.subscription?.trialEndsAt ? <Definition label="Fin de prueba" value={longDate(commercial.subscription.trialEndsAt)} /> : null}
            {commercial.subscription?.graceEndsAt ? <Definition label="Fin de gracia" value={longDate(commercial.subscription.graceEndsAt)} /> : null}
          </dl>

          <div className={styles.notice} data-tone={billingEnabled ? "green" : "neutral"}>
            {billingEnabled ? <ShieldCheck size={18} aria-hidden="true" /> : <LockKeyhole size={18} aria-hidden="true" />}
            <div>
              <strong>{billingEnabled ? "Proveedor comercial habilitado" : "Cobros reales desactivados"}</strong>
              <p>{billingEnabled ? "Las acciones disponibles requieren confirmación, catálogo completo e identidad OWNER." : "BILLING_ENABLED=false. No se crean cobros, suscripciones ni cambios de plan en producción."}</p>
            </div>
          </div>
        </section>

        <section className={styles.panel} data-plan-account>
          <div className={styles.panelHeadingCompact}>
            <div>
              <p className={styles.eyebrow}>Cuenta</p>
              <h2>Control comercial</h2>
            </div>
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <dl className={styles.accountList}>
            <Definition label="Rol actual" value={roleLabel(auth.role)} />
            <Definition label="Permiso" value="Gestión de plan" />
            <Definition label="Acceso operativo" value={accessLabel(access.access)} />
            <Definition label="Catálogo Stripe" value={billingCatalogReady ? "Completo" : "Cerrado"} />
            <Definition label="Cliente de facturación" value={billingCustomer || billingCustomerLink ? "Vinculado" : "No vinculado"} />
            <Definition label="Empresas incluidas" value={formatLimit(numericLimit(commercial.values.max_companies))} />
            <Definition label="Transcripciones mensuales" value={formatLimit(numericLimit(commercial.values.monthly_transcriptions))} />
            {billingCustomer?.email ? <Definition label="Contacto de facturación" value={billingCustomer.email} /> : null}
          </dl>
          <div className={styles.quickLinks}>
            <Link href="/equipo">Revisar equipo y permisos</Link>
            <Link href="/configuracion/ia">Revisar IA y consumo</Link>
          </div>
        </section>
      </div>

      <section className={styles.panel} data-plan-real-consumption>
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.eyebrow}>Consumo real</p>
            <h2>Límites del plan</h2>
            <p>Las lecturas nunca se bloquean. Al alcanzar el límite se detienen nuevas operaciones sin aplicar cargos automáticos.</p>
          </div>
          <span className={styles.policyChip}>Aviso 80 % · bloqueo 100 %</span>
        </div>
        <div className={styles.usageGrid}>
          <UsageMeter icon={Users} label="Miembros activos" value={members} limit={memberLimit} valueLabel={String(members)} />
          <UsageMeter icon={FileText} label="Documentos activos" value={documents} limit={documentLimit} valueLabel={documents.toLocaleString("es-ES")} />
          <UsageMeter icon={Database} label="Almacenamiento" value={storageBytes} limit={storageLimit} valueLabel={formatBytes(storageBytes)} limitLabel={formatBytes(storageLimit)} />
          <UsageMeter icon={Bot} label="Operaciones de IA" value={aiUsage._count.id} limit={aiLimit} valueLabel={aiUsage._count.id.toLocaleString("es-ES")} />
          <UsageMeter icon={Workflow} label="Automatizaciones" value={automations} limit={automationLimit} valueLabel={automations.toLocaleString("es-ES")} />
        </div>
        <div className={styles.aiDetail}>
          <div><span>Tokens de entrada</span><strong>{inputTokens.toLocaleString("es-ES")}</strong></div>
          <div><span>Tokens de salida</span><strong>{outputTokens.toLocaleString("es-ES")}</strong></div>
          <div><span>Coste IA agregado</span><strong>{formatCurrency(aiCost)}</strong></div>
          <div><span>Registros de uso adicionales</span><strong>{usage.length}</strong></div>
        </div>
        {usage.length ? (
          <details className={styles.usageDetails}>
            <summary>Ver contadores técnicos registrados</summary>
            <ul>{usage.map((item) => <li key={item.metric}><span>{usageMetricLabel(item.metric)}</span><strong>{Number(item._sum.quantity ?? 0).toLocaleString("es-ES")}</strong></li>)}</ul>
          </details>
        ) : null}
      </section>

      <div className={styles.secondaryGrid}>
        <section className={styles.panel} data-plan-entitlements>
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Capacidades</p>
              <h2>Módulos incluidos</h2>
              <p>{enabledFeatures} de {FEATURE_CATALOG.length} capacidades de referencia activas para este plan.</p>
            </div>
          </div>
          <div className={styles.featureGrid}>
            {FEATURE_CATALOG.map((feature) => {
              const enabled = commercial.values[feature.key] === true;
              const Icon = feature.icon;
              return (
                <article key={feature.key} className={styles.feature} data-enabled={enabled ? "true" : "false"}>
                  <span><Icon size={16} aria-hidden="true" /></span>
                  <div><strong>{feature.label}</strong><small>{enabled ? "Incluido" : "No incluido"}</small></div>
                  {enabled ? <Check size={16} aria-label="Incluido" /> : <LockKeyhole size={15} aria-label="No incluido" />}
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.panel} data-plan-actions>
          <div className={styles.panelHeadingCompact}>
            <div>
              <p className={styles.eyebrow}>Acciones</p>
              <h2>Gestión del plan</h2>
            </div>
          </div>
          {auth.role === "OWNER" && billingCatalogReady ? (
            <BillingActions companyId={auth.companyId} hasCustomer={Boolean(billingCustomer || billingCustomerLink)} hasSubscription={Boolean(commercial.subscription?.stripeSubscriptionId)} />
          ) : allowLocalSimulation ? (
            <section className={styles.actionStack} data-local-plan-simulation="development-only">
              <div className={styles.notice} data-tone="amber"><CircleAlert size={18} aria-hidden="true" /><div><strong>Simulación local</strong><p>Disponible sólo fuera de producción. No cobra y deja auditoría.</p></div></div>
              <form action={changeLocalPlan} className={styles.actionForm}>
                <label htmlFor="local-plan-key">Plan de prueba</label>
                <select id="local-plan-key" name="planKey" className="field" defaultValue={commercial.planKey}>{Object.entries(planCatalog).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}</select>
                <input type="hidden" name="confirm" value="CAMBIAR" />
                <button className={styles.primaryAction}>Aplicar cambio local</button>
              </form>
            </section>
          ) : (
            <div className={styles.closedState}>
              <LockKeyhole size={24} aria-hidden="true" />
              <h3>Gestión comercial cerrada</h3>
              <p>{auth.role === "OWNER" ? "Billing continúa apagado o el catálogo no está completo. No se ofrece ninguna acción que pueda crear un cobro real." : "Sólo la persona propietaria puede modificar la suscripción. Tu acceso actual es de consulta."}</p>
              <Link className={styles.secondaryAction} href="/configuracion">Volver a configuración</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function BillingActions({ companyId, hasCustomer, hasSubscription }: { companyId: string; hasCustomer: boolean; hasSubscription: boolean }) {
  return (
    <div className={styles.actionStack}>
      <form action={startStripeCheckout} className={styles.actionForm}>
        <label htmlFor="checkout-plan">Plan y periodicidad</label>
        <div className={styles.formRow}>
          <select id="checkout-plan" name="planKey" className="field">{CHECKOUT_PLAN_KEYS.map((key) => <option key={key} value={key}>{planCatalog[key].name}</option>)}</select>
          <select name="interval" aria-label="Periodicidad" className="field"><option value="month">Mensual</option><option value="year">Anual</option></select>
        </div>
        <input type="hidden" name="confirm" value="CONTINUAR_STRIPE" />
        <input type="hidden" name="idempotencyKey" value={`checkout:${companyId}:${randomUUID()}`} />
        <button className={styles.primaryAction}>Continuar a pago seguro</button>
      </form>
      {hasCustomer ? (
        <form action={openStripeCustomerPortal} className={styles.actionForm}>
          <input type="hidden" name="confirm" value="ABRIR_PORTAL" />
          <input type="hidden" name="idempotencyKey" value={`portal:${companyId}:${randomUUID()}`} />
          <button className={styles.secondaryAction}>Abrir portal de cliente</button>
        </form>
      ) : null}
      {hasSubscription ? (
        <>
          <form action={changeStripeSubscription} className={styles.actionForm}>
            <label htmlFor="subscription-plan">Cambiar suscripción</label>
            <div className={styles.formRow}>
              <select id="subscription-plan" name="planKey" className="field">{CHECKOUT_PLAN_KEYS.map((key) => <option key={key} value={key}>{planCatalog[key].name}</option>)}</select>
              <select name="interval" aria-label="Periodicidad del cambio" className="field"><option value="month">Mensual</option><option value="year">Anual</option></select>
            </div>
            <input type="hidden" name="confirm" value="CAMBIAR_SUSCRIPCION" />
            <input type="hidden" name="idempotencyKey" value={`subscription-change:${companyId}:${randomUUID()}`} />
            <button className={styles.secondaryAction}>Solicitar cambio</button>
          </form>
          <form action={scheduleStripeDowngrade} className={styles.actionForm}>
            <label htmlFor="downgrade-plan">Programar plan inferior</label>
            <div className={styles.formRow}>
              <select id="downgrade-plan" name="planKey" className="field"><option value="STARTER">{planCatalog.STARTER.name}</option><option value="PROFESSIONAL">{planCatalog.PROFESSIONAL.name}</option></select>
              <select name="interval" aria-label="Periodicidad del plan inferior" className="field"><option value="month">Mensual</option><option value="year">Anual</option></select>
            </div>
            <input type="hidden" name="confirm" value="PROGRAMAR_DOWNGRADE" />
            <input type="hidden" name="idempotencyKey" value={`downgrade:${companyId}:${randomUUID()}`} />
            <button className={styles.secondaryAction}>Programar al final del periodo</button>
          </form>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, detail, tone }: { icon: typeof CreditCard; label: string; value: string; detail: string; tone: "green" | "amber" | "red" }) {
  return <article className={styles.kpi} data-tone={tone}><span className={styles.kpiIcon}><Icon size={18} aria-hidden="true" /></span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>;
}

function Definition({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function UsageMeter({ icon: Icon, label, value, limit, valueLabel, limitLabel }: { icon: typeof Users; label: string; value: number; limit: number; valueLabel: string; limitLabel?: string }) {
  const state = usageState(value, limit);
  return (
    <article className={styles.usageCard} data-tone={state.tone}>
      <div className={styles.usageTop}><span><Icon size={17} aria-hidden="true" /></span><small>{state.label}</small></div>
      <p>{label}</p>
      <strong>{valueLabel} <span>/ {limitLabel ?? formatLimit(limit)}</span></strong>
      <div className={styles.progressTrack} role="progressbar" aria-label={`${label}: ${state.percent}%`} aria-valuenow={state.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${state.percent}%` }} /></div>
      <small>{state.percent}% utilizado</small>
    </article>
  );
}

function hasCompleteStripeCatalog() {
  try {
    for (const planKey of CHECKOUT_PLAN_KEYS) {
      stripePriceForPlan(planKey, "month");
      stripePriceForPlan(planKey, "year");
    }
    return true;
  } catch {
    return false;
  }
}

function numericLimit(value: boolean | number | string | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function usageState(value: number, limit: number): { percent: number; label: string; tone: "green" | "amber" | "red" } {
  if (limit <= 0) return { percent: value > 0 ? 100 : 0, label: "No incluido", tone: value > 0 ? "red" : "amber" };
  const percent = Math.min(100, Math.max(0, Math.round((value / limit) * 100)));
  if (value >= limit) return { percent, label: "Límite alcanzado", tone: "red" };
  if (percent >= 80) return { percent, label: "Revisar consumo", tone: "amber" };
  return { percent, label: "Dentro del límite", tone: "green" };
}

function subscriptionStatusLabel(status?: string) {
  const labels: Record<string, string> = { TRIALING: "En periodo de prueba", ACTIVE: "Activo", PAST_DUE: "Pago pendiente", PAUSED: "Pausado", CANCELED: "Cancelado", EXPIRED: "Finalizado" };
  return status ? labels[status] ?? status : "Plan base activo";
}

function accessLabel(access: string) {
  return access === "FULL" ? "Acceso completo" : access === "READ_ONLY" ? "Sólo lectura" : "Bloqueado";
}

function accessReasonLabel(reason: string) {
  const labels: Record<string, string> = { base_plan: "Configuración interna", subscription_active: "Suscripción vigente", canceled_period_remaining: "Activo hasta fin de periodo", payment_grace: "Dentro del periodo de gracia", payment_grace_expired: "Gracia finalizada", subscription_paused: "Suscripción pausada", subscription_ended: "Suscripción finalizada" };
  return labels[reason] ?? "Política comercial aplicada";
}

function roleLabel(role: string) {
  const labels: Record<string, string> = { OWNER: "Propietario", ADMIN: "Administración", MEMBER: "Miembro" };
  return labels[role] ?? role;
}

function renewalLabel(subscription: Awaited<ReturnType<typeof getEntitlements>>["subscription"]) {
  if (!subscription) return "Sin renovación comercial";
  if (subscription.cancelAtPeriodEnd) return `Cancelación al ${longDate(subscription.currentPeriodEnd)}`;
  return billingProviderLabel(subscription.provider) === "Stripe" ? `Prevista el ${longDate(subscription.currentPeriodEnd)}` : "Gestionada internamente";
}

function billingProviderLabel(provider: string) {
  return provider.toLowerCase() === "stripe" ? "Stripe" : "Gestión interna";
}

function planLabel(planKey: string) {
  return planCatalog[planKey as PlanKey]?.name ?? planKey;
}

function usageMetricLabel(metric: string) {
  const labels: Record<string, string> = { "ai.action": "Acciones de IA", "automation.run": "Ejecuciones de automatización", documents: "Documentos", storage: "Almacenamiento" };
  return labels[metric] ?? metric.replace(/[._-]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

function formatLimit(value: number) {
  return value > 0 ? value.toLocaleString("es-ES") : "0";
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1_000)), units.length - 1);
  return `${(value / 1_000 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: value < 1 ? 4 : 2, maximumFractionDigits: value < 1 ? 4 : 2 }).format(value);
}

function shortDate(value: Date) {
  return value.toLocaleDateString("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" });
}

function longDate(value: Date) {
  return value.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}
