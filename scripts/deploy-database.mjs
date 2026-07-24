import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const migration = "20260712210000_company_numbering_and_settings";
const prismaCli = join(process.cwd(), "node_modules", "prisma", "build", "index.js");

function run(args, { allowFailure = false } = {}) {
  const result = spawnSync(process.execPath, [prismaCli, ...args.slice(1)], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (!allowFailure && result.status !== 0) {
    throw new Error(`${args.join(" ")} failed with code ${result.status ?? "unknown"}`);
  }

  return result;
}

const tables = [
  "Client",
  "Contact",
  "Work",
  "Budget",
  "Invoice",
  "Payment",
  "Expense",
  "Material",
  "Document",
  "InternalNote",
  "Reminder",
  "EventoAgenda",
  "Notification",
  "FinancialAccount",
  "CashMovement",
  "RecurringExpense",
  "ExpectedCashFlow",
  "ChatConversation",
  "BusinessSignalState",
  "BusinessRecommendation",
  "AutomationDefinition",
  "AutomationRun",
  "Task",
  "FollowUp",
];

async function countNulls(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "companyId" IS NULL`,
  );
  return Number(rows[0]?.count ?? 0);
}

async function backfillLegacyCompany() {
  const legacyCompanies = await prisma.empresa.findMany({ orderBy: { createdAt: "asc" }, take: 2 });
  if (legacyCompanies.length > 1) {
    throw new Error("LEGACY_COMPANY_AMBIGUOUS");
  }
  const legacy = legacyCompanies[0] ?? null;
  const nullCounts = await Promise.all(tables.map((table) => countNulls(table)));
  const pendingRows = nullCounts.reduce((sum, value) => sum + value, 0);

  if (!legacy && pendingRows > 0) {
    throw new Error("LEGACY_COMPANY_REQUIRED_FOR_EXISTING_DATA");
  }

  if (!legacy) {
    console.log("[db:deploy] No legacy company or pending operational rows; backfill skipped.");
    return;
  }

  const company = await prisma.company.upsert({
    // Keep recovery compatible with a database whose later additive columns
    // have not been migrated yet. Prisma otherwise returns every current field.
    select: { id: true },
    where: { legacyEmpresaId: legacy.id },
    update: {
      nombreComercial: legacy.nombreComercial,
      razonSocial: legacy.razonSocial,
      taxId: legacy.nifCif,
      email: legacy.email,
      telefono: legacy.telefono,
      direccion: legacy.direccionFiscal,
      codigoPostal: legacy.codigoPostal,
      ciudad: legacy.ciudad ?? legacy.municipio,
      provincia: legacy.provincia,
      pais: legacy.pais,
      web: legacy.web,
      contactPerson: legacy.personaContacto,
      iban: legacy.iban,
      defaultConditions: legacy.condicionesPorDefecto,
      legalText: legacy.textoLegal,
      logoUrl: legacy.logoUrl,
      sealUrl: legacy.selloUrl,
      brandColor: legacy.colorMarca,
      defaultVat: legacy.ivaDefecto,
      currency: legacy.moneda,
      budgetValidityDays: legacy.validezPresupuestoDias,
      defaultPaymentTerms: legacy.formaPagoDefecto,
      budgetSeries: legacy.seriePresupuestos,
      invoiceSeries: legacy.serieFacturas,
      workSeries: legacy.serieObras,
      budgetPrefix: legacy.prefijoPresupuesto,
      invoicePrefix: legacy.prefijoFactura,
      workPrefix: legacy.prefijoObra,
    },
    create: {
      slug: `legacy-${legacy.id.toLowerCase()}`,
      nombreComercial: legacy.nombreComercial,
      razonSocial: legacy.razonSocial,
      taxId: legacy.nifCif,
      email: legacy.email,
      telefono: legacy.telefono,
      direccion: legacy.direccionFiscal,
      codigoPostal: legacy.codigoPostal,
      ciudad: legacy.ciudad ?? legacy.municipio,
      provincia: legacy.provincia,
      pais: legacy.pais,
      legacyEmpresaId: legacy.id,
      web: legacy.web,
      contactPerson: legacy.personaContacto,
      iban: legacy.iban,
      defaultConditions: legacy.condicionesPorDefecto,
      legalText: legacy.textoLegal,
      logoUrl: legacy.logoUrl,
      sealUrl: legacy.selloUrl,
      brandColor: legacy.colorMarca,
      defaultVat: legacy.ivaDefecto,
      currency: legacy.moneda,
      budgetValidityDays: legacy.validezPresupuestoDias,
      defaultPaymentTerms: legacy.formaPagoDefecto,
      budgetSeries: legacy.seriePresupuestos,
      invoiceSeries: legacy.serieFacturas,
      workSeries: legacy.serieObras,
      budgetPrefix: legacy.prefijoPresupuesto,
      invoicePrefix: legacy.prefijoFactura,
      workPrefix: legacy.prefijoObra,
    },
  });

  await prisma.$transaction(
    async (tx) => {
      for (const table of tables) {
        await tx.$executeRawUnsafe(
          `UPDATE "${table}" SET "companyId" = $1 WHERE "companyId" IS NULL`,
          company.id,
        );
      }
      await tx.treasurySettings.updateMany({
        where: { companyId: null },
        data: { companyId: company.id },
      });
    },
    { timeout: 120_000 },
  );

  const remaining = await Promise.all(tables.map((table) => countNulls(table)));
  if (remaining.some((value) => value !== 0)) {
    throw new Error("LEGACY_BACKFILL_RECONCILIATION_FAILED");
  }

  console.log(`[db:deploy] Legacy company backfill completed for ${company.id}.`);
}

async function failedMigrations() {
  return prisma.$queryRaw`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE finished_at IS NULL AND rolled_back_at IS NULL
    ORDER BY started_at ASC
  `;
}

async function main() {
  const firstDeploy = run(["prisma", "migrate", "deploy"], { allowFailure: true });
  if (firstDeploy.status === 0) return;

  const output = `${firstDeploy.stdout ?? ""}\n${firstDeploy.stderr ?? ""}`;
  const failures = await failedMigrations();
  const onlyExpectedMigrationFailed =
    failures.length === 1 && failures[0]?.migration_name === migration;
  const initialBackfillFailure =
    output.includes("P3018") &&
    output.includes(migration) &&
    output.includes("company numbering migration requires completed companyId backfill");
  const blockedByRecordedFailure = output.includes("P3009") && onlyExpectedMigrationFailed;
  const recoverable = onlyExpectedMigrationFailed && (initialBackfillFailure || blockedByRecordedFailure);

  if (!recoverable) {
    process.exitCode = firstDeploy.status ?? 1;
    return;
  }

  console.warn(`[db:deploy] Recovering failed migration ${migration}.`);
  await backfillLegacyCompany();
  run(["prisma", "migrate", "resolve", "--rolled-back", migration]);
  run(["prisma", "migrate", "deploy"]);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
