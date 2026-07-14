import { PrismaClient, type Prisma } from "@prisma/client";

const SOURCE_EMPRESA_ID = "empresa-demo";
const APPROVAL = "CREATE-ONE-LEGACY-COMPANY-empresa-demo";
const EXPECTED_OPERATIONAL_NULLS = 240;
const EXCLUDED_TASK_ID = "cmrhm95u80004vd84gufttv29";
const executeRequested = process.argv.includes("--execute");
const operationalTables = [
  "Client", "Contact", "Work", "Budget", "Invoice", "Payment", "Expense", "Material", "Document",
  "InternalNote", "Reminder", "EventoAgenda", "Notification", "FinancialAccount", "CashMovement",
  "RecurringExpense", "ExpectedCashFlow", "ChatConversation", "BusinessSignalState", "BusinessRecommendation",
  "AutomationDefinition", "AutomationRun", "Task", "FollowUp",
] as const;

const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ log: [], datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined });
type CountRow = { count: bigint | number };

function assertProductionTarget() {
  const expected = {
    RAILWAY_PROJECT_ID: "ca7ec244-e961-42dc-8573-23835e6db5f5",
    RAILWAY_ENVIRONMENT_ID: "42c14ac1-e933-485b-9b44-01272af389e0",
    RAILWAY_SERVICE_ID: "0f485ee7-0ab3-430d-9abd-791b8e3e2907",
    RAILWAY_ENVIRONMENT_NAME: "production",
    RAILWAY_SERVICE_NAME: "Postgres",
  };
  for (const [name, value] of Object.entries(expected)) {
    if (process.env[name] !== value) throw new Error(`PRODUCTION_TARGET_MISMATCH:${name}`);
  }
  if (!databaseUrl || !/(?:railway|rlwy)/i.test(new URL(databaseUrl).hostname)) {
    throw new Error("COMPANY_CREATION_REQUIRES_RAILWAY_DATABASE");
  }
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function normalizedSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

async function count(client: any, table: string, where = "") {
  const rows = await client.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(table)}${where ? ` WHERE ${where}` : ""}`,
  ) as CountRow[];
  return Number(rows[0]?.count ?? 0);
}

async function operationalNulls(client: any) {
  const byTable = Object.fromEntries(await Promise.all(operationalTables.map(async (table) => [
    table,
    await count(client, table, '"companyId" IS NULL'),
  ]))) as Record<string, number>;
  return { byTable, total: Object.values(byTable).reduce((sum, value) => sum + value, 0) };
}

function deriveIsDemo(operationalRows: number, businessName: string) {
  return operationalRows === 0 && /(^|[^a-z])(demo|test|prueba)([^a-z]|$)/i.test(businessName);
}

async function publicTableNames(client: any) {
  const rows = await client.$queryRawUnsafe(`
    SELECT table_name AS name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `) as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

async function allTableCounts(client: any) {
  const names = await publicTableNames(client);
  return Object.fromEntries(await Promise.all(names.map(async (table) => [table, await count(client, table)])));
}

async function fingerprintCount(client: any) {
  let total = 0;
  for (const table of await publicTableNames(client)) {
    const rows = await client.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(table)} candidate
       WHERE row_to_json(candidate)::text ILIKE $1 OR row_to_json(candidate)::text ILIKE $2`,
      "%4a33f773%",
      "%7a3b51a7%",
    ) as CountRow[];
    total += Number(rows[0]?.count ?? 0);
  }
  return total;
}

function companyValuesMatch(company: Record<string, unknown>, expected: Record<string, unknown>) {
  return Object.entries(expected).every(([field, value]) => company[field] === value);
}

function assertOnlyCompanyCountChanged(before: Record<string, number>, after: Record<string, number>, created: boolean) {
  for (const [table, countBefore] of Object.entries(before)) {
    const expected = table === "Company" && created ? countBefore + 1 : countBefore;
    if (after[table] !== expected) throw new Error(`UNAUTHORIZED_TABLE_COUNT_CHANGE:${table}:${countBefore}:${after[table]}`);
  }
}

