import { describe, expect, it } from "vitest";
import {
  extractInternalPdfPreviewPath,
  sanitizeInternalPdfPath,
} from "../../lib/internal-pdf-path";

describe("internal PDF paths", () => {
  it("accepts only canonical same-origin relative PDF paths", () => {
    expect(sanitizeInternalPdfPath("/facturas/abc-123/pdf")).toBe(
      "/facturas/abc-123/pdf",
    );
    expect(sanitizeInternalPdfPath("/presupuestos/abc_123/pdf?preview=1")).toBe(
      "/presupuestos/abc_123/pdf?preview=1",
    );
  });

  it.each([
    "//evil.example/document/pdf",
    "https://evil.example/document/pdf",
    "/document/pdf?preview=1&next=evil",
    "/document/pdf#fragment",
    "/document/<script>/pdf",
    "javascript:alert(1)",
  ])("rejects an unsafe PDF target: %s", (value) => {
    expect(sanitizeInternalPdfPath(value)).toBeNull();
  });

  it("extracts a safe preview without accepting a protocol-relative host", () => {
    expect(
      extractInternalPdfPreviewPath(
        "Documento: /facturas/abc-123/pdf?preview=1",
      ),
    ).toBe("/facturas/abc-123/pdf?preview=1");
    expect(
      extractInternalPdfPreviewPath(
        "Documento: //evil.example/facturas/abc/pdf?preview=1",
      ),
    ).toBeNull();
  });
});
