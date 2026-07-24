import { prisma } from "../lib/prisma";
import { createOpaqueToken, hashPassword, hashToken, normalizeEmail } from "../lib/auth/crypto";
import { ensureBasePlans, provisionCompany } from "../lib/commercial/provisioning";
import { profileDefaultPackages } from "../lib/commercial/functional-profiles";

const EXPECTED_PROJECT_ID = "5a501cb4-639e-4dd3-a1fb-08ae1c839ebb";
const EXPECTED_ENVIRONMENT_ID = "8c1eb538-d7a4-4963-bb7d-5567ecf93ac2";
const EXPECTED_DATABASE_SERVICE_ID = "44a39d4f-5bbe-4ebd-91c2-57b7f767aeda";

type LegacyMembershipRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";
type ProfileFixture = {
  key: string;
  label: string;
  role: LegacyMembershipRole;
  profile: string;
  readOnly?: boolean;
};

// These are intentionally not production accounts.  Each profile has a login,
// an active company and at least one synthetic resource so browser evidence
// exercises the resolved portal rather than a legacy-role fallback.
const profileFixtures: readonly ProfileFixture[] = [
  { key: "owner", label: "Propietario Staging", role: "OWNER", profile: "OWNER" },
  { key: "general-manager", label: "Gerencia Staging", role: "MANAGER", profile: "GENERAL_MANAGER" },
  { key: "sales-manager", label: "Dirección Comercial Staging", role: "MANAGER", profile: "SALES_MANAGER" },
  { key: "sales", label: "Comercial Staging", role: "MEMBER", profile: "SALES" },
  { key: "administrative", label: "Administración Staging", role: "ADMIN", profile: "ADMINISTRATIVE" },
  { key: "finance", label: "Finanzas Staging", role: "ADMIN", profile: "FINANCE" },
  { key: "procurement-manager", label: "Compras Staging", role: "MANAGER", profile: "PROCUREMENT_MANAGER" },
  { key: "project-manager", label: "Responsable de proyecto Staging", role: "MANAGER", profile: "PROJECT_MANAGER" },
  { key: "team-supervisor", label: "Supervisor Staging", role: "MEMBER", profile: "TEAM_SUPERVISOR" },
  { key: "worker", label: "Operario Staging", role: "MEMBER", profile: "WORKER" },
  { key: "external-collaborator", label: "Colaborador externo Staging", role: "MEMBER", profile: "EXTERNAL_COLLABORATOR" },
  { key: "advisor-auditor", label: "Auditor Staging", role: "VIEWER", profile: "ADVISOR_AUDITOR", readOnly: true }
];

function requireStaging() {
  if (process.env.RAILWAY_ENVIRONMENT_NAME !== "staging") throw new Error("STAGING_ENVIRONMENT_REQUIRED");
  if (process.env.RAILWAY_PROJECT_ID !== EXPECTED_PROJECT_ID) throw new Error("STAGING_PROJECT_ID_MISMATCH");
  if (process.env.RAILWAY_ENVIRONMENT_ID !== EXPECTED_ENVIRONMENT_ID) throw new Error("STAGING_ENVIRONMENT_ID_MISMATCH");
  if (process.env.ORQENA_STAGING_DATABASE_SERVICE_ID !== EXPECTED_DATABASE_SERVICE_ID) throw new Error("STAGING_DATABASE_SERVICE_ID_MISMATCH");
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_APP_ENV !== "staging") throw new Error("PRODUCTION_TARGET_FORBIDDEN");
}

async function stagingUser(key: string, roleName: string, passwordHash: string) {
  const email = `${key}@staging.orqena.invalid`;
  return prisma.user.upsert({
    where: { emailNormalized: email },
    update: { displayName: roleName, passwordHash, status: "active", emailVerifiedAt: new Date() },
    create: { email, emailNormalized: email, displayName: roleName, passwordHash, status: "active", emailVerifiedAt: new Date() }
  });
}

