import { pathToFileURL } from "node:url";
import type { Prisma, PrismaClient } from "@prisma/client";
import { ensureBasePlans } from "../../lib/commercial/provisioning";

export const REVIEW_RIGO_HOY_TARGET = {
  projectId: "c54a5065-df2c-46b9-a82b-cfac3be07315",
  environmentId: "e41b5add-511c-4697-b2b5-48164506f49a",
  databaseServiceId: "d14f98ec-1a00-4cc5-88fc-2ac0c99c8f1b",
  environmentName: "review",
  companyName: "Rigo Asociados",
  companySlug: "rigo-asociados-review",
  provisioningKey: "continuous-review:rigo-asociados:hoy:v1",
  demoScenarioKey: "rigo-hoy-v1",
} as const;

export const REVIEW_RIGO_HOY_LEGACY_COMPANY_NAME = "Orqena Review · Construcción";

export const REVIEW_RIGO_HOY_IDS = {
  company: "review-rigo-hoy-company-v1",
  ownerMembership: "review-rigo-hoy-owner-membership-v1",
  clientAlfa: "review-rigo-hoy-client-alfa-v1",
  clientBeta: "review-rigo-hoy-client-beta-v1",
  clientDelta: "review-rigo-hoy-client-delta-v1",
  clientIndustrias: "review-rigo-hoy-client-industrias-v1",
  clientGamma: "review-rigo-hoy-client-gamma-v1",
  workEdificioArce: "review-rigo-hoy-work-edificio-arce-v1",
  workResidencialSol: "review-rigo-hoy-work-residencial-sol-v1",
  workLocalComercial: "review-rigo-hoy-work-local-comercial-v1",
  workOficinasCentral: "review-rigo-hoy-work-oficinas-central-v1",
  workReformaBravo: "review-rigo-hoy-work-reforma-bravo-v1",
  budgetP0247: "review-rigo-hoy-budget-p0247-v1",
  invoiceF0155: "review-rigo-hoy-invoice-f0155-v1",
  invoiceF0156: "review-rigo-hoy-invoice-f0156-v1",
  invoiceF0158: "review-rigo-hoy-invoice-f0158-v1",
  documentContractGamma: "review-rigo-hoy-document-contract-gamma-v1",
  documentProgressArce: "review-rigo-hoy-document-progress-arce-v1",
  documentControl: "review-rigo-hoy-document-control-v1",
  followupIndustrias: "review-rigo-hoy-followup-industrias-v1",
  followupFuture: "review-rigo-hoy-followup-future-v1",
  expenseMaterials: "review-rigo-hoy-expense-materials-v1",
  expenseMachinery: "review-rigo-hoy-expense-machinery-v1",
  recommendationBudget: "review-rigo-hoy-recommendation-budget-v1",
  recommendationFingerprint: "review-rigo-hoy:budget:p0247:before-noon:v1",
  subscription: "review-rigo-hoy-enterprise-subscription-v1",
  userLaura: "review-rigo-hoy-user-laura-v1",
  userDiego: "review-rigo-hoy-user-diego-v1",
  eventInternalMeeting: "review-rigo-hoy-event-internal-meeting-v1",
  eventTechnicalVisit: "review-rigo-hoy-event-technical-visit-v1",
  eventBudgetReview: "review-rigo-hoy-event-budget-review-v1",
  eventCommercialCall: "review-rigo-hoy-event-commercial-call-v1",
  eventDocumentConfirmation: "review-rigo-hoy-event-document-confirmation-v1",
  eventCompletedVisit: "review-rigo-hoy-event-completed-visit-v1",
  legacyEventWeeklyReview: "review-event-5",
  legacyFollowUpBudget: "review-followup-1",
  legacyFollowUpCollection: "review-followup-2",
  legacyFollowUpVisit: "review-followup-3",
  auditBudget: "review-rigo-hoy-audit-budget-v1",
  auditInvoice: "review-rigo-hoy-audit-invoice-v1",
  auditVisit: "review-rigo-hoy-audit-visit-v1",
  auditDocument: "review-rigo-hoy-audit-document-v1",
  auditClient: "review-rigo-hoy-audit-client-v1",
} as const;

type ReviewTargetEnvironment = {
  [key: string]: string | undefined;
  ORQENA_REVIEW_RIGO_HOY_APPROVED?: string;
  ORQENA_REVIEW_RIGO_OWNER_EMAIL?: string;
  ORQENA_REVIEW_DATABASE_SERVICE_ID?: string;
  RAILWAY_PROJECT_ID?: string;
  RAILWAY_ENVIRONMENT_ID?: string;
  RAILWAY_ENVIRONMENT_NAME?: string;
  RAILWAY_SERVICE_ID?: string;
  NEXT_PUBLIC_APP_ENV?: string;
  CREDENTIAL_SCOPE?: string;
  DATABASE_URL?: string;
};

type ExistingMembership = {
  companyId: string;
};

type AgendaFixture = {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: "visita" | "llamada" | "seguimiento_presupuesto" | "recordatorio_interno";
  estado: "confirmado" | "pendiente" | "realizado";
  fechaInicio: Date;
  fechaFin: Date;
  clienteId: string;
  obraId: string | null;
  presupuestoId?: string | null;
  direccion: string | null;
  requiereConfirmacion: boolean;
  confirmadoPorUsuario: boolean;
};

const ALLOWED_DATABASE_HOST = /(?:^|\.)(?:railway\.internal|proxy\.rlwy\.net)$/u;
const SYNTHETIC_REVIEW_EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@review\.orqena\.invalid$/u;

export function assertReviewRigoHoyTarget(env: ReviewTargetEnvironment): string {
  if (env.ORQENA_REVIEW_RIGO_HOY_APPROVED !== "true") throw new Error("REVIEW_RIGO_HOY_APPROVAL_REQUIRED");
  if (env.RAILWAY_PROJECT_ID !== REVIEW_RIGO_HOY_TARGET.projectId) throw new Error("REVIEW_RIGO_HOY_PROJECT_MISMATCH");
  if (env.RAILWAY_ENVIRONMENT_ID !== REVIEW_RIGO_HOY_TARGET.environmentId) throw new Error("REVIEW_RIGO_HOY_ENVIRONMENT_MISMATCH");
  if (env.RAILWAY_ENVIRONMENT_NAME !== REVIEW_RIGO_HOY_TARGET.environmentName) throw new Error("REVIEW_RIGO_HOY_ENVIRONMENT_NAME_MISMATCH");
  if (env.RAILWAY_SERVICE_ID !== REVIEW_RIGO_HOY_TARGET.databaseServiceId) throw new Error("REVIEW_RIGO_HOY_SERVICE_MISMATCH");
  if (env.ORQENA_REVIEW_DATABASE_SERVICE_ID !== REVIEW_RIGO_HOY_TARGET.databaseServiceId) throw new Error("REVIEW_RIGO_HOY_DATABASE_SERVICE_MISMATCH");
  if (env.NEXT_PUBLIC_APP_ENV !== "preview" || env.CREDENTIAL_SCOPE !== "preview") throw new Error("REVIEW_RIGO_HOY_PREVIEW_SCOPE_REQUIRED");

  let database: URL;
  try {
    database = new URL(env.DATABASE_URL ?? "");
  } catch {
    throw new Error("REVIEW_RIGO_HOY_DATABASE_URL_INVALID");
  }
  if (!ALLOWED_DATABASE_HOST.test(database.hostname)) throw new Error("REVIEW_RIGO_HOY_DATABASE_HOST_INVALID");

  const ownerEmail = env.ORQENA_REVIEW_RIGO_OWNER_EMAIL?.trim().toLocaleLowerCase("en-US") ?? "";
  if (ownerEmail !== "demo@demo" && !SYNTHETIC_REVIEW_EMAIL.test(ownerEmail)) throw new Error("REVIEW_RIGO_HOY_OWNER_EMAIL_INVALID");
  return ownerEmail;
}

