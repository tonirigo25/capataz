import { notFound } from "next/navigation";
import type { CompanyContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/auth/audit";

async function denied(context: CompanyContext, entityType: string) {
  await recordSecurityEvent({ type: "cross_tenant_access", outcome: "blocked", userId: context.userId, companyId: context.companyId, metadata: { entityType } });
  notFound();
}

export async function requireCompanyClient(context: CompanyContext, id: string) {
  return await prisma.client.findFirst({ where: { id, companyId: context.companyId } }) ?? denied(context, "client");
}
export async function requireCompanyContact(context: CompanyContext, id: string) {
  return await prisma.contact.findFirst({ where: { id, companyId: context.companyId } }) ?? denied(context, "contact");
}
export async function requireCompanyWork(context: CompanyContext, id: string) {
  return await prisma.work.findFirst({ where: { id, companyId: context.companyId } }) ?? denied(context, "work");
}
export async function requireCompanyBudget(context: CompanyContext, id: string) {
  return await prisma.budget.findFirst({ where: { id, companyId: context.companyId } }) ?? denied(context, "budget");
}
export async function requireCompanyInvoice(context: CompanyContext, id: string) {
  return await prisma.invoice.findFirst({ where: { id, companyId: context.companyId } }) ?? denied(context, "invoice");
}
export async function requireCompanyPayment(context: CompanyContext, id: string) {
  return await prisma.payment.findFirst({ where: { id, companyId: context.companyId } }) ?? denied(context, "payment");
}
export async function requireCompanyExpense(context: CompanyContext, id: string) {
  return await prisma.expense.findFirst({ where: { id, companyId: context.companyId } }) ?? denied(context, "expense");
}
export async function requireCompanyMaterial(context: CompanyContext, id: string) {
  return await prisma.material.findFirst({ where: { id, companyId: context.companyId } }) ?? denied(context, "material");
}
export async function requireCompanyDocument(context: CompanyContext, id: string) {
  return await prisma.document.findFirst({ where: { id, companyId: context.companyId } }) ?? denied(context, "document");
}
export async function requireCompanyInternalNote(context: CompanyContext, id: string) {
  return await prisma.internalNote.findFirst({ where: { id, companyId: context.companyId } }) ?? denied(context, "internal_note");
}
export async function requireCompanyFinancialAccount(context: CompanyContext, id: string) {
  return await prisma.financialAccount.findFirst({ where: { id, companyId: context.companyId } }) ?? denied(context, "financial_account");
}
export async function requireCompanyCashMovement(context: CompanyContext, id: string) {
  return await prisma.cashMovement.findFirst({ where: { id, companyId: context.companyId } }) ?? denied(context, "cash_movement");
}
export async function requireCompanyReminder(context: CompanyContext, id: string) {
  return await prisma.reminder.findFirst({ where: { id, companyId: context.companyId } }) ?? denied(context, "reminder");
}
export async function requireCompanyAgendaEvent(context: CompanyContext, id: string) {
  return await prisma.eventoAgenda.findFirst({ where: { id, companyId: context.companyId } }) ?? denied(context, "agenda_event");
}
