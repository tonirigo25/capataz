import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const output = args[args.indexOf("--output") + 1] || "artifacts/readiness-report.json";
const root = process.cwd();
const requirementsText = await readFile(join(root, "docs/readiness/requirements.yaml"), "utf8");
const requirementSection = requirementsText.split("\nexternal_gates:\n", 1)[0];
const matches = [...requirementSection.matchAll(/^    phase: "(F\d+)"\n    status: "([A-Z_]+)"/gmu)];
const externalGates = JSON.parse(await readFile(join(root, "docs/readiness/external-gates.json"), "utf8")).gates;
const phases = {};
for (const [, phase, status] of matches) {
  phases[phase] ??= { total: 0 };
  phases[phase].total += 1;
  phases[phase][status] = (phases[phase][status] ?? 0) + 1;
}
const hash = (text) => createHash("sha256").update(text).digest("hex");
const migrations = (await readdir(join(root, "prisma/migrations"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const report = {
  schemaVersion: "orqena-readiness-report-v1",
  sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  dirty: Boolean(execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim()),
  requirementsSha256: hash(requirementsText),
  requirements: { total: matches.length, phases },
  externalGates: { total: externalGates.length, readyForExternalInput: externalGates.filter(({ status }) => status === "READY_FOR_EXTERNAL_INPUT").length },
  migrations: { count: migrations.length, sha256: hash(migrations.join("\n")) },
  productionModified: false,
  stagingModified: false,
  generatedFromContentOnly: true,
};
await mkdir(dirname(join(root, output)), { recursive: true });
await writeFile(join(root, output), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ ok: true, output, requirements: matches.length, migrations: migrations.length })}\n`);
