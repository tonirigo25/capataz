import { prisma } from "@/lib/prisma";

type NumberingType = "budget" | "invoice" | "work";

export async function nextDocumentNumber(type: NumberingType) {
  const company = await prisma.empresa.findFirst();
  const year = String(new Date().getFullYear());
  const prefix =
    type === "budget"
      ? company?.prefijoPresupuesto || "PRES"
      : type === "invoice"
        ? company?.prefijoFactura || "FAC"
        : company?.prefijoObra || "OB";
  const configuredSeries =
    type === "budget"
      ? company?.seriePresupuestos || year
      : type === "invoice"
        ? company?.serieFacturas || year
        : company?.serieObras || year;
  const series = /^\d{4}$/.test(configuredSeries) ? configuredSeries : year;
  const start = `${prefix}-${series}-`;

  const existing =
    type === "budget"
      ? await prisma.budget.findMany({ where: { numero: { startsWith: start } }, select: { numero: true } })
      : type === "invoice"
        ? await prisma.invoice.findMany({ where: { numero: { startsWith: start } }, select: { numero: true } })
        : await prisma.work.findMany({ where: { codigo: { startsWith: start } }, select: { codigo: true } });

  const next = existing.reduce((max, item) => {
    const number = "numero" in item ? item.numero : item.codigo ?? "";
    const suffix = number.slice(start.length);
    const parsed = Number(suffix);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0) + 1;

  return `${start}${String(next).padStart(3, "0")}`;
}
