import type { MembershipAccessMode, Prisma } from "@prisma/client";
import {
  createOpaqueToken,
  hashToken,
  normalizeEmail,
} from "@/lib/auth/crypto";
import { prisma } from "@/lib/prisma";
import {
  accessPackageKeys,
  type AccessPackageKey,
} from "@/lib/commercial/access-packages";
import {
  canUseAccessPackages,
  functionalProfileKeys,
  type FunctionalProfileKey,
} from "@/lib/commercial/functional-profiles";
import { invalidateMembershipAccess } from "@/lib/commercial/owner-governance";
import { queueEmailEvent } from "@/lib/email/outbox";

export type InvitationAccess = {
  profile: FunctionalProfileKey;
  packages: AccessPackageKey[];
  accessMode: MembershipAccessMode;
  scopeTemplate?: Prisma.InputJsonValue;
  approvalTemplate?: Prisma.InputJsonValue;
  fieldVisibilityTemplate?: Prisma.InputJsonValue;
  teamIds?: string[];
};

export async function createEmployeeInvitation(input: {
  companyId: string;
  ownerId: string;
  email: string;
  expiresAt: Date;
  access: InvitationAccess;
}) {
  const emailNormalized = normalizeEmail(input.email);
  if (
    !/^\S+@\S+\.\S+$/.test(emailNormalized) ||
    input.access.profile === "OWNER" ||
    !functionalProfileKeys.includes(input.access.profile) ||
    input.access.packages.some((key) => !accessPackageKeys.includes(key)) ||
    !canUseAccessPackages(input.access.profile, input.access.packages)
  )
    throw new Error("INVITATION_INVALID");
  const role =
    input.access.accessMode === "READ_ONLY"
      ? ("VIEWER" as const)
      : ("MEMBER" as const);
  return prisma.$transaction(async (tx) => {
    await assertActiveOwner(tx, input.companyId, input.ownerId);
    const duplicate = await tx.companyMembership.findFirst({
      where: {
        companyId: input.companyId,
        user: { emailNormalized },
        status: { in: ["active", "invited", "pending_owner_approval"] },
      },
    });
    if (duplicate) throw new Error("MEMBERSHIP_EXISTS");
    await tx.invitation.updateMany({
      where: {
        companyId: input.companyId,
        emailNormalized,
        status: { in: ["PENDING", "PENDING_EMPLOYEE"] },
      },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    const invitation = await tx.invitation.create({
      data: {
        companyId: input.companyId,
        emailNormalized,
        role,
        functionalProfileKey: input.access.profile,
        accessMode: input.access.accessMode,
        status: "PENDING_EMPLOYEE",
        inviterId: input.ownerId,
        tokenHash: hashToken(createOpaqueToken()),
        accessPackageKeys: input.access.packages,
        scopeTemplate: input.access.scopeTemplate,
        approvalTemplate: input.access.approvalTemplate,
        fieldVisibilityTemplate: input.access.fieldVisibilityTemplate,
        teamIds: input.access.teamIds ?? [],
        expiresAt: input.expiresAt,
      },
    });
    await queueEmailEvent(tx as typeof prisma, {
      companyId: input.companyId,
      invitationId: invitation.id,
      eventKey: "employee_invited",
      recipient: emailNormalized,
      createdById: input.ownerId,
      payload: {
        profile: input.access.profile,
        packages: input.access.packages,
        accessMode: input.access.accessMode,
      },
    });
    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userActorId: input.ownerId,
        action: "invitation.created",
        targetType: "Invitation",
        targetId: invitation.id,
        metadata: {
          profile: input.access.profile,
          packages: input.access.packages,
          accessMode: input.access.accessMode,
        },
      },
    });
    return invitation;
  });
}

