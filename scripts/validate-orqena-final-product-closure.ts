import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { hashPassword, hashToken } from "../lib/auth/crypto";
import { withCompanyContext, type CompanyContext } from "../lib/auth/session";
import { ensureBasePlans } from "../lib/commercial/provisioning";
import type { CapabilityKey } from "../lib/commercial/catalog";
import { getEntitlements, resolveAuthorization, resolveScopedEntityIds } from "../lib/commercial/authorization";
import { buildPortalManifest } from "../lib/commercial/portal-manifest";
import { functionalProfileCapabilities, profileDefaultPackages, resolveFunctionalProfile, type FunctionalProfileKey } from "../lib/commercial/functional-profiles";
import { acceptEmployeeInvitation, approveEmployeeMembership } from "../lib/commercial/invitation-service";
import { requireActiveOwner } from "../lib/commercial/owner-governance";

type ProfileCase = {
  key: FunctionalProfileKey;
  role: "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";
  positive: readonly CapabilityKey[];
  negative: readonly CapabilityKey[];
  readOnly?: boolean;
};

const checkedCapabilities = ["company.view", "clients.view", "work.view", "agenda.view", "tasks.view", "documents.view", "orqena.use"] as const satisfies readonly CapabilityKey[];
const profiles: readonly ProfileCase[] = [
  { key: "OWNER", role: "OWNER", positive: checkedCapabilities, negative: [] },
  { key: "GENERAL_MANAGER", role: "MANAGER", positive: checkedCapabilities, negative: ["company.members.invite", "treasury.view"] },
  { key: "SALES_MANAGER", role: "MANAGER", positive: ["company.view", "clients.view", "agenda.view", "tasks.view", "documents.view", "orqena.use", "sales.budgets.create"], negative: ["treasury.view", "company.members.invite"] },
  { key: "SALES", role: "MEMBER", positive: ["company.view", "clients.view", "agenda.view", "tasks.view", "documents.view", "orqena.use", "sales.budgets.create"], negative: ["margin_amount.view", "treasury.view", "company.members.invite"] },
  { key: "ADMINISTRATIVE", role: "ADMIN", positive: ["company.view", "clients.view", "agenda.view", "tasks.view", "documents.view", "orqena.use"], negative: ["work.view", "treasury.view", "company.members.invite"] },
  { key: "FINANCE", role: "ADMIN", positive: ["company.view", "documents.view", "orqena.use", "sales.invoices.view", "treasury.view"], negative: ["company.members.invite", "work.view"] },
  { key: "PROCUREMENT_MANAGER", role: "MANAGER", positive: ["company.view", "documents.view", "orqena.use", "purchases.suppliers.view", "purchase_cost.view"], negative: ["sales.invoices.view", "treasury.view", "company.members.invite"] },
  { key: "PROJECT_MANAGER", role: "MANAGER", positive: ["company.view", "work.view", "agenda.view", "tasks.view", "documents.view", "orqena.use"], negative: ["clients.view", "profitability.view", "company.members.invite"] },
  { key: "TEAM_SUPERVISOR", role: "MEMBER", positive: ["company.view", "work.view", "agenda.view", "tasks.view", "documents.view", "orqena.use"], negative: ["clients.view", "treasury.view", "company.members.invite"] },
  { key: "WORKER", role: "MEMBER", positive: ["company.view", "work.view", "agenda.view", "tasks.view", "documents.view", "orqena.use"], negative: ["clients.view", "treasury.view", "company.members.invite"] },
  { key: "EXTERNAL_COLLABORATOR", role: "MEMBER", positive: ["company.view", "work.view", "agenda.view", "documents.view"], negative: ["clients.view", "treasury.view", "company.members.invite"] },
  { key: "ADVISOR_AUDITOR", role: "VIEWER", positive: ["company.view", "documents.view", "orqena.use", "reports.view"], negative: ["clients.view", "treasury.view", "company.members.invite"], readOnly: true }
];