async function main() {
  assertProductionTarget();
  const empresas = await prisma.empresa.findMany({ orderBy: { createdAt: "asc" }, take: 2 });
  if (empresas.length !== 1) throw new Error(`EMPRESA_COUNT_MISMATCH:${empresas.length}`);
  const empresa = empresas[0];
  if (empresa.id !== SOURCE_EMPRESA_ID) throw new Error(`EMPRESA_ID_MISMATCH:${empresa.id}`);

  const slug = normalizedSlug(empresa.nombreComercial);
  if (!slug) throw new Error("COMPANY_SLUG_EMPTY");
  const currentCompanies = await prisma.company.findMany({ orderBy: { createdAt: "asc" }, take: 2 });
  const linkedCompany = currentCompanies.find((company) => company.legacyEmpresaId === SOURCE_EMPRESA_ID) ?? null;
  if (currentCompanies.length > 1 || (currentCompanies.length === 1 && !linkedCompany)) {
    throw new Error(`COMPANY_STATE_AMBIGUOUS:${currentCompanies.length}`);
  }

  const nulls = await operationalNulls(prisma);
  if (nulls.total !== EXPECTED_OPERATIONAL_NULLS) throw new Error(`OPERATIONAL_NULL_COUNT_MISMATCH:${nulls.total}`);
  const slugConflicts = await prisma.company.count({ where: { slug, ...(linkedCompany ? { id: { not: linkedCompany.id } } : {}) } });
  if (slugConflicts !== 0) throw new Error(`COMPANY_SLUG_CONFLICT:${slugConflicts}`);
  const taxId = empresa.nifCif?.trim() || null;
  const taxIdConflicts = taxId
    ? await prisma.company.count({ where: { taxId, ...(linkedCompany ? { id: { not: linkedCompany.id } } : {}) } })
    : 0;
  if (taxIdConflicts !== 0) throw new Error(`COMPANY_TAX_ID_CONFLICT:${taxIdConflicts}`);
  const taskBefore = await prisma.task.findUnique({ where: { id: EXCLUDED_TASK_ID } });
  if (!taskBefore) throw new Error("EXCLUDED_TASK_MISSING");
  const fingerprintsBefore = await fingerprintCount(prisma);

  const isDemo = deriveIsDemo(nulls.total, empresa.nombreComercial);
  const companyData = {
    slug,
    nombreComercial: empresa.nombreComercial,
    razonSocial: empresa.razonSocial,
    taxId,
    email: empresa.email,
    telefono: empresa.telefono,
    direccion: empresa.direccionFiscal,
    codigoPostal: empresa.codigoPostal,
    ciudad: empresa.ciudad ?? empresa.municipio,
    provincia: empresa.provincia,
    pais: empresa.pais?.trim() || "España",
    timezone: "Europe/Madrid",
    locale: "es-ES",
    status: "active" as const,
    isDemo,
    legacyEmpresaId: empresa.id,
    web: empresa.web,
    contactPerson: empresa.personaContacto,
    iban: empresa.iban,
    defaultConditions: empresa.condicionesPorDefecto,
    legalText: empresa.textoLegal,
    logoUrl: empresa.logoUrl,
    sealUrl: empresa.selloUrl,
    brandColor: empresa.colorMarca,
    defaultVat: empresa.ivaDefecto,
    currency: empresa.moneda,
    budgetValidityDays: empresa.validezPresupuestoDias,
    defaultPaymentTerms: empresa.formaPagoDefecto,
    budgetSeries: empresa.seriePresupuestos,
    invoiceSeries: empresa.serieFacturas,
    workSeries: empresa.serieObras,
    budgetPrefix: empresa.prefijoPresupuesto,
    invoicePrefix: empresa.prefijoFactura,
    workPrefix: empresa.prefijoObra,
  } satisfies Prisma.CompanyCreateInput;
  if (linkedCompany && !companyValuesMatch(linkedCompany as unknown as Record<string, unknown>, companyData)) {
    throw new Error("LINKED_COMPANY_FIELDS_MISMATCH");
  }

  const copiedFields = Object.entries(companyData).filter(([, value]) => value != null).map(([field]) => field);
  const nullFields = Object.entries(companyData).filter(([, value]) => value == null).map(([field]) => field);
  if (fingerprintsBefore !== 0) {
    console.log(JSON.stringify({
      ok: false,
      mode: "dry-run-blocked",
      blocker: `FIXTURE_FINGERPRINTS_PRESENT:${fingerprintsBefore}`,
      empresa: { id: empresa.id, nombreComercial: empresa.nombreComercial },
      companyBefore: currentCompanies.length,
      linkedCompanyBefore: linkedCompany ? 1 : 0,
      proposal: {
        companyId: null,
        slug,
        legacyEmpresaId: empresa.id,
        timezone: companyData.timezone,
        locale: companyData.locale,
        status: companyData.status,
        isDemo,
        isDemoReason: isDemo ? "empty operational dataset and explicit placeholder business name" : "240 operational rows exist; the source ID alone does not imply demo data",
        copiedFields,
        nullFields,
      },
      slugConflicts,
      taxIdConflicts,
      operationalNullsBefore: nulls,
      fingerprintsBefore,
      excludedTaskPresent: true,
      execution: { requested: executeRequested, performed: false, created: 0, noOp: false },
    }, null, 2));
    throw new Error(`FIXTURE_FINGERPRINTS_PRESENT:${fingerprintsBefore}`);
  }
  let execution = { requested: executeRequested, performed: false, created: 0, noOp: Boolean(linkedCompany) };
  let company = linkedCompany;

  if (executeRequested) {
    if (process.env.CAPATAZ_LEGACY_COMPANY_CREATE_APPROVAL !== APPROVAL) {
      throw new Error("EXPLICIT_COMPANY_CREATION_APPROVAL_MISSING");
    }
    if (!linkedCompany) {
      company = await prisma.$transaction(async (tx) => {
        const countsBefore = await allTableCounts(tx);
        if (await tx.empresa.count() !== 1 || await tx.company.count() !== 0) throw new Error("COMPANY_CONCURRENT_STATE_CHANGE");
        if ((await operationalNulls(tx)).total !== EXPECTED_OPERATIONAL_NULLS) throw new Error("OPERATIONAL_NULLS_CONCURRENT_CHANGE");
        if (await tx.company.count({ where: { slug } }) !== 0) throw new Error("COMPANY_SLUG_CONCURRENT_CONFLICT");
        const created = await tx.company.create({ data: companyData });
        const verified = await tx.company.findUnique({ where: { id: created.id } });
        if (!verified || !companyValuesMatch(verified as unknown as Record<string, unknown>, companyData)) {
          throw new Error("CREATED_COMPANY_FIELDS_MISMATCH");
        }
        if (await tx.company.count() !== 1 || await tx.empresa.count() !== 1) throw new Error("COMPANY_POST_COUNT_MISMATCH");
        if ((await operationalNulls(tx)).total !== EXPECTED_OPERATIONAL_NULLS) throw new Error("OPERATIONAL_NULLS_CHANGED");
        if (await fingerprintCount(tx) !== 0) throw new Error("FIXTURE_FINGERPRINTS_REAPPEARED");
        const taskAfter = await tx.task.findUnique({ where: { id: EXCLUDED_TASK_ID } });
        if (!taskAfter || JSON.stringify(taskAfter) !== JSON.stringify(taskBefore)) throw new Error("EXCLUDED_TASK_CHANGED");
        const countsAfter = await allTableCounts(tx);
        assertOnlyCompanyCountChanged(countsBefore, countsAfter, true);
        return created;
      }, { isolationLevel: "Serializable", timeout: 120_000 });
      execution = { requested: true, performed: true, created: 1, noOp: false };
    } else {
      const countsBefore = await allTableCounts(prisma);
      const countsAfter = await allTableCounts(prisma);
      assertOnlyCompanyCountChanged(countsBefore, countsAfter, false);
      execution = { requested: true, performed: false, created: 0, noOp: true };
    }
  }

  const companyCountAfter = await prisma.company.count();
  const empresaCountAfter = await prisma.empresa.count();
  const nullsAfter = await operationalNulls(prisma);
  const fingerprintsAfter = await fingerprintCount(prisma);
  const taskAfter = await prisma.task.findUnique({ where: { id: EXCLUDED_TASK_ID } });
  if (executeRequested && (companyCountAfter !== 1 || empresaCountAfter !== 1 || nullsAfter.total !== EXPECTED_OPERATIONAL_NULLS || fingerprintsAfter !== 0 || !taskAfter)) {
    throw new Error("POST_EXECUTION_RECONCILIATION_FAILED");
  }

  console.log(JSON.stringify({
    ok: true,
    mode: executeRequested ? "controlled-create" : "dry-run",
    empresa: { id: empresa.id, nombreComercial: empresa.nombreComercial },
    companyBefore: currentCompanies.length,
    linkedCompanyBefore: linkedCompany ? 1 : 0,
    proposal: {
      companyId: company?.id ?? null,
      slug,
      legacyEmpresaId: empresa.id,
      timezone: companyData.timezone,
      locale: companyData.locale,
      status: companyData.status,
      isDemo,
      isDemoReason: isDemo ? "empty operational dataset and explicit placeholder business name" : "240 real operational rows exist; the source ID alone does not imply demo data",
      copiedFields,
      nullFields,
    },
    slugConflicts,
    taxIdConflicts,
    operationalNullsBefore: nulls,
    fingerprintsBefore,
    excludedTaskPresent: Boolean(taskAfter),
    companyAfter: companyCountAfter,
    empresaAfter: empresaCountAfter,
    operationalNullsAfter: nullsAfter,
    fingerprintsAfter,
    execution,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "LEGACY_COMPANY_CREATION_FAILED");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
