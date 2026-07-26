import assert from "node:assert/strict";
import { calculateAeatCancellationHash, calculateAeatRegistrationHash, buildAeatQrPayload } from "../../lib/fiscal/aeat";
import { canonicalInvoiceHash, createCanonicalInvoice } from "../../lib/fiscal/canonical";
import { artifactManifest, generateElectronicInvoice } from "../../lib/fiscal/electronic-invoice";
import { FakeFiscalSignatureAdapter } from "../../lib/fiscal/signatures";
import { assertPublicElectronicInvoiceDeliveryAllowed } from "../../lib/fiscal/transmission";
import { renderDraftSoftwareDeclaration } from "../../lib/fiscal/engine";

async function main() {
let passed = 0;
function check(name: string, operation: () => void | Promise<void>) {
  return Promise.resolve().then(operation).then(() => {
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  });
}

const first = {
  issuerTaxId: "89890001K",
  invoiceNumber: "12345678/G33",
  issueDate: "01-01-2024",
  invoiceType: "F1",
  taxAmount: "12.35",
  totalAmount: "123.45",
  generatedAt: "2024-01-01T19:20:30+01:00",
};
const firstHash = "3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60";
const secondHash = "F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97";
const cancellationHash = "177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68";

await check("AEAT official registration vector 1", () => {
  assert.equal(calculateAeatRegistrationHash(first).hash, firstHash);
});
await check("AEAT official registration vector 2", () => {
  assert.equal(calculateAeatRegistrationHash({ ...first, invoiceNumber: "12345679/G34", previousHash: firstHash, generatedAt: "2024-01-01T19:20:35+01:00" }).hash, secondHash);
});
await check("AEAT official cancellation vector", () => {
  assert.equal(calculateAeatCancellationHash({ issuerTaxId: first.issuerTaxId, invoiceNumber: "12345679/G34", issueDate: first.issueDate, previousHash: secondHash, generatedAt: "2024-01-01T19:20:40+01:00" }).hash, cancellationHash);
});
await check("AEAT QR exact parameter order and sandbox boundary", () => {
  const qr = buildAeatQrPayload({ mode: "verifactu", environment: "sandbox", issuerTaxId: "B12345678", invoiceNumber: "F/2026 001", issueDate: "2026-07-26", totalAmount: "121.00" });
  assert.equal(qr.payload, "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=B12345678&numserie=F%2F2026%20001&fecha=26-07-2026&importe=121");
  assert.match(qr.legend ?? "", /AEAT/u);
});

const invoice = createCanonicalInvoice({
  documentId: "F26-000001",
  documentType: "F1",
  issueDate: "2026-07-26",
  dueDate: "2026-08-25",
  currency: "EUR",
  seller: { legalName: "Orqena Test SL", taxId: "B12345678", countryCode: "ES", addressLine: "Calle Uno 1", postalCode: "28001", city: "Madrid" },
  buyer: { legalName: "Cliente Test SL", taxId: "B87654321", countryCode: "ES", addressLine: "Calle Dos 2", postalCode: "46001", city: "Valencia" },
  lines: [
    { id: "1", description: "Servicio A", quantity: "3", unitPrice: "0.335", discountAmount: "0", taxRate: "21" },
    { id: "2", description: "Servicio B", quantity: "1", unitPrice: "10.005", discountAmount: "0.01", taxRate: "10" },
  ],
  withholdingAmount: "0.50",
});

await check("Decimal half-up golden totals", () => {
  assert.deepEqual(invoice.lines.map((line) => [line.taxableBase, line.taxAmount]), [["1.01", "0.21"], ["10.00", "1.00"]]);
  assert.deepEqual(invoice.totals, { grossAmount: "11.01", discountAmount: "0.01", taxableBase: "11.01", taxAmount: "1.21", withholdingAmount: "0.50", payableAmount: "11.72" });
});
await check("canonical hash is deterministic", () => {
  assert.equal(canonicalInvoiceHash(invoice), canonicalInvoiceHash(structuredClone(invoice)));
});

const signer = new FakeFiscalSignatureAdapter();
const formats = await Promise.all((["UBL", "CII", "FACTURAE", "EDIFACT"] as const).map((format) => generateElectronicInvoice(invoice, format, {
  signer: format === "FACTURAE" ? signer : undefined,
  credentialReference: "test-vault-reference",
  keyVersion: "v1",
  signedAt: "2026-07-26T12:00:00.000Z",
})));
await check("four electronic invoice serializers share semantic hash", () => {
  assert.equal(new Set(formats.map((artifact) => artifact.semanticHash)).size, 1);
  assert.equal(new Set(formats.map((artifact) => artifact.contentHash)).size, 4);
  assert.ok(formats.every((artifact) => artifact.validation.valid));
});
await check("artifact manifest is deterministic", () => {
  assert.equal(artifactManifest(formats).manifestHash, artifactManifest(formats).manifestHash);
});
await check("signature key rotation changes signature without embedding material", async () => {
  const v1 = await signer.sign({ bytes: Buffer.from("payload"), credentialReference: "vault-ref", keyVersion: "v1", signedAt: "2026-07-26T12:00:00Z" });
  const v2 = await signer.sign({ bytes: Buffer.from("payload"), credentialReference: "vault-ref", keyVersion: "v2", signedAt: "2026-07-26T12:00:00Z" });
  assert.notEqual(v1.signatureBase64, v2.signatureBase64);
  assert.doesNotMatch(JSON.stringify([v1, v2]), /BEGIN PRIVATE KEY/u);
});
await check("public electronic invoice delivery defaults closed", () => {
  assert.throws(() => assertPublicElectronicInvoiceDeliveryAllowed({ enabled: false, ministerialOrderEffective: false, independentSchemaApproval: false, liveCredentialsApproved: false }), /EINVOICE_PUBLIC_DELIVERY_DISABLED/u);
});
await check("public electronic invoice delivery requires every independent gate", () => {
  assert.throws(() => assertPublicElectronicInvoiceDeliveryAllowed({ enabled: true, ministerialOrderEffective: false, independentSchemaApproval: true, liveCredentialsApproved: true }), /MINISTERIAL_ORDER/u);
});
await check("draft software declaration is versioned and explicitly non-legal", () => {
  const declaration = renderDraftSoftwareDeclaration({ softwareName: "Orqena", softwareVersion: "1.0.0", providerIdentity: "Provider Test SL", providerContactReference: "support-reference", mode: "sandbox", releaseSha: "d5e1af3a", configurationHash: "a".repeat(64), capabilities: { verifactu: true, publicB2B: false }, implementationSummary: "Immutable snapshot and AEAT hash chain", place: "Madrid", date: "2026-07-26" });
  assert.match(declaration, /DRAFT_REQUIRES_INDEPENDENT_FISCAL_SPECIALIST_SIGNATURE/u);
  assert.match(declaration, /Hash del borrador: [a-f0-9]{64}/u);
  assert.match(declaration, /no constituye conformidad jurídica/u);
});

process.stdout.write(`${JSON.stringify({ ok: true, passed, officialAeatVectors: 3, formats: formats.map(({ format, schemaVersion, contentHash }) => ({ format, schemaVersion, contentHash })) }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
