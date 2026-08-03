import assert from "node:assert/strict";
import test from "node:test";
import { validateRepositoryDocumentFile } from "../lib/document-upload";

test("acepta PDF real y calcula hash sin confiar sólo en el MIME del navegador", () => {
  const bytes = new TextEncoder().encode("%PDF-1.7\ncontenido de prueba");
  const result = validateRepositoryDocumentFile({
    filename: "factura.pdf",
    browserMime: "application/pdf",
    bytes,
  });
  assert.equal(result.mimeType, "application/pdf");
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test("rechaza extensión que no coincide con la firma binaria", () => {
  const bytes = new TextEncoder().encode("%PDF-1.7\ncontenido de prueba");
  assert.throws(() => validateRepositoryDocumentFile({
    filename: "factura.jpg",
    browserMime: "image/jpeg",
    bytes,
  }), /DOCUMENT_EXTENSION_MISMATCH/);
});

test("admite TXT UTF-8 y rechaza contenido binario disfrazado", () => {
  const text = validateRepositoryDocumentFile({
    filename: "notas.txt",
    browserMime: "text/plain",
    bytes: new TextEncoder().encode("Seguimiento autorizado"),
  });
  assert.equal(text.mimeType, "text/plain");
  assert.throws(() => validateRepositoryDocumentFile({
    filename: "notas.txt",
    browserMime: "text/plain",
    bytes: Uint8Array.from([0, 255, 12]),
  }), /DOCUMENT_FORMAT_UNSUPPORTED/);
});
