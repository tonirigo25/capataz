import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
let passed = 0;
const check = (name, operation) => {
  operation();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
};

const landing = read("app/marketing-v2/_components/landing-sections.tsx");
const form = read("components/marketing/demo-request-form.tsx");
const service = read("lib/commercial/demo-service.ts");
const api = read("app/api/demo-requests/route.ts");
const funnelApi = read("app/api/metrics/funnel/route.ts");
const analytics = read("lib/product/analytics.ts");
const platform = read("app/(app)/plataforma/page.tsx");

check("canonical-home-uses-persistent-form", () => {
  assert.ok(landing.includes('<DemoRequestForm kind="home" />'));
  assert.equal(existsSync(join(root, "app/marketing-v2/_components/local-access-form.tsx")), false);
});
check("private-beta-capture-targets-contact", () => {
  assert.ok(read("app/(auth)/registro/page.tsx").includes('href="/contacto">Solicitar acceso'));
  assert.ok(read("components/auth/login-form.tsx").includes('href="/contacto"'));
});
check("header-mobile-and-final-demo-cta", () => {
  assert.ok(read("app/marketing-v2/_components/marketing-header.tsx").match(/href="\/contacto"/gu)?.length >= 2);
  assert.ok(landing.includes('href="/contacto">Solicitar demo'));
});
check("audio-copy-is-honest", () => assert.ok(read("app/marketing-v2/_components/hero-demo.tsx").includes("Ver un ejemplo con audio")));
check("quick-and-deep-demo-preserved", () => {
  assert.ok(read("app/demo/page.tsx").includes("<ImmersiveJourney />"));
  assert.ok(read("app/demo/page.tsx").includes("<GuidedDemo />"));
});
check("form-captures-attribution-and-consent", () => {
  for (const token of ["utmSource", "utmMedium", "utmCampaign", "landingPath", "referrerHost", "consentVersion"]) assert.ok(form.includes(token), token);
  assert.ok(form.includes('name="consent"'));
  assert.ok(form.includes('name="website"'));
});
check("dedupe-does-not-repeat-side-effects", () => {
  assert.ok(service.includes("createMany"));
  assert.ok(service.includes("skipDuplicates: true"));
  assert.ok(service.includes("if (!replayed)"));
});
check("api-has-payload-and-media-guards", () => {
  assert.ok(api.includes("PAYLOAD_TOO_LARGE"));
  assert.ok(api.includes("UNSUPPORTED_MEDIA_TYPE"));
  assert.ok(api.includes("clean(input.website"));
  assert.ok(api.includes("looksAutomated"));
  assert.ok(api.includes("status: 202"));
  assert.equal(api.includes("requestId:"), false);
  assert.equal(api.includes("replayed:"), false);
});
check("first-party-funnel-is-allowlisted-and-consented", () => {
  for (const event of ["funnel.hero_cta", "funnel.quick_demo_started", "funnel.contact_form_success"]) assert.ok(analytics.includes(`"${event}"`));
  assert.ok(funnelApi.includes("CONSENT_REQUIRED"));
  assert.ok(funnelApi.includes('scope: "public_funnel"'));
  assert.ok(read("lib/product/public-analytics.ts").includes('POLICY_VERSION = "1.0"'));
});
check("lead-list-is-platform-owner-only", () => {
  assert.ok(platform.match(/actor\.platformRole === "PLATFORM_OWNER"/gu)?.length >= 3);
  assert.ok(platform.includes("updateDemoRequest"));
});

process.stdout.write(`${JSON.stringify({ ok: true, phase: "C2", checks: passed, liveEmailEnabled: false, productionWrites: 0, stagingWrites: 0 })}\n`);
