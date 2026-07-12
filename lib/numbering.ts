import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";

type NumberingType = "budget" | "invoice" | "work";

export async function nextDocumentNumber(type: NumberingType, requestedCompanyId?: string) {
  const companyId = requestedCompanyId ?? (await requireCompanyContext()).companyId;
  return prisma.$transaction(async (tx) => {
  const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
  const year = String(new Date().getFullYear());
  const prefix =
    type === "budget"
      ? company.budgetPrefix || "PRES"
      : type === "invoice"
        ? company.invoicePrefix || "FAC"
        : company.workPrefix || "OB";
  const configuredSeries =
    type === "budget"
      ? company.budgetSeries || year
      : type === "invoice"
        ? company.invoiceSeries || year
        : company.workSeries || year;
  const series = /^\d{4}$/.test(configuredSeries) ? configuredSeries : year;
  const start = `${prefix}-${series}-`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${companyId}:${type}:${start}`}))`;

  const existing =
    type === "budget"
      ? await tx.budget.findMany({ where: { companyId, numero: { startsWith: start } }, select: { numero: true } })
      : type === "invoice"
        ? await tx.invoice.findMany({ where: { companyId, numero: { startsWith: start } }, select: { numero: true } })
        : await tx.work.findMany({ where: { companyId, codigo: { startsWith: start } }, select: { codigo: true } });

  const next = existing.reduce((max, item) => {
    const number = "numero" in item ? item.numero : item.codigo ?? "";
    const suffix = number.slice(start.length);
    const parsed = Number(suffix);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0) + 1;

  return `${start}${String(next).padStart(3, "0")}`;
  });
}
