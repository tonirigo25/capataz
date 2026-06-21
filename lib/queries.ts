import { prisma } from "@/lib/prisma";

export async function getDashboardData() {
  const [clients, works, budgets, invoices, materials, reminders, expenses] = await Promise.all([
    prisma.client.findMany({
      orderBy: { ultimaInteraccion: "desc" },
      include: { budgets: true, invoices: true, works: true }
    }),
    prisma.work.findMany({
      orderBy: { fechaFinPrevista: "asc" },
      include: { client: true, materials: true, invoices: true }
    }),
    prisma.budget.findMany({
      orderBy: { fechaCreacion: "desc" },
      include: { client: true, work: true }
    }),
    prisma.invoice.findMany({
      orderBy: { fechaVencimiento: "asc" },
      include: { client: true, work: true, payments: true }
    }),
    prisma.material.findMany({
      orderBy: { nombre: "asc" },
      include: { work: { include: { client: true } } }
    }),
    prisma.reminder.findMany({
      orderBy: { fechaProgramada: "asc" },
      include: { client: true, work: true, invoice: true, budget: true }
    }),
    prisma.expense.findMany({
      orderBy: { fecha: "desc" },
      include: { work: { include: { client: true } } }
    })
  ]);

  return { clients, works, budgets, invoices, materials, reminders, expenses };
}
