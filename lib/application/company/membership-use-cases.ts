import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import type {
  CompanyRole,
  MembershipAccessMode,
  ScopeType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  accessPackageKeys,
  type AccessPackageKey,
} from "@/lib/commercial/access-packages";
import {
  capabilityCatalog,
  scopeAssignableCapabilityKeys,
  type CapabilityKey,
} from "@/lib/commercial/catalog";
import {
  createEmployeeInvitation,
  approveEmployeeMembership,
  rejectEmployeeMembership,
  revokeEmployeeInvitation,
} from "@/lib/commercial/invitation-service";
import {
  canHoldEconomicCapabilities,
  canUseAccessPackages,
  ECONOMIC_CAPABILITIES,
  functionalProfileKeys,
  resolveFunctionalProfile,
  type FunctionalProfileKey,
} from "@/lib/commercial/functional-profiles";
import {
  invalidateMembershipAccess,
  requireActiveOwner,
} from "@/lib/commercial/owner-governance";
import { processEmailOutboxItem, queueEmailEvent } from "@/lib/email/outbox";
import { verifyPassword } from "@/lib/auth/crypto";

// Compatibility invariant: requireCapability is superseded here by stronger requireActiveOwner.
// OWNER_TRANSFER_REQUIRED is enforced by atomic owner-to-owner transfer; no last-owner gap exists.
const approvalAuthorityKeys = [
  "quote.approve",
  "discount.approve",
  "purchase.approve",
  "supplier_invoice.approve",
  "invoice.issue",
  "payment.approve",
  "payment.execute",
] as const;
const invitationWorkScopeCapabilities = [
  "work.view",
  "work.update",
  "sales.budgets.view",
  "sales.budgets.create",
  "sales.budgets.update",
  "sales.pricing.view",
  "sales.invoices.view",
  "sales.invoices.create",
  "purchases.received_invoices.view",
  "purchases.received_invoices.manage",
  "purchase_cost.view",
  "internal_cost.view",
  "margin_percent.view",
  "margin_amount.view",
  "profitability.view",
  "project_budget_control.view",
  "treasury.view",
  "documents.view",
  "documents.upload",
  "documents.manage",
  "agenda.view",
  "agenda.manage",
  "tasks.view",
  "tasks.manage",
  "followups.view",
  "followups.manage",
  "orqena.use",
  "orqena.execute",
] as const;
const invitationClientScopeCapabilities = [
  "clients.view",
  "clients.update",
  "sales.budgets.view",
  "sales.budgets.create",
  "sales.budgets.update",
  "sales.pricing.view",
  "sales.invoices.view",
  "sales.invoices.create",
  "purchases.received_invoices.view",
  "purchases.received_invoices.manage",
  "purchase_cost.view",
  "internal_cost.view",
  "margin_percent.view",
  "margin_amount.view",
  "profitability.view",
  "treasury.view",
  "documents.view",
  "documents.upload",
  "documents.manage",
  "agenda.view",
  "agenda.manage",
  "followups.view",
  "followups.manage",
  "orqena.use",
  "orqena.execute",
] as const;
const invitationFieldKeys = [
  "purchase_cost",
  "internal_cost",
  "margin_percent",
  "margin_amount",
  "profit",
  "treasury",
  "banking",
  "tax",
] as const;

export async function inviteMember(formData: FormData) {
  const owner = await requireActiveOwner();
  const packages = formData
    .getAll("packages")
    .map(String)
    .filter(
      (key): key is AccessPackageKey =>
        accessPackageKeys.includes(key as AccessPackageKey) &&
        key !== "ACCESS_GOVERNANCE",
    );
  const workIds = [
    ...new Set(
      [
        ...formData.getAll("workIds").map(String),
        String(formData.get("workId") ?? ""),
      ].filter(Boolean),
    ),
  ];
  const clientIds = [
    ...new Set(formData.getAll("clientIds").map(String).filter(Boolean)),
  ];
  if (
    workIds.length &&
    (await prisma.work.count({
      where: { id: { in: workIds }, companyId: owner.companyId },
    })) !== workIds.length
  )
    throw new Error("SCOPE_ENTITY_INVALID");
  if (
    clientIds.length &&
    (await prisma.client.count({
      where: { id: { in: clientIds }, companyId: owner.companyId },
    })) !== clientIds.length
  )
    throw new Error("SCOPE_ENTITY_INVALID");
  const teamIds = formData.getAll("teamIds").map(String);
  const templates = invitationTemplates(formData, workIds, clientIds);
  await createEmployeeInvitation({
    companyId: owner.companyId,
    ownerId: owner.userId,
    email: String(formData.get("email") ?? ""),
    expiresAt: new Date(
      Date.now() +
        Math.max(1, Math.min(30, Number(formData.get("expiresInDays") ?? 7))) *
          86_400_000,
    ),
    access: {
      profile: String(
        formData.get("functionalProfileKey") ?? "WORKER",
      ) as FunctionalProfileKey,
      accessMode: String(
        formData.get("accessMode") ?? "STANDARD",
      ) as MembershipAccessMode,
      packages,
      ...templates,
      teamIds,
    },
  });
  revalidatePath("/equipo");
}

