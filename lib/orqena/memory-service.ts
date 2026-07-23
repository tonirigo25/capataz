import { prisma } from "@/lib/prisma";
import { listOwnedConversationIdsForCompany } from "@/lib/orqena/conversation-repository";
type MemoryScope = "COMPANY" | "USER" | "CLIENT" | "WORK" | "PARTNER";
type MemoryCategory = "FACT" | "PREFERENCE" | "TERMINOLOGY" | "PROCESS" | "DEFAULT" | "ALIAS";
export async function suggestMemory(input: { companyId: string; userId?: string; scope: MemoryScope; entityType?: string; entityId?: string; category: MemoryCategory; key: string; value: unknown; summary: string; sourceConversationId?: string; sourceMessageId?: string }) {
  return prisma.businessMemory.create({ data: { ...input, value: input.value as never, sourceType: "USER_MESSAGE", status: "SUGGESTED" } });
}
async function ownedConversationIds(companyId: string, userId: string) { return listOwnedConversationIdsForCompany({companyId,userId,membershipId:"memory-service"}); }
function memoryAccess(userId: string, owned: string[]) { return [{ sourceConversationId: { in: owned } }, { sourceConversationId: null, scope: "COMPANY" as const }, { sourceConversationId: null, scope: "USER" as const, userId }]; }
export async function listMemoriesForUser(input:{companyId:string;userId:string;q?:string;status?:string}) { const owned=await ownedConversationIds(input.companyId,input.userId);return prisma.businessMemory.findMany({where:{companyId:input.companyId,OR:memoryAccess(input.userId,owned),...(input.status?{status:input.status as never}:{}),...(input.q?{summary:{contains:input.q,mode:"insensitive" as const}}:{})},orderBy:{updatedAt:"desc"},take:100}); }
export async function confirmMemory(companyId: string, id: string, confirmedById: string) { const owned=await ownedConversationIds(companyId,confirmedById);return prisma.businessMemory.updateMany({ where: { id, companyId, status: "SUGGESTED", archivedAt: null, OR:memoryAccess(confirmedById,owned) }, data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedById } }); }
export async function rejectMemory(companyId: string, id: string, userId: string) { const owned=await ownedConversationIds(companyId,userId);return prisma.businessMemory.updateMany({ where: { id, companyId, status: "SUGGESTED", archivedAt: null, OR:memoryAccess(userId,owned) }, data: { status: "REJECTED" } }); }
export async function archiveMemory(companyId: string, id: string, userId: string) { const owned=await ownedConversationIds(companyId,userId);return prisma.businessMemory.updateMany({ where: { id, companyId, archivedAt: null, OR:memoryAccess(userId,owned) }, data: { status: "ARCHIVED", archivedAt: new Date() } }); }
export async function relevantMemories(input: { companyId: string; userId?: string; entityType?: string; entityId?: string; take?: number }) {
  const owned = input.userId ? await ownedConversationIds(input.companyId,input.userId) : [];
  return prisma.businessMemory.findMany({ where: { companyId: input.companyId, status: "CONFIRMED", archivedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], AND: [{ OR: [{ sourceConversationId: null }, { sourceConversationId: { in: owned } }] }, { OR: [{ scope: "COMPANY" }, ...(input.userId ? [{ scope: "USER" as const, userId: input.userId }] : []), ...(input.entityId ? [{ entityType: input.entityType, entityId: input.entityId }] : [])] }] }, orderBy: { updatedAt: "desc" }, take: Math.min(input.take ?? 12, 20) });
}
