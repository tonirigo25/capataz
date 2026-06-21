import { prisma } from "@/lib/prisma";

type NumberingType = "budget" | "invoice";

export async function nextDocumentNumber(type: NumberingType) {
  const company = await prisma.empresa.findFirst();
  const year = String(new Date().getFullYear());
  const prefix =
    type === "budget"
      ? company?.prefijoPresupuesto || "PRES"
      : company?.prefijoFactura || "FAC";
  const configuredSeries =
    type === "budget"
      ? company?.seriePresupuestos || year
      : company?.serieFacturas || year;
  const series = /^\d{4}$/.test(configuredSeries) ? configuredSeries : year;
  const start = `${prefix}-${series}-`;

  const existing =
    type === "budget"
      ? await prisma.budget.findMany({ where: { numero: { startsWith: start } }, select: { numero: true } })
      : await prisma.invoice.findMany({ where: { numero: { startsWith: start } }, select: { numero: true } });

  const next = existing.reduce((max, item) => {
    const suffix = item.numero.slice(start.length);
    const parsed = Number(suffix);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0) + 1;

  return `${start}${String(next).padStart(3, "0")}`;
}
