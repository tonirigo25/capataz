import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const securityPolicyPath = join(root, "SECURITY.md");
const routePath = join(root, "app", ".well-known", "security.txt", "route.ts");
const hostRoutingPath = join(root, "lib", "host-routing.ts");
const requestHostPath = join(root, "lib", "security", "request-host.ts");
const publicPolicyPath = join(root, "app", "seguridad", "page.tsx");

const securityPolicy = readFileSync(securityPolicyPath, "utf8");
const route = readFileSync(routePath, "utf8");
const hostRouting = readFileSync(hostRoutingPath, "utf8");
const requestHost = readFileSync(requestHostPath, "utf8");
const publicPolicy = readFileSync(publicPolicyPath, "utf8");

function stringConstant(name) {
  const match = route.match(new RegExp(`export const ${name} = "([^"]+)";`, "u"));
  assert.ok(match, `${name}_MISSING`);
  return match[1];
}

function validateExpiration(value, now = new Date()) {
  const expiresAt = new Date(value);
  assert.ok(Number.isFinite(expiresAt.getTime()), "EXPIRES_INVALID");
  const remainingMs = expiresAt.getTime() - now.getTime();
  assert.ok(remainingMs > 0, "EXPIRES_NOT_FUTURE");
  assert.ok(remainingMs < 365 * 24 * 60 * 60 * 1000, "EXPIRES_NOT_UNDER_ONE_YEAR");
  return { expiresAt, remainingMs };
}

const contact = stringConstant("SECURITY_CONTACT");
const policy = stringConstant("SECURITY_POLICY");
const preferredLanguages = stringConstant("SECURITY_PREFERRED_LANGUAGES");
const expires = stringConstant("SECURITY_EXPIRES");

assert.equal(contact, "https://github.com/tonirigo25/capataz/security/advisories/new");
assert.equal(new URL(contact).protocol, "https:");
assert.equal(new URL(contact).hostname, "github.com");
assert.equal(new URL(policy).protocol, "https:");
assert.match(preferredLanguages, /(?:^|,\s*)es(?:,|$)/u);
assert.match(preferredLanguages, /(?:^|,\s*)en(?:,|$)/u);

for (const field of ["Contact", "Expires", "Policy", "Preferred-Languages"]) {
  assert.match(route, new RegExp("`" + field + ": \\$\\{SECURITY_", "u"), `${field.toUpperCase()}_FIELD_MISSING`);
}
assert.match(route, /`Canonical: \$\{canonical\}`/u, "CANONICAL_FIELD_MISSING");

assert.match(route, /text\/plain; charset=utf-8/u);
const canonicalMap = route.match(/export const SECURITY_CANONICALS = \{([\s\S]+?)\} as const;/u);
assert.ok(canonicalMap, "SECURITY_CANONICALS_MISSING");
const canonicalEntries = [...canonicalMap[1].matchAll(/"([^"]+)":\s*"([^"]+)"/gu)]
  .map((match) => [match[1], match[2]]);
const allowedHosts = canonicalEntries.map(([hostname]) => hostname);
assert.deepEqual(allowedHosts, ["orqenatech.com", "app.orqenatech.com"]);
for (const [hostname, canonical] of canonicalEntries) {
  const canonicalUrl = new URL(canonical);
  assert.equal(canonicalUrl.protocol, "https:");
  assert.equal(canonicalUrl.hostname, hostname, "CANONICAL_HOST_MISMATCH");
  assert.equal(canonicalUrl.pathname, "/.well-known/security.txt");
}
assert.ok(!allowedHosts.includes("untrusted.example"), "UNTRUSTED_HOST_ALLOWED");
assert.match(hostRouting, /\/\.well-known\/security\.txt/u, "SECURITY_TXT_NOT_SHARED_BY_HOST_ROUTING");
assert.match(route, /headers\.get\("x-forwarded-host"\)/u, "SECURITY_TXT_FORWARDED_HOST_MISSING");
assert.match(route, /resolveExternalRequestHost/u, "SECURITY_TXT_EXTERNAL_HOST_RESOLVER_MISSING");
assert.match(requestHost, /normalizeRequestHost/u, "SECURITY_TXT_HOST_NORMALIZATION_MISSING");

const policyUrl = new URL(policy);
if (policyUrl.hostname === "orqenatech.com") {
  const localPolicyPath = join(root, "app", ...policyUrl.pathname.split("/").filter(Boolean), "page.tsx");
  assert.ok(existsSync(localPolicyPath), "PUBLIC_POLICY_ROUTE_MISSING");
} else {
  assert.equal(policyUrl.hostname, "github.com", "POLICY_HOST_NOT_PUBLIC");
  assert.ok(existsSync(securityPolicyPath), "GITHUB_SECURITY_POLICY_MISSING");
}
assert.match(publicPolicy, /security\/advisories\/new/u, "PUBLIC_POLICY_PRIVATE_REPORTING_LINK_MISSING");
assert.match(publicPolicy, /no uses issues p[uú]blicas/iu, "PUBLIC_POLICY_MUST_REJECT_PUBLIC_ISSUES");
assert.match(publicPolicy, /orqenatech\.com/u, "PUBLIC_POLICY_ROOT_SCOPE_MISSING");
assert.match(publicPolicy, /app\.orqenatech\.com/u, "PUBLIC_POLICY_APP_SCOPE_MISSING");
assert.match(publicPolicy, /pentesting intrusivo/iu, "PUBLIC_POLICY_INTRUSIVE_TESTING_LIMIT_MISSING");
assert.match(publicPolicy, /denegaci[oó]n de servicio/iu, "PUBLIC_POLICY_DOS_LIMIT_MISSING");
assert.match(publicPolicy, /ingenier[ií]a social/iu, "PUBLIC_POLICY_SOCIAL_ENGINEERING_LIMIT_MISSING");
assert.match(publicPolicy, /datos ajenos/iu, "PUBLIC_POLICY_THIRD_PARTY_DATA_LIMIT_MISSING");
assert.match(publicPolicy, /security\/policy/u, "PUBLIC_POLICY_FULL_POLICY_LINK_MISSING");

assert.match(securityPolicy, /^## Español$/mu);
assert.match(securityPolicy, /^## English$/mu);
assert.match(securityPolicy, /security\/advisories\/new/u);
assert.match(securityPolicy, /no uses issues p[uú]blicas/iu);
assert.match(securityPolicy, /do not use public issues/iu);
assert.match(securityPolicy, /no autoriza pentesting/iu);
assert.match(securityPolicy, /does not authorize penetration testing/iu);

const current = validateExpiration(expires);
const nearExpiryNow = new Date(current.expiresAt.getTime() - 24 * 60 * 60 * 1000);
const nearExpiry = validateExpiration(expires, nearExpiryNow);
assert.equal(nearExpiry.remainingMs, 24 * 60 * 60 * 1000, "NEAR_EXPIRY_TEST_FAILED");
assert.throws(() => validateExpiration(expires, current.expiresAt), /EXPIRES_NOT_FUTURE/u);

process.stdout.write(`${JSON.stringify({
  ok: true,
  contact,
  canonicals: Object.fromEntries(canonicalEntries),
  policy,
  preferredLanguages,
  expires,
  remainingDays: Math.floor(current.remainingMs / (24 * 60 * 60 * 1000)),
  nearExpiryTest: "PASS",
  hosts: allowedHosts,
  untrustedHostTest: "PASS",
})}\n`);
