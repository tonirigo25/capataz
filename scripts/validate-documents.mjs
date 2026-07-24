import fs from "node:fs";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const documentsLib = fs.readFileSync("lib/documents.ts", "utf8");
const actions = fs.readFileSync("app/(app)/gestion/actions.ts", "utf8");
const gestionPage = fs.readFileSync("app/(app)/gestion/page.tsx", "utf8");
const documentsPage = fs.readFileSync("app/(app)/documentos/page.tsx", "utf8");
const workPage = fs.readFileSync("app/(app)/obras/[id]/page.tsx", "utf8");
const worksLib = fs.readFileSync("lib/works.ts", "utf8");

function expect(condition, message) {
  if (!condition) {
    console.error("[documents] FAIL", message);
    process.exit(1);
  }
}

for (const token of ["enum DocumentCategory", "model Document", "storageKey", "clientId", "workId", "budgetId", "invoiceId", "expenseId", "metadata", "archivedAt"]) {
  expect(schema.includes(token), `missing schema token ${token}`);
}

for (const category of ["presupuesto", "factura", "contrato", "albaran", "ticket", "fotografia", "garantia", "certificado", "plano", "informe", "otro"]) {
  expect(schema.includes(category), `missing document category ${category}`);
}

expect(documentsLib.includes("ALLOWED_DOCUMENT_MIME_TYPES"), "missing allowed MIME registry");
expect(documentsLib.includes("repositoryDocumentDisplay"), "missing repository document display helper");
expect(actions.includes("ALLOWED_DOCUMENT_MIME_TYPES") && actions.includes("Tipo de archivo no permitido"), "document action does not reject unsupported MIME types");
expect(actions.includes("assertSafeDocumentUrl") && actions.includes("HTTPS"), "document action does not guard unsafe URLs");
expect(actions.includes("async function saveDocument"), "missing saveDocument action");
expect(actions.includes("async function savePhoto"), "missing savePhoto action");
expect(gestionPage.includes('case "documento"') && gestionPage.includes('case "foto"'), "missing document/photo forms");
expect(documentsPage.includes('title="Documentos"') && documentsPage.includes("Cuando un archivo está disponible, puedes abrirlo desde su ficha"), "documents page explains file availability in user language");
expect(workPage.includes("repositoryDocuments") && workPage.includes("Registrar documento"), "Work 360 does not expose repository documents");
expect(worksLib.includes("Ficha sin archivo adjunto"), "work document presentation must distinguish metadata-only documents");

console.log("[documents] OK schema, categories, MIME/URL guards, repository UI and work integration");
