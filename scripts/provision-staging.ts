import { prisma } from "../lib/prisma";
import { createOpaqueToken, hashPassword, hashToken, normalizeEmail } from "../lib/auth/crypto";
import { ensureBasePlans, provisionCompany } from "../lib/commercial/provisioning";

const EXPECTED_ENVIRONMENT_ID = "7af806c2-99b7-4c70-9499-59b4551c5c03";
const EXPECTED_DATABASE_SERVICE_ID = "54c02a1a-5b1d-44ee-9a63-9b1123bbc8dc";

function requireStaging() {
  if (process.env.RAILWAY_ENVIRONMENT_NAME !== "staging") throw new Error("STAGING_ENVIRONMENT_REQUIRED");
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

  const [owner, admin, manager, member, viewer, multi] = await Promise.all([
    stagingUser("owner", "Owner Staging", passwordHash),
    stagingUser("admin", "Admin Staging", passwordHash),
    stagingUser("manager", "Manager Staging", passwordHash),
    stagingUser("member", "Member Staging", passwordHash),
    stagingUser("viewer", "Viewer Staging", passwordHash),
    stagingUser("multi", "Multiempresa Staging", passwordHash)
  ]);

  const single = await provisionCompany(prisma, { userId: owner.id, name: "Orqena Staging Uno", organizationType: "COMPANY", sectorKey: "professional_services", mainGoal: "Validar staging", teamSize: "2-5", planKey: "STARTER", idempotencyKey: "staging:single:v1", isDemo: true, demoScenarioKey: "professional_services" });
  const business = await provisionCompany(prisma, { userId: multi.id, name: "Orqena Staging Multi", organizationType: "COMPANY", sectorKey: "construction", mainGoal: "Validar multiempresa", teamSize: "6-20", planKey: "BUSINESS", idempotencyKey: "staging:business:v1", isDemo: true, demoScenarioKey: "construction" });
  const second = await provisionCompany(prisma, { userId: multi.id, name: "Orqena Staging Taller", organizationType: "COMPANY", sectorKey: "repair_workshop", mainGoal: "Validar selector", teamSize: "2-5", planKey: "STARTER", idempotencyKey: "staging:multi-second:v1", isDemo: true, demoScenarioKey: "repair_workshop" });

  const roleUsers: Array<[typeof admin, "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER"]> = [
    [admin, "ADMIN"], [manager, "MANAGER"], [member, "MEMBER"], [viewer, "VIEWER"]
  ];
  const members = await Promise.all(roleUsers.map(([user, role]) => prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: user.id, companyId: business.id } },
    update: { role, status: "active" },
    create: { userId: user.id, companyId: business.id, role, status: "active", acceptedAt: new Date(), joinedAt: new Date(), origin: "staging" }
  })));
  const [adminMembership, managerMembership, memberMembership] = members;
  const team = await prisma.team.upsert({ where: { companyId_name: { companyId: business.id, name: "Operaciones" } }, update: { managerMembershipId: managerMembership.id }, create: { companyId: business.id, name: "Operaciones", description: "Equipo sintético de staging", managerMembershipId: managerMembership.id } });
  for (const membership of [adminMembership, managerMembership, memberMembership]) await prisma.teamMembership.upsert({ where: { teamId_membershipId: { teamId: team.id, membershipId: membership.id } }, update: {}, create: { teamId: team.id, membershipId: membership.id } });
  await prisma.membershipPermissionOverride.upsert({ where: { membershipId_capabilityKey: { membershipId: memberMembership.id, capabilityKey: "sales.invoices.issue" } }, update: { effect: "DENY", reason: "Escenario negativo de staging" }, create: { membershipId: memberMembership.id, capabilityKey: "sales.invoices.issue", effect: "DENY", reason: "Escenario negativo de staging", changedById: owner.id } });
  await prisma.scopeAssignment.deleteMany({ where: { companyId: business.id, membershipId: memberMembership.id, capabilityKey: "work.view", scope: "TEAM" } });
  await prisma.scopeAssignment.create({ data: { companyId: business.id, membershipId: memberMembership.id, capabilityKey: "work.view", scope: "TEAM", teamId: team.id } });

  const invitationBase = { companyId: business.id, inviterId: multi.id, role: "MEMBER" as const };
  for (const [suffix, expiresAt] of [["pending", new Date(Date.now() + 7 * 86400000)], ["expired", new Date(Date.now() - 86400000)]] as const) {
    const emailNormalized = `invite-${suffix}@staging.orqena.invalid`;
    await prisma.invitation.upsert({ where: { tokenHash: hashToken(`staging-${suffix}-stable-token`) }, update: { expiresAt, status: "PENDING" }, create: { ...invitationBase, emailNormalized, tokenHash: hashToken(`staging-${suffix}-stable-token`), expiresAt } });
  }

  const platform = await prisma.platformAccount.upsert({ where: { userId: owner.id }, update: { role: "PLATFORM_OWNER", status: "ACTIVE" }, create: { userId: owner.id, role: "PLATFORM_OWNER" } });
  await prisma.supportAccessGrant.create({ data: { companyId: business.id, platformAccountId: platform.id, reason: "Auditoría sintética de staging", ticketReference: "STAGING-001", capabilityKeys: ["company.view", "reports.view"], expiresAt: new Date(Date.now() + 2 * 3600000) } });
  const businessPlan = await prisma.plan.findUniqueOrThrow({ where: { key: "BUSINESS" } });
  await prisma.subscription.updateMany({ where: { companyId: business.id }, data: { planId: businessPlan.id, status: "ACTIVE", provider: "local", trialEndsAt: null } });
  await prisma.usageRecord.upsert({ where: { companyId_metric_idempotencyKey: { companyId: single.id, metric: "members", idempotencyKey: "staging-limit-v1" } }, update: { quantity: 5 }, create: { companyId: single.id, metric: "members", quantity: 5, periodStart: new Date(Date.now() - 86400000), periodEnd: new Date(Date.now() + 29 * 86400000), idempotencyKey: "staging-limit-v1", origin: "staging" } });

  const client = await prisma.client.upsert({ where: { id: "staging-client-1" }, update: { companyId: business.id }, create: { id: "staging-client-1", companyId: business.id, nombre: "Cliente Sintético Norte", telefono: "+34 600 000 101", email: "cliente@staging.orqena.invalid", direccion: "Calle Demo 1", tipo: "Empresa", origen: "staging" } });
  const work = await prisma.work.upsert({ where: { id: "staging-work-1" }, update: { companyId: business.id }, create: { id: "staging-work-1", companyId: business.id, clienteId: client.id, numeroInterno: "OB-STG-1", titulo: "Trabajo sintético", direccion: "Calle Demo 1", tipoTrabajo: "Validación", presupuestoAprobado: 2500 } });
  await prisma.budget.upsert({ where: { id: "staging-budget-1" }, update: { companyId: business.id }, create: { id: "staging-budget-1", companyId: business.id, clienteId: client.id, obraId: work.id, numero: "P-STG-1", titulo: "Presupuesto sintético", partidas: "Validación", subtotal: 1000, iva: 210, total: 1210, margenEstimado: 300 } });
  await prisma.invoice.upsert({ where: { id: "staging-invoice-1" }, update: { companyId: business.id }, create: { id: "staging-invoice-1", companyId: business.id, clienteId: client.id, obraId: work.id, numero: "F-STG-1", concepto: "Factura sintética", importeBase: 500, iva: 105, total: 605, pendiente: 605, fechaEmision: new Date(), fechaVencimiento: new Date(Date.now() + 30 * 86400000) } });
  await prisma.expense.upsert({ where: { id: "staging-expense-1" }, update: { companyId: business.id }, create: { id: "staging-expense-1", companyId: business.id, obraId: work.id, proveedor: "Proveedor Sintético", concepto: "Material demo", categoria: "materiales", importe: 125, fecha: new Date() } });
  await prisma.businessPartner.upsert({ where: { id: "staging-partner-1" }, update: { companyId: business.id }, create: { id: "staging-partner-1", companyId: business.id, kind: "SUPPLIER", commercialName: "Suministros Sintéticos", legalName: "Suministros Sintéticos Demo", email: "proveedor@staging.orqena.invalid" } });
  await prisma.eventoAgenda.upsert({ where: { id: "staging-event-1" }, update: { companyId: business.id }, create: { id: "staging-event-1", companyId: business.id, titulo: "Visita sintética", tipo: "visita", fechaInicio: new Date(Date.now() + 86400000), clienteId: client.id, obraId: work.id } });
  await prisma.document.upsert({ where: { id: "staging-document-1" }, update: { companyId: business.id }, create: { id: "staging-document-1", companyId: business.id, name: "Documento sintético.pdf", originalName: "documento-sintetico.pdf", mimeType: "application/pdf", size: 1024, storageKey: "staging/synthetic/document.pdf", category: "otro", clientId: client.id, workId: work.id, uploadedById: multi.id, metadata: { synthetic: true } } });
  const conversation = await prisma.chatConversation.upsert({ where: { id: "staging-conversation-1" }, update: { companyId: business.id }, create: { id: "staging-conversation-1", companyId: business.id, title: "Conversación sintética de Orqena", structuredContext: { synthetic: true } } });
  await prisma.businessMemory.upsert({ where: { id: "staging-memory-1" }, update: { companyId: business.id }, create: { id: "staging-memory-1", companyId: business.id, userId: multi.id, scope: "COMPANY", category: "PREFERENCE", key: "staging-payment-preference", value: { terms: "30 días" }, summary: "Preferencia sintética confirmada", sourceType: "MANUAL_SETTING", sourceConversationId: conversation.id, status: "CONFIRMED", confirmedAt: new Date(), confirmedById: multi.id } });
  await prisma.auditLog.create({ data: { companyId: business.id, userActorId: multi.id, action: "staging.provisioned", targetType: "Company", targetId: business.id, metadata: { synthetic: true, version: 1 } } });

  console.log(JSON.stringify({ ok: true, synthetic: true, companies: [single.id, business.id, second.id], users: 6, roles: ["OWNER", "ADMIN", "MANAGER", "MEMBER", "VIEWER"], passwordPrinted: false }));
}

main().finally(() => prisma.$disconnect());
