import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "lib/prisma.ts"), "utf8");

assert.equal(
  (source.match(/new PrismaClient\(/gu) ?? []).length,
  1,
  "The shared runtime module must construct at most one Prisma client",
);
assert.match(
  source,
  /globalForPrisma\.prisma\s*\?\?\s*createPrismaClient\(\)/u,
  "The runtime must reuse the process-global Prisma client",
);
assert.match(
  source,
  /globalForPrisma\.prisma\s*=\s*prisma/u,
  "The runtime must persist the client in the process-global slot",
);
assert.doesNotMatch(
  source,
  /if\s*\(\s*process\.env\.NODE_ENV\s*!==\s*["']production["']\s*\)\s*\{[\s\S]*globalForPrisma\.prisma\s*=\s*prisma/u,
  "Standalone production route bundles must share the same process-global pool",
);

process.stdout.write(`${JSON.stringify({
  ok: true,
  control: "C3",
  runtimePool: "PROCESS_GLOBAL_SINGLETON",
  regression: "standalone route bundles cannot allocate one pool per bundle",
})}\n`);