export function assertExclusiveOwnerMembership(
  memberships: ExistingMembership[],
  targetCompanyIds: ReadonlySet<string>,
) {
  if (memberships.some((membership) => !targetCompanyIds.has(membership.companyId))) {
    throw new Error("REVIEW_RIGO_HOY_OWNER_HAS_OTHER_MEMBERSHIPS");
  }
}

function todayAt(now: Date, hour: number, minute = 0) {
  const value = new Date(now);
  value.setHours(hour, minute, 0, 0);
  return value;
}

function addDays(value: Date, days: number, hour = value.getHours(), minute = value.getMinutes()) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  result.setHours(hour, minute, 0, 0);
  return result;
}

export function buildRigoHoyAgendaFixtures(now: Date): AgendaFixture[] {
  const at = (hour: number, minute: number, durationMinutes = 60) => {
    const fechaInicio = todayAt(now, hour, minute);
    return {
      fechaInicio,
      fechaFin: new Date(fechaInicio.getTime() + durationMinutes * 60_000),
    };
  };

  return [
    {
      id: REVIEW_RIGO_HOY_IDS.eventInternalMeeting,
      titulo: "Reunión interna de obra",
      descripcion: "Coordinación del equipo en Edificio Arce.",
      tipo: "recordatorio_interno",
      estado: "confirmado",
      ...at(9, 0, 45),
      clienteId: REVIEW_RIGO_HOY_IDS.clientAlfa,
      obraId: REVIEW_RIGO_HOY_IDS.workEdificioArce,
      direccion: "Sala 2",
      requiereConfirmacion: false,
      confirmadoPorUsuario: true,
    },
    {
      id: REVIEW_RIGO_HOY_IDS.eventTechnicalVisit,
      titulo: "Visita técnica",
      descripcion: "Visita sintética para revisar el avance de Edificio Arce.",
      tipo: "visita",
      estado: "confirmado",
      ...at(10, 30, 60),
      clienteId: REVIEW_RIGO_HOY_IDS.clientAlfa,
      obraId: REVIEW_RIGO_HOY_IDS.workEdificioArce,
      direccion: "Calle Mayor 12, Madrid",
      requiereConfirmacion: false,
      confirmadoPorUsuario: true,
    },
    {
      id: REVIEW_RIGO_HOY_IDS.eventBudgetReview,
      titulo: "Revisión de presupuesto",
      descripcion: "Revisión interna sintética; no implica envío ni proveedor externo.",
      tipo: "seguimiento_presupuesto",
      estado: "pendiente",
      ...at(12, 0, 30),
      clienteId: REVIEW_RIGO_HOY_IDS.clientAlfa,
      obraId: null,
      presupuestoId: REVIEW_RIGO_HOY_IDS.budgetP0247,
      direccion: null,
      requiereConfirmacion: true,
      confirmadoPorUsuario: false,
    },
    {
      id: REVIEW_RIGO_HOY_IDS.eventCommercialCall,
      titulo: "Llamada seguimiento comercial",
      descripcion: "Seguimiento sintético preparado sin comunicación externa.",
      tipo: "llamada",
      estado: "pendiente",
      ...at(15, 30, 30),
      clienteId: REVIEW_RIGO_HOY_IDS.clientIndustrias,
      obraId: null,
      direccion: null,
      requiereConfirmacion: true,
      confirmadoPorUsuario: false,
    },
    {
      id: REVIEW_RIGO_HOY_IDS.eventDocumentConfirmation,
      titulo: "Confirmar documento",
      descripcion: "Contrato",
      tipo: "recordatorio_interno",
      estado: "pendiente",
      ...at(17, 0, 30),
      clienteId: REVIEW_RIGO_HOY_IDS.clientGamma,
      obraId: null,
      direccion: null,
      requiereConfirmacion: true,
      confirmadoPorUsuario: false,
    },
    {
      id: REVIEW_RIGO_HOY_IDS.eventCompletedVisit,
      titulo: "Visita de replanteo completada",
      descripcion: "Control sintético completado para validar el resumen operativo.",
      tipo: "visita",
      estado: "realizado",
      ...at(18, 30, 30),
      clienteId: REVIEW_RIGO_HOY_IDS.clientBeta,
      obraId: REVIEW_RIGO_HOY_IDS.workResidencialSol,
      direccion: "Residencial Sol · Madrid",
      requiereConfirmacion: false,
      confirmadoPorUsuario: true,
    },
  ];
}