export async function acceptEmployeeInvitation(input: {
  token: string;
  userId: string;
  email: string;
}) {
  const now = new Date();
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(input.token) },
  });
  if (
    !invitation ||
    !["PENDING", "PENDING_EMPLOYEE"].includes(invitation.status) ||
    invitation.expiresAt <= now ||
    invitation.emailNormalized !== normalizeEmail(input.email)
  )
    throw new Error("INVITATION_NOT_AVAILABLE");
  return prisma.$transaction(async (tx) => {
    const membership = await tx.companyMembership.upsert({
      where: {
        userId_companyId: {
          userId: input.userId,
          companyId: invitation.companyId,
        },
      },
      update: {
        status: "pending_owner_approval",
        role: invitation.role,
        functionalProfileKey: invitation.functionalProfileKey,
        accessMode: invitation.accessMode,
        acceptedAt: now,
        invitedById: invitation.inviterId,
        approvedAt: null,
        approvedById: null,
      },
      create: {
        userId: input.userId,
        companyId: invitation.companyId,
        status: "pending_owner_approval",
        role: invitation.role,
        functionalProfileKey: invitation.functionalProfileKey,
        accessMode: invitation.accessMode,
        acceptedAt: now,
        invitedAt: invitation.createdAt,
        invitedById: invitation.inviterId,
        origin: "invitation",
      },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        status: "PENDING_OWNER_APPROVAL",
        acceptedAt: now,
        employeeAcceptedAt: now,
      },
    });
    await queueEmailEvent(tx as typeof prisma, {
      companyId: invitation.companyId,
      invitationId: invitation.id,
      eventKey: "owner_approval_requested",
      recipient: "owner-notification@orqena.invalid",
      createdById: input.userId,
      payload: { membershipId: membership.id },
    });
    await tx.auditLog.create({
      data: {
        companyId: invitation.companyId,
        userActorId: input.userId,
        action: "invitation.employee_accepted",
        targetType: "Invitation",
        targetId: invitation.id,
        metadata: { membershipId: membership.id },
      },
    });
    return membership;
  });
}

