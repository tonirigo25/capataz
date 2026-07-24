import type { FollowUpPriority, FollowUpStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";
export async function createFollowUp(input: {
  companyId: string;
  title: string;
  type?: string;
  priority?: FollowUpPriority;
  nextActionAt?: Date;
  dueAt?: Date;
  origin?: string;
  clientId?: string;
  workId?: string;
  invoiceId?: string;
  budgetId?: string;
  automationRunId?: string;
}) {
  const companyId=input.companyId;
  return prisma.followUp.create({ data: { ...input, companyId } });
}
export async function addFollowUpAttempt(
  followUpId: string,
  input: {
    channel: string;
    summary?: string;
    response?: string;
    nextActionAt?: Date;
  },
) {
  const companyId=(await requireCompanyContext()).companyId;if(!await prisma.followUp.findFirst({where:{id:followUpId,companyId},select:{id:true}}))throw new Error("FOLLOWUP_NOT_AVAILABLE");
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.followUpAttempt.create({
      data: { followUpId, ...input },
    });
    await tx.followUp.update({
      where: { id: followUpId },
      data: {
        status: input.response ? "waiting_response" : "in_progress",
        nextActionAt: input.nextActionAt,
      },
    });
    return attempt;
  });
}
export async function recordFollowUpOutcome(
  followUpId: string,
  type: string,
  summary?: string,
  status: FollowUpStatus = "completed",
) {
  const companyId=(await requireCompanyContext()).companyId;if(!await prisma.followUp.findFirst({where:{id:followUpId,companyId},select:{id:true}}))throw new Error("FOLLOWUP_NOT_AVAILABLE");
  return prisma.$transaction(async (tx) => {
    const outcome = await tx.followUpOutcome.create({
      data: { followUpId, type, summary },
    });
    await tx.followUp.update({
      where: { id: followUpId },
      data: {
        status,
        resultSummary: summary,
        completedAt: status === "completed" ? new Date() : undefined,
      },
    });
    return outcome;
  });
}
export async function editFollowUp(
  id: string,
  data: {
    title?: string;
    type?: string;
    priority?: FollowUpPriority;
    responsibleId?: string | null;
    contactId?: string | null;
    nextActionAt?: Date | null;
    dueAt?: Date | null;
    expectedOutcome?: string | null;
  },
) {
  const companyId=(await requireCompanyContext()).companyId;if(!await prisma.followUp.findFirst({where:{id,companyId},select:{id:true}}))throw new Error("FOLLOWUP_NOT_AVAILABLE");
  return prisma.followUp.update({ where: { id }, data });
}
export async function changeFollowUpStatus(
  id: string,
  status: FollowUpStatus,
  resultSummary?: string,
) {
  const companyId=(await requireCompanyContext()).companyId;if(!await prisma.followUp.findFirst({where:{id,companyId},select:{id:true}}))throw new Error("FOLLOWUP_NOT_AVAILABLE");
  return prisma.followUp.update({
    where: { id },
    data: {
      status,
      resultSummary,
      completedAt: status === "completed" ? new Date() : undefined,
      cancelledAt: status === "cancelled" ? new Date() : undefined,
    },
  });
}
export async function archiveFollowUp(id: string) {
  const companyId=(await requireCompanyContext()).companyId;if(!await prisma.followUp.findFirst({where:{id,companyId},select:{id:true}}))throw new Error("FOLLOWUP_NOT_AVAILABLE");
  return prisma.followUp.update({
    where: { id },
    data: { status: "archived", archivedAt: new Date() },
  });
}