async function resolveTargetCompany(transaction: Prisma.TransactionClient, legacyCompanyId?: string) {
  const [byProvisioningKey, byName, bySlug, byLegacyId] = await Promise.all([
    transaction.company.findUnique({ where: { provisioningKey: REVIEW_RIGO_HOY_TARGET.provisioningKey } }),
    transaction.company.findMany({
      where: {
        nombreComercial: { equals: REVIEW_RIGO_HOY_TARGET.companyName, mode: "insensitive" },
        archivedAt: null,
      },
      take: 2,
    }),
    transaction.company.findUnique({ where: { slug: REVIEW_RIGO_HOY_TARGET.companySlug } }),
    legacyCompanyId ? transaction.company.findUnique({ where: { id: legacyCompanyId } }) : Promise.resolve(null),
  ]);

  if (byName.length > 1) throw new Error("REVIEW_RIGO_HOY_COMPANY_AMBIGUOUS");
  const namedCompany = byName[0] ?? null;
  if (byProvisioningKey && namedCompany && byProvisioningKey.id !== namedCompany.id) throw new Error("REVIEW_RIGO_HOY_COMPANY_IDENTITY_CONFLICT");
  if (bySlug && byProvisioningKey && bySlug.id !== byProvisioningKey.id) throw new Error("REVIEW_RIGO_HOY_COMPANY_SLUG_CONFLICT");
  if (bySlug && namedCompany && bySlug.id !== namedCompany.id) throw new Error("REVIEW_RIGO_HOY_COMPANY_SLUG_CONFLICT");
  if (bySlug && byLegacyId && bySlug.id !== byLegacyId.id) throw new Error("REVIEW_RIGO_HOY_COMPANY_SLUG_CONFLICT");

  const existing = byProvisioningKey ?? namedCompany ?? bySlug ?? byLegacyId;
  if (existing) {
    const legacyCandidate = existing.id === legacyCompanyId && existing.nombreComercial === REVIEW_RIGO_HOY_LEGACY_COMPANY_NAME;
    if (existing.nombreComercial !== REVIEW_RIGO_HOY_TARGET.companyName && !legacyCandidate) throw new Error("REVIEW_RIGO_HOY_COMPANY_NAME_CONFLICT");
    if (existing.archivedAt || existing.status !== "active" || !existing.isDemo) throw new Error("REVIEW_RIGO_HOY_COMPANY_NOT_SYNTHETIC_ACTIVE");
    if (existing.provisioningKey && existing.provisioningKey !== REVIEW_RIGO_HOY_TARGET.provisioningKey && !legacyCandidate) throw new Error("REVIEW_RIGO_HOY_COMPANY_PROVISIONING_CONFLICT");
    return transaction.company.update({
      where: { id: existing.id },
      data: {
        nombreComercial: REVIEW_RIGO_HOY_TARGET.companyName,
        slug: REVIEW_RIGO_HOY_TARGET.companySlug,
        provisioningKey: REVIEW_RIGO_HOY_TARGET.provisioningKey,
        demoScenarioKey: REVIEW_RIGO_HOY_TARGET.demoScenarioKey,
        sectorKey: "construction",
        commercialStatus: "ACTIVE",
      },
    });
  }

  return transaction.company.create({
    data: {
      id: REVIEW_RIGO_HOY_IDS.company,
      slug: REVIEW_RIGO_HOY_TARGET.companySlug,
      nombreComercial: REVIEW_RIGO_HOY_TARGET.companyName,
      organizationType: "COMPANY",
      sectorKey: "construction",
      businessProfileVersion: "1",
      status: "active",
      commercialStatus: "ACTIVE",
      isDemo: true,
      provisioningKey: REVIEW_RIGO_HOY_TARGET.provisioningKey,
      demoScenarioKey: REVIEW_RIGO_HOY_TARGET.demoScenarioKey,
      onboardingState: { step: 1, mainGoal: "Validación visual sintética del módulo Hoy" },
    },
  });
}

async function assertFixtureOwnership(
  transaction: Prisma.TransactionClient,
  companyId: string,
) {
  const [clients, works, budgets, invoices, documents, followUps, expenses, events, recommendations, subscriptions, audits] = await Promise.all([
    transaction.client.findMany({
      where: { id: { in: [REVIEW_RIGO_HOY_IDS.clientAlfa, REVIEW_RIGO_HOY_IDS.clientBeta, REVIEW_RIGO_HOY_IDS.clientDelta, REVIEW_RIGO_HOY_IDS.clientIndustrias, REVIEW_RIGO_HOY_IDS.clientGamma] } },
      select: { id: true, companyId: true },
    }),
    transaction.work.findMany({
      where: { id: { in: [REVIEW_RIGO_HOY_IDS.workEdificioArce, REVIEW_RIGO_HOY_IDS.workResidencialSol, REVIEW_RIGO_HOY_IDS.workLocalComercial, REVIEW_RIGO_HOY_IDS.workOficinasCentral, REVIEW_RIGO_HOY_IDS.workReformaBravo] } },
      select: { id: true, companyId: true },
    }),
    transaction.budget.findMany({ where: { id: REVIEW_RIGO_HOY_IDS.budgetP0247 }, select: { id: true, companyId: true } }),
    transaction.invoice.findMany({ where: { id: { in: [REVIEW_RIGO_HOY_IDS.invoiceF0155, REVIEW_RIGO_HOY_IDS.invoiceF0156, REVIEW_RIGO_HOY_IDS.invoiceF0158] } }, select: { id: true, companyId: true } }),
    transaction.document.findMany({ where: { id: { in: [REVIEW_RIGO_HOY_IDS.documentContractGamma, REVIEW_RIGO_HOY_IDS.documentProgressArce, REVIEW_RIGO_HOY_IDS.documentControl] } }, select: { id: true, companyId: true } }),
    transaction.followUp.findMany({ where: { id: { in: [REVIEW_RIGO_HOY_IDS.followupIndustrias, REVIEW_RIGO_HOY_IDS.followupFuture] } }, select: { id: true, companyId: true } }),
    transaction.expense.findMany({ where: { id: { in: [REVIEW_RIGO_HOY_IDS.expenseMaterials, REVIEW_RIGO_HOY_IDS.expenseMachinery] } }, select: { id: true, companyId: true } }),
    transaction.eventoAgenda.findMany({
      where: { id: { in: buildRigoHoyAgendaFixtures(new Date()).map((event) => event.id) } },
      select: { id: true, companyId: true },
    }),
    transaction.businessRecommendation.findMany({
      where: { OR: [{ id: REVIEW_RIGO_HOY_IDS.recommendationBudget }, { fingerprint: REVIEW_RIGO_HOY_IDS.recommendationFingerprint }] },
      select: { id: true, companyId: true },
    }),
    transaction.subscription.findMany({ where: { id: REVIEW_RIGO_HOY_IDS.subscription }, select: { id: true, companyId: true } }),
    transaction.auditLog.findMany({ where: { id: { in: [REVIEW_RIGO_HOY_IDS.auditBudget, REVIEW_RIGO_HOY_IDS.auditInvoice, REVIEW_RIGO_HOY_IDS.auditVisit, REVIEW_RIGO_HOY_IDS.auditDocument, REVIEW_RIGO_HOY_IDS.auditClient] } }, select: { id: true, companyId: true } }),
  ]);
  const groups = [clients, works, budgets, invoices, documents, followUps, expenses, events, recommendations, subscriptions, audits];
  if (groups.some((items) => items.some((item) => item.companyId !== companyId))) {
    throw new Error("REVIEW_RIGO_HOY_FIXTURE_OWNERSHIP_CONFLICT");
  }
}

