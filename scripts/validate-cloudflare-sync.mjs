import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  allDomains,
  desiredZone,
  loadResendRecords,
  railway,
  redirectRule,
  zoneSettings,
} from "../infra/cloudflare/config.mjs";

const resend = await loadResendRecords();
const activation = JSON.parse(await readFile(new URL("../infra/cloudflare/activation-plan.json", import.meta.url), "utf8"));
const rollback = JSON.parse(await readFile(new URL("../infra/cloudflare/rollback-plan.json", import.meta.url), "utf8"));
let cases = 0;
const check = (value, label) => {
  assert.ok(value, label);
  cases += 1;
};

assert.deepEqual(allDomains, ["orqenatech.com", "orqena.es", "orqenatech.es", "orquenatech.com"]);
cases += 1;
const primary = desiredZone("orqenatech.com", resend);
for (const [name, type, content, proxied] of [
  ["@", "CNAME", railway.rootTarget, true],
  ["app", "CNAME", railway.appTarget, true],
  ["www", "CNAME", "orqenatech.com", true],
  [railway.rootVerificationName, "TXT", railway.rootVerificationValue, false],
  [railway.appVerificationName, "TXT", railway.appVerificationValue, false],
]) {
  check(primary.records.some((record) => record.name === name && record.type === type && record.content === content && record.proxied === proxied), `${type} ${name}`);
}
check(!primary.records.some((record) => record.name === "*"), "no wildcard");
check(primary.remove.some((record) => record.type === "A" && record.content === "217.76.128.47"), "legacy A is removed");
check(primary.records.filter((record) => ["MX", "TXT"].includes(record.type)).every((record) => !record.proxied), "mail TXT/MX is DNS only");
check(primary.records.some((record) => record.type === "MX" && record.priority === 10 && record.content === "mx.serviciodecorreo.es"), "human MX preserved");
check(primary.records.some((record) => record.name === "1785180342353._domainkey" && record.content.length > 300), "full DKIM preserved");
check(primary.records.some((record) => record.name === "@" && record.type === "TXT" && record.content === "v=spf1 include:_spf.serviciodecorreo.es ~all"), "exported SPF preserved exactly");
check(resend.length === 3 && resend.every((record) => primary.records.some((desired) => desired.name === record.name && !desired.proxied)), "Resend records are DNS only");

for (const domain of allDomains.slice(1)) {
  const desired = desiredZone(domain);
  check(desired.records.length === 2 && desired.records.every((record) => record.type === "A" && record.content === "192.0.2.1" && record.proxied), `${domain} proxy-only sink`);
  const redirect = redirectRule(desired.redirect);
  check(redirect.action_parameters.from_value.status_code === 301 && redirect.action_parameters.from_value.preserve_query_string, `${domain} redirect preserves query`);
}

assert.deepEqual(zoneSettings, [
  ["ssl", "full"],
  ["always_use_https", "on"],
  ["automatic_https_rewrites", "on"],
  ["min_tls_version", "1.2"],
]);
cases += 1;
assert.deepEqual(activation.zones.map((zone) => zone.domain), allDomains);
cases += 1;
check(activation.zones.every((zone) => zone.zoneId && zone.nameservers.length === 2), "zone IDs and nameservers recorded");
assert.deepEqual(rollback.nameservers, ["dns97.servidoresdns.net", "dns98.servidoresdns.net"]);
cases += 1;
check(rollback.previousPrimaryZoneInventory.some((record) => record.name === "app" && record.content === railway.appTarget), "rollback preserves app");

console.log(`[cloudflare-sync] OK ${cases} casos`);
