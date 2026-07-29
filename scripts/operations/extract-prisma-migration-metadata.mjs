#!/usr/bin/env node

import { readFileSync } from "node:fs";

const [sqlPath] = process.argv.slice(2);
if (!sqlPath) {
  throw new Error("Usage: extract-prisma-migration-metadata.mjs <pg_restore-data-sql>");
}

const lines = readFileSync(sqlPath, "utf8").split(/\r?\n/u);
const copyIndex = lines.findIndex((line) =>
  /^COPY\s+.+_prisma_migrations.+\(.+\)\s+FROM\s+stdin;$/u.test(line),
);
if (copyIndex < 0) {
  throw new Error("The dump does not contain _prisma_migrations COPY data.");
}

const copyMatch = lines[copyIndex].match(/\((.+)\)\s+FROM\s+stdin;$/u);
if (!copyMatch) {
  throw new Error("Unable to parse _prisma_migrations columns.");
}

const columns = copyMatch[1]
  .split(",")
  .map((column) => column.trim().replaceAll('"', ""));
const finishedAtIndex = columns.indexOf("finished_at");
const migrationNameIndex = columns.indexOf("migration_name");
const rolledBackAtIndex = columns.indexOf("rolled_back_at");
if ([finishedAtIndex, migrationNameIndex, rolledBackAtIndex].some((index) => index < 0)) {
  throw new Error("The migration dump lacks required Prisma columns.");
}

const applied = [];
for (const line of lines.slice(copyIndex + 1)) {
  if (line === "\\.") break;
  if (!line) continue;
  const fields = line.split("\t");
  if (fields.length !== columns.length) {
    throw new Error("Unexpected _prisma_migrations COPY row shape.");
  }
  const finishedAt = fields[finishedAtIndex];
  const migrationName = fields[migrationNameIndex];
  const rolledBackAt = fields[rolledBackAtIndex];
  if (finishedAt !== "\\N" && rolledBackAt === "\\N") {
    applied.push({ finishedAt, migrationName });
  }
}

if (applied.length === 0) {
  throw new Error("The dump does not contain any completed Prisma migration.");
}

applied.sort((left, right) =>
  right.finishedAt.localeCompare(left.finishedAt)
  || right.migrationName.localeCompare(left.migrationName),
);

process.stdout.write(`${JSON.stringify({
  migrationCount: applied.length,
  migrationHead: applied[0].migrationName,
})}\n`);