export async function provisionReviewRigoHoy(
  database: PrismaClient,
  ownerEmail: string,
  now = new Date(),
) {
  return database.$transaction(async (transaction) => {
    const owner = await transaction.user.findUnique({
      where: { emailNormalized: ownerEmail },
      select: {
        id: true,
        status: true,
        emailVerifiedAt: true,
        memberships: { select: { companyId: true } },
      },
    });
    if (!owner || owner.status !== "active" || !owner.emailVerifiedAt) throw new Error("REVIEW_RIGO_HOY_OWNER_NOT_ACTIVE");

    const existingTargets = await transaction.company.findMany({
      where: {
        OR: [
          { provisioningKey: REVIEW_RIGO_HOY_TARGET.provisioningKey },
          { nombreComercial: { equals: REVIEW_RIGO_HOY_TARGET.companyName, mode: "insensitive" } },
          { slug: REVIEW_RIGO_HOY_TARGET.companySlug },
        ],
      },
      select: { id: true },
    });
    const legacyCompany = existingTargets.length === 0 && owner.memberships.length === 1
      ? await transaction.company.findUnique({ where: { id: owner.memberships[0].companyId }, select: { id: true, nombreComercial: true, isDemo: true, status: true, archivedAt: true } })
      : null;
    const safeLegacyCompany = legacyCompany?.nombreComercial === REVIEW_RIGO_HOY_LEGACY_COMPANY_NAME
      && legacyCompany.isDemo
      && legacyCompany.status === "active"
      && !legacyCompany.archivedAt
      ? legacyCompany
      : null;
    const allowedCompanyIds = new Set(existingTargets.map((company) => company.id));
    if (safeLegacyCompany) allowedCompanyIds.add(safeLegacyCompany.id);
    assertExclusiveOwnerMembership(owner.memberships, allowedCompanyIds);

    const company = await resolveTargetCompany(transaction, safeLegacyCompany?.id);
    const existingMembership = await transaction.companyMembership.findUnique({
      where: { userId_companyId: { userId: owner.id, companyId: company.id } },
    });
    if (existingMembership) {
      const validExistingMembership = existingMembership.role === "OWNER"
        && existingMembership.functionalProfileKey === "OWNER"
        && existingMembership.status === "active"
        && existingMembership.isDemo;
      if (!validExistingMembership) throw new Error("REVIEW_RIGO_HOY_OWNER_MEMBERSHIP_CONFLICT");
      await transaction.companyMembership.update({
        where: { id: existingMembership.id },
        data: {
          accessMode: "STANDARD",
          accessStartsAt: null,
          accessEndsAt: null,
        },
      });
    } else {
      await transaction.companyMembership.create({
        data: {
          id: REVIEW_RIGO_HOY_IDS.ownerMembership,
          userId: owner.id,
          companyId: company.id,
          role: "OWNER",
          functionalProfileKey: "OWNER",
          accessMode: "STANDARD",
          status: "active",
          acceptedAt: now,
          joinedAt: now,
          origin: "review-rigo-hoy",
          isDemo: true,
        },
      });
    }

    const finalMemberships = await transaction.companyMembership.findMany({
      where: { userId: owner.id },
      select: { companyId: true },
    });
    assertExclusiveOwnerMembership(finalMemberships, new Set([company.id]));
    if (finalMemberships.length !== 1) throw new Error("REVIEW_RIGO_HOY_OWNER_MEMBERSHIP_COUNT_INVALID");

    const membership = await transaction.companyMembership.findUniqueOrThrow({
      where: { userId_companyId: { userId: owner.id, companyId: company.id } },
      include: {
        permissionOverrides: true,
        fieldVisibilityPolicies: true,
        scopeAssignments: true,
      },
    });
    if (membership.permissionOverrides.some((item) => item.effect === "DENY")) {
      throw new Error("REVIEW_RIGO_HOY_PERMISSION_OVERRIDE_CONFLICT");
    }
    if (membership.fieldVisibilityPolicies.some((item) => !item.visible)) {
      throw new Error("REVIEW_RIGO_HOY_FIELD_VISIBILITY_CONFLICT");
    }
    if (membership.permissionOverrides.some((item) => item.scope && item.scope !== "COMPANY")
      || membership.scopeAssignments.some((item) => item.scope !== "COMPANY")) {
      throw new Error("REVIEW_RIGO_HOY_SCOPE_RESTRICTION_CONFLICT");
    }

    await ensureBasePlans(transaction);
    const enterprisePlan = await transaction.plan.findUnique({
      where: { key: "ENTERPRISE" },
      include: { entitlements: true },
    });
    if (!enterprisePlan || enterprisePlan.entitlements.length === 0) {
      throw new Error("REVIEW_RIGO_HOY_ENTERPRISE_PLAN_MISSING");
    }
    const entitlementOverride = await transaction.companyEntitlementOverride.findFirst({
      where: {
        companyId: company.id,
        active: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      select: { id: true },
    });
    if (entitlementOverride) throw new Error("REVIEW_RIGO_HOY_ENTITLEMENT_OVERRIDE_CONFLICT");

    const subscriptions = await transaction.subscription.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
    });
    if (subscriptions.length > 1) throw new Error("REVIEW_RIGO_HOY_SUBSCRIPTION_AMBIGUOUS");
    const subscription = subscriptions[0] ?? null;
    if (subscription) {
      const externalBillingAttached = subscription.provider !== "local"
        || Boolean(subscription.externalCustomerId)
        || Boolean(subscription.externalSubscriptionId)
        || Boolean(subscription.providerPriceId)
        || Boolean(subscription.providerProductId)
        || Boolean(subscription.providerCheckoutId)
        || Boolean(subscription.stripeSubscriptionId)
        || Boolean(subscription.stripePriceId);
      if (externalBillingAttached) throw new Error("REVIEW_RIGO_HOY_EXTERNAL_BILLING_CONFLICT");
      await transaction.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: enterprisePlan.id,
          status: "ACTIVE",
          trialEndsAt: null,
          currentPeriodStart: now,
          currentPeriodEnd: addDays(now, 365),
          cancelAtPeriodEnd: false,
          canceledAt: null,
          graceEndsAt: null,
          readOnlyAt: null,
          scheduledPlanKey: null,
          metadata: {
            synthetic: true,
            fixture: REVIEW_RIGO_HOY_TARGET.demoScenarioKey,
            billingEnabled: false,
            stripeObjectsCreated: false,
          },
        },
      });
    } else {
      await transaction.subscription.create({
        data: {
          id: REVIEW_RIGO_HOY_IDS.subscription,
          companyId: company.id,
          planId: enterprisePlan.id,
          status: "ACTIVE",
          provider: "local",
          currentPeriodStart: now,
          currentPeriodEnd: addDays(now, 365),
          metadata: {
            synthetic: true,
            fixture: REVIEW_RIGO_HOY_TARGET.demoScenarioKey,
            billingEnabled: false,
            stripeObjectsCreated: false,
          },
        },
      });
    }
    await transaction.user.update({
      where: { id: owner.id },
      data: { activeCompanyId: company.id, displayName: "Marta Ruiz" },
    });

    await assertFixtureOwnership(transaction, company.id);
    const clientFixtures = [
      {
        id: REVIEW_RIGO_HOY_IDS.clientAlfa,
        nombre: "Cliente Alfa",
        telefono: "+34 000 000 301",
        email: "cliente.alfa@review.orqena.invalid",
        direccion: "Calle Mayor 12, Madrid",
      },
      {
        id: REVIEW_RIGO_HOY_IDS.clientBeta,
        nombre: "Beta SL",
        telefono: "+34 000 000 304",
        email: "cliente.beta@review.orqena.invalid",
        direccion: "Avenida del Sol 24, Madrid",
      },
      {
        id: REVIEW_RIGO_HOY_IDS.clientDelta,
        nombre: "Cliente Delta",
        telefono: "+34 000 000 305",
        email: "cliente.delta@review.orqena.invalid",
        direccion: "Calle Mercado 14, Madrid",
      },
      {
        id: REVIEW_RIGO_HOY_IDS.clientIndustrias,
        nombre: "Industrias Norte",
        telefono: "+34 000 000 302",
        email: "industrias.norte@review.orqena.invalid",
        direccion: "Avenida Sintética 8, Madrid",
      },
      {
        id: REVIEW_RIGO_HOY_IDS.clientGamma,
        nombre: "Cliente Gamma",
        telefono: "+34 000 000 303",
        email: "cliente.gamma@review.orqena.invalid",
        direccion: "Plaza Sintética 3, Madrid",
      },
    ];
    for (const client of clientFixtures) {
      await transaction.client.upsert({
        where: { id: client.id },
        update: { companyId: company.id, nombre: client.nombre, telefono: client.telefono, email: client.email, direccion: client.direccion, tipo: "Empresa", origen: "review-rigo-hoy", archivadoAt: null },
        create: { ...client, companyId: company.id, tipo: "Empresa", origen: "review-rigo-hoy" },
      });
    }

    const [laura, diego] = await Promise.all([
      transaction.user.upsert({
        where: { emailNormalized: "laura.soto@review.orqena.invalid" },
        update: { displayName: "Laura Soto", status: "active", emailVerifiedAt: now },
        create: {
          id: REVIEW_RIGO_HOY_IDS.userLaura,
          email: "laura.soto@review.orqena.invalid",
          emailNormalized: "laura.soto@review.orqena.invalid",
          passwordHash: "review-fixture-no-login",
          displayName: "Laura Soto",
          status: "active",
          emailVerifiedAt: now,
        },
      }),
      transaction.user.upsert({
        where: { emailNormalized: "diego.martin@review.orqena.invalid" },
        update: { displayName: "Diego Martín", status: "active", emailVerifiedAt: now },
        create: {
          id: REVIEW_RIGO_HOY_IDS.userDiego,
          email: "diego.martin@review.orqena.invalid",
          emailNormalized: "diego.martin@review.orqena.invalid",
          passwordHash: "review-fixture-no-login",
          displayName: "Diego Martín",
          status: "active",
          emailVerifiedAt: now,
        },
      }),
    ]);

    const workFixtures = [
      { id: REVIEW_RIGO_HOY_IDS.workEdificioArce, clienteId: REVIEW_RIGO_HOY_IDS.clientAlfa, numeroInterno: "OB-0120", titulo: "Edificio Arce", direccion: "Calle Mayor 12, Madrid", estado: "en_curso" as const, responsable: "Diego Martín", comercial: "Laura Soto", jefeObra: "Diego Martín", completed: 13, total: 20 },
      { id: REVIEW_RIGO_HOY_IDS.workResidencialSol, clienteId: REVIEW_RIGO_HOY_IDS.clientBeta, numeroInterno: "OB-0118", titulo: "Residencial Sol", direccion: "Avenida del Sol 24, Madrid", estado: "en_curso" as const, responsable: "Diego Martín", comercial: "Laura Soto", jefeObra: "Diego Martín", completed: 4, total: 10 },
      { id: REVIEW_RIGO_HOY_IDS.workLocalComercial, clienteId: REVIEW_RIGO_HOY_IDS.clientDelta, numeroInterno: "OB-0112", titulo: "Local Comercial 14", direccion: "Calle Mercado 14, Madrid", estado: "planificada" as const, responsable: "Marta Ruiz", comercial: "Laura Soto", jefeObra: "Diego Martín", completed: 1, total: 5 },
      { id: REVIEW_RIGO_HOY_IDS.workOficinasCentral, clienteId: REVIEW_RIGO_HOY_IDS.clientBeta, numeroInterno: "OB-0105", titulo: "Oficinas Central", direccion: "Paseo Central 5, Madrid", estado: "pendiente_remates" as const, responsable: "Marta Ruiz", comercial: "Laura Soto", jefeObra: "Diego Martín", completed: 9, total: 10 },
      { id: REVIEW_RIGO_HOY_IDS.workReformaBravo, clienteId: REVIEW_RIGO_HOY_IDS.clientGamma, numeroInterno: "OB-0099", titulo: "Reforma Integral Bravo", direccion: "Plaza Sintética 3, Madrid", estado: "pausada" as const, responsable: "Diego Martín", comercial: "Laura Soto", jefeObra: "Diego Martín", completed: 0, total: 0 },
    ];
    const foreignTask = await transaction.task.findFirst({
      where: {
        workId: { in: workFixtures.map((work) => work.id) },
        origin: { not: "review-rigo-hoy" },
      },
      select: { id: true },
    });
    if (foreignTask) throw new Error("REVIEW_RIGO_HOY_WORK_TASK_CONFLICT");
    for (const [index, work] of workFixtures.entries()) {
      const updatedAt = new Date(now.getTime() - index * 60_000);
      await transaction.work.upsert({
        where: { id: work.id },
        update: {
          companyId: company.id,
          clienteId: work.clienteId,
          numeroInterno: work.numeroInterno,
          titulo: work.titulo,
          direccion: work.direccion,
          tipoTrabajo: "Reforma",
          estado: work.estado,
          responsable: work.responsable,
          comercial: work.comercial,
          jefeObra: work.jefeObra,
          archivada: false,
          archivadaAt: null,
          updatedAt,
        },
        create: {
          id: work.id,
          companyId: company.id,
          clienteId: work.clienteId,
          numeroInterno: work.numeroInterno,
          titulo: work.titulo,
          direccion: work.direccion,
          tipoTrabajo: "Reforma",
          estado: work.estado,
          presupuestoAprobado: 0,
          responsable: work.responsable,
          comercial: work.comercial,
          jefeObra: work.jefeObra,
          updatedAt,
        },
      });
      const taskIds = Array.from({ length: work.total }, (_, taskIndex) => `${work.id}-task-${taskIndex + 1}`);
      for (const [taskIndex, taskId] of taskIds.entries()) {
        await transaction.task.upsert({
          where: { id: taskId },
          update: {
            companyId: company.id,
            workId: work.id,
            title: `${work.titulo} · hito ${taskIndex + 1}`,
            origin: "review-rigo-hoy",
            status: taskIndex < work.completed ? "completed" : "planned",
            completedAt: taskIndex < work.completed ? addDays(now, -1) : null,
            archivedAt: null,
          },
          create: {
            id: taskId,
            companyId: company.id,
            workId: work.id,
            title: `${work.titulo} · hito ${taskIndex + 1}`,
            origin: "review-rigo-hoy",
            status: taskIndex < work.completed ? "completed" : "planned",
            completedAt: taskIndex < work.completed ? addDays(now, -1) : null,
          },
        });
      }
      await transaction.task.deleteMany({
        where: {
          companyId: company.id,
          workId: work.id,
          origin: "review-rigo-hoy",
          ...(taskIds.length ? { id: { notIn: taskIds } } : {}),
        },
      });
    }

    await transaction.budget.upsert({
      where: { id: REVIEW_RIGO_HOY_IDS.budgetP0247 },
      update: {
        companyId: company.id,
        clienteId: REVIEW_RIGO_HOY_IDS.clientAlfa,
        obraId: REVIEW_RIGO_HOY_IDS.workEdificioArce,
        numero: "P-0247",
        titulo: "Reforma fase 2 · Edificio Arce",
        partidas: JSON.stringify([{ concepto: "Reforma fase 2", cantidad: 1, importe: 12450 }]),
        subtotal: 10289.26,
        iva: 2160.74,
        descuento: 0,
        total: 12450,
        margenEstimado: 28,
        estado: "pendiente_revision",
        fechaSeguimiento: todayAt(now, 12),
        fechaValidez: addDays(now, 10, 23, 59),
      },
      create: {
        id: REVIEW_RIGO_HOY_IDS.budgetP0247,
        companyId: company.id,
        clienteId: REVIEW_RIGO_HOY_IDS.clientAlfa,
        obraId: REVIEW_RIGO_HOY_IDS.workEdificioArce,
        numero: "P-0247",
        titulo: "Reforma fase 2 · Edificio Arce",
        partidas: JSON.stringify([{ concepto: "Reforma fase 2", cantidad: 1, importe: 12450 }]),
        subtotal: 10289.26,
        iva: 2160.74,
        total: 12450,
        margenEstimado: 28,
        estado: "pendiente_revision",
        fechaSeguimiento: todayAt(now, 12),
        fechaValidez: addDays(now, 10, 23, 59),
      },
    });

    const invoiceFixtures = [
      { id: REVIEW_RIGO_HOY_IDS.invoiceF0155, clienteId: REVIEW_RIGO_HOY_IDS.clientBeta, obraId: REVIEW_RIGO_HOY_IDS.workOficinasCentral, numero: "F-2024-0155", concepto: "Certificación Oficinas Central", total: 6420, pagado: 6420, pendiente: 0, estado: "pagada" as const, dueAt: addDays(now, -1, 23, 59) },
      { id: REVIEW_RIGO_HOY_IDS.invoiceF0156, clienteId: REVIEW_RIGO_HOY_IDS.clientBeta, obraId: REVIEW_RIGO_HOY_IDS.workOficinasCentral, numero: "F-2024-0156", concepto: "Reforma oficina central", total: 12450, pagado: 0, pendiente: 12450, estado: "pendiente_pago" as const, dueAt: addDays(now, 1, 23, 59) },
      { id: REVIEW_RIGO_HOY_IDS.invoiceF0158, clienteId: REVIEW_RIGO_HOY_IDS.clientDelta, obraId: REVIEW_RIGO_HOY_IDS.workLocalComercial, numero: "F-2024-0158", concepto: "Adecuación local", total: 8750, pagado: 0, pendiente: 8750, estado: "pendiente_pago" as const, dueAt: addDays(now, 5, 23, 59) },
    ];
    for (const invoice of invoiceFixtures) {
      await transaction.invoice.upsert({
        where: { id: invoice.id },
        update: {
          companyId: company.id,
          clienteId: invoice.clienteId,
          obraId: invoice.obraId,
          numero: invoice.numero,
          concepto: invoice.concepto,
          importeBase: Number((invoice.total / 1.21).toFixed(2)),
          iva: Number((invoice.total - invoice.total / 1.21).toFixed(2)),
          total: invoice.total,
          pagado: invoice.pagado,
          pendiente: invoice.pendiente,
          fechaEmision: addDays(now, -10, 9),
          fechaVencimiento: invoice.dueAt,
          estado: invoice.estado,
        },
        create: {
          id: invoice.id,
          companyId: company.id,
          clienteId: invoice.clienteId,
          obraId: invoice.obraId,
          numero: invoice.numero,
          concepto: invoice.concepto,
          importeBase: Number((invoice.total / 1.21).toFixed(2)),
          iva: Number((invoice.total - invoice.total / 1.21).toFixed(2)),
          total: invoice.total,
          pagado: invoice.pagado,
          pendiente: invoice.pendiente,
          fechaEmision: addDays(now, -10, 9),
          fechaVencimiento: invoice.dueAt,
          estado: invoice.estado,
        },
      });
    }

    const documentFixtures = [
      { id: REVIEW_RIGO_HOY_IDS.documentContractGamma, name: "Contrato Cliente Gamma", category: "contrato" as const, status: "REVIEW_REQUIRED" as const, clientId: REVIEW_RIGO_HOY_IDS.clientGamma, workId: null, uploadedById: laura.id, metadata: { synthetic: true, reviewDueAt: todayAt(now, 17).toISOString(), entityLabel: "Contrato · Cliente Gamma" } },
      { id: REVIEW_RIGO_HOY_IDS.documentProgressArce, name: "Parte de avance Edificio Arce", category: "informe" as const, status: "PROCESSING" as const, clientId: REVIEW_RIGO_HOY_IDS.clientAlfa, workId: REVIEW_RIGO_HOY_IDS.workEdificioArce, uploadedById: diego.id, metadata: { synthetic: true, entityLabel: "Parte de avance · Edificio Arce" } },
      { id: REVIEW_RIGO_HOY_IDS.documentControl, name: "Control documental del día", category: "otro" as const, status: "UPLOADED" as const, clientId: null, workId: null, uploadedById: owner.id, metadata: { synthetic: true, entityLabel: "Control documental del día" } },
    ];
    for (const document of documentFixtures) {
      await transaction.document.upsert({
        where: { id: document.id },
        update: { ...document, companyId: company.id, mimeType: "application/pdf", archivedAt: null },
        create: { ...document, companyId: company.id, mimeType: "application/pdf" },
      });
    }

    const followUpFixtures = [
      { id: REVIEW_RIGO_HOY_IDS.followupIndustrias, title: "Lead · Industrias Norte", responsibleId: diego.id, clientId: REVIEW_RIGO_HOY_IDS.clientIndustrias, dueAt: todayAt(now, 16), expectedOutcome: "Confirmar próximos pasos comerciales" },
      { id: REVIEW_RIGO_HOY_IDS.followupFuture, title: "Cliente Beta SL", responsibleId: laura.id, clientId: REVIEW_RIGO_HOY_IDS.clientBeta, dueAt: addDays(now, 10, 10), expectedOutcome: "Revisar ampliación de alcance" },
    ];
    for (const followUp of followUpFixtures) {
      await transaction.followUp.upsert({
        where: { id: followUp.id },
        update: { ...followUp, companyId: company.id, type: "commercial", status: "planned", priority: "high", origin: "review-rigo-hoy", archivedAt: null },
        create: { ...followUp, companyId: company.id, type: "commercial", status: "planned", priority: "high", origin: "review-rigo-hoy" },
      });
    }

    const expenseFixtures = [
      { id: REVIEW_RIGO_HOY_IDS.expenseMaterials, obraId: REVIEW_RIGO_HOY_IDS.workEdificioArce, proveedor: "Proveedores de Materiales SL", concepto: "Albarán A-4587", categoria: "materiales" as const, importe: 5320, paymentDueDate: todayAt(now, 23, 59) },
      { id: REVIEW_RIGO_HOY_IDS.expenseMachinery, obraId: REVIEW_RIGO_HOY_IDS.workResidencialSol, proveedor: "Servicios de Maquinaria SA", concepto: "Alquiler grúa mayo", categoria: "maquinaria" as const, importe: 1850, paymentDueDate: addDays(now, 4, 23, 59) },
    ];
    for (const expense of expenseFixtures) {
      await transaction.expense.upsert({
        where: { id: expense.id },
        update: { ...expense, companyId: company.id, fecha: addDays(now, -3, 10), paymentStatus: "pending", notas: "Dato sintético de Review" },
        create: { ...expense, companyId: company.id, fecha: addDays(now, -3, 10), paymentStatus: "pending", notas: "Dato sintético de Review" },
      });
    }

    await transaction.eventoAgenda.updateMany({
      where: { id: REVIEW_RIGO_HOY_IDS.legacyEventWeeklyReview, companyId: company.id },
      data: {
        fechaInicio: addDays(now, 1, 16),
        fechaFin: addDays(now, 1, 17),
      },
    });
    const legacyFollowUpIds = [
      REVIEW_RIGO_HOY_IDS.legacyFollowUpBudget,
      REVIEW_RIGO_HOY_IDS.legacyFollowUpCollection,
      REVIEW_RIGO_HOY_IDS.legacyFollowUpVisit,
    ];
    for (const [index, legacyFollowUpId] of legacyFollowUpIds.entries()) {
      await transaction.followUp.updateMany({
        where: { id: legacyFollowUpId, companyId: company.id },
        data: {
          dueAt: addDays(now, 30 + index, 10),
          nextActionAt: addDays(now, 30 + index, 10),
        },
      });
    }

    const agendaFixtures = buildRigoHoyAgendaFixtures(now);
    for (const event of agendaFixtures) {
      await transaction.eventoAgenda.upsert({
        where: { id: event.id },
        update: { ...event, companyId: company.id },
        create: { ...event, companyId: company.id },
      });
    }

    const auditFixtures = [
      { id: REVIEW_RIGO_HOY_IDS.auditBudget, userActorId: laura.id, action: "budget.updated", targetType: "Budget", targetId: REVIEW_RIGO_HOY_IDS.budgetP0247, metadata: { headline: "Laura Soto ha actualizado el presupuesto P-0247", detail: "Cliente Alfa" }, createdAt: new Date(now.getTime() - 25 * 60_000) },
      { id: REVIEW_RIGO_HOY_IDS.auditInvoice, userActorId: owner.id, action: "invoice.paid", targetType: "Invoice", targetId: REVIEW_RIGO_HOY_IDS.invoiceF0155, metadata: { headline: "Factura F-2024-0155 marcada como pagada por Beta SL", detail: "" }, createdAt: new Date(now.getTime() - 60 * 60_000) },
      { id: REVIEW_RIGO_HOY_IDS.auditVisit, userActorId: diego.id, action: "visit.completed", targetType: "EventoAgenda", targetId: REVIEW_RIGO_HOY_IDS.eventCompletedVisit, metadata: { headline: "Diego Martín ha completado la visita técnica", detail: "OB-0118 · Residencial Sol" }, createdAt: new Date(now.getTime() - 2 * 60 * 60_000) },
      { id: REVIEW_RIGO_HOY_IDS.auditDocument, userActorId: laura.id, action: "document.uploaded", targetType: "Document", targetId: REVIEW_RIGO_HOY_IDS.documentProgressArce, metadata: { headline: "Nuevo documento subido a OB-0120 · Edificio Arce", detail: "Informe de avance · Mayo 2024" }, createdAt: new Date(now.getTime() - 3 * 60 * 60_000) },
      { id: REVIEW_RIGO_HOY_IDS.auditClient, userActorId: owner.id, action: "client.created", targetType: "Client", targetId: REVIEW_RIGO_HOY_IDS.clientIndustrias, metadata: { headline: "Marta Ruiz ha creado el lead Industrias Norte", detail: "" }, createdAt: new Date(now.getTime() - 4 * 60 * 60_000) },
    ];
    for (const audit of auditFixtures) {
      await transaction.auditLog.upsert({
        where: { id: audit.id },
        update: { ...audit, companyId: company.id, environment: "review", provider: "fixture" },
        create: { ...audit, companyId: company.id, environment: "review", provider: "fixture" },
      });
    }

    await transaction.businessRecommendation.upsert({
      where: { fingerprint: REVIEW_RIGO_HOY_IDS.recommendationFingerprint },
      update: {
        companyId: company.id,
        type: "budget_review_before_noon",
        title: "Revisa el presupuesto P-0247 antes del mediodía",
        summary: "El cliente Alfa ha mostrado interés en acelerar la decisión. Revisarlo a tiempo puede aumentar un 35% la probabilidad de cierre esta semana.",
        detailedExplanation: "El cliente Alfa ha mostrado interés en acelerar la decisión. Revisarlo a tiempo puede aumentar un 35% la probabilidad de cierre esta semana.",
        level: "importante",
        status: "active",
        source: "presupuestos",
        entityType: "Budget",
        entityId: REVIEW_RIGO_HOY_IDS.budgetP0247,
        clientId: REVIEW_RIGO_HOY_IDS.clientAlfa,
        workId: REVIEW_RIGO_HOY_IDS.workEdificioArce,
        budgetId: REVIEW_RIGO_HOY_IDS.budgetP0247,
        amount: 12450,
        score: 92,
        priority: 110,
        dueAt: todayAt(now, 12),
        expiresAt: addDays(now, 1, 0),
        preferredActionId: null,
        requiresConfirmation: true,
        suggestedActions: [{ id: "review-budget", label: "Revisar presupuesto", type: "navigate", href: `/presupuestos/${REVIEW_RIGO_HOY_IDS.budgetP0247}` }],
        evidence: { probabilityDelta: 35, cycleDeltaDays: -3, confidence: 92, synthetic: true },
        context: { sourceLabel: "Presupuesto P-0247", entityLabel: "Cliente Alfa", synthetic: true },
        dismissedAt: null,
        snoozedUntil: null,
        acceptedAt: null,
        actionStartedAt: null,
        completedAt: null,
      },
      create: {
        id: REVIEW_RIGO_HOY_IDS.recommendationBudget,
        companyId: company.id,
        fingerprint: REVIEW_RIGO_HOY_IDS.recommendationFingerprint,
        type: "budget_review_before_noon",
        title: "Revisa el presupuesto P-0247 antes del mediodía",
        summary: "El cliente Alfa ha mostrado interés en acelerar la decisión. Revisarlo a tiempo puede aumentar un 35% la probabilidad de cierre esta semana.",
        detailedExplanation: "El cliente Alfa ha mostrado interés en acelerar la decisión. Revisarlo a tiempo puede aumentar un 35% la probabilidad de cierre esta semana.",
        level: "importante",
        status: "active",
        source: "presupuestos",
        entityType: "Budget",
        entityId: REVIEW_RIGO_HOY_IDS.budgetP0247,
        clientId: REVIEW_RIGO_HOY_IDS.clientAlfa,
        workId: REVIEW_RIGO_HOY_IDS.workEdificioArce,
        budgetId: REVIEW_RIGO_HOY_IDS.budgetP0247,
        amount: 12450,
        score: 92,
        priority: 110,
        dueAt: todayAt(now, 12),
        expiresAt: addDays(now, 1, 0),
        requiresConfirmation: true,
        suggestedActions: [{ id: "review-budget", label: "Revisar presupuesto", type: "navigate", href: `/presupuestos/${REVIEW_RIGO_HOY_IDS.budgetP0247}` }],
        evidence: { probabilityDelta: 35, cycleDeltaDays: -3, confidence: 92, synthetic: true },
        context: { sourceLabel: "Presupuesto P-0247", entityLabel: "Cliente Alfa", synthetic: true },
      },
    });

    return {
      ok: true,
      target: "railway-review",
      fixture: REVIEW_RIGO_HOY_TARGET.demoScenarioKey,
      companyId: company.id,
      clients: clientFixtures.length,
      plan: "ENTERPRISE",
      ownerAccessMode: "STANDARD",
      entitlements: enterprisePlan.entitlements.length,
      works: workFixtures.length,
      agendaEvents: agendaFixtures.length,
      budgets: 1,
      invoices: invoiceFixtures.length,
      documents: documentFixtures.length,
      followUps: followUpFixtures.length,
      expenses: expenseFixtures.length,
      recommendations: 1,
      externalBillingAttached: false,
      credentialsChanged: false,
      securityFactorsChanged: false,
      otherMembershipsChanged: false,
    } as const;
  }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 120_000 });
}

