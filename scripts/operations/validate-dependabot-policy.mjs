import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("../..", import.meta.url)));
const source = readFileSync(join(root, ".github", "dependabot.yml"), "utf8");
const updateBlocks = source
  .split(/(?=^  - package-ecosystem: )/mu)
  .filter((block) => /^  - package-ecosystem: /mu.test(block));

assert.equal(updateBlocks.length, 2, "DEPENDABOT_ECOSYSTEM_COUNT_INVALID");

for (const ecosystem of ["npm", "github-actions"]) {
  const block = updateBlocks.find((candidate) =>
    new RegExp(`^  - package-ecosystem: ${ecosystem}$`, "mu").test(candidate),
  );
  assert.ok(block, `DEPENDABOT_${ecosystem.toUpperCase()}_MISSING`);
  assert.match(block, /interval: weekly/u, `DEPENDABOT_${ecosystem.toUpperCase()}_NOT_WEEKLY`);
  assert.match(block, /update-types:\s*\n\s+- minor\s*\n\s+- patch/u, `DEPENDABOT_${ecosystem.toUpperCase()}_MINOR_PATCH_GROUP_MISSING`);
  assert.match(block, /ignore:\s*\n\s+- dependency-name: "\*"\s*\n\s+update-types:\s*\n\s+- version-update:semver-major/u, `DEPENDABOT_${ecosystem.toUpperCase()}_MAJOR_IGNORE_MISSING`);
}

assert.doesNotMatch(source, /auto-?merge/iu, "DEPENDABOT_AUTOMERGE_FORBIDDEN");
process.stdout.write("Dependabot governance policy passed.\n");
