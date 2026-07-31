import { pathToFileURL } from "node:url";
import type { Prisma, PrismaClient } from "@prisma/client";

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
  clientIndustrias: "review-rigo-hoy-client-industrias-v1",
  clientGamma: "review-rigo-hoy-client-gamma-v1",
  workEdificioArce: "review-rigo-hoy-work-edificio-arce-v1",
  eventInternalMeeting: "review-rigo-hoy-event-internal-meeting-v1",
  eventTechnicalVisit: "review-rigo-hoy-event-technical-visit-v1",
  eventBudgetReview: "review-rigo-hoy-event-budget-review-v1",
  eventCommercialCall: "review-rigo-hoy-event-commercial-call-v1",
  eventDocumentConfirmation: "review-rigo-hoy-event-document-confirmation-v1",
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
  estado: "confirmado" | "pendiente";
  fechaInicio: Date;
  fechaFin: Date;
  clienteId: string;
  obraId: string | null;
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
      descripcion: "Coordinación sintética del equipo en Edificio Arce.",
      tipo: "recordatorio_interno",
      estado: "confirmado",
      ...at(9, 0, 45),
      clienteId: REVIEW_RIGO_HOY_IDS.clientAlfa,
      obraId: REVIEW_RIGO_HOY_IDS.workEdificioArce,
      direccion: "Edificio Arce · Sala 2",
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
      descripcion: "Comprobación sintética pendiente de confirmación humana.",
      tipo: "recordatorio_interno",
      estado: "pendiente",
      ...at(17, 0, 30),
      clienteId: REVIEW_RIGO_HOY_IDS.clientGamma,
      obraId: null,
      direccion: null,
      requiereConfirmacion: true,
      confirmadoPorUsuario: false,
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
  const [clients, work, events] = await Promise.all([
    transaction.client.findMany({
      where: { id: { in: [REVIEW_RIGO_HOY_IDS.clientAlfa, REVIEW_RIGO_HOY_IDS.clientIndustrias, REVIEW_RIGO_HOY_IDS.clientGamma] } },
      select: { id: true, companyId: true },
    }),
    transaction.work.findUnique({ where: { id: REVIEW_RIGO_HOY_IDS.workEdificioArce }, select: { companyId: true } }),
    transaction.eventoAgenda.findMany({
      where: { id: { in: buildRigoHoyAgendaFixtures(new Date()).map((event) => event.id) } },
      select: { id: true, companyId: true },
    }),
  ]);
  if (clients.some((item) => item.companyId !== companyId)) throw new Error("REVIEW_RIGO_HOY_CLIENT_OWNERSHIP_CONFLICT");
  if (work && work.companyId !== companyId) throw new Error("REVIEW_RIGO_HOY_WORK_OWNERSHIP_CONFLICT");
  if (events.some((item) => item.companyId !== companyId)) throw new Error("REVIEW_RIGO_HOY_EVENT_OWNERSHIP_CONFLICT");
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
        && ["STANDARD", "READ_ONLY"].includes(existingMembership.accessMode)
        && existingMembership.status === "active"
        && existingMembership.isDemo;
      if (!validExistingMembership) throw new Error("REVIEW_RIGO_HOY_OWNER_MEMBERSHIP_CONFLICT");
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

    await transaction.work.upsert({
      where: { id: REVIEW_RIGO_HOY_IDS.workEdificioArce },
      update: {
        companyId: company.id,
        clienteId: REVIEW_RIGO_HOY_IDS.clientAlfa,
        numeroInterno: "OB-0120",
        titulo: "Edificio Arce",
        direccion: "Calle Mayor 12, Madrid",
        tipoTrabajo: "Reforma",
        estado: "en_curso",
        archivada: false,
        archivadaAt: null,
      },
      create: {
        id: REVIEW_RIGO_HOY_IDS.workEdificioArce,
        companyId: company.id,
        clienteId: REVIEW_RIGO_HOY_IDS.clientAlfa,
        numeroInterno: "OB-0120",
        titulo: "Edificio Arce",
        direccion: "Calle Mayor 12, Madrid",
        tipoTrabajo: "Reforma",
        estado: "en_curso",
        presupuestoAprobado: 0,
        responsable: "Equipo sintético Review",
      },
    });

    const agendaFixtures = buildRigoHoyAgendaFixtures(now);
    for (const event of agendaFixtures) {
      await transaction.eventoAgenda.upsert({
        where: { id: event.id },
        update: { ...event, companyId: company.id },
        create: { ...event, companyId: company.id },
      });
    }

    return {
      ok: true,
      target: "railway-review",
      fixture: REVIEW_RIGO_HOY_TARGET.demoScenarioKey,
      companyId: company.id,
      clients: clientFixtures.length,
      works: 1,
      agendaEvents: agendaFixtures.length,
      credentialsChanged: false,
      securityFactorsChanged: false,
      otherMembershipsChanged: false,
    } as const;
  }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 });
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
    process.stdout.write(`${JSON.stringify(result)}\n`);
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
