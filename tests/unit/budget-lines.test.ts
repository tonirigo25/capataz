import { describe, expect, it } from "vitest";
import {
  assertBudgetRecordReconciled,
  calculateBudgetMargin,
  normalizeLine,
  reconcileBudgetRecord,
} from "../../lib/budget-lines";

describe("budget line compatibility and reconciliation", () => {
  it("keeps legacy importe as the line total and derives its unit price", () => {
    const line = normalizeLine({ concepto: "Instalación", cantidad: 2, importe: 150 });

    expect(line.descripcion).toBe("Instalación");
    expect(line.precioUnitario).toBe(75);
    expect(line.total).toBe(150);
  });

  it("accepts only records whose persisted totals match their lines", () => {
    const lines = [normalizeLine({ concepto: "Servicio", cantidad: 1, importe: 100 })];
    const valid = { subtotal: 100, descuento: 10, iva: 18.9, total: 108.9 };
    const invalid = { ...valid, subtotal: 90 };

    expect(reconcileBudgetRecord(lines, valid).ok).toBe(true);
    expect(reconcileBudgetRecord(lines, invalid).ok).toBe(false);
    expect(() => assertBudgetRecordReconciled(lines, invalid)).toThrow("BUDGET_TOTALS_MISMATCH");
  });

  it("calculates margin from net sales and line costs without a manual margin", () => {
    const lines = [
      normalizeLine({ descripcion: "Material", cantidad: 2, precioUnitario: 100, costeUnitario: 60 }),
      normalizeLine({ descripcion: "Montaje", cantidad: 1, precioUnitario: 300, costeUnitario: 150 }),
    ];

    expect(calculateBudgetMargin(lines, 50)).toEqual({
      revenue: 450,
      cost: 270,
      amount: 180,
      percent: 40,
      complete: true,
      missingCostLines: 0,
    });
  });

  it("fails closed when any line is missing its cost", () => {
    const lines = [normalizeLine({ descripcion: "Sin coste", cantidad: 1, precioUnitario: 100 })];
    expect(calculateBudgetMargin(lines)).toEqual({
      revenue: 100,
      cost: null,
      amount: null,
      percent: null,
      complete: false,
      missingCostLines: 1,
    });
  });
});