export async function approveEmployeeMembership(input: {
  companyId: string;
  ownerId: string;
  invitationId: string;
}) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await assertActiveOwner(tx, input.companyId, input.ownerId);
    const invitation = await tx.invitation.findFirstOrThrow({
      where: { id: input.invitationId, companyId: input.companyId },
    });
    const user = await tx.user.findUniqueOrThrow({
      where: { emailNormalized: invitation.emailNormalized },
    });
    if (invitation.status === "OWNER_APPROVED")
      return tx.companyMembership.findFirstOrThrow({
        where: {
          companyId: input.companyId,
          userId: user.id,
          status: "active",
        },
      });
    if (invitation.status !== "PENDING_OWNER_APPROVAL")
      throw new Error("INVITATION_NOT_APPROVABLE");
    const membership = await tx.companyMembership.findFirstOrThrow({
      where: {
        companyId: input.companyId,
        userId: user.id,
        status: "pending_owner_approval",
      },
    });
    await tx.membershipAccessPackage.deleteMany({
      where: { membershipId: membership.id },
    });
    const packages = jsonStrings(invitation.accessPackageKeys).filter(
      (key): key is AccessPackageKey =>
        accessPackageKeys.includes(key as AccessPackageKey),
    );
    if (packages.length)
      await tx.membershipAccessPackage.createMany({
        data: packages.map((packageKey) => ({
          companyId: input.companyId,
          membershipId: membership.id,
          packageKey,
          grantedById: input.ownerId,
        })),
      });
    const scopes = jsonObjects(invitation.scopeTemplate).filter(
      (item) =>
        typeof item.capabilityKey === "string" &&
        typeof item.scope === "string",
    );
    await tx.scopeAssignment.deleteMany({
      where: { membershipId: membership.id },
    });
    if (scopes.length)
      await tx.scopeAssignment.createMany({
        data: scopes.map((item) => ({
          companyId: input.companyId,
          membershipId: membership.id,
          capabilityKey: String(item.capabilityKey),
          scope: String(item.scope) as
            | "COMPANY"
            | "OWN"
            | "ASSIGNED"
            | "TEAM"
            | "SELECTED_WORKS"
            | "SELECTED_CLIENTS",
          teamId: typeof item.teamId === "string" ? item.teamId : null,
          entityType:
            typeof item.entityType === "string" ? item.entityType : null,
          entityId: typeof item.entityId === "string" ? item.entityId : null,
        })),
      });
    const authorities = jsonObjects(invitation.approvalTemplate).filter(
      (item) => typeof item.authorityKey === "string",
    );
    await tx.approvalAuthority.deleteMany({
      where: { membershipId: membership.id },
    });
    for (const item of authorities)
      await tx.approvalAuthority.create({
        data: {
          companyId: input.companyId,
          membershipId: membership.id,
          authorityKey: String(item.authorityKey),
          maxAmount: decimal(item.maxAmount),
          maxDiscountPercent: decimal(item.maxDiscountPercent),
          minimumMarginPercent: decimal(item.minimumMarginPercent),
          scope:
            typeof item.scope === "string"
              ? (item.scope as
                  | "COMPANY"
                  | "OWN"
                  | "ASSIGNED"
                  | "TEAM"
                  | "SELECTED_WORKS"
                  | "SELECTED_CLIENTS")
              : "COMPANY",
          grantedById: input.ownerId,
        },
      });
    const fields = asRecord(invitation.fieldVisibilityTemplate);
    await tx.membershipFieldVisibilityPolicy.deleteMany({
      where: { membershipId: membership.id },
    });
    const fieldCapabilities: Record<string, string> = {
      purchase_cost: "purchase_cost.view",
      internal_cost: "internal_cost.view",
      margin_percent: "margin_percent.view",
      margin_amount: "margin_amount.view",
      profit: "profitability.view",
      treasury: "treasury.view",
      banking: "banking.view",
      tax: "tax.view",
    };
    for (const [fieldKey, visible] of Object.entries(fields))
      if (typeof visible === "boolean" && fieldCapabilities[fieldKey]) {
        await tx.membershipFieldVisibilityPolicy.create({
          data: {
            companyId: input.companyId,
            membershipId: membership.id,
            fieldKey,
            visible,
            changedById: input.ownerId,
            reason: "Aprobación de invitación",
          },
        });
        await tx.membershipPermissionOverride.upsert({
          where: {
            membershipId_capabilityKey: {
              membershipId: membership.id,
              capabilityKey: fieldCapabilities[fieldKey],
            },
          },
          update: {
            effect: visible ? "GRANT" : "DENY",
            changedById: input.ownerId,
            reason: "Visibilidad aprobada en invitación",
          },
          create: {
            membershipId: membership.id,
            capabilityKey: fieldCapabilities[fieldKey],
            effect: visible ? "GRANT" : "DENY",
            changedById: input.ownerId,
            reason: "Visibilidad aprobada en invitación",
          },
        });
      }
    const teamIds = jsonStrings(invitation.teamIds);
    const validTeams = teamIds.length
      ? await tx.team.findMany({
          where: {
            companyId: input.companyId,
            id: { in: teamIds },
            state: "ACTIVE",
          },
          select: { id: true },
        })
      : [];
    await tx.teamMembership.deleteMany({
      where: { membershipId: membership.id },
    });
    if (validTeams.length)
      await tx.teamMembership.createMany({
        data: validTeams.map((team) => ({
          teamId: team.id,
          membershipId: membership.id,
        })),
      });
    const approvedMembership = await tx.companyMembership.update({
      where: { id: membership.id },
      data: {
        status: "active",
        joinedAt: now,
        approvedAt: now,
        approvedById: input.ownerId,
        accessVersion: { increment: 1 },
      },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        status: "OWNER_APPROVED",
        ownerApprovedAt: now,
        ownerApprovedById: input.ownerId,
      },
    });
    await queueEmailEvent(tx as typeof prisma, {
      companyId: input.companyId,
      invitationId: invitation.id,
      eventKey: "employee_approved",
      recipient: invitation.emailNormalized,
      createdById: input.ownerId,
    });
    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userActorId: input.ownerId,
        action: "membership.owner_approved",
        targetType: "CompanyMembership",
        targetId: membership.id,
        metadata: { packages },
      },
    });
    return approvedMembership;
  });
}

