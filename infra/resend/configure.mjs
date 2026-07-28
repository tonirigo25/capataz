import { mkdir, writeFile } from "node:fs/promises";

const API_BASE = "https://api.resend.com";
const DOMAIN = "updates.orqenatech.com";
const ROOT_ZONE = "orqenatech.com";
const key = process.env.RESEND_BOOTSTRAP_API_KEY?.trim();
if (!key) {
  console.error(JSON.stringify({ ok: false, missing: ["RESEND_BOOTSTRAP_API_KEY"] }));
  process.exit(1);
}

const domains = await request("/domains?limit=100");
const matches = (domains.data ?? []).filter((item) => item.name === DOMAIN);
if (matches.length > 1) throw new Error("RESEND_DUPLICATE_DOMAIN");
let domain = matches[0];

if (!domain) {
  domain = await request("/domains", {
    method: "POST",
    body: {
      name: DOMAIN,
      region: process.env.RESEND_REGION?.trim() || "eu-west-1",
      open_tracking: false,
      click_tracking: false,
      capabilities: { sending: "enabled", receiving: "disabled" },
    },
  });
}

domain = await request(`/domains/${domain.id}`);
const update = {};
if (domain.open_tracking !== false) update.open_tracking = false;
if (domain.click_tracking !== false) update.click_tracking = false;
if (domain.capabilities?.sending !== "enabled" || domain.capabilities?.receiving !== "disabled") {
  update.capabilities = { sending: "enabled", receiving: "disabled" };
}
if (Object.keys(update).length) {
  await request(`/domains/${domain.id}`, { method: "PATCH", body: update });
}

if (process.argv.includes("--verify")) {
  await request(`/domains/${domain.id}/verify`, { method: "POST" });
}

domain = await request(`/domains/${domain.id}`);
const records = deduplicate((domain.records ?? []).map(normalizeRecord));
const output = {
  generatedAt: new Date().toISOString(),
  domainId: domain.id,
  name: domain.name,
  status: domain.status,
  region: domain.region,
  openTracking: Boolean(domain.open_tracking),
  clickTracking: Boolean(domain.click_tracking),
  capabilities: domain.capabilities,
  records,
};
const target = new URL("../cloudflare/resend-records.json", import.meta.url);
await mkdir(new URL("../cloudflare/", import.meta.url), { recursive: true });
await writeFile(target, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  domainId: output.domainId,
  name: output.name,
  status: output.status,
  region: output.region,
  openTracking: output.openTracking,
  clickTracking: output.clickTracking,
  capabilities: output.capabilities,
  dnsRecords: output.records.length,
  verificationRequested: process.argv.includes("--verify"),
}, null, 2));

async function request(path, init = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload.name || payload.statusCode || response.status;
    throw new Error(`RESEND_API_${response.status}:${code}`);
  }
  return payload;
}

function normalizeRecord(record) {
  const type = String(record.type ?? "").toUpperCase();
  const content = String(record.value ?? record.content ?? "").replace(/^"|"$/g, "").replace(/\.$/, "");
  const name = normalizeName(String(record.name ?? ""));
  return {
    record: record.record,
    name,
    type,
    content,
    priority: record.priority === undefined ? undefined : Number(record.priority),
    status: record.status,
  };
}

function normalizeName(value) {
  let name = value.trim().toLowerCase().replace(/\.$/, "");
  if (name === DOMAIN) return "updates";
  if (name.endsWith(`.${ROOT_ZONE}`)) return name.slice(0, -(ROOT_ZONE.length + 1));
  if (name.endsWith(`.${DOMAIN}`)) return name.slice(0, -(ROOT_ZONE.length + 1));
  if (!name.endsWith(".updates")) name = `${name}.updates`;
  return name;
}

function deduplicate(records) {
  const map = new Map();
  for (const record of records) {
    if (!record.name || !record.type || !record.content) continue;
    const identity = `${record.type}|${record.name}|${record.content}|${record.priority ?? ""}`;
    map.set(identity, record);
  }
  return [...map.values()];
}
