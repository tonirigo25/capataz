import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { applyCompanyImport, previewCompanyImport, rollbackCompanyImport, type ImportKind } from "../../lib/product/import-service";
import { saveExperiencePreferences } from "../../lib/product/experience-preferences";
import { createAuthenticatedSupportTicket } from "../../lib/product/support-service";
import { getAndMeasureActivationStatus } from "../../lib/product/activation";
import { withRequestContext } from "../../lib/platform/request-context";

const prisma = new PrismaClient();

async function main() {
  let passed = 0;
  async function check(name: string, operation: () => unknown | Promise<unknown>) { await operation(); passed += 1; process.stdout.write(`PASS ${name}\n`); }
  const migrations = await prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  assert.equal(migrations[0]?.count, 45);
  const suffix = Date.now().toString(36);
  const [companyA, companyB] = await Promise.all([
    prisma.company.create({ data: { slug: `f7-a-${suffix}`, nombreComercial: "F7 Synthetic Alpha", onboardingCompletedAt: new Date() } }),
    prisma.company.create({ data: { slug: `f7-b-${suffix}`, nombreComercial: "F7 Synthetic Beta" } }),
  ]);
  const [userA, userB] = await Promise.all([
    prisma.user.create({ data: { email: `f7-a-${suffix}@example.invalid`, emailNormalized: `f7-a-${suffix}@example.invalid`, passwordHash: "synthetic-only", displayName: "F7 Alpha", status: "active" } }),
    prisma.user.create({ data: { email: `f7-b-${suffix}@example.invalid`, emailNormalized: `f7-b-${suffix}@example.invalid`, passwordHash: "synthetic-only", displayName: "F7 Beta", status: "active" } }),
  ]);
  const existing = await prisma.client.create({ data: { companyId: companyA.id, nombre: "Cliente Existente", telefono: "600000001", direccion: "Calle Sintética 1", tipo: "empresa", origen: "fixture" } });
  await prisma.client.create({ data: { companyId: companyB.id, nombre: "Cliente Otro Tenant", telefono: "600000002", direccion: "Calle Sintética 2", tipo: "empresa", origen: "fixture" } });

  const clientCsv = [
    "nombre,telefono,direccion,tipo,email,nifCif",
    "Cliente Nuevo,600000003,Calle Sintética 3,empresa,nuevo@example.invalid,B00000001",
    "Cliente Existente,600000001,Calle Sintética 1,empresa,,",
    "=HYPERLINK,600000004,Calle Sintética 4,empresa,email-invalido,",
  ].join("\n");
  let clientBatchId = "";
  await check("client preview has valid duplicate and row error", async () => {
    const batch = await previewCompanyImport(prisma, { companyId: companyA.id, actorId: userA.id, kind: "CLIENTS", source: clientCsv });
    clientBatchId = batch.id;
    assert.deepEqual([batch.validRows, batch.duplicateRows, batch.invalidRows], [1, 1, 1]);
    assert.equal(batch.rows.some((row) => JSON.stringify(row.errorCodes).includes("FORMULA_INJECTION")), true);
    const replay = await previewCompanyImport(prisma, { companyId: companyA.id, actorId: userA.id, kind: "CLIENTS", source: clientCsv });
    assert.equal(replay.id, batch.id);
  });
  await check("import apply is tenant scoped confirmed and idempotent", async () => {
    await assert.rejects(() => applyCompanyImport(prisma, { companyId: companyB.id, actorId: userB.id, batchId: clientBatchId, confirmation: `APPLY_BATCH:${clientBatchId}` }));
    await assert.rejects(() => applyCompanyImport(prisma, { companyId: companyA.id, actorId: userA.id, batchId: clientBatchId, confirmation: "WRONG" }), /IMPORT_CONFIRMATION_REQUIRED/);
    const result = await applyCompanyImport(prisma, { companyId: companyA.id, actorId: userA.id, batchId: clientBatchId, confirmation: `APPLY_BATCH:${clientBatchId}` });
    assert.equal(result.appliedRows, 1);
    await assert.rejects(() => applyCompanyImport(prisma, { companyId: companyA.id, actorId: userA.id, batchId: clientBatchId, confirmation: `APPLY_BATCH:${clientBatchId}` }), /IMPORT_CONFIRMATION_REQUIRED/);
    assert.equal(await prisma.client.count({ where: { companyId: companyB.id } }), 1);
  });
  await check("client rollback only archives entities created by batch", async () => {
    await assert.rejects(() => rollbackCompanyImport(prisma, { companyId: companyA.id, actorId: userA.id, batchId: clientBatchId, confirmation: "WRONG" }), /IMPORT_ROLLBACK_CONFIRMATION_REQUIRED/);
    const result = await rollbackCompanyImport(prisma, { companyId: companyA.id, actorId: userA.id, batchId: clientBatchId, confirmation: `ROLLBACK_BATCH:${clientBatchId}` });
    assert.equal(result.rolledBackRows, 1);
    assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: existing.id } })).archivadoAt, null);
  });

  const importParent = await prisma.client.create({ data: { companyId: companyA.id, nombre: "Cliente Referencias", nifCif: "B11111111", telefono: "600000011", direccion: "Calle Referencias 11", tipo: "empresa", origen: "fixture" } });
  const importWork = await prisma.work.create({ data: { companyId: companyA.id, clienteId: importParent.id, codigo: `OB-F7-${suffix}`, titulo: "Obra referencias", direccion: "Calle Referencias 11", tipoTrabajo: "Reforma", presupuestoAprobado: 1000, costePrevisto: 600, margenEstimado: 400 } });
  const expandedImports: Array<{ kind: ImportKind; csv: string }> = [
    { kind: "CONTACTS", csv: "clienteNifCif,nombre,email\nB11111111,Contacto Importado,contacto-importado@example.invalid" },
    { kind: "WORKS", csv: `codigo,clienteNifCif,titulo,direccion,tipoTrabajo,presupuestoAprobado,costePrevisto\nOB-IMPORT-${suffix},B11111111,Obra importada,Calle Importada 1,Reforma,2000.00,1250.00` },
    { kind: "TASKS", csv: `titulo,obraCodigo,prioridad,estado\nTarea importada ${suffix},${importWork.codigo},high,planned` },
    { kind: "FOLLOW_UPS", csv: `titulo,clienteNifCif,estado,prioridad\nSeguimiento importado ${suffix},B11111111,planned,medium` },
    { kind: "SUPPLIERS", csv: `nombreComercial,razonSocial,nifCif,diasVencimiento\nProveedor importado,Proveedor Importado SL,B2${suffix.padStart(7, "0").slice(-7)},30` },
    { kind: "SUBCONTRACTORS", csv: `nombreComercial,razonSocial,nifCif,diasVencimiento\nSubcontrata importada,Subcontrata Importada SL,B3${suffix.padStart(7, "0").slice(-7)},30` },
    { kind: "FINANCIAL_ACCOUNTS", csv: `nombre,tipo,moneda,saldoInicial,activa\nCuenta importada ${suffix},bank,EUR,1250.00,si` },
    { kind: "INTERNAL_NOTES", csv: `clienteNifCif,obraCodigo,contenido\nB11111111,${importWork.codigo},Nota importada ${suffix}` },
  ];
  await check("expanded import catalog applies and rolls back every reversible module", async () => {
    for (const testCase of expandedImports) {
      const batch = await previewCompanyImport(prisma, { companyId: companyA.id, actorId: userA.id, kind: testCase.kind, source: testCase.csv });
      assert.deepEqual([batch.validRows, batch.invalidRows, batch.duplicateRows], [1, 0, 0], testCase.kind);
      assert.equal((await applyCompanyImport(prisma, { companyId: companyA.id, actorId: userA.id, batchId: batch.id, confirmation: batch.confirmationKey })).appliedRows, 1, testCase.kind);
      assert.equal((await rollbackCompanyImport(prisma, { companyId: companyA.id, actorId: userA.id, batchId: batch.id, confirmation: `ROLLBACK_BATCH:${batch.id}` })).rolledBackRows, 1, testCase.kind);
    }
  });
  await check("cross-tenant references are rejected during preview", async () => {
    const batch = await previewCompanyImport(prisma, { companyId: companyA.id, actorId: userA.id, kind: "CONTACTS", source: "clienteNombre,nombre\nCliente Otro Tenant,Contacto prohibido" });
    assert.deepEqual([batch.validRows, batch.invalidRows], [0, 1]);
    assert.match(JSON.stringify(batch.rows[0]?.errorCodes), /CLIENT_REFERENCE_NOT_FOUND/);
  });

  const documentCsv = ["name,category,classification,originalName,mimeType,sha256", "Parte técnico.pdf,informe,OPERATIONAL,Parte técnico.pdf,application/pdf," + "a".repeat(64), "Documento inválido,desconocida,SECRET,,,"] .join("\n");
  await check("document metadata import previews applies and rolls back", async () => {
    const batch = await previewCompanyImport(prisma, { companyId: companyA.id, actorId: userA.id, kind: "DOCUMENTS", source: documentCsv });
    assert.deepEqual([batch.validRows, batch.invalidRows], [1, 1]);
    assert.equal((await applyCompanyImport(prisma, { companyId: companyA.id, actorId: userA.id, batchId: batch.id, confirmation: batch.confirmationKey })).appliedRows, 1);
    const document = await prisma.document.findFirstOrThrow({ where: { companyId: companyA.id, sha256: "a".repeat(64) } });
    assert.equal((document.metadata as { metadataOnly?: boolean }).metadataOnly, true);
    await rollbackCompanyImport(prisma, { companyId: companyA.id, actorId: userA.id, batchId: batch.id, confirmation: `ROLLBACK_BATCH:${batch.id}` });
    assert((await prisma.document.findUniqueOrThrow({ where: { id: document.id } })).archivedAt);
  });

  await prisma.companyAiPolicy.create({ data: { companyId: companyA.id, enabled: false, killSwitch: false, allowedPurposes: [], prohibitedData: [], approvedModels: [], dataProfile: "synthetic-f7" } });
  await check("preferences are audited and AI opt-out stays fail closed", async () => {
    const disabled = await saveExperiencePreferences(prisma, { companyId: companyA.id, actorId: userA.id, aiSuggestionsEnabled: false, operationalEmailEnabled: true, marketingEmailEnabled: false });
    assert.notEqual(disabled.updatedByHash, userA.id);
    assert.equal((await prisma.companyAiPolicy.findUniqueOrThrow({ where: { companyId: companyA.id } })).killSwitch, true);
    await saveExperiencePreferences(prisma, { companyId: companyA.id, actorId: userA.id, aiSuggestionsEnabled: true, operationalEmailEnabled: false, marketingEmailEnabled: true });
    assert.equal((await prisma.companyAiPolicy.findUniqueOrThrow({ where: { companyId: companyA.id } })).killSwitch, true);
    assert.equal(await prisma.auditLog.count({ where: { companyId: companyA.id, action: "experience.preferences.updated" } }), 2);
  });

  await check("support ticket stores only minimized sanitized context", async () => {
    const ticket = await withRequestContext({ requestId: `f7-request-${suffix}`, correlationId: `f7-correlation-${suffix}`, causationId: `f7-causation-${suffix}`, companyId: companyA.id, actor: { type: "user", id: userA.id }, release: "synthetic-release", environment: "test" }, () => createAuthenticatedSupportTicket(prisma, {
      companyId: companyA.id, actorId: userA.id, category: "PRIVACY", priority: "NORMAL", route: "/configuracion/privacidad?secret=never", subject: `Ayuda sk-${"proj-synthetic-never-real"}`, description: "Contacto demo@example.invalid teléfono 600000000 NIF 00000000T. Necesito revisar una preferencia sintética.",
    }));
    assert.equal(ticket.route, "/configuracion/privacidad");
    assert.equal(ticket.requestId, `f7-request-${suffix}`);
    assert.equal(ticket.correlationId, `f7-correlation-${suffix}`);
    assert.notEqual(ticket.actorIdHash, userA.id);
    const serialized = JSON.stringify(ticket);
    assert.doesNotMatch(serialized, /sk-proj|demo@example\.invalid|600000000|00000000T|secret=never/);
    assert.equal(await prisma.supportTicket.count({ where: { companyId: companyB.id } }), 0);
  });

  await check("activation is measured once within seven days", async () => {
    const client = await prisma.client.create({ data: { companyId: companyA.id, nombre: "Cliente Activación", telefono: "600000005", direccion: "Calle Sintética 5", tipo: "empresa", origen: "manual" } });
    await prisma.budget.create({ data: { companyId: companyA.id, clienteId: client.id, numero: `P-F7-${suffix}`, titulo: "Presupuesto sintético", partidas: "[]", subtotal: 100, iva: 21, total: 121, margenEstimado: 20 } });
    await prisma.document.create({ data: { companyId: companyA.id, name: "Documento activación", uploadedById: userA.id, category: "otro", classification: "OPERATIONAL", status: "UPLOADED" } });
    const first = await getAndMeasureActivationStatus(prisma, { companyId: companyA.id, actorId: userA.id });
    assert(first.completedAt && first.completedWithinSevenDays === true);
    assert.equal(first.milestones.every((item) => item.completedAt), true);
    const activationEvents = await prisma.productEvent.findMany({
      where: { companyId: companyA.id, eventName: { startsWith: "activation." } },
      orderBy: { eventName: "asc" },
    });
    assert.equal(activationEvents.length, 6);
    assert.deepEqual(
      activationEvents.map((event) => event.eventName),
      [
        "activation.budget.completed",
        "activation.client.completed",
        "activation.company.completed",
        "activation.completed",
        "activation.document.completed",
        "activation.time_to_first_value",
      ],
    );
    const firstValue = activationEvents.find((event) => event.eventName === "activation.time_to_first_value");
    const firstValueProperties = firstValue?.properties as { measurementVersion?: string; milestone?: string; minutes?: number; withinSevenDays?: boolean } | null;
    assert(firstValueProperties);
    assert(["client", "budget", "document"].includes(firstValueProperties.milestone ?? ""));
    assert.equal(typeof firstValueProperties.minutes, "number");
    assert((firstValueProperties.minutes ?? -1) >= 0);
    assert.equal(firstValueProperties.withinSevenDays, true);
    assert.equal(firstValueProperties.measurementVersion, "addendum-a1-v1");
    await getAndMeasureActivationStatus(prisma, { companyId: companyA.id, actorId: userA.id });
    assert.equal(await prisma.productEvent.count({ where: { companyId: companyA.id, eventName: { startsWith: "activation." } } }), 6);
    const events = await prisma.productEvent.findMany({ where: { companyId: companyA.id } });
    assert.doesNotMatch(JSON.stringify(events), new RegExp(userA.id));
  });

  await check("tenant B remains unchanged by F7 workflows", async () => {
    assert.equal(await prisma.companyImportBatch.count({ where: { companyId: companyB.id } }), 0);
    assert.equal(await prisma.companyExperiencePreference.count({ where: { companyId: companyB.id } }), 0);
    assert.equal(await prisma.productEvent.count({ where: { companyId: companyB.id } }), 0);
  });
  console.log(JSON.stringify({ ok: true, passed, migrations: migrations[0]?.count, companies: 2, imports: { clients: true, contacts: true, works: true, tasks: true, followUps: true, suppliers: true, subcontractors: true, financialAccounts: true, internalNotes: true, documents: true, rollback: true, tenantReferences: true }, activationEvents: 6, supportSanitized: true, externalCalls: 0, productionWrites: 0 }, null, 2));
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exitCode = 1; });
