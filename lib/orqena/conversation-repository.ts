import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ConversationTenantContext = {
  userId: string;
  companyId: string;
  membershipId: string;
};

const conversationScope = (context: ConversationTenantContext) => ({
  companyId: context.companyId,
  ownerUserId: context.userId
});

const messageScope = (context: ConversationTenantContext) => ({
  companyId: context.companyId,
  conversation: conversationScope(context)
});

const unavailable = () => new Error("Conversación no disponible.");

export async function listOwnedConversationIdsForCompany(context:ConversationTenantContext){return (await prisma.chatConversation.findMany({where:conversationScope(context),select:{id:true}})).map(item=>item.id);}

export async function listConversationsForCompany(context: ConversationTenantContext, includeArchived = false) {
  return prisma.chatConversation.findMany({
    where: { ...conversationScope(context), ...(includeArchived ? {} : { status: "active" }) },
    orderBy: { lastActivityAt: "desc" },
    take: 40,
    include: { messages: { where: messageScope(context), orderBy: { createdAt: "asc" }, take: 80 } }
  });
}

export async function getConversationForCompany(context: ConversationTenantContext, id: string, options?: { activeOnly?: boolean }) {
  return prisma.chatConversation.findFirst({
    where: { id, ...conversationScope(context), ...(options?.activeOnly ? { status: "active" } : {}) },
    include: { messages: { where: messageScope(context), orderBy: { createdAt: "asc" }, take: 80 } }
  });
}

export async function getConversationContextForCompany(context: ConversationTenantContext, id: string, messageLimit: number) {
  return prisma.chatConversation.findFirst({
    where: { id, ...conversationScope(context) },
    include: { messages: { where: messageScope(context), orderBy: { createdAt: "desc" }, take: messageLimit } }
  });
}

export async function createConversationForCompany(context: ConversationTenantContext, data: Prisma.ChatConversationUncheckedCreateInput) {
  return prisma.chatConversation.create({
    data: { ...data, companyId: context.companyId, ownerUserId: context.userId },
    include: { messages: true }
  });
}

export async function renameConversationForCompany(context: ConversationTenantContext, id: string, title: string) {
  const result = await prisma.chatConversation.updateMany({ where: { id, ...conversationScope(context) }, data: { title } });
  if (result.count !== 1) throw unavailable();
}

export async function archiveConversationForCompany(context: ConversationTenantContext, id: string) {
  const result = await prisma.chatConversation.updateMany({ where: { id, ...conversationScope(context) }, data: { status: "archived", archivedAt: new Date(), activeTask: Prisma.DbNull, pendingConfirmation: Prisma.DbNull } });
  if (result.count !== 1) throw unavailable();
}

export async function deleteConversationForCompany(context: ConversationTenantContext, id: string) {
  const result = await prisma.chatConversation.deleteMany({ where: { id, ...conversationScope(context) } });
  if (result.count > 1) throw unavailable();
  return result.count === 1;
}

export async function appendMessageForCompany(context: ConversationTenantContext, conversationId: string, data: Omit<Prisma.ChatMessageUncheckedCreateInput, "conversationId">) {
  const conversation = await prisma.chatConversation.findFirst({ where: { id: conversationId, ...conversationScope(context), status: "active" }, select: { id: true } });
  if (!conversation) throw unavailable();
  return prisma.chatMessage.create({ data: { ...data, companyId: context.companyId, conversationId: conversation.id } });
}

export async function getMessageForCompany(context: ConversationTenantContext, where: { id?: string; idempotencyKey?: string }) {
  return prisma.chatMessage.findFirst({ where: { ...where, ...messageScope(context) } });
}

export async function claimMessageForCompany(context: ConversationTenantContext, id: string) {
  return prisma.chatMessage.updateMany({ where: { id, ...messageScope(context), status: { in: ["saved", "failed"] } }, data: { status: "processing" } });
}

