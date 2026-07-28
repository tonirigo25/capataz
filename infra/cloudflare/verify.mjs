import {
  accountIdVariable,
  allDomains,
  apiTokenVariable,
  desiredZone,
  loadResendRecords,
  redirectRule,
  zoneSettings,
} from "./config.mjs";
import { CloudflareClient, fqdn, recordsEqual } from "./client.mjs";

const missing = [accountIdVariable, apiTokenVariable].filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(JSON.stringify({ ok: false, missing }));
  process.exit(1);
}

const client = new CloudflareClient({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID, apiToken: process.env.CLOUDFLARE_API_TOKEN });
const resend = await loadResendRecords();
const checks = [];

for (const domain of allDomains) {
  const desired = desiredZone(domain, domain === "orqenatech.com" ? resend : []);
  const zone = await client.findZone(domain);
  checks.push(check(domain, "zone_exists", Boolean(zone)));
  if (!zone) continue;
  checks.push(check(domain, "two_nameservers", (zone.name_servers ?? []).length === 2));
  const records = await client.listRecords(zone.id);
  for (const record of desired.records) {
    checks.push(check(domain, `record:${record.type}:${record.name}`, records.some((item) => recordsEqual(item, record, domain))));
  }
  checks.push(check(domain, "no_wildcard", !records.some((item) => item.name === fqdn("*", domain))));
  if (domain === "orqenatech.com") {
    checks.push(check(domain, "no_legacy_root_a", !records.some((item) => item.type === "A" && [domain, `www.${domain}`].includes(item.name) && item.content === "217.76.128.47")));
    const mailNames = new Set([domain, `1785180342353._domainkey.${domain}`, `autoconfig.${domain}`, `autodiscover.${domain}`, `control.${domain}`, `webmail.${domain}`, `_dmarc.${domain}`]);
    const mailRecords = records.filter((item) => mailNames.has(item.name) && !(item.name === domain && item.type === "CNAME"));
    checks.push(check(domain, "mail_dns_only", mailRecords.every((item) => !item.proxied)));
  }
  for (const [setting, value] of zoneSettings) {
    const current = await client.getSetting(zone.id, setting);
    checks.push(check(domain, `setting:${setting}`, current.value === value));
  }
  const securityHeader = await client.getSetting(zone.id, "security_header");
  checks.push(check(domain, "hsts_disabled", !securityHeader.value?.strict_transport_security?.enabled));
  try {
    const universalSsl = await client.getUniversalSsl(zone.id);
    checks.push(check(domain, "universal_ssl", universalSsl.enabled === true));
  } catch (error) {
    checks.push({ ...check(domain, "universal_ssl", false), code: error instanceof Error ? error.message : "UNKNOWN" });
  }
  const entrypoint = await client.getRedirectEntrypoint(zone.id);
  const expected = redirectRule(desired.redirect);
  checks.push(check(domain, "redirect", Boolean(entrypoint?.rules?.some((item) => item.ref === expected.ref && item.enabled && item.action_parameters?.from_value?.preserve_query_string === true))));
}

const failed = checks.filter((item) => !item.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checks: checks.length, failed }, null, 2));
if (failed.length) process.exit(1);

function check(domain, name, ok) {
  return { domain, name, ok };
}
