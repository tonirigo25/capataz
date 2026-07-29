import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { validateBrowserRequest } from "../../lib/security/browser-request";

const ORIGINAL_ENV = {
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  APP_BASE_URL: process.env.APP_BASE_URL,
  NEXT_PUBLIC_WEB_BASE_URL: process.env.NEXT_PUBLIC_WEB_BASE_URL,
  TRUSTED_BROWSER_ORIGINS: process.env.TRUSTED_BROWSER_ORIGINS,
};

describe("browser request host validation", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_ENV = "production";
    process.env.APP_BASE_URL = "https://app.orqenatech.com";
    process.env.NEXT_PUBLIC_WEB_BASE_URL = "https://orqenatech.com";
    delete process.env.TRUSTED_BROWSER_ORIGINS;
  });

  afterEach(() => {
    for (const [name, value] of Object.entries(ORIGINAL_ENV)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("accepts the normalized forwarded public host behind Railway", () => {
    const request = new NextRequest("http://railway.internal/.well-known/security.txt", {
      headers: {
        host: "capataz-production.up.railway.app",
        "x-forwarded-host": "app.orqenatech.com:443",
      },
    });

    expect(validateBrowserRequest(request)).toEqual({ allowed: true });
  });

  it("rejects an untrusted forwarded host instead of falling through", () => {
    const request = new NextRequest("http://railway.internal/.well-known/security.txt", {
      headers: {
        host: "app.orqenatech.com",
        "x-forwarded-host": "evil.example/path",
      },
    });

    expect(validateBrowserRequest(request)).toEqual({
      allowed: false,
      code: "HOST_NOT_ALLOWED",
    });
  });
});
