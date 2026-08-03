export type BudgetLine = {
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  total: number;
  costeUnitario?: number | null;
  costeTotal?: number | null;
  categoria: string;
};

export type BudgetTotals = {
  subtotal: number;
  iva: number;
  descuento: number;
  total: number;
};

export type BudgetReconciliation = {
  ok: boolean;
  linesSubtotal: number;
  storedSubtotal: number;
  calculatedTotal: number;
  storedTotal: number;
};

export type BudgetMargin = {
  revenue: number;
  cost: number | null;
  amount: number | null;
  percent: number | null;
  complete: boolean;
  missingCostLines: number;
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

/** Calculates commercial margin over net revenue, excluding VAT. */
export function calculateBudgetMargin(lines: BudgetLine[], discount = 0): BudgetMargin {
  const normalized = lines.map((line) => normalizeLine(line));
  const revenue = money(Math.max(0, normalized.reduce((sum, line) => sum + line.total, 0) - Math.max(0, discount)));
  const missingCostLines = normalized.filter((line) => line.costeTotal == null).length;
  const complete = normalized.length > 0 && missingCostLines === 0;
  if (!complete) return { revenue, cost: null, amount: null, percent: null, complete, missingCostLines };

  const cost = money(normalized.reduce((sum, line) => sum + (line.costeTotal ?? 0), 0));
  const amount = money(revenue - cost);
  const percent = revenue > 0 ? Math.round((amount / revenue) * 1000) / 10 : null;
  return { revenue, cost, amount, percent, complete, missingCostLines };
}

export function lineTotal(cantidad: number, precioUnitario: number) {
  return money(Math.max(0, cantidad) * Math.max(0, precioUnitario));
}

export function normalizeLine(item: unknown): BudgetLine {
  const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
  const cantidad = num(value.cantidad, 1);
  const suppliedTotal = optionalNum(value.total ?? value.importe);
  const suppliedUnitPrice = optionalNum(value.precioUnitario ?? value.precio);
  const precioUnitario = suppliedUnitPrice ?? (suppliedTotal !== null && cantidad > 0 ? money(suppliedTotal / cantidad) : 0);
  const suppliedCostTotal = optionalNum(value.costeTotal);
  const suppliedUnitCost = optionalNum(value.costeUnitario);
  const costeUnitario = suppliedUnitCost ?? (suppliedCostTotal !== null && cantidad > 0 ? money(suppliedCostTotal / cantidad) : null);
  // Quantity and unit cost are canonical. Never trust a stale or manipulated
  // aggregate when both fields are present.
  const costeTotal = costeUnitario !== null ? lineTotal(cantidad, costeUnitario) : null;
  return {
    descripcion: String(value.descripcion ?? value.concepto ?? "Partida").trim(),
    cantidad,
    unidad: String(value.unidad ?? "ud").trim() || "ud",
    precioUnitario,
    total: money(Math.max(0, suppliedTotal ?? lineTotal(cantidad, precioUnitario))),
    costeUnitario: costeUnitario === null ? null : money(Math.max(0, costeUnitario)),
    costeTotal: costeTotal === null ? null : money(Math.max(0, costeTotal)),
    categoria: String(value.categoria ?? "General").trim() || "General"
  };
}

export function reconcileBudgetRecord(
  lines: BudgetLine[],
  record: Pick<BudgetTotals, "subtotal" | "iva" | "descuento" | "total">,
  tolerance = 0.01,
): BudgetReconciliation {
  const linesSubtotal = money(lines.reduce((sum, line) => sum + normalizeLine(line).total, 0));
  const storedSubtotal = money(record.subtotal);
  const calculatedTotal = money(Math.max(0, storedSubtotal - Math.max(0, record.descuento) + record.iva));
  const storedTotal = money(record.total);
  return {
    ok:
      Math.abs(linesSubtotal - storedSubtotal) <= tolerance &&
      Math.abs(calculatedTotal - storedTotal) <= tolerance,
    linesSubtotal,
    storedSubtotal,
    calculatedTotal,
    storedTotal,
  };
}

export function assertBudgetRecordReconciled(
  lines: BudgetLine[],
  record: Pick<BudgetTotals, "subtotal" | "iva" | "descuento" | "total">,
) {
  const result = reconcileBudgetRecord(lines, record);
  if (!result.ok) throw new Error("BUDGET_TOTALS_MISMATCH");
  return result;
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

function optionalNum(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
