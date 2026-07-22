import { prisma } from "@/lib/prisma";
import { EntityContextError, type EntitySelection, type ValidatedEntityContext } from "./types";

export async function validateEntityContext(companyId: string, selection: EntitySelection): Promise<ValidatedEntityContext> {
  const [client, work, budget, invoice, document, contact] = await Promise.all([
    selection.clientId ? prisma.client.findFirst({ where: { id: selection.clientId, companyId }, select: { id: true } }) : null,
    selection.workId ? prisma.work.findFirst({ where: { id: selection.workId, companyId }, select: { id: true, clienteId: true } }) : null,
    selection.budgetId ? prisma.budget.findFirst({ where: { id: selection.budgetId, companyId }, select: { id: true, clienteId: true, obraId: true } }) : null,
    selection.invoiceId ? prisma.invoice.findFirst({ where: { id: selection.invoiceId, companyId }, select: { id: true, clienteId: true, obraId: true } }) : null,
    selection.documentId ? prisma.document.findFirst({ where: { id: selection.documentId, companyId }, select: { id: true, clientId: true, workId: true } }) : null,
    selection.contactId ? prisma.contact.findFirst({ where: { id: selection.contactId, companyId }, select: { id: true, clientId: true } }) : null,
  ]);
  for (const [id, found] of [[selection.clientId, client], [selection.workId, work], [selection.budgetId, budget], [selection.invoiceId, invoice], [selection.documentId, document], [selection.contactId, contact]] as const) if (id && !found) throw new EntityContextError("CROSS_COMPANY", "La selección no pertenece a la empresa activa.");
  const clientId = work?.clienteId ?? selection.clientId ?? null;
  const incompatible = (budget && ((clientId && budget.clienteId !== clientId) || (selection.workId && budget.obraId !== selection.workId))) || (invoice && ((clientId && invoice.clienteId !== clientId) || (selection.workId && invoice.obraId !== selection.workId))) || (document && ((clientId && document.clientId && document.clientId !== clientId) || (selection.workId && document.workId && document.workId !== selection.workId))) || (contact && clientId && contact.clientId !== clientId);
  if (incompatible) throw new EntityContextError("INCOMPATIBLE_RELATION", "Las entidades seleccionadas no están relacionadas.");
  return { companyId, ...selection, clientId };
}
