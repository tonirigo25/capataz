import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateFirstPartyEvent } from "../../lib/product/analytics";
import { sanitizeChurnComment } from "../../lib/commercial/subscription-service";
import { supportSlaForPriority } from "../../lib/product/support-service";

const checks: string[] = [];
function check(name: string, condition: unknown) { assert.ok(condition, name); checks.push(name); }
function source(path: string) { return readFileSync(path, "utf8"); }

check("first-party-event-valid", validateFirstPartyEvent("user.active", { surface: "app" }).surface === "app");
assert.throws(() => validateFirstPartyEvent("unknown.event", {}), /PRODUCT_EVENT_NOT_ALLOWLISTED/);
checks.push("unknown-event-rejected");
assert.throws(() => validateFirstPartyEvent("user.active", { surface: "app", email: "synthetic@example.invalid" }), /PROPERTY_NOT_ALLOWLISTED/);
checks.push("unknown-property-rejected");
assert.throws(() => validateFirstPartyEvent("outcome.time_saved", { minutes: Number.POSITIVE_INFINITY, methodology: "self_reported" }), /PROPERTY_INVALID/);
checks.push("non-finite-value-rejected");
assert.throws(() => validateFirstPartyEvent("user.active", { surface: "synthetic@example.invalid" }), /PROPERTY_INVALID|SENSITIVE_VALUE/);
checks.push("sensitive-value-rejected");

const churn = sanitizeChurnComment(`Contacto synthetic@example.invalid, 600000000, 00000000T y sk-${"proj-synthetic-never-real"}`);
check("churn-comment-redacted", !/synthetic@example|600000000|00000000T|sk-proj/.test(churn));
const urgent = supportSlaForPriority("URGENT", new Date("2026-07-26T00:00:00.000Z"));
check("urgent-first-response-sla", urgent.firstResponseDueAt.toISOString() === "2026-07-26T01:00:00.000Z");
check("urgent-resolution-sla", urgent.resolutionDueAt.toISOString() === "2026-07-26T08:00:00.000Z");

const eventContract = JSON.parse(source("contracts/analytics/v1/events.json")) as { version: number; contentPolicy: string; events: Record<string, unknown> };
check("event-contract-versioned", eventContract.version === 1);
check("event-contract-content-minimized", eventContract.contentPolicy === "no-free-text-no-direct-identifiers");
check("event-contract-catalog-aligned", ["user.active", "activation.completed", "web.vital", "feedback.nps"].every((name) => name in eventContract.events));
const pilotContract = JSON.parse(source("contracts/pilots/v1/program.json")) as { version: number; targetCompanies: { minimum: number; maximum: number; minimumPaid: number }; liveEnrollmentStatus: string };
check("pilot-contract-versioned", pilotContract.version === 1);
check("pilot-target-five-to-ten", pilotContract.targetCompanies.minimum === 5 && pilotContract.targetCompanies.maximum === 10);
check("pilot-minimum-five-paid", pilotContract.targetCompanies.minimumPaid === 5);
check("pilot-live-enrollment-external", pilotContract.liveEnrollmentStatus === "READY_FOR_EXTERNAL_INPUT");

const analytics = source("lib/product/analytics.ts");
for (const control of ["PRODUCT_EVENT_NOT_ALLOWLISTED", "PRODUCT_EVENT_SENSITIVE_VALUE_REJECTED", "PRODUCT_EVENT_ID_REUSED", "stableReference", "eventId"]) check(`analytics-${control.toLowerCase()}`, analytics.includes(control));
const metrics = source("lib/product/metrics.ts");
for (const control of ['provider: "stripe"', 'status: "MATCHED"', "divergenceCount: 0", "verified: true", "localSimulationIncluded: false", "withinSevenDays", 'month: `M${month}`', "recoveredDebtEur", "minutesSaved"]) check(`metrics-${control}`, metrics.includes(control));
check("metrics-no-ticket-content", !/supportTicket\.findMany[\s\S]{0,400}(subject|description|context)/.test(metrics));

const governance = source("lib/product/pilot-governance.ts");
for (const control of ["PILOT_FEEDBACK_CONSENT_REQUIRED", "TESTIMONIAL_SCOPE_INVALID", "WITHDRAWN", "sourceReferenceHash", "verified", "SUPPORT_SATISFACTION_CONSENT_REQUIRED"]) check(`governance-${control.toLowerCase()}`, governance.includes(control));
const supportPage = source("app/(app)/configuracion/soporte/page.tsx");
check("feedback-optional-explicit-consent", supportPage.includes("Participación opcional") && supportPage.includes('name="consent" required'));
check("contact-permission-separate", supportPage.includes('name="contactAllowed"'));
check("testimonial-grant-and-withdraw", supportPage.includes('value="GRANT"') && supportPage.includes('value="WITHDRAW"'));
check("knowledge-base-linked", supportPage.includes("/configuracion/soporte/ayuda"));

const platformPage = source("app/(app)/plataforma/salud/page.tsx");
check("platform-owner-only", platformPage.includes('requirePlatformAccount("PLATFORM_OWNER")'));
check("platform-dashboard-aggregate-only", platformPage.includes("Vista agregada PLATFORM_OWNER") && !platformPage.includes("ticket.subject") && !platformPage.includes("ticket.description"));
check("platform-methodology-visible", platformPage.includes("methodologyVersion"));
check("platform-local-simulation-excluded", platformPage.includes("estados locales simulados no contribuyen al MRR"));

const layout = source("app/layout.tsx");
const webVitalsRoute = source("app/api/metrics/web-vitals/route.ts");
check("browser-analytics-fail-closed", layout.includes('process.env.ANALYTICS_ENABLED === "true"'));
check("web-vitals-endpoint-fail-closed", webVitalsRoute.includes('process.env.ANALYTICS_ENABLED !== "true"'));
check("web-vitals-minimized", webVitalsRoute.includes("LCP|CLS|INP|FCP|TTFB") && source("components/web-vitals-reporter.tsx").includes("routeGroup(pathname)"));

const budget = JSON.parse(source("contracts/observability/v1/web-performance-budget.json")) as { version: number; budgets: Record<string, { maximum: number }>; accessibility: { standard: string; blockingImpacts: string[] } };
check("performance-budget-versioned", budget.version === 1);
check("core-web-vitals-budgeted", budget.budgets.LCP.maximum === 2500 && budget.budgets.CLS.maximum === 0.1 && budget.budgets.INP.maximum === 200);
check("wcag-22-aa-budget", budget.accessibility.standard === "WCAG 2.2 AA" && budget.accessibility.blockingImpacts.includes("critical") && budget.accessibility.blockingImpacts.includes("serious"));
const chrome = source("components/app-chrome.tsx");
const css = source("app/globals.css");
check("skip-link-and-main-landmark", chrome.includes('href="#main-content"') && chrome.includes('id="main-content"'));
check("keyboard-dialog-guard", chrome.includes('event.key !== "Tab"') && chrome.includes('event.key === "Escape"'));
check("visible-focus-style", css.includes(":focus-visible"));
check("reduced-motion-style", css.includes("prefers-reduced-motion: reduce"));
check("forced-colors-style", css.includes("forced-colors"));

console.log(JSON.stringify({ ok: true, checks: checks.length, names: checks, livePilotEnrollment: "READY_FOR_EXTERNAL_INPUT", externalCalls: 0, productionWrites: 0 }, null, 2));
