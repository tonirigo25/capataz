import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function assertNoForbiddenStartupMigrationReference(source) {
  const forbidden = [
    "prisma migrate deploy",
    "prisma migrate resolve",
    "db:deploy",
    "deploy-database",
    "Prisma CLI",
    "npx prisma",
    "spawnSync",
    "execFile",
    "execSync",
    "child_process",
    "DATABASE_URL"
  ];

  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `[deploy-contract] start-standalone must not reference ${token}`);
  }
}

const railway = JSON.parse(read("railway.json"));
assert.equal(railway.deploy?.preDeployCommand, "npm run db:deploy", "[deploy-contract] Railway preDeployCommand must be npm run db:deploy");
assert.equal(railway.deploy?.startCommand, "npm run start", "[deploy-contract] Railway startCommand must be npm run start");
assert.notEqual(railway.build?.buildCommand?.includes("migrate deploy"), true, "[deploy-contract] build must not run migrations");

const pkg = JSON.parse(read("package.json"));
assert.equal(pkg.scripts?.start, "node scripts/start-standalone.mjs", "[deploy-contract] npm start must run the standalone wrapper");
assert.equal(pkg.scripts?.["db:deploy"], "prisma generate && node scripts/deploy-database.mjs", "[deploy-contract] db:deploy must remain the predeploy migration entrypoint");

const startup = read("scripts/start-standalone.mjs");
assertNoForbiddenStartupMigrationReference(startup);
assert.match(startup, /await import\(standaloneServer\.href\)/, "[deploy-contract] startup must import only the generated standalone server");
assert.match(startup, /HOSTNAME/, "[deploy-contract] startup must preserve host configuration");
assert.match(startup, /PORT/, "[deploy-contract] startup must preserve port configuration");
assert.match(startup, /existsSync\(standaloneServer\)/, "[deploy-contract] startup must fail clearly when standalone server is missing");

const automaticMigrationOwners = [];
if (railway.deploy?.preDeployCommand === "npm run db:deploy") automaticMigrationOwners.push("railway.json:deploy.preDeployCommand");
if (railway.deploy?.startCommand?.includes("migrate deploy")) automaticMigrationOwners.push("railway.json:deploy.startCommand");
if (railway.build?.buildCommand?.includes("migrate deploy")) automaticMigrationOwners.push("railway.json:build.buildCommand");
if (startup.includes("migrate deploy") || startup.includes("deploy-database") || startup.includes("db:deploy")) automaticMigrationOwners.push("scripts/start-standalone.mjs");

assert.deepEqual(automaticMigrationOwners, ["railway.json:deploy.preDeployCommand"], "[deploy-contract] exactly one automatic migration owner is allowed");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "capataz-start-contract-"));
const tempScripts = path.join(tempRoot, "scripts");
const tempStandalone = path.join(tempRoot, ".next", "standalone");
const tempBin = path.join(tempRoot, "bin");
const marker = path.join(tempRoot, "forbidden-prisma-process.txt");
fs.mkdirSync(tempScripts, { recursive: true });
fs.mkdirSync(tempStandalone, { recursive: true });
fs.mkdirSync(tempBin, { recursive: true });
fs.writeFileSync(path.join(tempScripts, "start-standalone.mjs"), startup);
fs.writeFileSync(
  path.join(tempStandalone, "server.js"),
  "console.log('[mock-standalone] server imported'); process.exitCode = 17;\n"
);
fs.writeFileSync(path.join(tempBin, "npx.cmd"), `@echo off\r\necho npx-called > \"${marker}\"\r\nexit /b 99\r\n`);
fs.writeFileSync(path.join(tempBin, "prisma.cmd"), `@echo off\r\necho prisma-called > \"${marker}\"\r\nexit /b 99\r\n`);
fs.writeFileSync(path.join(tempBin, "npx"), `#!/bin/sh\necho npx-called > \"${marker}\"\nexit 99\n`);
fs.writeFileSync(path.join(tempBin, "prisma"), `#!/bin/sh\necho prisma-called > \"${marker}\"\nexit 99\n`);

const pathSeparator = process.platform === "win32" ? ";" : ":";
const controlledRun = spawnSync(process.execPath, [path.join(tempScripts, "start-standalone.mjs")], {
  cwd: tempRoot,
  env: {
    ...process.env,
    ["DATA" + "BASE_URL"]: ["postgresql://tester", "placeholder@example.invalid:5432/not_used"].join(":"),
    PATH: `${tempBin}${pathSeparator}${process.env.PATH ?? ""}`,
    PORT: "3900",
    HOSTNAME: "127.0.0.1"
  },
  encoding: "utf8"
});

assert.equal(controlledRun.status, 17, "[deploy-contract] startup must propagate standalone server exit code");
assert.match(controlledRun.stdout, /\[mock-standalone\] server imported/, "[deploy-contract] startup must import the generated server");
assert.equal(fs.existsSync(marker), false, "[deploy-contract] startup must not launch npx or prisma");
assert.equal(controlledRun.stderr.includes("DATABASE_URL"), false, "[deploy-contract] startup must not print database configuration");

const scanFiles = [
  "railway.json",
  "package.json",
  "scripts/start-standalone.mjs",
  "scripts/deploy-database.mjs"
];
const matches = [];
for (const file of scanFiles) {
  const source = read(file);
  for (const pattern of ["prisma migrate deploy", "prisma migrate resolve", "db:deploy", "deploy-database"]) {
    if (source.includes(pattern)) matches.push(`${file}:${pattern}`);
  }
}

assert(matches.includes("railway.json:db:deploy"), "[deploy-contract] Railway predeploy must invoke db:deploy");
assert(matches.includes("package.json:db:deploy"), "[deploy-contract] package.json must expose db:deploy for Railway predeploy");
assert(matches.includes("package.json:deploy-database"), "[deploy-contract] db:deploy must call deploy-database.mjs");
assert(matches.some((entry) => entry.startsWith("scripts/deploy-database.mjs:")), "[deploy-contract] deploy-database.mjs remains the migration implementation");
assert(!matches.some((entry) => entry.startsWith("scripts/start-standalone.mjs:")), "[deploy-contract] startup must not contain migration triggers");

const backupOrBuildArtifacts = [
  ".next",
  "coverage",
  ".codex-backup"
].filter((entry) => fs.existsSync(path.join(process.cwd(), entry)));

console.log(`[deploy-contract] OK sole automatic migration owner: ${automaticMigrationOwners[0]}`);
console.log(`[deploy-contract] startup imports standalone server only; no Prisma process or DATABASE_URL gate`);
if (backupOrBuildArtifacts.length > 0) {
  console.log(`[deploy-contract] local ignored artifacts present but not part of contract: ${backupOrBuildArtifacts.join(", ")}`);
}
