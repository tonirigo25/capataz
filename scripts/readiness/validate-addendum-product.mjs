import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const checks = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  checks.push(name);
  process.stdout.write(`PASS ${name}\n`);
};

const activation = read("lib/product/activation.ts");
const onboarding = read("app/(app)/onboarding/page.tsx");
const analytics = read("lib/product/analytics.ts");
check("A1-first-week-has-four-milestones", (activation.match(/\{ key: "(?:company|client|budget|document)"/gu) ?? []).length === 4);
check("A1-progressive-resumable-optional", onboarding.includes("Personalización opcional") && onboarding.includes("Guardar y continuar después") && onboarding.includes("Omitir lo opcional") && onboarding.includes("state.mainGoal"));
check("A1-time-to-first-value-event", analytics.includes('"activation.time_to_first_value"') && activation.includes("addendum-a1-v1"));

const terminology = JSON.parse(read("contracts/product/v1/terminology.json"));
const sectors = read("lib/business-profile/sectors.ts");
check("A2-terminology-contract-versioned", terminology.schemaVersion === "orqena-terminology-v1");
check("A2-construction-terms-match", terminology.profiles.construction.workSingular === "Obra" && sectors.includes('{ workSingular: "Obra", workPlural: "Obras", owner: "Jefe de obra", progress: "Avance" }'));
check("A2-installations-terms-match", terminology.profiles.installations.workSingular === "Instalación" && sectors.includes('{ workSingular: "Instalación", workPlural: "Instalaciones", owner: "Técnico responsable", progress: "Ejecución" }'));
check("A2-profile-resolution-used", read("lib/business-profile/resolve-profile.ts").includes("terminologyOverrides"));

const status = read("lib/status.ts");
const statusPill = read("components/status-pill.tsx");
for (const value of ["DRAFT", "PREPARED", "ISSUED", "SENT", "TRANSMITTED", "ACCEPTED", "REJECTED", "OVERDUE", "PARTIAL", "PAID"]) {
  check(`A3-status-${value.toLowerCase()}`, status.includes(`${value}:`));
}
check("A3-visible-status-explanation", statusPill.includes("statusDescription") && statusPill.includes("aria-label"));

const mobile = JSON.parse(read("contracts/mobile/v1/capability-matrix.json"));
check("A4-mobile-contract-versioned", mobile.schemaVersion === "orqena-mobile-capabilities-v1");
check("A4-store-claim-is-honest", mobile.capabilities.some((item) => item.id === "signed-store-builds" && item.status === "READY_FOR_EXTERNAL_INPUT"));
check("A4-unsupported-capabilities-explicit", mobile.capabilities.filter((item) => item.status === "NOT_SUPPORTED").length >= 2);
check("A4-public-matrix-rendered", read("app/estado/page.tsx").includes("mobileCapabilities.capabilities.map"));

process.stdout.write(`${JSON.stringify({ ok: true, controls: ["A1", "A2", "A3", "A4"], checks: checks.length })}\n`);
