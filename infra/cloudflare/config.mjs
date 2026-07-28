import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const accountIdVariable = "CLOUDFLARE_ACCOUNT_ID";
export const apiTokenVariable = "CLOUDFLARE_API_TOKEN";
export const arsysExportVariable = "ARSYS_DNS_EXPORT_DIR";

export const primaryDomain = "orqenatech.com";
export const defensiveDomains = ["orqena.es", "orqenatech.es", "orquenatech.com"];
export const allDomains = [primaryDomain, ...defensiveDomains];

export const railway = {
  rootTarget: "ox1hqyuo.up.railway.app",
  rootVerificationName: "_railway-verify",
  rootVerificationValue: "railway-verify=279ed58532a47453f894a3b2f1bca3df918c80921bc275581ed2e45ea140a21c",
  appTarget: "u3rrm744.up.railway.app",
  appVerificationName: "_railway-verify.app",
  appVerificationValue: "railway-verify=ea773ca79a1d4e1f6cdba41afea14579df3407d02343a30361d4e68a29668ff9",
};

const humanMailRecords = [
  record("@", "MX", "mx.serviciodecorreo.es", { priority: 10 }),
  record("@", "TXT", "v=spf1 include:_spf.serviciodecorreo.es ~all"),
  record(
    "1785180342353._domainkey",
    "TXT",
    "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAy86qZlb9GFnbRiC91sr1anvcdgPFT4L6zaU630+xvpRiejHf9+vAUENXk7NCkEtK3Yvtw79nkadxTEX31e+svYAmbi81AU+2n/1gESdgN4+pZJLhWlqBkIh+k+Z9fzLcfsCmX7uk6M2aFoPA0iQaAIdKLgajRN0xj0Vgxl5fRdzbcbvQMe6D362e4NYgbcjn6PhX+rFIjnGzlW05ikTiKJxEj2A6EA8R7dHmo0YyQPmiihZz9MTargTy5rbZKRLZHcfeFzWAUL5OJmoByQPeyeXi9stbHcjso4RFs26AD8P0UmmtrPHbXeR77O3nPwCIw1IPQFq01/n50nygQ5byLQIDAQAB",
  ),
  record("autoconfig", "CNAME", "autoconfig.serviciodecorreo.es"),
  record("autodiscover", "CNAME", "autodiscover.serviciodecorreo.es"),
  record("control", "CNAME", "pdc.servidoresdns.net"),
  record("webmail", "CNAME", "serviciodecorreo.es"),
];

export function desiredZone(domain, resendRecords = []) {
  if (domain === primaryDomain) {
    return {
      domain,
      records: [
        record("@", "CNAME", railway.rootTarget, { proxied: true }),
        record(railway.rootVerificationName, "TXT", railway.rootVerificationValue),
        record("app", "CNAME", railway.appTarget, { proxied: true }),
        record(railway.appVerificationName, "TXT", railway.appVerificationValue),
        record("www", "CNAME", primaryDomain, { proxied: true }),
        ...humanMailRecords,
        record("_dmarc", "TXT", "v=DMARC1; p=none; sp=none; rua=mailto:privacidad@orqenatech.com; adkim=r; aspf=r"),
        ...resendRecords.map(normalizeResendRecord),
      ],
      remove: [
        { name: "@", type: "A", content: "217.76.128.47" },
        { name: "www", type: "A", content: "217.76.128.47" },
        { name: "*", type: "CNAME", content: "www.orqenatech.com" },
      ],
      redirect: {
        ref: "orqena_launch_www_canonical",
        expression: '(http.host eq "www.orqenatech.com")',
      },
    };
  }
  return {
    domain,
    records: [
      record("@", "A", "192.0.2.1", { proxied: true }),
      record("www", "A", "192.0.2.1", { proxied: true }),
    ],
    remove: [{ name: "*", type: "CNAME" }],
    redirect: {
      ref: `orqena_launch_${domain.replaceAll(".", "_")}_canonical`,
      expression: `(http.host in {"${domain}" "www.${domain}"})`,
    },
  };
}

export const zoneSettings = [
  ["ssl", "full"],
  ["always_use_https", "on"],
  ["automatic_https_rewrites", "on"],
  ["min_tls_version", "1.2"],
];

export function redirectRule(redirect) {
  return {
    ref: redirect.ref,
    description: "Orqena canonical domain redirect",
    expression: redirect.expression,
    action: "redirect",
    action_parameters: {
      from_value: {
        status_code: 301,
        target_url: { expression: 'concat("https://orqenatech.com", http.request.uri.path)' },
        preserve_query_string: true,
      },
    },
    enabled: true,
  };
}

export async function loadResendRecords() {
  try {
    const content = await readFile(new URL("./resend-records.json", import.meta.url), "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch {
    return [];
  }
}

export async function verifyArsysExport(directory) {
  if (!directory?.trim()) return { ok: false, blocker: arsysExportVariable, files: 0, matched: [] };
  const root = resolve(directory);
  const expectedFiles = allDomains.map((domain) => `${domain}.csv`);
  const available = new Set((await readdir(root, { withFileTypes: true })).filter((item) => item.isFile()).map((item) => item.name.toLowerCase()));
  const missingFiles = expectedFiles.filter((name) => !available.has(name.toLowerCase()));
  if (missingFiles.length) return { ok: false, blocker: "ARSYS_DNS_EXPORT_FILES", files: expectedFiles.length - missingFiles.length, missingFiles, matched: [] };
  const texts = await Promise.all(expectedFiles.map((name) => readFile(resolve(root, name), "utf8")));
  const joined = texts[0].replace(/\s+/g, " ");
  const checks = [
    ["mx", /mx\.serviciodecorreo\.es/i],
    ["dkim", /1785180342353\._domainkey/i],
    ["dkim_value", /p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A/i],
    ["app", /u3rrm744\.up\.railway\.app/i],
    ["app_verification", /railway-verify=ea773ca79a1d4e1f6cdba41afea14579df3407d02343a30361d4e68a29668ff9/i],
    ["spf", /v=spf1 include:_spf\.serviciodecorreo\.es ~all/i],
    ["autoconfig", /autoconfig\.serviciodecorreo\.es/i],
    ["autodiscover", /autodiscover\.serviciodecorreo\.es/i],
    ["control", /pdc\.servidoresdns\.net/i],
    ["webmail", /serviciodecorreo\.es/i],
  ];
  const matched = checks.filter(([, pattern]) => pattern.test(joined)).map(([name]) => name);
  return { ok: matched.length === checks.length, files: expectedFiles.length, matched };
}

function record(name, type, content, options = {}) {
  return { name, type, content, ttl: 1, proxied: options.proxied ?? false, priority: options.priority };
}

function normalizeResendRecord(input) {
  return record(
    input.name,
    String(input.type).toUpperCase(),
    input.content ?? input.value,
    { priority: input.priority, proxied: false },
  );
}