export async function revokeEmployeeInvitation(input: {
  companyId: string;
  ownerId: string;
  invitationId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await assertActiveOwner(tx, input.companyId, input.ownerId);
    const invitation = await tx.invitation.findFirstOrThrow({
      where: {
        id: input.invitationId,
        companyId: input.companyId,
        status: {
          in: ["PENDING", "PENDING_EMPLOYEE", "PENDING_OWNER_APPROVAL"],
        },
      },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    const user = await tx.user.findUnique({
      where: { emailNormalized: invitation.emailNormalized },
    });
    if (user) {
      const membership = await tx.companyMembership.findFirst({
        where: {
          companyId: input.companyId,
          userId: user.id,
          status: { in: ["invited", "pending_owner_approval"] },
        },
      });
      if (membership) {
        await tx.companyMembership.update({
          where: { id: membership.id },
          data: {
            status: "revoked",
            revokedAt: new Date(),
            revokedReason: "Invitación revocada por el propietario",
          },
        });
        await invalidateMembershipAccess(tx as typeof prisma, {
          companyId: input.companyId,
          membershipId: membership.id,
          userId: user.id,
          actorId: input.ownerId,
          reason: "invitation_revoked",
        });
      }
    }
    await queueEmailEvent(tx as typeof prisma, {
      companyId: input.companyId,
      invitationId: invitation.id,
      eventKey: "invitation_revoked",
      recipient: invitation.emailNormalized,
      createdById: input.ownerId,
    });
    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userActorId: input.ownerId,
        action: "invitation.revoked",
        targetType: "Invitation",
        targetId: invitation.id,
      },
    });
    return invitation;
  });
}

export async function rejectEmployeeMembership(input: {
  companyId: string;
  ownerId: string;
  invitationId: string;
}) {
  return prisma.$transaction(async (tx) => {
    await assertActiveOwner(tx, input.companyId, input.ownerId);
    const invitation = await tx.invitation.findFirstOrThrow({
      where: {
        id: input.invitationId,
        companyId: input.companyId,
        status: "PENDING_OWNER_APPROVAL",
      },
    });
    const user = await tx.user.findUniqueOrThrow({
      where: { emailNormalized: invitation.emailNormalized },
    });
    const membership = await tx.companyMembership.findFirstOrThrow({
      where: { companyId: input.companyId, userId: user.id },
    });
    const rejectedMembership = await tx.companyMembership.update({
      where: { id: membership.id },
      data: {
        status: "rejected",
        rejectedAt: new Date(),
        rejectedById: input.ownerId,
      },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "OWNER_REJECTED", rejectedAt: new Date() },
    });
    await invalidateMembershipAccess(tx as typeof prisma, {
      companyId: input.companyId,
      membershipId: membership.id,
      userId: user.id,
      actorId: input.ownerId,
      reason: "owner_rejected",
    });
    await queueEmailEvent(tx as typeof prisma, {
      companyId: input.companyId,
      invitationId: invitation.id,
      eventKey: "employee_rejected",
      recipient: invitation.emailNormalized,
      createdById: input.ownerId,
    });
    return rejectedMembership;
  });
}

function jsonStrings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
function jsonObjects(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function decimal(value: unknown) {
  return typeof value === "number" ||
    (typeof value === "string" && value.trim())
    ? String(value)
    : null;
}

async function assertActiveOwner(
  tx: Prisma.TransactionClient,
  companyId: string,
  userId: string,
) {
  const now = new Date();
  const owner = await tx.companyMembership.findFirst({
    where: {
      companyId,
      userId,
      role: "OWNER",
      status: "active",
      OR: [{ accessStartsAt: null }, { accessStartsAt: { lte: now } }],
      AND: [{ OR: [{ accessEndsAt: null }, { accessEndsAt: { gt: now } }] }],
    },
    select: { id: true },
  });
  if (!owner) throw new Error("OWNER_ACCESS_REQUIRED");
}
