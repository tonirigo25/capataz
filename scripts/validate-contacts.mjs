import fs from "node:fs";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const actions = fs.readFileSync("app/(app)/gestion/actions.ts", "utf8");
const gestionPage = fs.readFileSync("app/(app)/gestion/page.tsx", "utf8");
const clientPage = fs.readFileSync("app/(app)/clientes/[id]/page.tsx", "utf8");
const workPage = fs.readFileSync("app/(app)/obras/[id]/page.tsx", "utf8");
const contactsLib = fs.readFileSync("lib/contacts.ts", "utf8");
const chatQuery = fs.readFileSync("lib/capataz-chat-query.ts", "utf8");

function expect(condition, message) {
  if (!condition) {
    console.error("[contacts] FAIL", message);
    process.exit(1);
  }
}

for (const field of ["model Contact", "clientId", "isPrimary", "isBillingContact", "isSiteContact", "archivedAt", "worksAsSite", "contactId"]) {
  expect(schema.includes(field), `missing schema field ${field}`);
}

for (const legacyField of ["contactoPrincipalNombre", "contactoPrincipalTelefono", "contactoPrincipalEmail", "contactoFacturacionNombre"]) {
  expect(schema.includes(legacyField), `legacy Client field was removed: ${legacyField}`);
}

expect(actions.includes("async function saveContact"), "missing saveContact action");
expect(actions.includes("syncLegacyContactFields"), "missing defensive legacy contact sync");
expect(actions.includes("isPrimary") && actions.includes("isBillingContact") && actions.includes("isSiteContact"), "missing contact flags in actions");
expect(gestionPage.includes('case "contacto"'), "missing contacto management form");
expect(gestionPage.includes('name="contactoId"'), "work form does not expose site contact selection");
expect(clientPage.includes("/gestion?tipo=contacto"), "Client 360 does not link to contact creation/editing");
expect(workPage.includes("work.contact") && workPage.includes("/gestion?tipo=contacto"), "Work 360 does not use real site contacts");
expect(contactsLib.includes("buildClientContacts") && contactsLib.includes("Legacy"), "missing real+legacy contact presentation");
expect(chatQuery.includes('"client_contacts"'), "chat intent does not support client_contacts");

console.log("[contacts] OK real contacts, legacy compatibility, UI, work relation and chat query");
