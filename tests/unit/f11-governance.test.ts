import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("F11 release governance", () => {
  it("keeps public launch and live providers fail closed by default", () => {
    const example = readFileSync(".env.example", "utf8");
    for (const value of [
      "PUBLIC_INDEXING_ENABLED=false",
      "PUBLIC_PRICING_ENABLED=false",
      "AI_ENABLED=false",
      "AI_PROVIDER_MODE=off",
      "BILLING_ENABLED=false",
      "EMAIL_LIVE_ENABLED=false",
    ]) expect(example).toContain(value);
  });

  it("pins deterministic fiscal vectors", () => {
    const source = readFileSync("scripts/readiness/validate-f3-fiscal.ts", "utf8");
    const expected = [
      "3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60",
      "F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97",
      "177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68",
    ];
    expect(expected.every((hash) => source.includes(hash))).toBe(true);
    expect(createHash("sha256").update(expected.join("\n")).digest("hex"))
      .toBe("0a9e484c00715e0dc0f8871075de57938ee747f200ea1da0e8dfc4b4eac0b593");
  });

  it("keeps private data-room material outside Git", () => {
    expect(readFileSync(".gitignore", "utf8")).toContain("docs/data-room/private/");
    expect(readFileSync("docs/data-room/README.md", "utf8")).toContain("never be committed");
  });
});
