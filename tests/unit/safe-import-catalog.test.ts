import { describe, expect, it } from "vitest";
import {
  IMPORT_CATALOG,
  IMPORT_KINDS,
  PROTECTED_IMPORT_AREAS,
  buildImportTemplate,
  isImportKind,
} from "@/lib/product/import-catalog";
import { parseImportCsv } from "@/lib/product/import-service";

describe("catálogo de importación segura", () => {
  it("publica diez plantillas únicas y completas", () => {
    expect(IMPORT_KINDS).toHaveLength(10);
    expect(new Set(IMPORT_KINDS).size).toBe(10);
    expect(new Set(IMPORT_KINDS.map((kind) => IMPORT_CATALOG[kind].slug)).size).toBe(10);

    for (const kind of IMPORT_KINDS) {
      const definition = IMPORT_CATALOG[kind];
      expect(definition.kind).toBe(kind);
      expect(definition.fields.length).toBeGreaterThanOrEqual(4);
      expect(definition.examples.length).toBeGreaterThan(0);
      expect(definition.dependency.length).toBeGreaterThan(10);
      expect(definition.destination).toMatch(/^\//);
      for (const field of definition.fields.filter((item) => item.required)) {
        expect(definition.examples[0][field.name], `${kind}.${field.name}`).toBeTruthy();
      }
    }
  });

  it("genera CSV válido con todas las columnas de cada módulo", () => {
    for (const kind of IMPORT_KINDS) {
      const definition = IMPORT_CATALOG[kind];
      const rows = parseImportCsv(buildImportTemplate(kind));
      expect(rows[0]).toEqual(definition.fields.map((item) => item.name));
      expect(rows).toHaveLength(definition.examples.length + 1);
      expect(rows.every((row) => row.length === definition.fields.length)).toBe(true);
    }
  });

  it("mantiene fuera del CSV genérico los flujos económicos y de seguridad", () => {
    expect(PROTECTED_IMPORT_AREAS.map((area) => area.label).join(" ")).toContain("Presupuestos");
    expect(PROTECTED_IMPORT_AREAS.map((area) => area.label).join(" ")).toContain("Cobros");
    expect(PROTECTED_IMPORT_AREAS.map((area) => area.label).join(" ")).toContain("Equipo");
    expect(isImportKind("SALES_INVOICES")).toBe(false);
    expect(isImportKind("USERS")).toBe(false);
  });
});
