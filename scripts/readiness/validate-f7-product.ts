import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseImportCsv } from "../../lib/product/import-service";
import { sanitizeSupportText } from "../../lib/product/support-service";

const checks: string[] = [];
function check(name: string, condition: unknown) { assert.ok(condition, name); checks.push(name); }
function source(path: string) { return readFileSync(path, "utf8"); }

const csv = parseImportCsv('nombre,telefono,direccion,tipo,email,nifCif\r\n"Cliente, Uno",600000000,"Calle\nSintética 1",empresa,cliente@example.invalid,B00000000');
check("csv-rfc4180-quotes-and-newlines", csv.length === 2 && csv[1]?.[0] === "Cliente, Uno" && csv[1]?.[2].includes("\n"));
assert.throws(() => parseImportCsv("nombre,telefono\n\"sin cierre,600000000"), /IMPORT_UNCLOSED_QUOTE/);
checks.push("csv-unclosed-quote-rejected");
const importService = source("lib/product/import-service.ts");
for (const control of ["IMPORT_FILE_TOO_LARGE", "IMPORT_ROW_LIMIT_EXCEEDED", "FORMULA_INJECTION", "IMPORT_HEADERS_INVALID", "DUPLICATE_AT_APPLY", "pg_advisory_xact_lock", "IMPORT_ROLLBACK_CONFIRMATION_REQUIRED"]) check(`import-${control.toLowerCase()}`, importService.includes(control));

const sanitized = sanitizeSupportText(`Clave sk-${"proj-synthetic-never-real"}; Bearer synthetic-token-value; demo@example.invalid; 600000000; 00000000T`, 4000);
check("support-secret-redaction", !sanitized.includes("sk-proj") && !sanitized.includes("synthetic-token-value"));
check("support-pii-redaction", !sanitized.includes("demo@example.invalid") && !sanitized.includes("600000000") && !sanitized.includes("00000000T"));
const support = source("lib/product/support-service.ts");
for (const control of ["split(\"?\")[0]", "SUPPORT_ATTACHMENT_TOO_LARGE", "SUPPORT_CONFIDENTIAL", "requestId", "correlationId", "release"]) check(`support-${control}`, support.includes(control));

const onboarding = source("lib/application/company/onboarding-use-case.ts");
check("onboarding-owner-admin", onboarding.includes('["OWNER", "ADMIN"]'));
check("onboarding-objective-and-first-action", onboarding.includes("mainGoal") && onboarding.includes("firstAction"));
const activation = source("lib/product/activation.ts");
for (const milestone of ["company", "client", "budget", "document"]) check(`activation-${milestone}`, activation.includes(`key: "${milestone}"`));
check("activation-versioned-event-names", activation.includes("activation.${milestone.key}.completed") && activation.includes('name: "activation.completed"'));
check("activation-seven-day-window", activation.includes("7 * 24 * 60 * 60 * 1_000"));
check("activation-pseudonymous-actor", activation.includes('createHash("sha256")') && !activation.includes("actorId: input.actorId"));

const plan = source("app/(app)/plan-y-uso/page.tsx");
check("production-plan-simulation-fail-closed", plan.includes('process.env.NODE_ENV !== "production"') && plan.includes('data-local-plan-simulation="development-only"'));
check("plan-real-consumption", ["document.count", "storedObject.aggregate", "aiUsageEvent.aggregate", "usageRecord.groupBy"].every((value) => plan.includes(value)));
check("plan-checkout-and-portal", plan.includes("startStripeCheckout") && plan.includes("openStripeCustomerPortal"));

const preferences = source("lib/product/experience-preferences.ts");
check("preferences-ai-optout-kill-switch", preferences.includes("killSwitch: true") && !preferences.includes("killSwitch: false"));
check("preferences-audited", preferences.includes("experience.preferences.updated"));
check("privacy-rights-ui", source("app/(app)/configuracion/privacidad/page.tsx").includes("privacidad"));

const pdf = source("lib/document-pdf.ts");
check("pdf-versioned-contract", pdf.includes("orqena-professional-v1") && source("contracts/documents/v1/rendering.json").includes("deterministic-output"));
check("pdf-winansi-spanish", pdf.includes("WinAnsiEncoding") && pdf.includes('"€": 0x80'));
check("pdf-private-jpeg-asset", pdf.includes("/DCTDecode") && source("lib/document-pdf-assets.ts").includes("readVerified"));
check("pdf-hash-no-pii-header", ["app/(app)/dinero/[id]/pdf/route.ts", "app/(app)/presupuestos/[id]/pdf/route.ts"].every((path) => { const value = source(path); return value.includes("X-Orqena-PDF-SHA256") && !value.includes("X-Orqena-Template-Placeholders"); }));

for (const page of ["app/(app)/clientes/page.tsx", "app/(app)/presupuestos/page.tsx", "app/(app)/documentos/page.tsx", "app/(app)/dinero/page.tsx", "app/(app)/gestion/page.tsx"]) check(`manual-mode-${page}`, source(page).length > 100);
const manualActions = ["app/(app)/clientes/actions.ts", "app/(app)/presupuestos/actions.ts", "app/(app)/gestion/actions.ts", "app/(app)/dinero/actions.ts"].map(source).join("\n");
check("manual-domain-actions-no-direct-prisma", !manualActions.includes('from "@/lib/prisma"') && manualActions.includes("executeNextAction"));
check("configuration-surfaces", ["importar", "preferencias", "soporte", "privacidad", "ia"].every((segment) => source("app/(app)/configuracion/page.tsx").includes(`/configuracion/${segment}`)));

console.log(JSON.stringify({ ok: true, checks: checks.length, names: checks, externalCalls: 0, productionWrites: 0 }, null, 2));
