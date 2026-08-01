import { describe, expect, it } from "vitest";
import {
  assertBudgetRecordReconciled,
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
});
