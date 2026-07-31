import { describe, expect, it } from "vitest";
import { selectDiffViewportKeys } from "../../scripts/design/public-matrix-config.mjs";

describe("D10 public matrix configuration", () => {
  it("only diffs viewports that were selected for screenshots", () => {
    const result = selectDiffViewportKeys({
      viewports: [{ key: "390" }, { key: "768" }, { key: "1440" }],
      screenshotViewportKeys: new Set(["390", "1440"]),
    });

    expect(result).toEqual(["390", "1440"]);
  });
});
