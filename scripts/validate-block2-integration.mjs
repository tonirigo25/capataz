import fs from "node:fs";

const files = {
  schema: fs.readFileSync("prisma/schema.prisma", "utf8"),
  packageJson: fs.readFileSync("package.json", "utf8"),
  chrome: fs.readFileSync("components/app-chrome.tsx", "utf8"),
  navigation: fs.readFileSync("lib/product-navigation.ts", "utf8"),
  client: fs.readFileSync("app/(app)/clientes/[id]/page.tsx", "utf8"),
  work: fs.readFileSync("app/(app)/obras/[id]/page.tsx", "utf8"),
  chatActions: fs.readFileSync("app/(app)/capataz/actions.ts", "utf8"),
  migration: fs.readFileSync("prisma/migrations/20260711183000_block2_final_consolidation/migration.sql", "utf8")
};

function expect(condition, message) {
  if (!condition) {
    console.error("[block2-integration] FAIL", message);
    process.exit(1);
  }
}

for (const route of ["app/(app)/agenda/page.tsx", "app/(app)/actividad/page.tsx", "app/(app)/buscar/page.tsx", "app/(app)/notificaciones/page.tsx", "app/(app)/documentos/page.tsx", "app/(app)/configuracion/page.tsx"]) {
  expect(fs.existsSync(route), `missing route ${route}`);
}

for (const model of ["Contact", "InternalNote", "Document", "Notification"]) {
  expect(files.schema.includes(`model ${model}`), `missing model ${model}`);
  expect(files.migration.includes(`CREATE TABLE IF NOT EXISTS "${model}"`), `migration does not create ${model}`);
}

for (const script of ["test:contacts", "test:documents", "test:internal-notes", "test:agenda", "test:notifications", "test:global-search", "test:settings", "test:block2-integration"]) {
  expect(files.packageJson.includes(`"${script}"`), `missing package script ${script}`);
}

for (const nav of ["/agenda", "/actividad", "/notificaciones", "/documentos", "/buscar", "/configuracion"]) {
  expect(`${files.chrome}\n${files.navigation}`.includes(nav), `navigation missing ${nav}`);
}

expect(files.client.includes("Contactos") && files.client.includes("Documentos") && files.client.includes("Notas internas"), "Client 360 missing Block 2 tabs");
expect(files.work.includes("Contactos") && files.work.includes("Documentos") && files.work.includes("Fotograf") && files.work.includes("Notas"), "Work 360 missing Block 2 tabs");
expect(files.chatActions.includes("queryClientContacts") && files.chatActions.includes("queryWorkDocuments") && files.chatActions.includes("queryPendingNotifications"), "chat actions missing Block 2 queries");
expect(fs.existsSync("docs/MULTIEMPRESA_OWNERSHIP_PLAN.md"), "missing ownership plan doc");
expect(fs.existsSync("docs/BLOQUE_2_CIERRE_FINAL.md"), "missing Block 2 closure doc");

console.log("[block2-integration] OK routes, migration, navigation, scripts, chat and docs");