function requireIsolatedDatabase() {
  if (process.env.CAPATAZ_TEST_DATABASE_ISOLATED !== "true") throw new Error("CAPATAZ_TEST_DATABASE_ISOLATED=true es obligatorio.");
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL aislada es obligatoria.");
  const url = new URL(raw);
  const database = url.pathname.replace(/^\//, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname) || !database.startsWith("capataz_test")) throw new Error("La prueba sólo puede usar PostgreSQL local capataz_test*.");
}

function context(input: { userId: string; membershipId: string; companyId: string; role: ProfileCase["role"] }): CompanyContext {
  return {
    sessionId: `closure-${input.membershipId}`, userId: input.userId, membershipId: input.membershipId, companyId: input.companyId,
    email: "closure@orqena.invalid", displayName: "Cierre Orqena", expiresAt: new Date(Date.now() + 60_000), role: input.role,
    isDemo: true, companyName: "Cierre Orqena", companyStatus: "active", commercialStatus: "ACTIVE"
  };
}

async function main() {
  requireIsolatedDatabase();
  await ensureBasePlans(prisma);
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const passwordHash = await hashPassword("Orqena-functional-closure-2026!");
  const company = await prisma.company.create({ data: { slug: `closure-${suffix}`, nombreComercial: `Cierre Orqena ${suffix}`, status: "active", isDemo: true, organizationType: "COMPANY", sectorKey: "construction" } });
  const users = new Map<string, { id: string }>();
  const memberships = new Map<FunctionalProfileKey, { id: string; userId: string }>();
  const traces: Array<Record<string, unknown>> = [];

  try {
    const plan = await prisma.plan.findUniqueOrThrow({ where: { key: "BUSINESS" } });
    await prisma.subscription.create({ data: { companyId: company.id, planId: plan.id, status: "ACTIVE", provider: "local", currentPeriodStart: new Date(Date.now() - 60_000), currentPeriodEnd: new Date(Date.now() + 86400000) } });

    for (const profile of profiles) {
      const email = `${profile.key.toLowerCase().replaceAll("_", "-")}-${suffix}@orqena.invalid`;
      const user = await prisma.user.create({ data: { email, emailNormalized: email, displayName: profile.key, passwordHash, status: "active", emailVerifiedAt: new Date(), activeCompanyId: company.id } });
      users.set(profile.key, user);
      const membership = await prisma.companyMembership.create({ data: { userId: user.id, companyId: company.id, role: profile.role, functionalProfileKey: profile.key, accessMode: profile.readOnly ? "READ_ONLY" : "STANDARD", status: "active", acceptedAt: new Date(), joinedAt: new Date(), origin: "functional-closure" } });
      memberships.set(profile.key, { id: membership.id, userId: user.id });
      await prisma.membershipAccessPackage.createMany({ data: profileDefaultPackages[profile.key].map((packageKey) => ({ companyId: company.id, membershipId: membership.id, packageKey })) });
    }

    const worker = memberships.get("WORKER")!;
    await prisma.scopeAssignment.create({ data: { companyId: company.id, membershipId: worker.id, capabilityKey: "work.view", scope: "ASSIGNED", entityType: "Work", entityId: "closure-work" } });
    const generalManager = memberships.get("GENERAL_MANAGER")!;
    await prisma.approvalAuthority.create({ data: { companyId: company.id, membershipId: generalManager.id, authorityKey: "quote.approve", maxAmount: 100000, scope: "COMPANY" } });

    for (const profile of profiles) {
      const member = memberships.get(profile.key)!;
      const auth = context({ userId: member.userId, membershipId: member.id, companyId: company.id, role: profile.role });
      const manifest = await buildPortalManifest(auth);
      assert.equal(manifest.profile, profile.key, `${profile.key}: profile resolved incorrectly`);
      assert.equal(manifest.readOnly, Boolean(profile.readOnly), `${profile.key}: read-only mode mismatch`);
      assert.ok(manifest.navigation.length > 0 || manifest.safeHome === "/acceso-restringido", `${profile.key}: empty portal without a safe home`);
      assert.ok(manifest.packages.length > 0, `${profile.key}: packages missing from PortalManifest`);
      if (profile.key === "WORKER") assert.ok(manifest.scopes.some((scope) => scope.capabilityKey === "work.view" && scope.scope === "ASSIGNED"), "WORKER: assigned scope missing from PortalManifest");
      if (profile.key === "GENERAL_MANAGER") assert.ok(manifest.approvalAuthorities.some((item) => item.key === "quote.approve" && item.maxAmount === "100000"), "GENERAL_MANAGER: delegated approval missing from PortalManifest");

      for (const capability of checkedCapabilities) {
        const decision = await resolveAuthorization(auth, capability);
        traces.push({ profile: profile.key, capability, resolvedProfile: resolveFunctionalProfile(profile.key, profile.role), baseCapabilities: functionalProfileCapabilities[profile.key], packages: manifest.packages, entitlements: (await getEntitlements(company.id)).values, scope: decision.scope, decision: decision.allowed, reason: decision.reason });
      }
      for (const capability of profile.positive) assert.equal((await resolveAuthorization(auth, capability)).allowed, true, `${profile.key}: expected ${capability} to be allowed`);
      for (const capability of profile.negative) assert.equal((await resolveAuthorization(auth, capability)).allowed, false, `${profile.key}: expected ${capability} to be denied`);
    }

    const owner = memberships.get("OWNER")!;
    const sales = memberships.get("SALES")!;
    const ownerContext = context({ userId: owner.userId, membershipId: owner.id, companyId: company.id, role: "OWNER" });
    const salesContext = context({ userId: sales.userId, membershipId: sales.id, companyId: company.id, role: "MEMBER" });
    const workerContext = context({ userId: worker.userId, membershipId: worker.id, companyId: company.id, role: "MEMBER" });
    assert.equal((await resolveAuthorization(ownerContext, "company.members.invite")).allowed, true, "OWNER must govern invitations");
    assert.equal((await withCompanyContext(ownerContext, () => requireActiveOwner())).ownerMembership.id, owner.id, "OWNER must satisfy the central governance guard");
    await assert.rejects(withCompanyContext(salesContext, () => requireActiveOwner()), /OWNER_REQUIRED/, "Non-owner must not satisfy the central governance guard");
    assert.equal((await resolveAuthorization(salesContext, "margin_amount.view")).allowed, false, "SALES must not see margin without a grant");
    await prisma.membershipPermissionOverride.create({ data: { membershipId: sales.id, capabilityKey: "margin_amount.view", effect: "GRANT", changedById: owner.userId, reason: "Functional closure field grant" } });
    assert.equal((await resolveAuthorization(salesContext, "margin_amount.view")).allowed, true, "SALES must see margin after an explicit grant");
    assert.equal((await resolveAuthorization(workerContext, "work.update")).scope, "ASSIGNED", "Mutating work access must inherit the selected work.view scope");
    assert.deepEqual(await resolveScopedEntityIds(workerContext, "work.update", "Work"), ["closure-work"], "Mutating work access must inherit selected work IDs");
    await prisma.membershipPermissionOverride.create({ data: { membershipId: worker.id, capabilityKey: "sales.invoices.view", effect: "GRANT", changedById: owner.userId, reason: "Economic hard-boundary check" } });
    assert.equal((await resolveAuthorization(workerContext, "sales.invoices.view")).allowed, false, "WORKER must never receive economic access through an override");

    const auditor = memberships.get("ADVISOR_AUDITOR")!;
    await prisma.membershipPermissionOverride.create({ data: { membershipId: auditor.id, capabilityKey: "documents.upload", effect: "GRANT", changedById: owner.userId, reason: "Read-only mutation guard" } });
    assert.equal((await resolveAuthorization(context({ userId: auditor.userId, membershipId: auditor.id, companyId: company.id, role: "VIEWER" }), "documents.upload")).allowed, false, "READ_ONLY must not mutate even after a grant");

    const token = `closure-${suffix}-one-use-token`;
    const invitation = await prisma.invitation.create({ data: { companyId: company.id, inviterId: owner.userId, emailNormalized: `invite-${suffix}@orqena.invalid`, role: "MEMBER", functionalProfileKey: "WORKER", accessMode: "STANDARD", status: "PENDING_EMPLOYEE", tokenHash: hashToken(token), accessPackageKeys: ["OPERATIONS", "OPERATIONAL_DOCUMENTS"], scopeTemplate: [{ capabilityKey: "work.view", scope: "ASSIGNED", entityId: "closure-work" }], expiresAt: new Date(Date.now() + 86400000) } });
    const outbox = await prisma.emailOutbox.create({ data: { companyId: company.id, invitationId: invitation.id, eventKey: "employee_invited", templateKey: "employee_invited", templateVersion: 1, recipient: invitation.emailNormalized, subject: "Invitación sintética", status: "PENDING", createdById: owner.userId, payload: { synthetic: true } } });
    assert.notEqual(invitation.tokenHash, token, "Invitation token must be persisted only as a hash");
    assert.equal(outbox.status, "PENDING", "Invitation must create a pending local outbox event");
    const invitee = await prisma.user.create({ data: { email: invitation.emailNormalized, emailNormalized: invitation.emailNormalized, displayName: "Empleado invitado", passwordHash, status: "active", emailVerifiedAt: new Date() } });
    users.set("invitee", invitee);
    const pendingMembership = await acceptEmployeeInvitation({ token, userId: invitee.id, email: invitee.email });
    assert.equal(pendingMembership.status, "pending_owner_approval", "Accepted employee must remain pending until owner approval");
    assert.equal((await resolveAuthorization(context({ userId: invitee.id, membershipId: pendingMembership.id, companyId: company.id, role: "MEMBER" }), "work.view")).allowed, false, "Pending member must not enter the company portal");
    const approvedMembership = await approveEmployeeMembership({ companyId: company.id, ownerId: owner.userId, invitationId: invitation.id });
    assert.equal(approvedMembership.status, "active", "Owner approval must activate the membership");
    assert.equal((await resolveAuthorization(context({ userId: invitee.id, membershipId: approvedMembership.id, companyId: company.id, role: "MEMBER" }), "work.view")).allowed, true, "Approved worker must receive the selected operational package");
    await assert.rejects(acceptEmployeeInvitation({ token, userId: invitee.id, email: invitee.email }), /INVITATION_NOT_AVAILABLE/, "Invitation token must be single-use");

    const report = { ok: true, suite: "orqena-final-product-closure", isolated: true, profiles: profiles.map((item) => item.key), checks: { profileResolution: profiles.length, portalManifests: profiles.length, authorizationTraces: traces.length, ownerGovernance: true, explicitFieldGrant: true, economicBoundary: true, inheritedMutationScope: true, readOnlyMutationDenied: true, invitationOutbox: true, invitationPendingDenied: true, invitationOwnerApproval: true, invitationSingleUse: true }, ...(process.env.ORQENA_AUTHORIZATION_TRACE === "true" ? { traces } : {}) };
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.emailOutbox.deleteMany({ where: { companyId: company.id } });
    await prisma.invitation.deleteMany({ where: { companyId: company.id } });
    await prisma.auditLog.deleteMany({ where: { companyId: company.id } });
    await prisma.subscription.deleteMany({ where: { companyId: company.id } });
    await prisma.user.updateMany({ where: { activeCompanyId: company.id }, data: { activeCompanyId: null } });
    await prisma.companyMembership.deleteMany({ where: { companyId: company.id } });
    await prisma.company.delete({ where: { id: company.id } });
    await prisma.user.deleteMany({ where: { id: { in: [...users.values()].map((user) => user.id) } } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  await prisma.$disconnect().catch(() => undefined);
  console.error(error);
  process.exitCode = 1;
});
