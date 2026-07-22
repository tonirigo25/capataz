import { prisma } from "@/lib/prisma";
type MemoryScope = "COMPANY" | "USER" | "CLIENT" | "WORK" | "PARTNER";
type MemoryCategory = "FACT" | "PREFERENCE" | "TERMINOLOGY" | "PROCESS" | "DEFAULT" | "ALIAS";
export async function suggestMemory(input: { companyId: string; userId?: string; scope: MemoryScope; entityType?: string; entityId?: string; category: MemoryCategory; key: string; value: unknown; summary: string; sourceConversationId?: string; sourceMessageId?: string }) {
  return prisma.businessMemory.create({ data: { ...input, value: input.value as never, sourceType: "USER_MESSAGE", status: "SUGGESTED" } });
}
export async function confirmMemory(companyId: string, id: string, confirmedById: string) { return prisma.businessMemory.updateMany({ where: { id, companyId, status: "SUGGESTED", archivedAt: null }, data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedById } }); }
export async function rejectMemory(companyId: string, id: string) { return prisma.businessMemory.updateMany({ where: { id, companyId, status: "SUGGESTED", archivedAt: null }, data: { status: "REJECTED" } }); }
export async function archiveMemory(companyId: string, id: string) { return prisma.businessMemory.updateMany({ where: { id, companyId, archivedAt: null }, data: { status: "ARCHIVED", archivedAt: new Date() } }); }
export async function relevantMemories(input: { companyId: string; userId?: string; entityType?: string; entityId?: string; take?: number }) {
  return prisma.businessMemory.findMany({ where: { companyId: input.companyId, status: "CONFIRMED", archivedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], AND: [{ OR: [{ scope: "COMPANY" }, ...(input.userId ? [{ scope: "USER" as const, userId: input.userId }] : []), ...(input.entityId ? [{ entityType: input.entityType, entityId: input.entityId }] : [])] }] }, orderBy: { updatedAt: "desc" }, take: Math.min(input.take ?? 12, 20) });
}
