import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isPublicIndexablePath, shouldSendNoIndexHeader } from "../../lib/public-indexing";

const checks: string[] = [];
const source = (path: string) => readFileSync(path, "utf8");
const check = (name: string, condition: unknown) => { assert.ok(condition, name); checks.push(name); };
const acceptedSha = "ff175b7cfe7fccc6e59d02627e4d9e02fdf996b4";

execFileSync("git", ["merge-base", "--is-ancestor", acceptedSha, "HEAD"], { stdio: "ignore" });
checks.push("accepted-marketing-v2-sha-is-ancestor");
const parents = execFileSync("git", ["rev-list", "--parents", "-n", "1", "b5e063b5b5bb8efcfd04da3723e068747f679e2b"], { encoding: "utf8" });
check("marketing-v2-integrated-as-explicit-parent", parents.includes(acceptedSha));

const f0 = JSON.parse(source("docs/readiness/evidence/f0/audit-manifest.json")) as { pullRequest: { number: number; headSha: string }; railway: { teardown: { completed: boolean; environmentAbsentAfterDelete: boolean } }; browserValidation: { requestedViewports: string[]; horizontalOverflow: boolean; consoleErrors: number } };
check("f0-preview-pr-24", f0.pullRequest.number === 24 && f0.pullRequest.headSha === acceptedSha);
check("f0-isolated-preview-torn-down", f0.railway.teardown.completed && f0.railway.teardown.environmentAbsentAfterDelete);
check("f0-preview-viewports-accepted", f0.browserValidation.requestedViewports.includes("390x844") && f0.browserValidation.requestedViewports.includes("1440x900"));
check("f0-preview-browser-clean", !f0.browserValidation.horizontalOverflow && f0.browserValidation.consoleErrors === 0);

const manifest = source("lib/route-experience-manifest.ts");
check("route-manifest-marketing-v2-once", (manifest.match(/\^\\\/marketing-v2\$/g) ?? []).length === 1);
check("route-manifest-demo-v2-once", (manifest.match(/\^\\\/demo-v2\$/g) ?? []).length === 1);
check("route-manifest-brand-configured", manifest.includes("brand.productName"));

const home = source("app/page.tsx");
const demo = source("app/demo/page.tsx");
check("canonical-home-promotes-accepted-v2", home.includes("marketing-v2/_components/hero-demo") && home.includes('canonical: "/"'));
check("canonical-demo-promotes-accepted-v2", demo.includes("demo-v2/_components/guided-demo") && demo.includes('canonical: "/demo"'));
for (const alias of ["app/marketing-v2/page.tsx", "app/demo-v2/page.tsx"]) {
  const text = source(alias);
  check(`${alias}-preserved-noindex`, text.includes("index: false") && text.includes("follow: false") && text.includes("canonical: null"));
}

const landing = source("app/marketing-v2/_components/landing-data.ts");
const journey = ["lead", "visita", "presupuesto", "trabajo", "gasto", "factura", "cobro"];
for (const stage of journey) check(`journey-${stage}`, landing.includes(`id: "${stage}"`));
check("journey-seven-stages", (landing.match(/\n\s+id: "(?:lead|visita|presupuesto|trabajo|gasto|factura|cobro)"/g) ?? []).length === 7);
const guided = source("app/demo-v2/_components/guided-demo.tsx");
check("demo-seven-minute-story", guided.includes("Demostración guiada · 7 minutos") && guided.includes("lead-visita-presupuesto-trabajo-gasto-factura-cobro"));
check("public-vertical-first", source("app/marketing-v2/_components/hero-demo.tsx").includes("Sistema operativo para obra y reformas"));
check("internal-multisector-catalog-preserved", source("lib/marketing/catalog.ts").includes("marketingSectorCatalog"));

const brand = source("lib/config/brand.ts");
for (const token of ["NEXT_PUBLIC_PRODUCT_NAME", "NEXT_PUBLIC_LEGAL_COMPANY_NAME", "NEXT_PUBLIC_BRAND_TAGLINE", "NEXT_PUBLIC_BRAND_MARK", "NEXT_PUBLIC_SOCIAL_IMAGE", "NEXT_PUBLIC_BRAND_COLOR", "NEXT_PUBLIC_PWA_NAME", "NEXT_PUBLIC_SENDER_NAME"]) {
  check(`brand-${token.toLowerCase()}`, brand.includes(token));
}
check("accepted-v2-has-no-product-literal", !/Capataz/.test(["marketing-header.tsx", "hero-demo.tsx", "landing-sections.tsx"].map((file) => source(`app/marketing-v2/_components/${file}`)).join("\n")));
check("email-subjects-use-brand-config", source("lib/email/index.ts").includes("brand.productName") && !/correo en Orqena|contraseña de Orqena/.test(source("lib/email/index.ts")));
check("pdf-branding-is-company-configurable", source("lib/document-pdf.ts").includes("input.company.brandColor") && source("lib/document-pdf.ts").includes("input.company.logo"));
check("public-metadata-uses-brand-config", ["contacto", "soporte", "seguridad", "planes", "producto", "sectores"].every((route) => source(`app/${route}/page.tsx`).includes("brand.productName")));

