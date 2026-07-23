import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth/crypto";
import { companyCore } from "../lib/tenant/core";
import { reserveDocumentNumber } from "../lib/numbering";
import { prisma as appPrisma } from "../lib/prisma";
import { assertIsolatedTestDatabase } from "./test-database-safety.mjs";

async function main() {
  const root = process.env.CAPATAZ_EMBEDDED_POSTGRES_ROOT;
  if (!root) throw new Error("CAPATAZ_EMBEDDED_POSTGRES_ROOT is required");
  const { default: EmbeddedPostgres } = await import(pathToFileURL(join(root, "node_modules", "embedded-postgres", "dist", "index.js")).href);
  const password = randomBytes(24).toString("hex"), port = Number(process.env.CAPATAZ_TENANT_POSTGRES_PORT ?? 55435);
  const pg = new EmbeddedPostgres({ databaseDir: join(root, `tenant-${Date.now()}`), user: "postgres", password, port, persistent: true });
  let prisma: PrismaClient | undefined;
  try {
    await pg.initialise(); await pg.start(); await pg.createDatabase("capataz_test_tenant");
    const url = `postgresql://postgres:${password}@127.0.0.1:${port}/capataz_test_tenant?schema=public`;
    const env = { ...process.env, DATABASE_URL: url, CAPATAZ_TEST_DATABASE_ISOLATED: "true", APP_ENV: "test", NEXT_PUBLIC_APP_ENV: "test" };
    assertIsolatedTestDatabase(env);
    execFileSync("npx.cmd", ["prisma", "migrate", "deploy"], { cwd: process.cwd(), env, stdio: "pipe", shell: true });
    prisma = new PrismaClient({ datasources: { db: { url } } });
    const hash = await hashPassword("Fixtures-seguras-2026!");
    const [a, b] = await Promise.all([
      prisma.company.create({ data: { slug: "tenant-a", nombreComercial: "Empresa A" } }),
      prisma.company.create({ data: { slug: "tenant-b", nombreComercial: "Empresa B" } })
    ]);
    const [ua, ub] = await Promise.all([
      prisma.user.create({ data: { email: "a@tenant.test", emailNormalized: "a@tenant.test", displayName: "A", passwordHash: hash, status: "active", emailVerifiedAt: new Date() } }),
      prisma.user.create({ data: { email: "b@tenant.test", emailNormalized: "b@tenant.test", displayName: "B", passwordHash: hash, status: "active", emailVerifiedAt: new Date() } })
    ]);
    await prisma.companyMembership.createMany({ data: [{ userId: ua.id, companyId: a.id, role: "OWNER", status: "active" }, { userId: ub.id, companyId: b.id, role: "OWNER", status: "active" }] });
    const [ca, cb] = await Promise.all([
      prisma.client.create({ data: { companyId: a.id, nombre: "Cliente A", telefono: "111", direccion: "A", tipo: "empresa", origen: "qa" } }),
      prisma.client.create({ data: { companyId: b.id, nombre: "Cliente B", telefono: "222", direccion: "B", tipo: "empresa", origen: "qa" } })
    ]);
    const coreA = companyCore(prisma, a.id), coreB = companyCore(prisma, b.id);
    const wa = await coreA.createWork({ clienteId: ca.id, titulo: "Obra A", direccion: "A", tipoTrabajo: "QA", presupuestoAprobado: 1000 });
    const wb = await coreB.createWork({ clienteId: cb.id, titulo: "Obra B", direccion: "B", tipoTrabajo: "QA", presupuestoAprobado: 9000 });
    await assert.rejects(() => coreA.createWork({ clienteId: cb.id, titulo: "Cruce", direccion: "X", tipoTrabajo: "QA", presupuestoAprobado: 1 }), /ENTITY_NOT_FOUND/);
    const ba = await prisma.budget.create({ data: { companyId: a.id, clienteId: ca.id, obraId: wa.id, numero: "P-2026-001", titulo: "A", partidas: "[]", subtotal: 100, iva: 21, total: 121, margenEstimado: 20 } });
    const bb = await prisma.budget.create({ data: { companyId: b.id, clienteId: cb.id, obraId: wb.id, numero: "P-2026-001", titulo: "B", partidas: "[]", subtotal: 1000, iva: 21, total: 1210, margenEstimado: 200 } });
    await assert.rejects(() => prisma!.budget.create({ data: { companyId: a.id, clienteId: ca.id, numero: "P-2026-001", titulo: "Duplicado", partidas: "[]", subtotal: 1, iva: 0, total: 1, margenEstimado: 0 } }));
    const ia = await coreA.createInvoice({ clienteId: ca.id, obraId: wa.id, numero: "F-2026-001", concepto: "A", importeBase: 100, iva: 21, total: 121, pendiente: 71, fechaEmision: new Date(), fechaVencimiento: new Date() });
    const ib = await coreB.createInvoice({ clienteId: cb.id, obraId: wb.id, numero: "F-2026-001", concepto: "B", importeBase: 1000, iva: 21, total: 1210, pendiente: 1210, fechaEmision: new Date(), fechaVencimiento: new Date() });
    await assert.rejects(() => coreA.createInvoice({ clienteId: ca.id, numero: "F-2026-001", concepto: "Duplicada", importeBase: 1, iva: 0, total: 1, pendiente: 1, fechaEmision: new Date(), fechaVencimiento: new Date() }));
    await assert.rejects(() => coreA.createInvoice({ clienteId: cb.id, numero: "F-X", concepto: "X", importeBase: 1, iva: 0, total: 1, pendiente: 1, fechaEmision: new Date(), fechaVencimiento: new Date() }), /ENTITY_NOT_FOUND/);
    await prisma.payment.create({ data: { companyId: a.id, facturaId: ia.id, clienteId: ca.id, obraId: wa.id, importe: 50, metodo: "qa", tipo: "pago_parcial" } });
    await prisma.expense.create({ data: { companyId: a.id, obraId: wa.id, clienteId: ca.id, proveedor: "Proveedor A", concepto: "A", categoria: "material", importe: 10, fecha: new Date() } });
    await prisma.document.create({ data: { companyId: a.id, name: "Documento A", clientId: ca.id, workId: wa.id, budgetId: ba.id } });
    const account = await prisma.financialAccount.create({ data: { companyId: a.id, name: "Cuenta A" } });
    await prisma.cashMovement.create({ data: { companyId: a.id, accountId: account.id, type: "inflow", amount: 50, date: new Date(), description: "A" } });

    assert.deepEqual((await coreA.listClients()).map((item) => item.id), [ca.id]);
    assert.deepEqual((await coreB.listClients()).map((item) => item.id), [cb.id]);
    assert.equal(await coreA.getClient(cb.id), null);
    assert.equal(await coreA.getWork(wb.id), null);
    assert.equal(await coreA.getBudget(bb.id), null);
    assert.equal(await coreA.getInvoice(ib.id), null);
    assert.equal((await coreA.updateClient(cb.id, { nombre: "Manipulado" })).count, 0);
    assert.equal((await prisma.client.findUnique({ where: { id: cb.id } }))?.nombre, "Cliente B");
    assert.deepEqual(await coreA.totals(), { invoiced: 121, pending: 71, collected: 50, expenses: 10 });
    assert.deepEqual(await coreB.totals(), { invoiced: 1210, pending: 1210, collected: 0, expenses: 0 });
    assert.equal((await coreA.listDocuments()).length, 1);
    assert.equal((await coreB.listDocuments()).length, 0);
    const concurrentA = await Promise.all(Array.from({ length: 20 }, () => reserveDocumentNumber(prisma!, a.id, "budget")));
    const nextB = await reserveDocumentNumber(prisma, b.id, "budget");
    assert.deepEqual([...new Set(concurrentA)].sort(), Array.from({ length: 20 }, (_, index) => `P-2026-${String(index + 2).padStart(3, "0")}`));
    assert.equal(nextB, "P-2026-002");
    const sequences = await prisma.companyDocumentSequence.findMany({ where: { type: "budget" }, orderBy: { companyId: "asc" }, select: { companyId: true, scope: true, nextValue: true } });
    assert.equal(sequences.length, 2);
    assert.equal(sequences.find((sequence) => sequence.companyId === a.id)?.nextValue, 22);
    assert.equal(sequences.find((sequence) => sequence.companyId === b.id)?.nextValue, 3);
    console.log(JSON.stringify({ ok: true, listIsolation: true, idIsolation: true, mutationIsolation: true, relationIsolation: true, aggregateIsolation: true, documentsIsolation: true, companyNumbering: true, concurrentNumberReservations: concurrentA.length, concurrentRange: [...new Set(concurrentA)].sort(), nextB }));
  } finally { await prisma?.$disconnect(); await appPrisma.$disconnect(); await pg.stop(); }
}

main().then(
  () => process.exit(0),
  (error) => { console.error(error); process.exit(1); }
);
