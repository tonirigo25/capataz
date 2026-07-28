import { writeFile } from "node:fs/promises";
import {
  accountIdVariable,
  allDomains,
  apiTokenVariable,
  desiredZone,
  loadResendRecords,
  railway,
  redirectRule,
  verifyArsysExport,
  zoneSettings,
} from "./config.mjs";
import { CloudflareClient, fqdn, recordsEqual } from "./client.mjs";

const apply = process.argv.includes("--apply");
const required = [accountIdVariable, apiTokenVariable];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(JSON.stringify({ ok: false, mode: apply ? "apply" : "plan", missing }));
  process.exit(1);
}

const arsys = await verifyArsysExport(process.env.ARSYS_DNS_EXPORT_DIR);
if (apply && !arsys.ok) {
  console.error(JSON.stringify({ ok: false, mode: "apply", blocker: arsys.blocker ?? "ARSYS_DNS_EXPORT_INVALID", arsys }));
  process.exit(2);
}

const client = new CloudflareClient({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
});
const resendRecords = await loadResendRecords();
const operations = [];
const warnings = [];
const activation = {
  state: "reconciled",
  arsysExport: arsys,
  warnings,
  zones: [],
  railway: {
    cname: railway.rootTarget,
    txtName: railway.rootVerificationName,
    txtValue: railway.rootVerificationValue,
  },
  manualActivationOrder: allDomains.map((domain, index) => ({ order: index + 1, domain, action: "replace nameservers in Arsys only after verification" })),
};

for (const domain of allDomains) {
  const desired = desiredZone(domain, domain === "orqenatech.com" ? resendRecords : []);
  let zone = await client.findZone(domain);
  if (!zone) {
    operations.push({ domain, action: "create_zone" });
    if (apply) zone = await client.createZone(domain);
  }
  if (!zone) {
    activation.zones.push({ domain, zoneId: null, nameservers: [] });
    continue;
  }

  const currentRecords = await client.listRecords(zone.id);
  for (const record of desired.records) {
    const name = fqdn(record.name, domain);
    const sameIdentity = currentRecords.filter((item) => item.name === name && item.type === record.type);
    const exact = sameIdentity.find((item) => recordsEqual(item, record, domain));
    if (exact && sameIdentity.length === 1) continue;
    if (sameIdentity.length) {
      operations.push({ domain, action: "update_record", name: record.name, type: record.type });
      if (apply) {
        await client.updateRecord(zone.id, sameIdentity[0].id, record);
        for (const duplicate of sameIdentity.slice(1)) await client.deleteRecord(zone.id, duplicate.id);
      }
    } else {
      operations.push({ domain, action: "create_record", name: record.name, type: record.type });
      if (apply) await client.createRecord(zone.id, record);
    }
  }

  for (const removal of desired.remove) {
    const name = fqdn(removal.name, domain);
    const matches = currentRecords.filter((item) => item.name === name && item.type === removal.type && (!removal.content || String(item.content).replace(/\.$/, "") === removal.content));
    for (const match of matches) {
      operations.push({ domain, action: "remove_record", name: removal.name, type: removal.type });
      if (apply) await client.deleteRecord(zone.id, match.id);
    }
  }

  for (const [setting, value] of zoneSettings) {
    const current = await client.getSetting(zone.id, setting);
    if (current.value === value) continue;
    operations.push({ domain, action: "update_setting", setting, value });
    if (apply) await client.updateSetting(zone.id, setting, value);
  }
  try {
    const universalSsl = await client.getUniversalSsl(zone.id);
    if (!universalSsl.enabled) {
      operations.push({ domain, action: "ensure_universal_ssl", enabled: true });
      if (apply) await client.updateUniversalSsl(zone.id);
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "CLOUDFLARE_UNIVERSAL_SSL_UNKNOWN";
    warnings.push({ domain, check: "universal_ssl", code });
  }

  const securityHeader = await client.getSetting(zone.id, "security_header");
  if (securityHeader.value?.strict_transport_security?.enabled) {
    operations.push({ domain, action: "disable_hsts" });
    if (apply) {
      await client.updateSetting(zone.id, "security_header", {
        strict_transport_security: {
          enabled: false,
          max_age: 0,
          include_subdomains: false,
          preload: false,
          nosniff: true,
        },
      });
    }
  }

  const rule = redirectRule(desired.redirect);
  const entrypoint = await client.getRedirectEntrypoint(zone.id);
  const currentRule = entrypoint?.rules?.find((item) => item.ref === rule.ref);
  if (!ruleEquivalent(currentRule, rule)) {
    operations.push({ domain, action: "upsert_redirect", ref: rule.ref });
    if (apply) {
      if (entrypoint) await client.updateRedirectRuleset(zone.id, entrypoint, rule);
      else await client.createRedirectRuleset(zone.id, rule);
    }
  }

  const refreshed = apply ? await client.findZone(domain) : zone;
  activation.zones.push({ domain, zoneId: refreshed.id, nameservers: refreshed.name_servers ?? [] });
}

await writeFile(new URL("./activation-plan.json", import.meta.url), `${JSON.stringify(activation, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  mode: apply ? "apply" : "plan",
  changes: operations.length,
  operations,
  blocker: arsys.ok ? null : arsys.blocker,
  warnings,
  zones: activation.zones.map((zone) => ({ domain: zone.domain, zoneId: zone.zoneId, nameservers: zone.nameservers })),
}, null, 2));

function ruleEquivalent(current, desired) {
  return current?.ref === desired.ref
    && current?.expression === desired.expression
    && current?.action === "redirect"
    && current?.enabled === true
    && current?.action_parameters?.from_value?.status_code === 301
    && current?.action_parameters?.from_value?.target_url?.expression === desired.action_parameters.from_value.target_url.expression
    && current?.action_parameters?.from_value?.preserve_query_string === true;
}
