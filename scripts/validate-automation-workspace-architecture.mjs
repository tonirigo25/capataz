import fs from "node:fs";

const page = fs.readFileSync("app/(app)/automatizaciones/page.tsx", "utf8");
const css = fs.readFileSync("app/(app)/automatizaciones/automation-workspace.module.css", "utf8");

const requirements = [
  [page.includes('requireCapability("company.update")'), "capability gate"],
  [page.includes("companyId: auth.companyId"), "tenant scoped query"],
  [page.includes("runAutomationAction"), "real dry-run action"],
  [page.includes("toggleAutomationAction"), "real activation action"],
  [page.includes("publishAutomationAction"), "real publication action"],
  [page.includes('name="dryRun" value="true"'), "safe test execution"],
  [page.includes("Puerta de confirmación humana"), "human confirmation gate"],
  [page.includes("idempotencia"), "idempotency disclosure"],
  [page.includes("data-automation-list-view"), "list view"],
  [page.includes("data-automation-board-view"), "board view"],
  [page.includes("data-automation-calendar-view"), "calendar view"],
  [page.includes("Flujo") && page.includes("Configuración") && page.includes("Ejecuciones") && page.includes("Historial") && page.includes("Auditoría"), "inspector tabs"],
  [page.includes("pendingConfirmations"), "real confirmation metric"],
  [css.includes("@media (max-width: 720px)"), "mobile breakpoint"],
  [css.includes("grid-template-columns: minmax(0, 1.55fr)"), "compact split workspace"],
];

const failures = requirements.filter(([ok]) => !ok).map(([, label]) => label);
if (failures.length) {
  console.error(`[automation-workspace] FAIL: ${failures.join(", ")}`);
  process.exit(1);
}

console.log(`[automation-workspace] PASS (${requirements.length}/${requirements.length})`);
