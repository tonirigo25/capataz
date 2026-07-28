const API_BASE = "https://api.cloudflare.com/client/v4";

export class CloudflareClient {
  constructor({ accountId, apiToken }) {
    this.accountId = accountId;
    this.apiToken = apiToken;
  }

  async request(path, init = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      body: init.body && typeof init.body !== "string" ? JSON.stringify(init.body) : init.body,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      const codes = Array.isArray(payload.errors) ? payload.errors.map((error) => error.code).filter(Boolean) : [];
      throw new Error(`CLOUDFLARE_API_${response.status}${codes.length ? `:${codes.join(",")}` : ""}`);
    }
    return payload.result;
  }

  async findZone(name) {
    const zones = await this.request(`/zones?account.id=${encodeURIComponent(this.accountId)}&name=${encodeURIComponent(name)}&per_page=50`);
    if (zones.length > 1) throw new Error(`CLOUDFLARE_DUPLICATE_ZONE:${name}`);
    return zones[0] ?? null;
  }

  createZone(name) {
    return this.request("/zones", { method: "POST", body: { account: { id: this.accountId }, name, type: "full" } });
  }

  listRecords(zoneId) {
    return this.request(`/zones/${zoneId}/dns_records?per_page=500`);
  }

  createRecord(zoneId, record) {
    return this.request(`/zones/${zoneId}/dns_records`, { method: "POST", body: recordPayload(record) });
  }

  updateRecord(zoneId, recordId, record) {
    return this.request(`/zones/${zoneId}/dns_records/${recordId}`, { method: "PUT", body: recordPayload(record) });
  }

  deleteRecord(zoneId, recordId) {
    return this.request(`/zones/${zoneId}/dns_records/${recordId}`, { method: "DELETE" });
  }

  getSetting(zoneId, setting) {
    return this.request(`/zones/${zoneId}/settings/${setting}`);
  }

  updateSetting(zoneId, setting, value) {
    return this.request(`/zones/${zoneId}/settings/${setting}`, { method: "PATCH", body: { value } });
  }

  updateUniversalSsl(zoneId) {
    return this.request(`/zones/${zoneId}/ssl/universal/settings`, { method: "PATCH", body: { enabled: true } });
  }

  getUniversalSsl(zoneId) {
    return this.request(`/zones/${zoneId}/ssl/universal/settings`);
  }

  async getRedirectEntrypoint(zoneId) {
    try {
      return await this.request(`/zones/${zoneId}/rulesets/phases/http_request_dynamic_redirect/entrypoint`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("CLOUDFLARE_API_404")) return null;
      throw error;
    }
  }

  createRedirectRuleset(zoneId, rule) {
    return this.request(`/zones/${zoneId}/rulesets`, {
      method: "POST",
      body: { name: "Orqena redirects", description: "Canonical redirects managed by infra/cloudflare", kind: "zone", phase: "http_request_dynamic_redirect", rules: [rule] },
    });
  }

  updateRedirectRuleset(zoneId, ruleset, rule) {
    const existing = Array.isArray(ruleset.rules) ? ruleset.rules : [];
    const rules = [...existing.filter((item) => item.ref !== rule.ref), rule];
    return this.request(`/zones/${zoneId}/rulesets/${ruleset.id}`, {
      method: "PUT",
      body: {
        name: ruleset.name || "Orqena redirects",
        description: ruleset.description || "Canonical redirects managed by infra/cloudflare",
        kind: ruleset.kind || "zone",
        phase: "http_request_dynamic_redirect",
        rules,
      },
    });
  }
}

export function fqdn(recordName, zoneName) {
  if (recordName === "@") return zoneName;
  if (recordName.endsWith(`.${zoneName}`) || recordName === zoneName) return recordName;
  return `${recordName}.${zoneName}`;
}

export function recordsEqual(current, desired, zoneName) {
  return current.type === desired.type
    && current.name === fqdn(desired.name, zoneName)
    && normalizeContent(current.content) === normalizeContent(desired.content)
    && Boolean(current.proxied) === Boolean(desired.proxied)
    && Number(current.priority ?? 0) === Number(desired.priority ?? 0);
}

function recordPayload(record) {
  return {
    name: record.name,
    type: record.type,
    content: record.content,
    ttl: record.ttl ?? 1,
    proxied: record.proxied ?? false,
    ...(record.priority !== undefined ? { priority: record.priority } : {}),
    comment: "Managed by infra/cloudflare/sync.mjs",
  };
}

function normalizeContent(value) {
  return String(value ?? "").replace(/\.$/, "");
}