export async function updateMessageForCompany(context: ConversationTenantContext, id: string, data: Prisma.ChatMessageUpdateManyMutationInput) {
  const result = await prisma.chatMessage.updateMany({ where: { id, ...messageScope(context) }, data });
  if (result.count !== 1) throw unavailable();
}

export async function completeMessageForCompany(context: ConversationTenantContext, id: string, metadata: Prisma.InputJsonValue) {
  return updateMessageForCompany(context, id, { status: "completed", metadata });
}

export async function failMessageForCompany(context: ConversationTenantContext, id: string, metadata: Prisma.InputJsonValue) {
  return updateMessageForCompany(context, id, { status: "failed", metadata });
}

export async function touchConversationForCompany(context: ConversationTenantContext, id: string, data: Prisma.ChatConversationUpdateManyMutationInput = {}) {
  const result = await prisma.chatConversation.updateMany({ where: { id, ...conversationScope(context) }, data: { ...data, lastActivityAt: new Date() } });
  if (result.count !== 1) throw unavailable();
}

export async function saveConversationStateForCompany(context: ConversationTenantContext, id: string, structuredContext: Prisma.InputJsonValue) {
  return touchConversationForCompany(context, id, { structuredContext });
}

export async function logConversationActionForCompany(context: ConversationTenantContext, conversationId: string, data: Omit<Prisma.ChatActionLogUncheckedCreateInput, "conversationId">) {
  const conversation = await prisma.chatConversation.findFirst({ where: { id: conversationId, ...conversationScope(context) }, select: { id: true } });
  if (!conversation) throw unavailable();
  return prisma.chatActionLog.create({ data: { ...data, conversationId, companyId: context.companyId, actorUserId: context.userId } });
}

export async function findLatestPendingTaskForCompany(context: ConversationTenantContext) {
  return prisma.chatConversation.findMany({ where: { ...conversationScope(context), status: "active", messages: { some: messageScope(context) } }, orderBy: { lastActivityAt: "desc" }, take: 20 });
}

export async function cancelPendingProposalForCompany(context: ConversationTenantContext, conversationId: string, confirmationId: string) {
  const conversation = await prisma.chatConversation.findFirst({ where: { id: conversationId, ...conversationScope(context) }, select: { id: true, pendingConfirmation: true } });
  if (!conversation) throw unavailable();
  if (!conversation.pendingConfirmation || typeof conversation.pendingConfirmation !== "object" || Array.isArray(conversation.pendingConfirmation)) return { cancelled: true, alreadyCancelled: true, confirmation: null };
  const pending = conversation.pendingConfirmation as Record<string, unknown>;
  if (pending.id !== confirmationId || pending.userId !== context.userId || pending.membershipId !== context.membershipId) throw unavailable();
  if (pending.status === "CANCELLED") return { cancelled: true, alreadyCancelled: true, confirmation: pending };
  if (pending.status !== "PENDING") throw new Error(pending.status === "EXPIRED" ? "Esta propuesta ha caducado" : "Propuesta no disponible.");
  const expiresAt = typeof pending.expiresAt === "string" ? Date.parse(pending.expiresAt) : Number.NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await prisma.chatConversation.updateMany({ where: { id: conversationId, ...conversationScope(context) }, data: { pendingConfirmation: { ...pending, status: "EXPIRED" }, lastActivityAt: new Date() } });
    throw new Error("Esta propuesta ha caducado");
  }
  const confirmation = { ...pending, status: "CANCELLED", cancelledAt: new Date().toISOString() };
  const result = await prisma.chatConversation.updateMany({
    where: { id: conversationId, ...conversationScope(context), AND: [{ pendingConfirmation: { path: ["id"], equals: confirmationId } }, { pendingConfirmation: { path: ["status"], equals: "PENDING" } }] },
    data: { pendingConfirmation: confirmation, lastActivityAt: new Date() }
  });
  if (result.count !== 1) {
    const latest = await prisma.chatConversation.findFirst({ where: { id: conversationId, ...conversationScope(context) }, select: { pendingConfirmation: true } });
    const latestPending = latest?.pendingConfirmation as Record<string, unknown> | null;
    if (latestPending?.id === confirmationId && latestPending.status === "CANCELLED") return { cancelled: true, alreadyCancelled: true, confirmation: latestPending };
    throw unavailable();
  }
  await logConversationActionForCompany(context, conversationId, { stage: "proposal_cancelled", status: "cancelled", summary: "Propuesta cancelada", metadata: { userId: context.userId, membershipId: context.membershipId } });
  return { cancelled: true, alreadyCancelled: false, confirmation };
}