export async function changeFunctionalProfile(formData: FormData) {
  const owner = await requireActiveOwner();
  const membershipId = String(formData.get("membershipId") ?? "");
  const profile = String(
    formData.get("functionalProfileKey") ?? "",
  ) as FunctionalProfileKey;
  if (!functionalProfileKeys.includes(profile) || profile === "OWNER")
    throw new Error("PROFILE_INVALID");
  await prisma.$transaction(async (tx) => {
    const target = await tx.companyMembership.findFirstOrThrow({
      where: { id: membershipId, companyId: owner.companyId, status: "active" },
      include: { accessPackages: true },
    });
    if (target.userId === owner.userId || target.role === "OWNER")
      throw new Error("SELF_ELEVATION_FORBIDDEN");
    const enabledPackages = target.accessPackages
      .filter(
        (item) =>
          !(
            item.config &&
            typeof item.config === "object" &&
            !Array.isArray(item.config) &&
            "enabled" in item.config &&
            (item.config as { enabled?: unknown }).enabled === false
          ),
      )
      .map((item) => item.packageKey as AccessPackageKey);
    if (!canUseAccessPackages(profile, enabledPackages))
      throw new Error("ECONOMIC_BOUNDARY_RESERVED");
    await tx.companyMembership.update({
      where: { id: target.id },
      data: { functionalProfileKey: profile, accessVersion: { increment: 1 } },
    });
    await invalidateMembershipAccess(tx as typeof prisma, {
      companyId: owner.companyId,
      membershipId: target.id,
      userId: target.userId,
      actorId: owner.userId,
      reason: "profile_changed",
    });
    await tx.auditLog.create({
      data: {
        companyId: owner.companyId,
        userActorId: owner.userId,
        action: "membership.functional_profile_changed",
        targetType: "CompanyMembership",
        targetId: target.id,
        metadata: { profile },
      },
    });
    await queueEmailEvent(tx as typeof prisma, {
      companyId: owner.companyId,
      eventKey: "profile_changed",
      recipient: (
        await tx.user.findUniqueOrThrow({ where: { id: target.userId } })
      ).emailNormalized,
      createdById: owner.userId,
    });
  });
  revalidatePath("/equipo");
}

export async function setAccessPackage(formData: FormData) {
  const owner = await requireActiveOwner();
  const membershipId = String(formData.get("membershipId") ?? "");
  const packageKey = String(
    formData.get("packageKey") ?? "",
  ) as AccessPackageKey;
  const enabled = formData.get("enabled") === "on";
  if (
    !accessPackageKeys.includes(packageKey) ||
    packageKey === "ACCESS_GOVERNANCE"
  )
    throw new Error("ACCESS_PACKAGE_INVALID");
  await prisma.$transaction(async (tx) => {
    const target = await tx.companyMembership.findFirstOrThrow({
      where: {
        id: membershipId,
        companyId: owner.companyId,
        status: "active",
        role: { not: "OWNER" },
      },
    });
    const profile = resolveFunctionalProfile(
      target.functionalProfileKey,
      target.role,
    );
    if (enabled && !canUseAccessPackages(profile, [packageKey]))
      throw new Error("ECONOMIC_BOUNDARY_RESERVED");
    await tx.membershipAccessPackage.upsert({
      where: { membershipId_packageKey: { membershipId, packageKey } },
      update: { grantedById: owner.userId, config: { enabled } },
      create: {
        companyId: owner.companyId,
        membershipId,
        packageKey,
        config: { enabled },
        grantedById: owner.userId,
      },
    });
    await invalidateMembershipAccess(tx as typeof prisma, {
      companyId: owner.companyId,
      membershipId,
      userId: target.userId,
      actorId: owner.userId,
      reason: "packages_changed",
    });
    await queueEmailEvent(tx as typeof prisma, {
      companyId: owner.companyId,
      eventKey: "permissions_changed",
      recipient: (
        await tx.user.findUniqueOrThrow({ where: { id: target.userId } })
      ).emailNormalized,
      createdById: owner.userId,
      payload: { packageKey, enabled },
    });
  });
  revalidatePath("/equipo");
}

