import type { FollowUpPriority, FollowUpStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export async function createFollowUp(input: {
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
  return prisma.followUp.create({ data: input });
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
  return prisma.followUp.update({ where: { id }, data });
}
export async function changeFollowUpStatus(
  id: string,
  status: FollowUpStatus,
  resultSummary?: string,
) {
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
  return prisma.followUp.update({
    where: { id },
    data: { status: "archived", archivedAt: new Date() },
  });
}
