import { spawnSync } from "node:child_process";

const fixture = "scripts/readiness/fixtures/action-boundary-direct-prisma.fixture.ts";
const result = spawnSync(process.execPath, ["scripts/readiness/validate-action-boundaries.mjs", "--fixture", fixture], { encoding: "utf8" });
if (result.status === 0) {
  process.stderr.write("negative action-boundary fixture was not rejected\n");
  process.exit(1);
}
if (!`${result.stderr}${result.stdout}`.includes("direct Prisma import")) {
  process.stderr.write(`negative fixture failed for an unexpected reason\n${result.stderr}${result.stdout}`);
  process.exit(1);
}
process.stdout.write("action boundary negative fixture: PASS\n");
