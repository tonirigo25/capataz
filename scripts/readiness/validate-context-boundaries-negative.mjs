import { spawnSync } from "node:child_process";

const fixture = "scripts/readiness/fixtures/route-without-context.fixture.ts";
const result = spawnSync(process.execPath, ["scripts/readiness/validate-context-boundaries.mjs", "--fixture", fixture], { encoding: "utf8" });
if (result.status === 0 || !`${result.stdout}${result.stderr}`.includes("lacks canonical request context")) {
  process.stderr.write(`context negative fixture was not rejected correctly\n${result.stdout}${result.stderr}`);
  process.exit(1);
}
process.stdout.write("context boundary negative fixture: PASS\n");