const pricing = source("lib/commercial/unit-economics.ts");
const environmentExample = source(".env.example");
check("public-pricing-default-off", environmentExample.includes("PUBLIC_PRICING_ENABLED=false"));
for (const gate of ["PUBLIC_PRICING_APPROVAL_REF", "PUBLIC_PRICE_CATALOG_VERSION", "STRIPE_PRICE_KEYS"]) check(`pricing-gate-${gate.toLowerCase()}`, pricing.includes(gate));
check("pricing-fail-closed-conjunction", pricing.includes("publicPricingRequested && publicPricingApproval && publicPricingCatalogVersion && mappedPriceKeys.length > 0"));
check("plan-ui-has-no-subscription-amount", !/[0-9]+(?:[.,][0-9]+)?\s*(?:€|EUR)/.test(source("app/planes/page.tsx")));
check("plan-catalog-prices-null", (source("lib/commercial/plans.ts").match(/price: null/g) ?? []).length === 1);
for (const variable of [
  "STRIPE_PRICE_STARTER_MONTHLY",
  "STRIPE_PRICE_STARTER_ANNUAL",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_ANNUAL",
  "STRIPE_PRICE_BUSINESS_MONTHLY",
  "STRIPE_PRICE_BUSINESS_ANNUAL",
]) {
  check(`stripe-canonical-${variable.toLowerCase()}`, environmentExample.includes(`${variable}=`));
}
check("stripe-legacy-aliases-deprecated", environmentExample.includes("Deprecated compatibility aliases"));
check("stripe-live-billing-default-off", environmentExample.includes("BILLING_ENABLED=false"));
check("stripe-spain-only-default", environmentExample.includes("BILLING_ALLOWED_COUNTRIES=ES"));
check("stripe-cross-border-default-off", environmentExample.includes("EU_B2B_CROSS_BORDER_ENABLED=false"));
check("stripe-trial-and-grace-three-days", environmentExample.includes("STRIPE_TRIAL_DAYS=3") && environmentExample.includes("BILLING_PAST_DUE_GRACE_DAYS=3"));
check("stripe-portal-configuration-is-environment-specific", environmentExample.includes("STRIPE_PORTAL_CONFIGURATION_ID="));
check("stripe-remote-sandbox-default-off", environmentExample.includes("STRIPE_REMOTE_SANDBOX_ENABLED=false") && environmentExample.includes("STRIPE_SANDBOX_REMOTE_ALLOW_WRITES=false"));

const layout = source("app/layout.tsx");
const consent = source("components/consent-manager.tsx");
check("analytics-not-mounted-directly", !layout.includes("<WebVitalsReporter") && layout.includes("ConsentManager"));
check("analytics-only-after-accept", consent.includes('choice === "accepted" ? <WebVitalsReporter /> : null'));
check("consent-default-null", consent.includes("useState<ConsentChoice>(null)"));
check("consent-withdrawal-control", consent.includes("Privacidad") && consent.includes("setEditing(true)"));
check("no-marketing-category-activated", source("lib/config/legal.ts").includes("marketing: false"));

const legal = source("lib/config/legal.ts");
for (const token of ["NEXT_PUBLIC_LEGAL_COMPANY_NAME", "NEXT_PUBLIC_LEGAL_ADDRESS", "NEXT_PUBLIC_LEGAL_REGISTRATION", "NEXT_PUBLIC_PRIVACY_EMAIL", "REVIEW_REQUIRED"]) check(`legal-${token.toLowerCase()}`, legal.includes(token));
for (const page of ["privacidad", "terminos", "cookies", "politicas"]) {
  const text = source(`app/${page}/page.tsx`);
  check(`${page}-versioned-reviewable`, text.includes("legalConfig") && text.includes("brand."));
}
check("legal-provider-claims-fail-closed", source("app/privacidad/page.tsx").includes("No se presenta ningún proveedor externo como activo por defecto"));

check("indexing-default-fail-closed", source(".env.example").includes("PUBLIC_INDEXING_ENABLED=false") && shouldSendNoIndexHeader("/", false));
check("aliases-never-indexable", !isPublicIndexablePath("/marketing-v2") && !isPublicIndexablePath("/demo-v2"));
check("canonical-routes-indexable-only-after-gate", isPublicIndexablePath("/") && isPublicIndexablePath("/demo"));

console.log(JSON.stringify({ ok: true, phase: "F9", checks: checks.length, names: checks, acceptedSourceSha: acceptedSha, externalCalls: 0, productionWrites: 0, stagingWrites: 0 }, null, 2));