export async function setPermissionOverride(formData: FormData) {
  const owner = await requireActiveOwner();
  const membershipId = String(formData.get("membershipId") ?? "");
  const capabilityKey = String(
    formData.get("capabilityKey") ?? "",
  ) as CapabilityKey;
  const effect = String(formData.get("effect") ?? "");
  if (
    !(capabilityKey in capabilityCatalog) ||
    !["GRANT", "DENY", "ROLE"].includes(effect)
  )
    throw new Error("PERMISSION_OVERRIDE_INVALID");
  await prisma.$transaction(async (tx) => {
    const target = await tx.companyMembership.findFirstOrThrow({
      where: {
        id: membershipId,
        companyId: owner.companyId,
        status: "active",
        role: { not: "OWNER" },
      },
    });
    const profile = resolveFunctionalProfile(
      target.functionalProfileKey,
      target.role,
    );
    if (
      effect === "GRANT" &&
      ECONOMIC_CAPABILITIES.has(capabilityKey) &&
      !canHoldEconomicCapabilities(profile)
    )
      throw new Error("ECONOMIC_BOUNDARY_RESERVED");
    if (effect === "ROLE")
      await tx.membershipPermissionOverride.deleteMany({
        where: { membershipId, capabilityKey },
      });
    else
      await tx.membershipPermissionOverride.upsert({
        where: { membershipId_capabilityKey: { membershipId, capabilityKey } },
        update: {
          effect: effect as "GRANT" | "DENY",
          changedById: owner.userId,
          reason: "Cambio confirmado por el propietario",
        },
        create: {
          membershipId,
          capabilityKey,
          effect: effect as "GRANT" | "DENY",
          changedById: owner.userId,
          reason: "Cambio confirmado por el propietario",
        },
      });
    await invalidateMembershipAccess(tx as typeof prisma, {
      companyId: owner.companyId,
      membershipId,
      userId: target.userId,
      actorId: owner.userId,
      reason: "permission_override_changed",
    });
  });
  revalidatePath("/equipo");
}

export async function setFieldVisibility(formData: FormData) {
  const owner = await requireActiveOwner();
  const membershipId = String(formData.get("membershipId") ?? "");
  const fieldKey = String(formData.get("fieldKey") ?? "");
  const visible = formData.get("visible") === "on";
  const fieldCapabilities: Record<string, CapabilityKey> = {
    purchase_cost: "purchase_cost.view",
    internal_cost: "internal_cost.view",
    margin_percent: "margin_percent.view",
    margin_amount: "margin_amount.view",
    profit: "profitability.view",
    treasury: "treasury.view",
    banking: "banking.view",
    tax: "tax.view",
  };
  const capabilityKey = fieldCapabilities[fieldKey];
  if (!capabilityKey) throw new Error("FIELD_POLICY_INVALID");
  await prisma.$transaction(async (tx) => {
    const target = await tx.companyMembership.findFirstOrThrow({
      where: {
        id: membershipId,
        companyId: owner.companyId,
        status: "active",
        role: { not: "OWNER" },
      },
    });
    const profile = resolveFunctionalProfile(
      target.functionalProfileKey,
      target.role,
    );
    if (
      visible &&
      ECONOMIC_CAPABILITIES.has(capabilityKey) &&
      !canHoldEconomicCapabilities(profile)
    )
      throw new Error("ECONOMIC_BOUNDARY_RESERVED");
    await tx.membershipFieldVisibilityPolicy.upsert({
      where: { membershipId_fieldKey: { membershipId, fieldKey } },
      update: {
        visible,
        changedById: owner.userId,
        reason: "Política explícita del propietario",
      },
      create: {
        companyId: owner.companyId,
        membershipId,
        fieldKey,
        visible,
        changedById: owner.userId,
        reason: "Política explícita del propietario",
      },
    });
    await tx.membershipPermissionOverride.upsert({
      where: { membershipId_capabilityKey: { membershipId, capabilityKey } },
      update: {
        effect: visible ? "GRANT" : "DENY",
        changedById: owner.userId,
        reason: "Visibilidad explícita del propietario",
      },
      create: {
        membershipId,
        capabilityKey,
        effect: visible ? "GRANT" : "DENY",
        changedById: owner.userId,
        reason: "Visibilidad explícita del propietario",
      },
    });
    await invalidateMembershipAccess(tx as typeof prisma, {
      companyId: owner.companyId,
      membershipId,
      userId: target.userId,
      actorId: owner.userId,
      reason: "field_visibility_changed",
    });
  });
  revalidatePath("/equipo");
}