async function main() {
  requireStaging();
  const password = process.env.ORQENA_STAGING_TEST_PASSWORD;
  if (!password || password.length < 16) throw new Error("ORQENA_STAGING_TEST_PASSWORD_REQUIRED");
  const passwordHash = await hashPassword(password);
  await ensureBasePlans(prisma);

  const users = new Map(await Promise.all(profileFixtures.map(async (fixture) => [fixture.key, await stagingUser(fixture.key, fixture.label, passwordHash)] as const)));
  const owner = users.get("owner")!;
  const multi = await stagingUser("multi", "Multiempresa Staging", passwordHash);

  const single = await provisionCompany(prisma, { userId: owner.id, name: "Orqena Staging Uno", organizationType: "COMPANY", sectorKey: "professional_services", mainGoal: "Validar staging", teamSize: "2-5", planKey: "STARTER", idempotencyKey: "staging:single:v1", isDemo: true, demoScenarioKey: "professional_services" });
  const business = await provisionCompany(prisma, { userId: multi.id, name: "Orqena Staging Multi", organizationType: "COMPANY", sectorKey: "construction", mainGoal: "Validar multiempresa", teamSize: "6-20", planKey: "BUSINESS", idempotencyKey: "staging:business:v1", isDemo: true, demoScenarioKey: "construction" });
  const second = await provisionCompany(prisma, { userId: multi.id, name: "Orqena Staging Taller", organizationType: "COMPANY", sectorKey: "repair_workshop", mainGoal: "Validar selector", teamSize: "2-5", planKey: "STARTER", idempotencyKey: "staging:multi-second:v1", isDemo: true, demoScenarioKey: "repair_workshop" });

  const memberships = new Map(await Promise.all(profileFixtures.map(async (fixture) => {
    const user = users.get(fixture.key)!;
    const membership = await prisma.companyMembership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: business.id } },
      update: { role: fixture.role, functionalProfileKey: fixture.profile, accessMode: fixture.readOnly ? "READ_ONLY" : "STANDARD", status: "active", acceptedAt: new Date(), joinedAt: new Date(), origin: "staging" },
      create: { userId: user.id, companyId: business.id, role: fixture.role, functionalProfileKey: fixture.profile, accessMode: fixture.readOnly ? "READ_ONLY" : "STANDARD", status: "active", acceptedAt: new Date(), joinedAt: new Date(), origin: "staging" }
    });
    await prisma.membershipAccessPackage.deleteMany({ where: { membershipId: membership.id } });
    await prisma.membershipAccessPackage.createMany({ data: profileDefaultPackages[fixture.profile as keyof typeof profileDefaultPackages].map((packageKey) => ({ companyId: business.id, membershipId: membership.id, packageKey, grantedById: owner?.id })) });
    await prisma.user.update({ where: { id: user.id }, data: { activeCompanyId: business.id } });
    return [fixture.key, membership] as const;
  })));
  const team = await prisma.team.upsert({ where: { companyId_name: { companyId: business.id, name: "Operaciones" } }, update: { managerMembershipId: memberships.get("project-manager")!.id }, create: { companyId: business.id, name: "Operaciones", description: "Equipo sintético de staging", managerMembershipId: memberships.get("project-manager")!.id } });
  for (const key of ["project-manager", "team-supervisor", "worker", "external-collaborator"]) {
    const membership = memberships.get(key)!;
    await prisma.teamMembership.upsert({ where: { teamId_membershipId: { teamId: team.id, membershipId: membership.id } }, update: {}, create: { teamId: team.id, membershipId: membership.id } });
  }
  await prisma.membershipPermissionOverride.upsert({ where: { membershipId_capabilityKey: { membershipId: memberships.get("sales")!.id, capabilityKey: "sales.invoices.issue" } }, update: { effect: "DENY", reason: "Escenario negativo de staging" }, create: { membershipId: memberships.get("sales")!.id, capabilityKey: "sales.invoices.issue", effect: "DENY", reason: "Escenario negativo de staging", changedById: owner.id } });
  for (const [key, authorityKey, maxAmount] of [["general-manager", "quote.approve", 100000], ["sales-manager", "quote.approve", 50000]] as const) {
    const membership = memberships.get(key)!;
    await prisma.approvalAuthority.upsert({ where: { membershipId_authorityKey: { membershipId: membership.id, authorityKey } }, update: { maxAmount, scope: "COMPANY", grantedById: owner.id }, create: { companyId: business.id, membershipId: membership.id, authorityKey, maxAmount, scope: "COMPANY", grantedById: owner.id } });
  }

  const invitationBase = { companyId: business.id, inviterId: multi.id, role: "MEMBER" as const };
  for (const [suffix, expiresAt] of [["pending", new Date(Date.now() + 7 * 86400000)], ["expired", new Date(Date.now() - 86400000)]] as const) {
    const emailNormalized = `invite-${suffix}@staging.orqena.invalid`;
    await prisma.invitation.upsert({ where: { tokenHash: hashToken(`staging-${suffix}-stable-token`) }, update: { expiresAt, status: "PENDING" }, create: { ...invitationBase, emailNormalized, tokenHash: hashToken(`staging-${suffix}-stable-token`), expiresAt } });
  }
  await prisma.invitation.upsert({ where: { tokenHash: hashToken("staging-owner-approval-stable-token") }, update: { status: "PENDING_OWNER_APPROVAL", expiresAt: new Date(Date.now() + 7 * 86400000), functionalProfileKey: "WORKER" }, create: { ...invitationBase, emailNormalized: "invite-approval@staging.orqena.invalid", functionalProfileKey: "WORKER", status: "PENDING_OWNER_APPROVAL", tokenHash: hashToken("staging-owner-approval-stable-token"), expiresAt: new Date(Date.now() + 7 * 86400000) } });

  const platform = await prisma.platformAccount.upsert({ where: { userId: owner.id }, update: { role: "PLATFORM_OWNER", status: "ACTIVE" }, create: { userId: owner.id, role: "PLATFORM_OWNER" } });
  await prisma.supportAccessGrant.create({ data: { companyId: business.id, platformAccountId: platform.id, reason: "Auditoría sintética de staging", ticketReference: "STAGING-001", capabilityKeys: ["company.view", "reports.view"], expiresAt: new Date(Date.now() + 2 * 3600000) } });
  const businessPlan = await prisma.plan.findUniqueOrThrow({ where: { key: "BUSINESS" } });
  await prisma.subscription.updateMany({ where: { companyId: business.id }, data: { planId: businessPlan.id, status: "ACTIVE", provider: "local", trialEndsAt: null } });
  await prisma.usageRecord.upsert({ where: { companyId_metric_idempotencyKey: { companyId: single.id, metric: "members", idempotencyKey: "staging-limit-v1" } }, update: { quantity: 5 }, create: { companyId: single.id, metric: "members", quantity: 5, periodStart: new Date(Date.now() - 86400000), periodEnd: new Date(Date.now() + 29 * 86400000), idempotencyKey: "staging-limit-v1", origin: "staging" } });

  const client = await prisma.client.upsert({ where: { id: "staging-client-1" }, update: { companyId: business.id }, create: { id: "staging-client-1", companyId: business.id, nombre: "Cliente Sintético Norte", telefono: "+34 600 000 101", email: "cliente@staging.orqena.invalid", direccion: "Calle Demo 1", tipo: "Empresa", origen: "staging" } });
  const work = await prisma.work.upsert({ where: { id: "staging-work-1" }, update: { companyId: business.id }, create: { id: "staging-work-1", companyId: business.id, clienteId: client.id, numeroInterno: "OB-STG-1", titulo: "Trabajo sintético", direccion: "Calle Demo 1", tipoTrabajo: "Validación", presupuestoAprobado: 2500 } });
  const task = await prisma.task.upsert({ where: { id: "staging-task-1" }, update: { companyId: business.id, clientId: client.id, workId: work.id }, create: { id: "staging-task-1", companyId: business.id, clientId: client.id, workId: work.id, title: "Revisión sintética asignada", description: "Recurso positivo de los perfiles operativos", createdById: owner.id, assigneeId: users.get("worker")!.id, dueAt: new Date(Date.now() + 86400000) } });
  await prisma.taskAssignment.deleteMany({ where: { taskId: task.id, userId: { in: [users.get("worker")!.id, users.get("external-collaborator")!.id, users.get("team-supervisor")!.id, users.get("project-manager")!.id] } } });
  await prisma.taskAssignment.createMany({ data: ["worker", "external-collaborator", "team-supervisor", "project-manager"].map((key) => ({ taskId: task.id, userId: users.get(key)!.id, role: "responsible" })) });
  for (const key of ["worker", "external-collaborator", "advisor-auditor"]) {
    const membership = memberships.get(key)!;
    await prisma.scopeAssignment.deleteMany({ where: { companyId: business.id, membershipId: membership.id, capabilityKey: { in: ["work.view", "tasks.view", "documents.view"] } } });
    await prisma.scopeAssignment.createMany({ data: ["work.view", "tasks.view", "documents.view"].map((capabilityKey) => ({ companyId: business.id, membershipId: membership.id, capabilityKey, scope: "ASSIGNED" as const, entityType: capabilityKey === "work.view" ? "Work" : capabilityKey === "tasks.view" ? "Task" : "Document", entityId: capabilityKey === "work.view" ? work.id : capabilityKey === "tasks.view" ? task.id : "staging-document-1" })) });
  }
  await prisma.budget.upsert({ where: { id: "staging-budget-1" }, update: { companyId: business.id }, create: { id: "staging-budget-1", companyId: business.id, clienteId: client.id, obraId: work.id, numero: "P-STG-1", titulo: "Presupuesto sintético", partidas: "Validación", subtotal: 1000, iva: 210, total: 1210, margenEstimado: 300 } });
  await prisma.invoice.upsert({ where: { id: "staging-invoice-1" }, update: { companyId: business.id }, create: { id: "staging-invoice-1", companyId: business.id, clienteId: client.id, obraId: work.id, numero: "F-STG-1", concepto: "Factura sintética", importeBase: 500, iva: 105, total: 605, pendiente: 605, fechaEmision: new Date(), fechaVencimiento: new Date(Date.now() + 30 * 86400000) } });
  await prisma.expense.upsert({ where: { id: "staging-expense-1" }, update: { companyId: business.id }, create: { id: "staging-expense-1", companyId: business.id, obraId: work.id, proveedor: "Proveedor Sintético", concepto: "Material demo", categoria: "materiales", importe: 125, fecha: new Date() } });
  await prisma.businessPartner.upsert({ where: { id: "staging-partner-1" }, update: { companyId: business.id }, create: { id: "staging-partner-1", companyId: business.id, kind: "SUPPLIER", commercialName: "Suministros Sintéticos", legalName: "Suministros Sintéticos Demo", email: "proveedor@staging.orqena.invalid" } });
  await prisma.eventoAgenda.upsert({ where: { id: "staging-event-1" }, update: { companyId: business.id }, create: { id: "staging-event-1", companyId: business.id, titulo: "Visita sintética", tipo: "visita", fechaInicio: new Date(Date.now() + 86400000), clienteId: client.id, obraId: work.id } });
  await prisma.document.upsert({ where: { id: "staging-document-1" }, update: { companyId: business.id }, create: { id: "staging-document-1", companyId: business.id, name: "Documento sintético.pdf", originalName: "documento-sintetico.pdf", mimeType: "application/pdf", size: 1024, storageKey: "staging/synthetic/document.pdf", category: "otro", clientId: client.id, workId: work.id, uploadedById: multi.id, metadata: { synthetic: true } } });
  await prisma.work.upsert({ where: { id: "staging-work-unassigned" }, update: { companyId: business.id }, create: { id: "staging-work-unassigned", companyId: business.id, clienteId: client.id, numeroInterno: "OB-STG-X", titulo: "Trabajo fuera de alcance", direccion: "Calle Aislada 9", tipoTrabajo: "Control negativo", presupuestoAprobado: 500 } });
  const lifecycleUser = await stagingUser("invite-lifecycle", "Invitado Ciclo Staging", passwordHash);
  await prisma.companyMembership.upsert({ where: { userId_companyId: { userId: lifecycleUser.id, companyId: business.id } }, update: { status: "invited", role: "MEMBER", functionalProfileKey: "WORKER", accessMode: "STANDARD", approvedAt: null, approvedById: null }, create: { userId: lifecycleUser.id, companyId: business.id, status: "invited", role: "MEMBER", functionalProfileKey: "WORKER", accessMode: "STANDARD", origin: "staging" } });
  await prisma.invitation.upsert({ where: { tokenHash: hashToken("staging-lifecycle-stable-token") }, update: { status: "PENDING_EMPLOYEE", expiresAt: new Date(Date.now() + 7 * 86400000), functionalProfileKey: "WORKER", emailNormalized: lifecycleUser.emailNormalized }, create: { ...invitationBase, emailNormalized: lifecycleUser.emailNormalized, functionalProfileKey: "WORKER", status: "PENDING_EMPLOYEE", tokenHash: hashToken("staging-lifecycle-stable-token"), expiresAt: new Date(Date.now() + 7 * 86400000), accessPackageKeys: profileDefaultPackages.WORKER, scopeTemplate: [{ capabilityKey: "work.view", scope: "ASSIGNED", entityType: "Work", entityId: work.id }] } });
  const conversation = await prisma.chatConversation.upsert({ where: { id: "staging-conversation-1" }, update: { companyId: business.id, ownerUserId: multi.id }, create: { id: "staging-conversation-1", companyId: business.id, ownerUserId: multi.id, title: "Conversación sintética de Orqena", structuredContext: { synthetic: true } } });
  await prisma.businessMemory.upsert({ where: { id: "staging-memory-1" }, update: { companyId: business.id }, create: { id: "staging-memory-1", companyId: business.id, userId: multi.id, scope: "COMPANY", category: "PREFERENCE", key: "staging-payment-preference", value: { terms: "30 días" }, summary: "Preferencia sintética confirmada", sourceType: "MANUAL_SETTING", sourceConversationId: conversation.id, status: "CONFIRMED", confirmedAt: new Date(), confirmedById: multi.id } });
  await prisma.auditLog.create({ data: { companyId: business.id, userActorId: multi.id, action: "staging.provisioned", targetType: "Company", targetId: business.id, metadata: { synthetic: true, version: 1 } } });
  await prisma.user.update({ where: { id: multi.id }, data: { activeCompanyId: second.id } });

  console.log(JSON.stringify({ ok: true, synthetic: true, companies: [single.id, business.id, second.id], users: profileFixtures.length + 1, profiles: profileFixtures.map(({ key, profile, readOnly }) => ({ key, profile, readOnly: Boolean(readOnly) })), passwordPrinted: false }));
}

main().finally(() => prisma.$disconnect());
