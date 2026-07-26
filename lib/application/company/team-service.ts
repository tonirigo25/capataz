import type { PrismaClient } from "@prisma/client";

export type TeamServiceContext = {
  companyId: string;
  userId: string;
};

export async function createCompanyTeam(
  prisma: PrismaClient,
  context: TeamServiceContext,
  input: { name: string; description?: string | null; auditId?: string },
) {
  return prisma.$transaction(async (transaction) => {
    const team = await transaction.team.create({
      data: {
        companyId: context.companyId,
        name: input.name,
        description: input.description ?? null,
      },
    });
    await transaction.auditLog.create({
      data: {
        id: input.auditId,
        companyId: context.companyId,
        userActorId: context.userId,
        action: "team.created",
        targetType: "Team",
        targetId: team.id,
      },
    });
    return team;
  });
}

export async function assignCompanyTeamMember(
  prisma: PrismaClient,
  context: TeamServiceContext,
  input: { teamId: string; membershipId: string },
) {
  const [team, membership] = await Promise.all([
    prisma.team.findFirst({ where: { id: input.teamId, companyId: context.companyId, state: "ACTIVE" } }),
    prisma.companyMembership.findFirst({ where: { id: input.membershipId, companyId: context.companyId, status: "active" } }),
  ]);
  if (!team || !membership) throw new Error("CROSS_COMPANY_TEAM_FORBIDDEN");
  return prisma.teamMembership.upsert({
    where: { teamId_membershipId: { teamId: input.teamId, membershipId: input.membershipId } },
    update: {},
    create: { teamId: input.teamId, membershipId: input.membershipId },
  });
}