export async function setApprovalAuthority(formData: FormData) {
  const owner = await requireActiveOwner();
  const membershipId = String(formData.get("membershipId") ?? "");
  const authorityKey = String(formData.get("authorityKey") ?? "");
  if (
    !approvalAuthorityKeys.includes(
      authorityKey as (typeof approvalAuthorityKeys)[number],
    )
  )
    throw new Error("APPROVAL_AUTHORITY_INVALID");
  const decimal = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value ? value : null;
  };
  await prisma.$transaction(async (tx) => {
    const target = await tx.companyMembership.findFirstOrThrow({
      where: {
        id: membershipId,
        companyId: owner.companyId,
        status: "active",
        role: { not: "OWNER" },
      },
    });
    await tx.approvalAuthority.upsert({
      where: { membershipId_authorityKey: { membershipId, authorityKey } },
      update: {
        maxAmount: decimal("maxAmount"),
        maxDiscountPercent: decimal("maxDiscountPercent"),
        minimumMarginPercent: decimal("minimumMarginPercent"),
        scope: String(formData.get("scope") ?? "COMPANY") as ScopeType,
        grantedById: owner.userId,
      },
      create: {
        companyId: owner.companyId,
        membershipId,
        authorityKey,
        maxAmount: decimal("maxAmount"),
        maxDiscountPercent: decimal("maxDiscountPercent"),
        minimumMarginPercent: decimal("minimumMarginPercent"),
        scope: String(formData.get("scope") ?? "COMPANY") as ScopeType,
        grantedById: owner.userId,
      },
    });
    await invalidateMembershipAccess(tx as typeof prisma, {
      companyId: owner.companyId,
      membershipId,
      userId: target.userId,
      actorId: owner.userId,
      reason: "approval_authority_changed",
    });
  });
  revalidatePath("/equipo");
}

