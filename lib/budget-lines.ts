export type BudgetLine = {
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  total: number;
  categoria: string;
};

export type BudgetTotals = {
  subtotal: number;
  iva: number;
  descuento: number;
  total: number;
};

export const units = ["ud", "m", "m2", "m3", "hora", "día", "lote", "servicio"];

export function parseBudgetLines(value: string | null | undefined): BudgetLine[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return fallbackLine(value);
    return parsed.map((item) => normalizeLine(item)).filter((line) => line.descripcion);
  } catch {
    return fallbackLine(value);
  }
}

export function serializeBudgetLines(lines: BudgetLine[]) {
  return JSON.stringify(lines.map((line) => normalizeLine(line)));
}

export function calculateBudgetTotals(lines: BudgetLine[], ivaPercent = 21, discount = 0): BudgetTotals {
  const subtotal = money(lines.reduce((sum, line) => sum + normalizeLine(line).total, 0));
  const descuento = money(Math.max(0, discount));
  const taxable = Math.max(0, subtotal - descuento);
  const iva = money(taxable * (ivaPercent / 100));
  const total = money(taxable + iva);
  return { subtotal, iva, descuento, total };
}

export function lineTotal(cantidad: number, precioUnitario: number) {
  return money(Math.max(0, cantidad) * Math.max(0, precioUnitario));
}

export function normalizeLine(item: any): BudgetLine {
  const cantidad = num(item?.cantidad, 1);
  const precioUnitario = num(item?.precioUnitario ?? item?.precio, 0);
  return {
    descripcion: String(item?.descripcion ?? item?.concepto ?? "Partida").trim(),
    cantidad,
    unidad: String(item?.unidad ?? "ud").trim() || "ud",
    precioUnitario,
    total: num(item?.total, lineTotal(cantidad, precioUnitario)),
    categoria: String(item?.categoria ?? "General").trim() || "General"
  };
}

export function money(value: number) {
  return Math.round(value * 100) / 100;
}

function fallbackLine(value: string): BudgetLine[] {
  const description = value.trim();
  return description ? [normalizeLine({ descripcion: description, cantidad: 1, unidad: "servicio", precioUnitario: 0 })] : [];
}

function num(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}
