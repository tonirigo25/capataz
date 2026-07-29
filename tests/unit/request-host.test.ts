import { describe, expect, it } from "vitest";
import { resolveExternalRequestHost } from "../../lib/security/request-host";

describe("external request host", () => {
  it("uses Railway's forwarded public host before the internal URL host", () => {
    expect(resolveExternalRequestHost({
      forwardedHost: "app.orqenatech.com",
      host: "capataz-production.up.railway.app",
      urlHostname: "0.0.0.0",
    })).toBe("app.orqenatech.com");
  });

  it("uses the first proxy hop and normalizes its port", () => {
    expect(resolveExternalRequestHost({
      forwardedHost: "orqenatech.com:443, railway.internal",
      host: "capataz-production.up.railway.app",
      urlHostname: "0.0.0.0",
    })).toBe("orqenatech.com");
  });

  it("falls back to Host and then the request URL hostname", () => {
    expect(resolveExternalRequestHost({
      forwardedHost: null,
      host: "app.orqenatech.com:443",
      urlHostname: "0.0.0.0",
    })).toBe("app.orqenatech.com");
    expect(resolveExternalRequestHost({
      forwardedHost: null,
      host: null,
      urlHostname: "orqenatech.com",
    })).toBe("orqenatech.com");
  });

  it("does not accept an invalid forwarded host by falling through", () => {
    expect(resolveExternalRequestHost({
      forwardedHost: "evil.example/path",
      host: "app.orqenatech.com",
      urlHostname: "app.orqenatech.com",
    })).toBe("");
  });
});