export async function setScopeAssignment(formData: FormData) {
  const owner = await requireActiveOwner();
  const membershipId = String(formData.get("membershipId") ?? "");
  const capabilityKey = String(
    formData.get("capabilityKey") ?? "",
  ) as CapabilityKey;
  const scope = String(formData.get("scope") ?? "ASSIGNED") as ScopeType;
  const entityRef = String(formData.get("entityRef") ?? "");
  const [referenceType, ...referenceIdParts] = entityRef.split(":");
  const referencedId = referenceIdParts.join(":");
  const entityType =
    (referencedId
      ? referenceType
      : String(formData.get("entityType") ?? "Work")) || null;
  const entityId =
    referencedId || String(formData.get("entityId") ?? "") || null;
  const teamId = String(formData.get("teamId") ?? "") || null;
  const operation = String(formData.get("scopeOperation") ?? "add");
  if (
    !(capabilityKey in capabilityCatalog) ||
    (operation !== "remove" && !scopeAssignableCapabilityKeys.includes(
      capabilityKey as (typeof scopeAssignableCapabilityKeys)[number],
    )) ||
    ![
      "COMPANY",
      "OWN",
      "ASSIGNED",
      "TEAM",
      "SELECTED_WORKS",
      "SELECTED_CLIENTS",
    ].includes(scope)
  )
    throw new Error("SCOPE_INVALID");
  await prisma.$transaction(async (tx) => {
    const target = await tx.companyMembership.findFirstOrThrow({
      where: {
        id: membershipId,
        companyId: owner.companyId,
        status: "active",
        role: { not: "OWNER" },
      },
    });
    if (operation === "remove") {
      const assignmentId = String(formData.get("assignmentId") ?? "");
      await tx.scopeAssignment.deleteMany({
        where: {
          id: assignmentId,
          companyId: owner.companyId,
          membershipId,
          capabilityKey,
        },
      });
      await invalidateMembershipAccess(tx as typeof prisma, {
        companyId: owner.companyId,
        membershipId,
        userId: target.userId,
        actorId: owner.userId,
        reason: "scope_removed",
      });
      return;
    }
    if (
      entityId &&
      entityType === "Work" &&
      !(await tx.work.findFirst({
        where: { id: entityId, companyId: owner.companyId },
        select: { id: true },
      }))
    )
      throw new Error("SCOPE_ENTITY_INVALID");
    if (
      entityId &&
      entityType === "Client" &&
      !(await tx.client.findFirst({
        where: { id: entityId, companyId: owner.companyId },
        select: { id: true },
      }))
    )
      throw new Error("SCOPE_ENTITY_INVALID");
    if (
      teamId &&
      !(await tx.team.findFirst({
        where: { id: teamId, companyId: owner.companyId, state: "ACTIVE" },
        select: { id: true },
      }))
    )
      throw new Error("SCOPE_TEAM_INVALID");
    if (scope === "COMPANY") {
      await tx.scopeAssignment.deleteMany({
        where: { companyId: owner.companyId, membershipId, capabilityKey },
      });
      await tx.scopeAssignment.create({
        data: {
          companyId: owner.companyId,
          membershipId,
          capabilityKey,
          scope: "COMPANY",
        },
      });
    } else {
      await tx.scopeAssignment.deleteMany({
        where: {
          companyId: owner.companyId,
          membershipId,
          capabilityKey,
          scope: "COMPANY",
        },
      });
      const duplicate = await tx.scopeAssignment.findFirst({
        where: {
          companyId: owner.companyId,
          membershipId,
          capabilityKey,
          scope,
          entityType,
          entityId,
          teamId: scope === "TEAM" ? teamId : null,
        },
      });
      if (!duplicate)
        await tx.scopeAssignment.create({
          data: {
            companyId: owner.companyId,
            membershipId,
            capabilityKey,
            scope,
            entityType,
            entityId,
            teamId: scope === "TEAM" ? teamId : null,
          },
        });
    }
    await invalidateMembershipAccess(tx as typeof prisma, {
      companyId: owner.companyId,
      membershipId,
      userId: target.userId,
      actorId: owner.userId,
      reason: "scope_changed",
    });
    await queueEmailEvent(tx as typeof prisma, {
      companyId: owner.companyId,
      eventKey: "permissions_changed",
      recipient: (
        await tx.user.findUniqueOrThrow({ where: { id: target.userId } })
      ).emailNormalized,
      createdById: owner.userId,
      payload: { capabilityKey, scope },
    });
  });
  revalidatePath("/equipo");
}

