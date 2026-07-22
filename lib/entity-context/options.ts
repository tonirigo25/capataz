import { prisma } from "@/lib/prisma";
export async function getEntityOptions(companyId: string, input: { clientId?: string; workId?: string; search?: string }) {
  const contains = input.search?.trim() || undefined;
  const [clients, works, budgets, invoices] = await Promise.all([
    prisma.client.findMany({ where: { companyId, ...(contains ? { nombre: { contains, mode: "insensitive" } } : {}) }, select: { id: true, nombre: true }, take: 30, orderBy: { nombre: "asc" } }),
    prisma.work.findMany({ where: { companyId, ...(input.clientId ? { clienteId: input.clientId } : {}), ...(contains ? { titulo: { contains, mode: "insensitive" } } : {}) }, select: { id: true, titulo: true, clienteId: true }, take: 30 }),
    prisma.budget.findMany({ where: { companyId, ...(input.clientId ? { clienteId: input.clientId } : {}), ...(input.workId ? { obraId: input.workId } : {}) }, select: { id: true, numero: true, clienteId: true, obraId: true }, take: 30 }),
    prisma.invoice.findMany({ where: { companyId, ...(input.clientId ? { clienteId: input.clientId } : {}), ...(input.workId ? { obraId: input.workId } : {}) }, select: { id: true, numero: true, clienteId: true, obraId: true }, take: 30 }),
  ]);
  return { clients, works, budgets, invoices };
}
