import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const output = value("--output");
const notices = value("--notices");
const root = process.cwd();
const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));

function packageName(path) {
  const marker = "node_modules/";
  const tail = path.slice(path.lastIndexOf(marker) + marker.length);
  const parts = tail.split("/node_modules/").at(-1).split("/");
  return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

const rows = [];
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (!path.includes("node_modules/") || entry.dev || !entry.version) continue;
  const name = packageName(path);
  let installed = {};
  try { installed = JSON.parse(await readFile(join(root, "node_modules", name, "package.json"), "utf8")); } catch {}
  const license = String(installed.license ?? entry.license ?? "UNKNOWN").trim();
  rows.push({ name, version: entry.version, license, direct: Boolean(lock.packages[""]?.dependencies?.[name]) });
}

const unique = [...new Map(rows.map((row) => [`${row.name}@${row.version}`, row])).values()]
  .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const criticalPattern = /\b(?:AGPL|SSPL|BUSL|BUSINESS SOURCE|POLYFORM)\b|^UNKNOWN$/iu;
const reviewPattern = /\b(?:GPL|LGPL|MPL|EPL|CDDL)\b/iu;
const critical = unique.filter(({ license }) => criticalPattern.test(license));
const review = unique.filter(({ license }) => !criticalPattern.test(license) && reviewPattern.test(license));
const report = {
  schemaVersion: "f11-license-report-v1",
  generatedFrom: "package-lock.json and installed package metadata",
  legalConclusion: false,
  packages: unique.length,
  directProductionPackages: unique.filter(({ direct }) => direct).length,
  critical,
  review,
  entries: unique,
};

if (output) {
  await mkdir(dirname(join(root, output)), { recursive: true });
  await writeFile(join(root, output), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
if (notices) {
  const direct = unique.filter(({ direct }) => direct);
  const markdown = [
    "# Third-party notices",
    "",
    "Generated from the locked production dependency graph. This is a technical inventory, not a legal opinion.",
    "The complete transitive graph and license expressions are emitted by `npm run readiness:licenses` and the CycloneDX SBOM workflow.",
    "",
    "| Direct production package | Locked version | License expression |",
    "| --- | --- | --- |",
    ...direct.map(({ name, version, license }) => `| ${name} | ${version} | ${license.replaceAll("|", "\\|")} |`),
    "",
  ].join("\n");
  await writeFile(join(root, notices), markdown, "utf8");
}

process.stdout.write(`${JSON.stringify({ ok: critical.length === 0, packages: unique.length, direct: report.directProductionPackages, critical: critical.length, review: review.length, output: output ?? null, notices: notices ?? null })}\n`);
if (critical.length) process.exitCode = 1;
