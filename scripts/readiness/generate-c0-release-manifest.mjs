import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();
const sourcePath = join(root, "docs/readiness/c0-release-sources.json");
const outputPath = join(root, "docs/readiness/evidence/c0/release-manifest.json");
const sources = JSON.parse(await readFile(sourcePath, "utf8"));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

for (const value of [sources.main.sha, sources.source.sha]) {
  assert.match(value, /^[a-f0-9]{40}$/u);
  assert.equal(git("cat-file", "-t", value), "commit");
}
assert.equal(git("rev-list", "-n", "1", sources.source.candidateTag), sources.source.sha);

const mergeBase = git("merge-base", sources.main.sha, sources.source.sha);
const [mainOnly, sourceOnly] = git("rev-list", "--left-right", "--count", `${sources.main.sha}...${sources.source.sha}`)
  .split(/\s+/u).map(Number);
const commitRows = git(
  "log",
  "--reverse",
  "--format=%H%x09%P%x09%s",
  `${sources.main.sha}..${sources.source.sha}`,
).split("\n").filter(Boolean);
const commits = commitRows.map((row) => {
  const [sha, parents, subject] = row.split("\t");
  return { sha, parents: parents ? parents.split(" ") : [], subject };
});
const migrations = git(
  "diff",
  "--name-only",
  sources.main.sha,
  sources.source.sha,
  "--",
  "prisma/migrations/*/migration.sql",
).split("\n").filter(Boolean).map((path) => path.split("/").at(-2)).sort();
const changedFiles = git("diff", "--name-only", sources.main.sha, sources.source.sha)
  .split("\n").filter(Boolean).length;

const manifest = {
  schemaVersion: "orqena-c0-release-manifest-v1",
  repository: sources.repository,
  main: sources.main,
  source: sources.source,
  topology: {
    mergeBase,
    mainOnlyCommits: mainOnly,
    sourceOnlyCommits: sourceOnly,
    sourceCommitManifestCount: commits.length,
    changedFiles,
    migrationCount: migrations.length,
  },
  commits,
  migrations,
  supersededPullRequest: sources.supersededPullRequest,
  productionObservation: sources.productionObservation,
  repositoryPolicy: sources.repositoryPolicy,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ ok: true, output: "docs/readiness/evidence/c0/release-manifest.json", commits: commits.length, migrations: migrations.length, changedFiles })}\n`);
