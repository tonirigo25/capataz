import { randomBytes } from "node:crypto";
import { generate } from "otplib";
import { prisma } from "../../lib/prisma";
import { createOpaqueToken, hashPassword, hashToken } from "../../lib/auth/crypto";
import { ensureBasePlans, provisionCompany } from "../../lib/commercial/provisioning";
import { profileDefaultPackages } from "../../lib/commercial/functional-profiles";
import { confirmTotpEnrollment, startTotpEnrollment } from "../../lib/security/mfa";

const EXPECTED_PROJECT_ID = "c54a5065-df2c-46b9-a82b-cfac3be07315";
const EXPECTED_ENVIRONMENT_ID = "e41b5add-511c-4697-b2b5-48164506f49a";
const EXPECTED_DATABASE_SERVICE_ID = "d14f98ec-1a00-4cc5-88fc-2ac0c99c8f1b";
const REVIEW_ORIGIN = "https://orqena-review-web-review.up.railway.app";

type LegacyMembershipRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";
type ProfileFixture = { key: string; label: string; role: LegacyMembershipRole; profile: keyof typeof profileDefaultPackages; readOnly?: boolean };
const profiles: readonly ProfileFixture[] = [
  { key: "owner", label: "Propietario Review", role: "OWNER", profile: "OWNER" },
  { key: "general-manager", label: "Dirección Review", role: "MANAGER", profile: "GENERAL_MANAGER" },
  { key: "admin", label: "Administración Review", role: "ADMIN", profile: "ADMINISTRATIVE" },
  { key: "sales", label: "Comercial Review", role: "MEMBER", profile: "SALES" },
  { key: "finance", label: "Finanzas Review", role: "ADMIN", profile: "FINANCE" },
  { key: "procurement", label: "Compras Review", role: "MANAGER", profile: "PROCUREMENT_MANAGER" },
  { key: "project-manager", label: "Responsable de obra Review", role: "MANAGER", profile: "PROJECT_MANAGER" },
  { key: "supervisor", label: "Supervisor Review", role: "MEMBER", profile: "TEAM_SUPERVISOR" },
  { key: "worker", label: "Trabajador Review", role: "MEMBER", profile: "WORKER" },
  { key: "external", label: "Colaborador externo Review", role: "MEMBER", profile: "EXTERNAL_COLLABORATOR" },
  { key: "viewer", label: "Auditor Review", role: "VIEWER", profile: "ADVISOR_AUDITOR", readOnly: true },
];

function guardReview() {
  if (process.env.ORQENA_REVIEW_SEED_APPROVED !== "true") throw new Error("REVIEW_SEED_APPROVAL_REQUIRED");
  if (process.env.RAILWAY_PROJECT_ID !== EXPECTED_PROJECT_ID) throw new Error("REVIEW_PROJECT_ID_MISMATCH");
  if (process.env.RAILWAY_ENVIRONMENT_ID !== EXPECTED_ENVIRONMENT_ID) throw new Error("REVIEW_ENVIRONMENT_ID_MISMATCH");
  if (process.env.ORQENA_REVIEW_DATABASE_SERVICE_ID !== EXPECTED_DATABASE_SERVICE_ID) throw new Error("REVIEW_DATABASE_SERVICE_ID_MISMATCH");
  if (process.env.NEXT_PUBLIC_APP_ENV !== "preview" || process.env.CREDENTIAL_SCOPE !== "preview") throw new Error("REVIEW_SCOPE_REQUIRED");
  const database = new URL(process.env.DATABASE_URL ?? "");
  if (!/(?:railway\.internal|proxy\.rlwy\.net)$/u.test(database.hostname)) throw new Error("REVIEW_DATABASE_HOST_INVALID");
}