export function safeProvisionErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /^[A-Z0-9_]+$/u.test(message) ? message : "REVIEW_RIGO_HOY_PROVISION_FAILED";
}

async function main() {
  const ownerEmail = assertReviewRigoHoyTarget(process.env);
  const { prisma } = await import("../../lib/prisma");
  try {
    const result = await provisionReviewRigoHoy(prisma, ownerEmail);
    const owner = await prisma.user.findUniqueOrThrow({ where: { emailNormalized: ownerEmail } });
    const [company, membership] = await Promise.all([
      prisma.company.findUniqueOrThrow({ where: { id: result.companyId } }),
      prisma.companyMembership.findUniqueOrThrow({ where: { userId_companyId: { userId: owner.id, companyId: result.companyId } } }),
    ]);
    const { resolveAuthorization, getEffectiveCapabilities, getEntitlements } = await import("../../lib/commercial/authorization");
    const { capabilityCatalog } = await import("../../lib/commercial/catalog");
    const context = {
      sessionId: "review-rigo-hoy-provision",
      userId: owner.id,
      email: owner.email,
      displayName: owner.displayName,
      expiresAt: addDays(new Date(), 1),
      secondFactorVerifiedAt: null,
      companyId: company.id,
      membershipId: membership.id,
      role: membership.role,
      functionalProfileKey: membership.functionalProfileKey,
      isDemo: company.isDemo,
      companyName: company.nombreComercial,
      companyStatus: company.status,
      commercialStatus: company.commercialStatus ?? "ACTIVE",
    };
    const entitlementGates = [
      "company.members.invite",
      "company.members.update",
      "company.members.remove",
      "company.teams.manage",
      "clients.export",
      "reports.export",
      "orqena.use",
      "orqena.execute",
      "orqena.memory.manage",
    ] as const;
    const decisions = await Promise.all(entitlementGates.map((capability) => resolveAuthorization(context, capability)));
    if (decisions.some((decision) => !decision.allowed || decision.scope !== "COMPANY")) {
      throw new Error("REVIEW_RIGO_HOY_ENTERPRISE_AUTHORIZATION_FAILED");
    }
    const [capabilities, entitlements] = await Promise.all([
      getEffectiveCapabilities(context),
      getEntitlements(company.id),
    ]);
    if (entitlements.planKey !== "ENTERPRISE" || capabilities.length !== Object.keys(capabilityCatalog).length) {
      throw new Error("REVIEW_RIGO_HOY_FULL_ACCESS_VALIDATION_FAILED");
    }
    const { buildPortalManifest } = await import("../../lib/commercial/portal-manifest");
    const { getNotificationItems } = await import("../../lib/notifications");
    const manifest = await buildPortalManifest(context);
    const notificationItems = await getNotificationItems({ context, domains: manifest.notificationDomains });
    const unreadNotificationKeys = new Set([
      `agenda-${REVIEW_RIGO_HOY_IDS.eventTechnicalVisit}`,
      `agenda-${REVIEW_RIGO_HOY_IDS.eventBudgetReview}`,
      `document-pending-${REVIEW_RIGO_HOY_IDS.documentContractGamma}`,
    ]);
    const existingNotificationStates = await prisma.notification.findMany({
      where: { sourceKey: { in: notificationItems.map((item) => item.sourceKey) } },
      select: { companyId: true },
    });
    if (existingNotificationStates.some((item) => item.companyId !== company.id)) {
      throw new Error("REVIEW_RIGO_HOY_NOTIFICATION_OWNERSHIP_CONFLICT");
    }
    const readAt = new Date();
    for (const item of notificationItems) {
      await prisma.notification.upsert({
        where: { sourceKey: item.sourceKey },
        update: {
          companyId: company.id,
          type: item.type,
          title: item.title,
          body: item.body,
          href: item.href,
          priority: item.priority,
          entityType: item.entityType,
          entityId: item.entityId,
          readAt: unreadNotificationKeys.has(item.sourceKey) ? null : readAt,
          archivedAt: null,
        },
        create: {
          companyId: company.id,
          sourceKey: item.sourceKey,
          type: item.type,
          title: item.title,
          body: item.body,
          href: item.href,
          priority: item.priority,
          entityType: item.entityType,
          entityId: item.entityId,
          readAt: unreadNotificationKeys.has(item.sourceKey) ? null : readAt,
        },
      });
    }
    const unreadNotifications = notificationItems.filter((item) => unreadNotificationKeys.has(item.sourceKey)).length;
    if (unreadNotifications !== 3) throw new Error("REVIEW_RIGO_HOY_NOTIFICATION_FIXTURE_INCOMPLETE");
    process.stdout.write(`${JSON.stringify({ ...result, capabilities: capabilities.length, authorizationGates: entitlementGates.length, unreadNotifications })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

const directInvocation = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (directInvocation) {
  main().catch((error) => {
    process.stderr.write(`${safeProvisionErrorCode(error)}\n`);
    process.exitCode = 1;
  });
}
