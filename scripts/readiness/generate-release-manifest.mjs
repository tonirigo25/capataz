import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const option = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
};
const root = process.cwd();
const output = option("--output", "artifacts/release-manifest.json");
const actualSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const sha = option("--sha", actualSha);
if (!/^[a-f0-9]{40}$/u.test(sha) || sha !== actualSha) throw new Error("RELEASE_MANIFEST_SHA_MISMATCH");
const files = ["package-lock.json", "docs/readiness/requirements.yaml", "prisma/schema.prisma"];
const checksums = [];
for (const path of files) {
  const bytes = await readFile(join(root, path));
  checksums.push({ path, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
}
const migrations = (await readdir(join(root, "prisma/migrations"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const manifest = {
  schemaVersion: "orqena-release-manifest-v1",
  releaseSha: sha,
  createdBy: "reproducible local/CI generator",
  deploymentPerformed: false,
  migrations,
  checksums,
  artifacts: ["production build", "test reports", "CycloneDX SBOM", "license report"],
};
await mkdir(dirname(join(root, output)), { recursive: true });
await writeFile(join(root, output), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ ok: true, output, releaseSha: sha, migrations: migrations.length, checksums: checksums.length })}\n`);
