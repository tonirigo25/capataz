import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { assertIsolatedTestDatabase } from "./test-database-safety.mjs";
const { reserveDocumentNumber, reserveDocumentNumberInTransaction } = await import("../lib/numbering.ts");

const root = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
if (!root) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
const port = Number(process.env.CAPATAZ_NUMBERING_POSTGRES_PORT ?? 55437);
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(root, "node_modules", "embedded-postgres", "dist", "index.js")).href);
const password = randomBytes(24).toString("hex");
const pg = new EmbeddedPostgres({ databaseDir: join(root, `numbering-${Date.now()}`), user: "postgres", password, port, persistent: true });
const databaseName = "capataz_test_numbering";
const url = `postgresql://postgres:${password}@127.0.0.1:${port}/${databaseName}?schema=public`;
const env = { ...process.env, DATABASE_URL: url, CAPATAZ_TEST_DATABASE_ISOLATED: "true", APP_ENV: "test", NEXT_PUBLIC_APP_ENV: "test" };
const transactionOptions = { maxWait: 30_000, timeout: 30_000 };
assertIsolatedTestDatabase(env);
let db;
let calls = 0;

async function company(slug, overrides = {}) {
  return db.company.create({ data: { slug, nombreComercial: slug, budgetPrefix: "P", budgetSeries: "2026", invoicePrefix: "F", invoiceSeries: "2026", ...overrides } });
}

async function clientAndBudget(companyId, numero) {
  const client = await db.client.create({ data: { companyId, nombre: `Cliente ${numero}`, telefono: numero, direccion: numero, tipo: "empresa", origen: "numbering-test" } });
  const work = await db.work.create({ data: { companyId, clienteId: client.id, titulo: `Obra ${numero}`, direccion: numero, tipoTrabajo: "QA", presupuestoAprobado: 1 } });
  return db.budget.create({ data: { companyId, clienteId: client.id, obraId: work.id, numero, titulo: numero, partidas: "[]", subtotal: 1, iva: 0, total: 1, margenEstimado: 0 } });
}

async function reserve(companyId, type) {
  calls += 1;
  return reserveDocumentNumber(db, companyId, type);
}

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(databaseName);
  execFileSync("npx.cmd", ["prisma", "migrate", "deploy"], { cwd: process.cwd(), env, stdio: "pipe", shell: true });
  db = new PrismaClient({ datasources: { db: { url } }, transactionOptions });

  console.error("case basic");
  const a = await company("contract-a");
  const b = await company("contract-b");
  assert.equal(await reserve(a.id, "budget"), "P-2026-001");
  assert.equal(await reserve(a.id, "budget"), "P-2026-002");
  assert.equal(await reserve(b.id, "budget"), "P-2026-001");
  assert.equal(await reserve(a.id, "invoice"), "F-2026-001");

  await db.company.update({ where: { id: a.id }, data: { budgetSeries: "2027" } });
  assert.equal(await reserve(a.id, "budget"), "P-2027-001");
  await db.company.update({ where: { id: a.id }, data: { budgetSeries: "2025" } });
  assert.equal(await reserve(a.id, "budget"), "P-2025-001");
  await db.company.update({ where: { id: a.id }, data: { budgetSeries: "2026" } });
  const a2026 = await db.companyDocumentSequence.findUnique({ where: { companyId_type_scope: { companyId: a.id, type: "budget", scope: "P-2026-" } } });
  assert.equal(a2026?.nextValue, 3);
  const aBeforeB = await db.companyDocumentSequence.findUnique({ where: { companyId_type_scope: { companyId: a.id, type: "budget", scope: "P-2026-" } } });
  assert.equal(await reserve(b.id, "budget"), "P-2026-002");
  const aAfterB = await db.companyDocumentSequence.findUnique({ where: { companyId_type_scope: { companyId: a.id, type: "budget", scope: "P-2026-" } } });
  assert.deepEqual(aAfterB, aBeforeB);

  console.error("case legacy"); const legacy = await company("contract-legacy");
  await clientAndBudget(legacy.id, "P-2026-007");
  assert.equal(await db.companyDocumentSequence.count({ where: { companyId: legacy.id } }), 0);
  assert.equal(await reserve(legacy.id, "budget"), "P-2026-008");

  console.error("case sequence-above"); const above = await company("contract-sequence-above");
  await db.companyDocumentSequence.create({ data: { companyId: above.id, type: "budget", scope: "P-2026-", nextValue: 10 } });
  assert.equal(await reserve(above.id, "budget"), "P-2026-010");
  assert.equal((await db.companyDocumentSequence.findUnique({ where: { companyId_type_scope: { companyId: above.id, type: "budget", scope: "P-2026-" } } })).nextValue, 11);

  console.error("case sequence-below"); const below = await company("contract-sequence-below");
  await clientAndBudget(below.id, "P-2026-001");
  await clientAndBudget(below.id, "P-2026-005");
  await db.companyDocumentSequence.create({ data: { companyId: below.id, type: "budget", scope: "P-2026-", nextValue: 2 } });
  assert.equal(await reserve(below.id, "budget"), "P-2026-006");
  assert.equal((await db.companyDocumentSequence.findUnique({ where: { companyId_type_scope: { companyId: below.id, type: "budget", scope: "P-2026-" } } })).nextValue, 7);

  console.error("case concurrency"); const concurrent = await company("contract-concurrent");
  await clientAndBudget(concurrent.id, "P-2026-001");
  const concurrentNumbers = await Promise.all(Array.from({ length: 20 }, () => reserve(concurrent.id, "budget")));
  assert.deepEqual([...new Set(concurrentNumbers)].sort(), Array.from({ length: 20 }, (_, index) => `P-2026-${String(index + 2).padStart(3, "0")}`));
  assert.equal((await db.companyDocumentSequence.findUnique({ where: { companyId_type_scope: { companyId: concurrent.id, type: "budget", scope: "P-2026-" } } })).nextValue, 22);

  console.error("case rollback"); const rollback = await company("contract-rollback");
  await assert.rejects(() => db.$transaction(async (tx) => {
    await reserveDocumentNumberInTransaction(tx, rollback.id, "budget");
    throw new Error("ROLLBACK_NUMBERING_TEST");
  }), /ROLLBACK_NUMBERING_TEST/);
  assert.equal(await db.companyDocumentSequence.count({ where: { companyId: rollback.id } }), 0);
  assert.equal(await reserve(rollback.id, "budget"), "P-2026-001");

  console.error("case missing"); const missing = await company("contract-missing");
  await assert.rejects(() => reserve("missing-company-id", "budget"));
  assert.equal(await db.companyDocumentSequence.count({ where: { companyId: missing.id } }), 0);
  console.log(JSON.stringify({ ok: true, isolated: true, host: "127.0.0.1", database: databaseName, calls, transactionOptions, cases: { companyAFirstSecond: true, companyBIndependent: true, invoiceIndependent: true, seriesIndependent: true, yearsIndependent: true, legacyMaxPlusOne: true, sequenceAboveMax: true, sequenceBelowMax: true, concurrency20: true, crossCompanyIsolation: true, rollbackNoAdvance: true, missingCompanyNoSequence: true } }));
} finally {
  await db?.$disconnect();
  await pg.stop();
}