export async function beginPendingProposalExecutionForCompany(context: ConversationTenantContext, conversationId: string, confirmationId: string) {
  const conversation = await prisma.chatConversation.findFirst({ where: { id: conversationId, ...conversationScope(context), status: "active" }, select: { pendingConfirmation: true } });
  if (!conversation) throw unavailable();
  if (!conversation.pendingConfirmation || typeof conversation.pendingConfirmation !== "object" || Array.isArray(conversation.pendingConfirmation)) throw unavailable();
  const pending = conversation.pendingConfirmation as Record<string, unknown>;
  if (pending.id !== confirmationId || pending.companyId !== context.companyId || pending.conversationId !== conversationId || pending.userId !== context.userId || pending.membershipId !== context.membershipId) throw unavailable();
  if (pending.status === "CONFIRMED") return { alreadyConfirmed: true };
  if (pending.status !== "PENDING") throw new Error(pending.status === "EXPIRED" ? "Esta propuesta ha caducado" : "Propuesta no disponible.");
  const expiresAt = typeof pending.expiresAt === "string" ? Date.parse(pending.expiresAt) : Number.NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await prisma.chatConversation.updateMany({ where: { id: conversationId, ...conversationScope(context) }, data: { pendingConfirmation: { ...pending, status: "EXPIRED" }, lastActivityAt: new Date() } });
    throw new Error("Esta propuesta ha caducado");
  }
  const result = await prisma.chatConversation.updateMany({
    where: { id: conversationId, ...conversationScope(context), status: "active", AND: [{ pendingConfirmation: { path: ["id"], equals: confirmationId } }, { pendingConfirmation: { path: ["status"], equals: "PENDING" } }] },
    data: { pendingConfirmation: { ...pending, status: "EXECUTING", executionStartedAt: new Date().toISOString() }, lastActivityAt: new Date() }
  });
  if (result.count !== 1) throw unavailable();
  return { alreadyConfirmed: false, confirmation: pending };
}

export async function finishPendingProposalExecutionForCompany(context: ConversationTenantContext, conversationId: string, confirmationId: string, succeeded: boolean) {
  const conversation = await prisma.chatConversation.findFirst({ where: { id: conversationId, ...conversationScope(context) }, select: { pendingConfirmation: true } });
  const pending = conversation?.pendingConfirmation as Record<string, unknown> | null;
  if (!pending || pending.id !== confirmationId || pending.userId !== context.userId || pending.membershipId !== context.membershipId || pending.status !== "EXECUTING") throw unavailable();
  const status = succeeded ? "CONFIRMED" : "PENDING";
  const result = await prisma.chatConversation.updateMany({
    where: { id: conversationId, ...conversationScope(context), AND: [{ pendingConfirmation: { path: ["id"], equals: confirmationId } }, { pendingConfirmation: { path: ["status"], equals: "EXECUTING" } }] },
    data: { pendingConfirmation: { ...pending, status, ...(succeeded ? { confirmedAt: new Date().toISOString() } : { executionFailedAt: new Date().toISOString() }) }, lastActivityAt: new Date() }
  });
  if (result.count !== 1) throw unavailable();
  await logConversationActionForCompany(context, conversationId, { stage: succeeded ? "proposal_confirmed" : "proposal_execution_failed", status: succeeded ? "confirmed" : "failed", summary: succeeded ? "Propuesta confirmada" : "Ejecución de propuesta fallida", metadata: { confirmationId, userId: context.userId, membershipId: context.membershipId } });
}