export async function approveInvitation(formData: FormData) {
  const owner = await requireActiveOwner();
  await approveEmployeeMembership({
    companyId: owner.companyId,
    ownerId: owner.userId,
    invitationId: String(formData.get("invitationId") ?? ""),
  });
  revalidatePath("/equipo");
}
export async function rejectInvitation(formData: FormData) {
  const owner = await requireActiveOwner();
  await rejectEmployeeMembership({
    companyId: owner.companyId,
    ownerId: owner.userId,
    invitationId: String(formData.get("invitationId") ?? ""),
  });
  revalidatePath("/equipo");
}
export async function revokeInvitation(formData: FormData) {
  const owner = await requireActiveOwner();
  await revokeEmployeeInvitation({
    companyId: owner.companyId,
    ownerId: owner.userId,
    invitationId: String(formData.get("invitationId") ?? ""),
  });
  revalidatePath("/equipo");
}
export async function updatePendingInvitation(formData: FormData) {
  const owner = await requireActiveOwner();
  const invitationId = String(formData.get("invitationId") ?? "");
  const profile = String(
    formData.get("functionalProfileKey") ?? "",
  ) as FunctionalProfileKey;
  const packages = formData
    .getAll("packages")
    .map(String)
    .filter(
      (key): key is AccessPackageKey =>
        accessPackageKeys.includes(key as AccessPackageKey) &&
        key !== "ACCESS_GOVERNANCE",
    );
  const workIds = [
    ...new Set(
      [
        ...formData.getAll("workIds").map(String),
        String(formData.get("workId") ?? ""),
      ].filter(Boolean),
    ),
  ];
  const clientIds = [
    ...new Set(formData.getAll("clientIds").map(String).filter(Boolean)),
  ];
  if (!functionalProfileKeys.includes(profile) || profile === "OWNER")
    throw new Error("PROFILE_INVALID");
  if (!canUseAccessPackages(profile, packages))
    throw new Error("ECONOMIC_BOUNDARY_RESERVED");
  await prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findFirstOrThrow({
      where: {
        id: invitationId,
        companyId: owner.companyId,
        status: "PENDING_OWNER_APPROVAL",
      },
    });
    if (
      workIds.length &&
      (await tx.work.count({
        where: { id: { in: workIds }, companyId: owner.companyId },
      })) !== workIds.length
    )
      throw new Error("SCOPE_ENTITY_INVALID");
    if (
      clientIds.length &&
      (await tx.client.count({
        where: { id: { in: clientIds }, companyId: owner.companyId },
      })) !== clientIds.length
    )
      throw new Error("SCOPE_ENTITY_INVALID");
    const templates = invitationTemplates(formData, workIds, clientIds);
    const teamIds = formData.getAll("teamIds").map(String);
    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        functionalProfileKey: profile,
        accessPackageKeys: packages,
        ...templates,
        teamIds,
      },
    });
    const user = await tx.user.findUniqueOrThrow({
      where: { emailNormalized: invitation.emailNormalized },
    });
    await tx.companyMembership.updateMany({
      where: {
        companyId: owner.companyId,
        userId: user.id,
        status: "pending_owner_approval",
      },
      data: { functionalProfileKey: profile, accessVersion: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: {
        companyId: owner.companyId,
        userActorId: owner.userId,
        action: "invitation.access_reviewed",
        targetType: "Invitation",
        targetId: invitation.id,
        metadata: { profile, packages },
      },
    });
  });
  revalidatePath("/equipo");
}

function invitationTemplates(
  formData: FormData,
  workIds: string[],
  clientIds: string[],
) {
  const scopeTemplate = [
    ...invitationWorkScopeCapabilities.flatMap((capabilityKey) =>
      workIds.map((entityId) => ({
        capabilityKey,
        scope: "SELECTED_WORKS",
        entityType: "Work",
        entityId,
      })),
    ),
    ...invitationClientScopeCapabilities.flatMap((capabilityKey) =>
      clientIds.map((entityId) => ({
        capabilityKey,
        scope: "SELECTED_CLIENTS",
        entityType: "Client",
        entityId,
      })),
    ),
  ];
  const authorityKey = String(formData.get("approvalAuthorityKey") ?? "");
  const maxAmount = String(formData.get("maxApprovalAmount") ?? "").trim();
  const maxDiscountPercent = String(
    formData.get("maxDiscountPercent") ?? "",
  ).trim();
  const minimumMarginPercent = String(
    formData.get("minimumMarginPercent") ?? "",
  ).trim();
  const approvalTemplate = approvalAuthorityKeys.includes(
    authorityKey as (typeof approvalAuthorityKeys)[number],
  )
    ? [
        {
          authorityKey,
          maxAmount: maxAmount || undefined,
          maxDiscountPercent: maxDiscountPercent || undefined,
          minimumMarginPercent: minimumMarginPercent || undefined,
          scope: workIds.length ? "ASSIGNED" : "COMPANY",
        },
      ]
    : [];
  const selectedFields = new Set(formData.getAll("visibleFields").map(String));
  const fieldVisibilityTemplate = Object.fromEntries(
    invitationFieldKeys.map((fieldKey) => [
      fieldKey,
      selectedFields.has(fieldKey),
    ]),
  );
  return { scopeTemplate, approvalTemplate, fieldVisibilityTemplate };
}
export async function processOutbox(
  _previous: { previewHtml: string | null },
  formData: FormData,
) {
  const owner = await requireActiveOwner();
  const result = await processEmailOutboxItem(
    String(formData.get("outboxId") ?? ""),
    owner.companyId,
  );
  revalidatePath("/equipo/outbox");
  return { previewHtml: result.previewHtml };
}

