import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export function companyCore(db: Db, companyId: string) {
  return {
    listClients: () => db.client.findMany({ where: { companyId, archivadoAt: null }, orderBy: { nombre: "asc" } }),
    getClient: (id: string) => db.client.findFirst({ where: { id, companyId } }),
    updateClient: (id: string, data: Prisma.ClientUpdateManyMutationInput) => db.client.updateMany({ where: { id, companyId }, data }),
    listWorks: () => db.work.findMany({ where: { companyId }, orderBy: { fechaCreacion: "desc" } }),
    getWork: (id: string) => db.work.findFirst({ where: { id, companyId } }),
    listBudgets: () => db.budget.findMany({ where: { companyId }, orderBy: { fechaCreacion: "desc" } }),
    getBudget: (id: string) => db.budget.findFirst({ where: { id, companyId } }),
    listInvoices: () => db.invoice.findMany({ where: { companyId }, orderBy: { fechaEmision: "desc" } }),
    getInvoice: (id: string) => db.invoice.findFirst({ where: { id, companyId } }),
    listPayments: () => db.payment.findMany({ where: { companyId } }),
    listExpenses: () => db.expense.findMany({ where: { companyId } }),
    listDocuments: () => db.document.findMany({ where: { companyId, archivedAt: null } }),
    listAccounts: () => db.financialAccount.findMany({ where: { companyId, archivedAt: null } }),
    listMovements: () => db.cashMovement.findMany({ where: { companyId, archivedAt: null } }),
    totals: async () => {
      const [invoices, payments, expenses] = await Promise.all([
        db.invoice.aggregate({ where: { companyId }, _sum: { total: true, pendiente: true } }),
        db.payment.aggregate({ where: { companyId }, _sum: { importe: true } }),
        db.expense.aggregate({ where: { companyId }, _sum: { importe: true } })
      ]);
      return { invoiced: invoices._sum.total ?? 0, pending: invoices._sum.pendiente ?? 0, collected: payments._sum.importe ?? 0, expenses: expenses._sum.importe ?? 0 };
    },
    createWork: async (data: Omit<Prisma.WorkUncheckedCreateInput, "companyId">) => {
      const client = await db.client.findFirst({ where: { id: data.clienteId, companyId }, select: { id: true } });
      if (!client) throw new Error("ENTITY_NOT_FOUND");
      return db.work.create({ data: { ...data, companyId } });
    },
    createInvoice: async (data: Omit<Prisma.InvoiceUncheckedCreateInput, "companyId">) => {
      const client = await db.client.findFirst({ where: { id: data.clienteId, companyId }, select: { id: true } });
      if (!client) throw new Error("ENTITY_NOT_FOUND");
      if (data.obraId && !(await db.work.findFirst({ where: { id: data.obraId, companyId }, select: { id: true } }))) throw new Error("ENTITY_NOT_FOUND");
      return db.invoice.create({ data: { ...data, companyId } });
    }
  };
}
