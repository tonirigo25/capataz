import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const resources = [
  ["work_margin_calculator", "app/recursos/calculadora-margen-obra/work-margin-calculator.tsx"],
  ["received_invoice_checklist", "app/recursos/checklist-factura-recibida/received-invoice-checklist.tsx"],
];
for (const [key, file] of resources) {
  assert.ok(existsSync(join(root, file)), file);
  const source = read(file);
  assert.ok(source.includes("funnel.resource_used"), `${key}:use-event`);
  assert.ok(source.includes("funnel.resource_cta"), `${key}:cta-event`);
  assert.ok(source.includes('href="/contacto?'), `${key}:persistent-contact`);
}
const analytics = read("lib/product/analytics.ts");
assert.ok(analytics.includes('"funnel.resource_used"'));
assert.ok(analytics.includes('"funnel.resource_cta"'));
assert.ok(read("app/sitemap.ts").includes("/recursos/calculadora-margen-obra"));
assert.ok(read("app/sitemap.ts").includes("/recursos/checklist-factura-recibida"));
assert.ok(read("docs/commercial/FOUNDER_DISCOVERY.md").includes("READY_FOR_EXTERNAL_INPUT"));
assert.ok(read("docs/commercial/PARTNER_CHANNEL_PLAYBOOK.md").includes("READY_FOR_EXTERNAL_INPUT"));

process.stdout.write(`${JSON.stringify({ ok: true, controls: ["B1", "B2", "B3"], b1: "READY_FOR_EXTERNAL_INPUT", b2: "READY_FOR_EXTERNAL_INPUT", b3TechnicalAssets: resources.length })}\n`);
