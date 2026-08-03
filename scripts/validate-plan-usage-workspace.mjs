import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const page = read("app/(app)/plan-y-uso/page.tsx");
const styles = read("app/(app)/plan-y-uso/plan-usage.module.css");
const actions = read("app/(app)/plan-y-uso/actions.ts");
const billing = read("lib/billing/service.ts");
const failures = [];
const check = (name, condition) => { if (!condition) failures.push(name); };

check("capability-guard", page.includes('requireCapability("company.billing.manage")'));
check("tenant-scoped-real-consumption", [
  "companyMembership.count",
  "usageRecord.groupBy",
  "document.count",
  "storedObject.aggregate",
  "aiUsageEvent.aggregate",
  "automationDefinition.count",
].every((needle) => page.includes(needle)));
check("billing-fail-closed", page.includes('process.env.BILLING_ENABLED === "true"') && page.includes("billingCatalogReady = billingEnabled && hasCompleteStripeCatalog()"));
check("production-simulation-blocked", page.includes('process.env.NODE_ENV !== "production"') && page.includes('data-local-plan-simulation="development-only"'));
check("stripe-server-actions", ["startStripeCheckout", "openStripeCustomerPortal", "changeStripeSubscription", "scheduleStripeDowngrade"].every((needle) => actions.includes(needle)));
check("service-rejects-disabled-billing", billing.includes('if (!isBillingEnabled()) throw new Error("BILLING_DISABLED")'));
check("master-workspace-sections", ["data-plan-subscription", "data-plan-account", "data-plan-real-consumption", "data-plan-entitlements", "data-plan-actions"].every((needle) => page.includes(needle)));
check("responsive-density", styles.includes(".kpiGrid") && styles.includes(".usageGrid") && styles.includes("@media (max-width: 520px)"));
check("no-automatic-overage", page.includes("sin aplicar cargos automáticos") && page.includes("Aviso 80 % · bloqueo 100 %"));

if (failures.length) {
  console.error(`Plan y uso contract: FAIL (${failures.join(", ")})`);
  process.exit(1);
}
console.log("Plan y uso contract: PASS");
