import fs from "node:fs";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const actions = fs.readFileSync("app/(app)/gestion/actions.ts", "utf8");
const gestionPage = fs.readFileSync("app/(app)/gestion/page.tsx", "utf8");
const clientPage = fs.readFileSync("app/(app)/clientes/[id]/page.tsx", "utf8");
const workPage = fs.readFileSync("app/(app)/obras/[id]/page.tsx", "utf8");
const budgetPdf = fs.readFileSync("app/(app)/presupuestos/[id]/pdf/route.ts", "utf8");
const invoicePdf = fs.readFileSync("app/(app)/dinero/[id]/pdf/route.ts", "utf8");
const chatQuery = fs.readFileSync("lib/capataz-chat-query.ts", "utf8");

function expect(condition, message) {
  if (!condition) {
    console.error("[internal-notes] FAIL", message);
    process.exit(1);
  }
}

for (const token of ["model InternalNote", "clientId", "workId", "invoiceId", "budgetId", "authorId", "content", "archivedAt"]) {
  expect(schema.includes(token), `missing schema token ${token}`);
}

expect(actions.includes("async function saveInternalNote"), "missing saveInternalNote action");
expect(actions.includes("La nota interna debe estar asociada"), "internal notes can be saved without an entity");
expect(gestionPage.includes('case "notaInterna"'), "missing internal note form");
expect(clientPage.includes("Notas internas estructuradas") && clientPage.includes("/gestion?tipo=notaInterna"), "Client 360 does not expose structured internal notes");
expect(workPage.includes("NotesTab") && workPage.includes("/gestion?tipo=notaInterna"), "Work 360 does not expose structured internal notes");
expect(!budgetPdf.includes("internalNotes") && !budgetPdf.includes("notasPrivadas") && !budgetPdf.includes("observacionesInternas"), "budget PDF route exposes internal notes");
expect(!invoicePdf.includes("internalNotes") && !invoicePdf.includes("notasPrivadas") && !invoicePdf.includes("observacionesInternas"), "invoice PDF route exposes internal notes");
expect(chatQuery.includes('"internal_notes"'), "chat intent does not support internal_notes");

console.log("[internal-notes] OK model, forms, client/work visibility, PDF isolation and chat query");