async function main() {
  guardReview();
  await ensureBasePlans(prisma);
  const configuredQaPassword = process.env.ORQENA_REVIEW_QA_PASSWORD;
  if (configuredQaPassword && configuredQaPassword.length < 24) throw new Error("REVIEW_QA_PASSWORD_TOO_SHORT");
  const temporaryPassword = configuredQaPassword ?? `${randomBytes(28).toString("base64url")}Aa1!`;
  const passwordHash = await hashPassword(temporaryPassword);
  const users = new Map(await Promise.all(profiles.map(async (fixture) => {
    const email = `${fixture.key}@review.orqena.invalid`;
    const user = await prisma.user.upsert({
      where: { emailNormalized: email },
      update: { displayName: fixture.label, passwordHash, status: "active", emailVerifiedAt: new Date() },
      create: { email, emailNormalized: email, displayName: fixture.label, passwordHash, status: "active", emailVerifiedAt: new Date() },
    });
    return [fixture.key, user] as const;
  })));

  const owner = users.get("owner")!;
  const primary = await provisionCompany(prisma, {
    userId: owner.id,
    name: "Orqena Review · Construcción",
    organizationType: "COMPANY",
    sectorKey: "construction",
    mainGoal: "Auditar un ciclo sintético completo",
    teamSize: "6-20",
    planKey: "BUSINESS",
    idempotencyKey: "continuous-review:construction:v1",
    isDemo: true,
    demoScenarioKey: "construction",
  });
  const negativeTenant = await provisionCompany(prisma, {
    userId: owner.id,
    name: "Orqena Review · Instalaciones",
    organizationType: "COMPANY",
    sectorKey: "installations",
    mainGoal: "Control negativo multiempresa",
    teamSize: "2-5",
    planKey: "STARTER",
    idempotencyKey: "continuous-review:installations:v1",
    isDemo: true,
    demoScenarioKey: "installations",
  });

  const memberships = new Map();
  for (const fixture of profiles) {
    const user = users.get(fixture.key)!;
    const membership = await prisma.companyMembership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: primary.id } },
      update: { role: fixture.role, functionalProfileKey: fixture.profile, accessMode: fixture.readOnly ? "READ_ONLY" : "STANDARD", status: "active", acceptedAt: new Date(), joinedAt: new Date(), origin: "continuous-review" },
      create: { userId: user.id, companyId: primary.id, role: fixture.role, functionalProfileKey: fixture.profile, accessMode: fixture.readOnly ? "READ_ONLY" : "STANDARD", status: "active", acceptedAt: new Date(), joinedAt: new Date(), origin: "continuous-review", isDemo: true },
    });
    await prisma.membershipAccessPackage.deleteMany({ where: { membershipId: membership.id } });
    await prisma.membershipAccessPackage.createMany({ data: profileDefaultPackages[fixture.profile].map((packageKey) => ({ companyId: primary.id, membershipId: membership.id, packageKey, grantedById: owner.id })) });
    await prisma.user.update({ where: { id: user.id }, data: { activeCompanyId: primary.id } });
    memberships.set(fixture.key, membership);
  }

  const client = await prisma.client.upsert({
    where: { id: "review-client-1" },
    update: { companyId: primary.id },
    create: { id: "review-client-1", companyId: primary.id, nombre: "Cliente Sintético Review", telefono: "+34 000 000 201", email: "cliente@review.orqena.invalid", direccion: "Calle Sintética 1", tipo: "Empresa", origen: "continuous-review" },
  });
  const work = await prisma.work.upsert({
    where: { id: "review-work-1" },
    update: { companyId: primary.id, clienteId: client.id },
    create: { id: "review-work-1", companyId: primary.id, clienteId: client.id, numeroInterno: "OB-REV-1", titulo: "Reforma sintética completa", direccion: "Calle Sintética 1", tipoTrabajo: "Reforma", presupuestoAprobado: 18_000 },
  });
  await prisma.budget.upsert({
    where: { id: "review-budget-1" },
    update: { companyId: primary.id, clienteId: client.id, obraId: work.id },
    create: { id: "review-budget-1", companyId: primary.id, clienteId: client.id, obraId: work.id, numero: "P-REV-1", titulo: "Presupuesto sintético", partidas: "Demolición, instalación y acabado", subtotal: 10_000, iva: 2_100, total: 12_100, margenEstimado: 2_400, estado: "enviado" },
  });
  await prisma.invoice.upsert({
    where: { id: "review-invoice-1" },
    update: { companyId: primary.id, clienteId: client.id, obraId: work.id },
    create: { id: "review-invoice-1", companyId: primary.id, clienteId: client.id, obraId: work.id, numero: "F-REV-1", concepto: "Factura sintética parcial", importeBase: 5_000, iva: 1_050, total: 6_050, pagado: 2_000, pendiente: 4_050, fechaEmision: new Date(), fechaVencimiento: new Date(Date.now() + 14 * 86_400_000), estado: "emitida" },
  });
  await prisma.expense.upsert({
    where: { id: "review-expense-1" },
    update: { companyId: primary.id, obraId: work.id },
    create: { id: "review-expense-1", companyId: primary.id, obraId: work.id, proveedor: "Proveedor Sintético Review", concepto: "Material de prueba", categoria: "materiales", importe: 850, fecha: new Date() },
  });
  await prisma.businessPartner.upsert({
    where: { id: "review-partner-1" },
    update: { companyId: primary.id },
    create: { id: "review-partner-1", companyId: primary.id, kind: "SUPPLIER", commercialName: "Suministros Review", legalName: "Suministros Review Sintéticos", email: "proveedor@review.orqena.invalid" },
  });
  await prisma.eventoAgenda.upsert({
    where: { id: "review-event-1" },
    update: { companyId: primary.id, clienteId: client.id, obraId: work.id },
    create: { id: "review-event-1", companyId: primary.id, titulo: "Visita sintética", tipo: "visita", fechaInicio: new Date(Date.now() + 86_400_000), clienteId: client.id, obraId: work.id },
  });
  const task = await prisma.task.upsert({
    where: { id: "review-task-1" },
    update: { companyId: primary.id, clientId: client.id, workId: work.id },
    create: { id: "review-task-1", companyId: primary.id, clientId: client.id, workId: work.id, title: "Revisar avance sintético", description: "Tarea visible para los perfiles operativos", createdById: owner.id, assigneeId: users.get("worker")!.id, dueAt: new Date(Date.now() + 86_400_000) },
  });
  await prisma.taskAssignment.deleteMany({ where: { taskId: task.id } });
  await prisma.taskAssignment.createMany({ data: ["project-manager", "supervisor", "worker", "external"].map((key) => ({ taskId: task.id, userId: users.get(key)!.id, role: "responsible" })) });

  await prisma.platformAccount.upsert({ where: { userId: owner.id }, update: { role: "PLATFORM_OWNER", status: "ACTIVE" }, create: { userId: owner.id, role: "PLATFORM_OWNER", status: "ACTIVE" } });
  let ownerMfaToken: string | null = null;
  if (process.env.ORQENA_REVIEW_PROVISION_MFA === "true") {
    const enrollment = await startTotpEnrollment({ prisma, userId: owner.id, email: owner.email });
    const secret = new URL(enrollment.uri).searchParams.get("secret");
    if (!secret) throw new Error("REVIEW_MFA_SECRET_MISSING");
    ownerMfaToken = await generate({ secret });
    await confirmTotpEnrollment({ prisma, userId: owner.id, factorId: enrollment.factorId, token: ownerMfaToken });
  }
  const rotateOwnerAccess = process.env.ORQENA_REVIEW_ROTATE_OWNER_ACCESS !== "false";
  const token = rotateOwnerAccess ? createOpaqueToken() : null;
  if (token) {
    await prisma.passwordResetToken.updateMany({ where: { userId: owner.id, usedAt: null }, data: { usedAt: new Date() } });
    await prisma.passwordResetToken.create({ data: { userId: owner.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60_000) } });
  }
  await prisma.auditLog.create({ data: { companyId: primary.id, userActorId: owner.id, action: "continuous_review.provisioned", targetType: "Company", targetId: primary.id, metadata: { synthetic: true, version: 1, profiles: profiles.length, negativeTenantId: negativeTenant.id } } });

  process.stdout.write(`${JSON.stringify({
    ok: true,
    synthetic: true,
    companies: 2,
    profiles: profiles.map(({ key, profile, readOnly }) => ({ key, profile, readOnly: Boolean(readOnly) })),
    platformOwner: true,
    passwordPrinted: false,
    resetUrl: token ? `${REVIEW_ORIGIN}/restablecer-contrasena?token=${encodeURIComponent(token)}` : null,
    resetExpiresAt: token ? new Date(Date.now() + 60 * 60_000).toISOString() : null,
    ownerAccessRotated: Boolean(token),
    ownerMfaProvisioned: Boolean(ownerMfaToken),
    ownerMfaToken,
  })}\n`);
}

main().finally(() => prisma.$disconnect()).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
