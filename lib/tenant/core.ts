import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export function companyCore(db: Db, companyId: string) {
  return {
    companyId,
    company: () => db.company.findUniqueOrThrow({ where: { id: companyId } }),
    listClients: () => db.client.findMany({ where: { companyId, archivadoAt: null }, orderBy: { nombre: "asc" } }),
    getClient: (id: string) => db.client.findFirst({ where: { id, companyId } }),
    updateClient: (id: string, data: Prisma.ClientUpdateManyMutationInput) => db.client.updateMany({ where: { id, companyId }, data }),
    listWorks: () => db.work.findMany({ where: { companyId }, orderBy: { fechaCreacion: "desc" } }),
    getWork: (id: string) => db.work.findFirst({ where: { id, companyId } }),
    listBudgets: () => db.budget.findMany({ where: { companyId }, orderBy: { fechaCreacion: "desc" } }),
    getBudget: (id: string) => db.budget.findFirst({ where: { id, companyId } }),
    getBudgetDocument: (id: string) => db.budget.findFirst({ where: { id, companyId }, include: { client: true, work: true } }),
    listInvoices: () => db.invoice.findMany({ where: { companyId }, orderBy: { fechaEmision: "desc" } }),
    getInvoice: (id: string) => db.invoice.findFirst({ where: { id, companyId } }),
    getInvoiceDocument: (id: string) => db.invoice.findFirst({ where: { id, companyId }, include: { client: true, work: true, payments: { orderBy: { fecha: "asc" } } } }),
    getReminder: (id: string) => db.reminder.findFirst({ where: { id, companyId } }),
    updateReminder: (id: string, data: Prisma.ReminderUpdateInput) => db.reminder.update({ where: { id, companyId }, data }),
    getAgendaEvent: (id: string) => db.eventoAgenda.findFirst({ where: { id, companyId } }),
    updateAgendaEvent: (id: string, data: Prisma.EventoAgendaUpdateInput) => db.eventoAgenda.update({ where: { id, companyId }, data }),
    listPayments: () => db.payment.findMany({ where: { companyId } }),
    listExpenses: () => db.expense.findMany({ where: { companyId } }),
    listDocuments: () => db.document.findMany({ where: { companyId, archivedAt: null } }),
    listAccounts: () => db.financialAccount.findMany({ where: { companyId, archivedAt: null } }),
    listMovements: () => db.cashMovement.findMany({ where: { companyId, archivedAt: null } }),
    dashboard: async () => {
      const [clients, works, budgets, invoices, materials, reminders, expenses] = await Promise.all([
        db.client.findMany({ where: { companyId }, orderBy: { ultimaInteraccion: "desc" }, include: { budgets: true, invoices: true, works: true } }),
        db.work.findMany({ where: { companyId }, orderBy: { fechaFinPrevista: "asc" }, include: { client: true, materials: true, invoices: true } }),
        db.budget.findMany({ where: { companyId }, orderBy: { fechaCreacion: "desc" }, include: { client: true, work: true } }),
        db.invoice.findMany({ where: { companyId }, orderBy: { fechaVencimiento: "asc" }, include: { client: true, work: true, payments: true } }),
        db.material.findMany({ where: { companyId }, orderBy: { nombre: "asc" }, include: { work: { include: { client: true } } } }),
        db.reminder.findMany({ where: { companyId }, orderBy: { fechaProgramada: "asc" }, include: { client: true, work: true, invoice: true, budget: true } }),
        db.expense.findMany({ where: { companyId }, orderBy: { fecha: "desc" }, include: { work: { include: { client: true } } } })
      ]);
      return { clients, works, budgets, invoices, materials, reminders, expenses };
    },
    agendaSources: () => Promise.all([
      db.eventoAgenda.findMany({ where: { companyId }, orderBy: { fechaInicio: "asc" }, include: { client: true, contact: true, work: true, budget: true, invoice: true, reminder: true } }),
      db.reminder.findMany({ where: { companyId }, orderBy: { fechaProgramada: "asc" }, include: { client: true, contact: true, work: true, invoice: true, budget: true } }),
      db.invoice.findMany({ where: { companyId }, orderBy: { fechaVencimiento: "asc" }, include: { client: true, work: true } }),
      db.work.findMany({ where: { companyId }, orderBy: { fechaInicio: "asc" }, include: { client: true } }),
      db.material.findMany({ where: { companyId }, orderBy: { nombre: "asc" }, include: { work: { include: { client: true } } } }),
      db.budget.findMany({ where: { companyId }, orderBy: { fechaSeguimiento: "asc" }, include: { client: true, work: true } })
    ]),
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
