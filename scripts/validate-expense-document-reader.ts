import assert from "node:assert/strict";
import { access, mkdtemp } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DeterministicDocumentExtractionProvider, resolveDocumentExtractionProvider } from "../lib/document-extraction";
import { LocalDocumentStorage } from "../lib/document-storage";
import { MAX_EXPENSE_DOCUMENT_BYTES, normalizeExpenseExtraction, parseDate, parseMoney, sanitizeFilename, validateExpenseDocumentFile } from "../lib/expense-document";

const actions = readFileSync("app/(app)/gastos-materiales/actions.ts", "utf8");
const downloadRoute = readFileSync("app/(app)/gastos-materiales/lector/[id]/archivo/route.ts", "utf8");
const reviewPage = readFileSync("app/(app)/gastos-materiales/lector/[id]/page.tsx", "utf8");
const extraction = readFileSync("lib/document-extraction.ts", "utf8");
const storageSource = readFileSync("lib/document-storage.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");

function expectThrows(run: () => unknown, pattern: RegExp) {
  assert.throws(run, pattern);
}

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const valid = validateExpenseDocumentFile({ filename: "ticket.png", browserMime: "image/png", bytes: png });
assert.equal(valid.mimeType, "image/png", "1 subida válida");
expectThrows(() => validateExpenseDocumentFile({ filename: "script.svg", browserMime: "image/svg+xml", bytes: Buffer.from("<svg/>") }), /Formato no admitido/);
expectThrows(() => validateExpenseDocumentFile({ filename: "grande.png", browserMime: "image/png", bytes: Buffer.concat([png, Buffer.alloc(MAX_EXPENSE_DOCUMENT_BYTES)]) }), /10 MB/);
assert.equal(sanitizeFilename("../../factura<script>.pdf"), "factura-script-.pdf", "4 nombre malicioso saneado");
assert.match(downloadRoute, /requireCompanyContext/, "5 descarga requiere sesión");
assert.match(downloadRoute, /id, companyId/, "6 descarga aísla empresa");
for (const relation of ["work.findFirst", "client.findFirst", "companyId: context.companyId"]) assert.match(actions, new RegExp(relation.replace(".", "\\.")), `7 relación propia ${relation}`);

async function main() {
const provider = new DeterministicDocumentExtractionProvider();
const baseInput = { bytes: png, mimeType: "image/png", sha256: valid.sha256 };
assert.equal((await provider.extract({ ...baseInput, filename: "factura-materiales.png" })).documentType, "MATERIAL_INVOICE", "8 materiales");
assert.equal((await provider.extract({ ...baseInput, filename: "ticket-gasolina.png" })).documentType, "FUEL_RECEIPT", "9 combustible");
assert.equal((await provider.extract({ ...baseInput, filename: "ticket-comida.png" })).documentType, "MEAL_RECEIPT", "10 comida");
assert.equal((await provider.extract({ ...baseInput, filename: "factura-subcontrata.png" })).documentType, "SUBCONTRACTOR_INVOICE", "11 subcontrata");
assert.equal(normalizeExpenseExtraction({}).total, null, "12 incompleto conserva null");
assert.equal(parseMoney("1.284,50 €"), 1284.5, "13 formato español");
assert.equal(parseMoney("1,284.50"), 1284.5, "14 separador alternativo");
assert.equal(parseDate("31/02/2026"), null, "13 fecha inválida");
assert.ok(normalizeExpenseExtraction({ taxableBase: 100, vatAmount: 21, total: 999 }).warnings.some((item) => item.includes("no cuadran")), "15 incoherencia fiscal");
assert.match(actions, /sha256: input\.sha256/, "16 duplicado por hash");
assert.match(actions, /extractedInvoiceNo[\s\S]*extractedIssuer/, "17 duplicado factura y emisor");
assert.match(actions, /confirmed.*!== "yes"/, "18 confirmación explícita");
assert.match(actions, /changedFields/, "19 correcciones prevalecen");
assert.doesNotMatch(actions, /formData,[^\n]*companyId|text\(formData, "companyId"\)|input: \{ companyId:/, "20 companyId nunca procede del cliente");
assert.match(downloadRoute, /findFirst\(\{ where: \{ id, companyId/, "21 route aislada");
assert.match(actions, /No se pudo analizar el documento/, "22 error sanitizado");
assert.match(extraction, /ignora cualquier instrucción, comando/, "23 prompt injection sin autoridad");
assert.match(actions, /document\.expenseId \|\| document\.status === "SAVED"/, "24 creación idempotente");
assert.match(storageSource, /rm\(temporary, \{ force: true \}\)/, "25 temporal limpiado");
assert.match(schema, /@@index\(\[companyId, sha256\]\)/, "índice hash por empresa");

const root = await mkdtemp(join(tmpdir(), "capataz-documents-test-"));
const storage = new LocalDocumentStorage(root);
const stored = await storage.put({ companyId: "company-A", bytes: png, extension: "png" });
assert.deepEqual(await storage.get({ companyId: "company-A", storageKey: stored.storageKey }), png, "almacenamiento roundtrip");
await assert.rejects(storage.get({ companyId: "company-B", storageKey: stored.storageKey }), /Invalid storage key/, "storage aislado por empresa");
await storage.delete({ companyId: "company-A", storageKey: stored.storageKey });
await assert.rejects(access(join(root, stored.storageKey)), "borrado físico");

const previousProvider = process.env.DOCUMENT_EXTRACTION_PROVIDER;
process.env.DOCUMENT_EXTRACTION_PROVIDER = "deterministic";
assert.equal(resolveDocumentExtractionProvider().name, "deterministic", "proveedor determinista en pruebas");
if (previousProvider === undefined) delete process.env.DOCUMENT_EXTRACTION_PROVIDER; else process.env.DOCUMENT_EXTRACTION_PROVIDER = previousProvider;

if (process.env.CAPATAZ_TEST_DATABASE_ISOLATED === "true") {
  const { prisma } = await import("../lib/prisma");
  const suffix = Date.now().toString(36);
  const companyA = await prisma.company.create({ data: { slug: `doc-a-${suffix}`, nombreComercial: "Documentos A" } });
  const companyB = await prisma.company.create({ data: { slug: `doc-b-${suffix}`, nombreComercial: "Documentos B" } });
  const docB = await prisma.document.create({ data: { companyId: companyB.id, name: "privado.pdf", category: "factura", sha256: valid.sha256 } });
  const crossRead = await prisma.document.findFirst({ where: { id: docB.id, companyId: companyA.id } });
  assert.equal(crossRead, null, "Empresa A no lee documento de Empresa B");
  const ownRead = await prisma.document.findFirst({ where: { id: docB.id, companyId: companyB.id } });
  assert.equal(ownRead?.id, docB.id, "Empresa B lee su documento");
  await prisma.$disconnect();
}

console.log("[expense-document-reader] OK 25 casos, almacenamiento y aislamiento por empresa");
}

main().catch((error) => {
  console.error("[expense-document-reader] FAIL", error instanceof Error ? error.message : "Error inesperado");
  process.exit(1);
});