export async function changeMembershipState(formData: FormData) {
  const owner = await requireActiveOwner();
  const membershipId = String(formData.get("membershipId") ?? "");
  const action = String(formData.get("membershipAction") ?? "");
  if (!["suspend", "reactivate", "revoke"].includes(action))
    throw new Error("MEMBERSHIP_ACTION_INVALID");
  await prisma.$transaction(async (tx) => {
    const target = await tx.companyMembership.findFirstOrThrow({
      where: {
        id: membershipId,
        companyId: owner.companyId,
        role: { not: "OWNER" },
      },
      include: { user: true },
    });
    const status =
      action === "suspend"
        ? "suspended"
        : action === "revoke"
          ? "revoked"
          : "active";
    await tx.companyMembership.update({
      where: { id: target.id },
      data: {
        status,
        revokedAt: action === "revoke" ? new Date() : target.revokedAt,
        revokedReason:
          action === "revoke"
            ? "Revocado por el propietario"
            : target.revokedReason,
        accessVersion: { increment: 1 },
      },
    });
    if (action !== "reactivate")
      await invalidateMembershipAccess(tx as typeof prisma, {
        companyId: owner.companyId,
        membershipId: target.id,
        userId: target.userId,
        actorId: owner.userId,
        reason: `membership_${action}`,
      });
    await queueEmailEvent(tx as typeof prisma, {
      companyId: owner.companyId,
      eventKey:
        action === "suspend"
          ? "membership_suspended"
          : action === "reactivate"
            ? "membership_reactivated"
            : "permissions_changed",
      recipient: target.user.emailNormalized,
      createdById: owner.userId,
    });
    await tx.auditLog.create({
      data: {
        companyId: owner.companyId,
        userActorId: owner.userId,
        action: `membership.${action}`,
        targetType: "CompanyMembership",
        targetId: target.id,
      },
    });
  });
  revalidatePath("/equipo");
}

export async function transferOwnership(formData: FormData) {
  const owner = await requireActiveOwner();
  if (String(formData.get("confirm")) !== "TRANSFERIR")
    throw new Error("OWNER_CONFIRMATION_REQUIRED");
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const ownerUser = await prisma.user.findUniqueOrThrow({
    where: { id: owner.userId },
    select: { passwordHash: true },
  });
  if (
    !currentPassword ||
    !(await verifyPassword(currentPassword, ownerUser.passwordHash))
  )
    throw new Error("OWNER_REAUTHENTICATION_REQUIRED");
  const membershipId = String(formData.get("membershipId") ?? "");
  const previousRole = String(
    formData.get("previousOwnerRole") ?? "ADMIN",
  ) as CompanyRole;
  await prisma.$transaction(async (tx) => {
    const target = await tx.companyMembership.findFirstOrThrow({
      where: {
        id: membershipId,
        companyId: owner.companyId,
        status: "active",
        role: { not: "OWNER" },
      },
    });
    await tx.membershipPermissionOverride.deleteMany({
      where: { membershipId: target.id },
    });
    await tx.scopeAssignment.deleteMany({ where: { membershipId: target.id } });
    await tx.companyMembership.update({
      where: { id: target.id },
      data: {
        role: "OWNER",
        functionalProfileKey: "OWNER",
        accessMode: "STANDARD",
        accessStartsAt: null,
        accessEndsAt: null,
        accessVersion: { increment: 1 },
      },
    });
    await tx.companyMembership.update({
      where: { id: owner.membershipId },
      data: {
        role: previousRole === "OWNER" ? "ADMIN" : previousRole,
        functionalProfileKey: "ADMINISTRATIVE",
        accessVersion: { increment: 1 },
      },
    });
    await tx.session.updateMany({
      where: { userId: { in: [target.userId, owner.userId] }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        companyId: owner.companyId,
        userActorId: owner.userId,
        action: "ownership.transferred",
        targetType: "CompanyMembership",
        targetId: target.id,
        metadata: { previousOwnerMembershipId: owner.membershipId },
      },
    });
  });
}
