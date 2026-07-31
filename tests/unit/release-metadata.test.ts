import { afterEach, describe, expect, it } from "vitest";
import { resolveReleaseSha } from "../../lib/observability/release-sha";

const ORIGINAL_ENV = {
  APP_RELEASE_SHA: process.env.APP_RELEASE_SHA,
  RAILWAY_GIT_COMMIT_SHA: process.env.RAILWAY_GIT_COMMIT_SHA,
  GIT_COMMIT_SHA: process.env.GIT_COMMIT_SHA,
};

describe("release SHA metadata", () => {
  afterEach(() => {
    for (const [name, value] of Object.entries(ORIGINAL_ENV)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("treats a blank APP_RELEASE_SHA as absent and falls back to Railway", () => {
    process.env.APP_RELEASE_SHA = "   ";
    process.env.RAILWAY_GIT_COMMIT_SHA = " railway-sha ";
    process.env.GIT_COMMIT_SHA = "git-sha";

    expect(resolveReleaseSha()).toBe("railway-sha");
  });

  it("falls back to unknown when every release source is blank", () => {
    process.env.APP_RELEASE_SHA = "";
    process.env.RAILWAY_GIT_COMMIT_SHA = "  ";
    process.env.GIT_COMMIT_SHA = "";

    expect(resolveReleaseSha()).toBe("unknown");
  });
});
