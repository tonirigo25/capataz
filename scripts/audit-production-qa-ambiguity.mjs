import { PrismaClient } from "@prisma/client";
import { assertProductionTarget } from "./production-fixture-cleanup-guards.mjs";

const CLIENT_ID = "cmrhkz1jv0000vdd0tdyuykem";
const WORK_ID = "cmrhkz1xc0002vdd01gjz7kni";
const QA_SUFFIX = "7be843e2";
const STRONG_MARKERS = [QA_SUFFIX, `F-${QA_SUFFIX}`, `Q-${QA_SUFFIX}`, "Factura QA", "Presupuesto QA"];

function quoteIdent(name) { return `"${name.replaceAll('"', '""')}"`; }
function stable(value) { return JSON.stringify(value, (_, item) => item instanceof Date ? item.toISOString() : item); }
function flatten(value, path = "", out = []) {
  if (typeof value === "string") out.push({ path, value });
  else if (Array.isArray(value)) value.forEach((item, index) => flatten(item, `${path}[${index}]`, out));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => flatten(item, path ? `${path}.${key}` : key, out));
  return out;
}
function qaEvidence(strings) {
  return strings.filter(({ value }) => STRONG_MARKERS.some((marker) => value.includes(marker)) || /^(QA |Obra QA|Presupuesto QA|Factura QA)/.test(value));
}
function productionUrl() {
  const raw = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL_MISSING");
  if (!/(?:railway|rlwy)/i.test(new URL(raw).hostname)) throw new Error("AUDIT_REQUIRES_RAILWAY_DATABASE");
  assertProductionTarget(process.env);
  return raw;
}
async function schema(prisma) {
  const tables = await prisma.$queryRawUnsafe(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY table_name`);
  const columns = await prisma.$queryRawUnsafe(`SELECT table_name AS "table", column_name AS "column" FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position`);
  const pks = await prisma.$queryRawUnsafe(`SELECT tc.table_name AS "table", kcu.column_name AS "column" FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema WHERE tc.table_schema='public' AND tc.constraint_type='PRIMARY KEY' ORDER BY tc.table_name,kcu.ordinal_position`);
  const result = new Map(tables.map(({ name }) => [name, { name, columns: [], pk: [] }]));
  for (const item of columns) result.get(item.table)?.columns.push(item.column);
  for (const item of pks) result.get(item.table)?.pk.push(item.column);
  for (const table of result.values()) if (!table.pk.length && table.columns.includes("id")) table.pk = ["id"];
  return [...result.values()].filter((table) => table.pk.length);
}
function compact(table, row, matches) {
  const values = {};
  for (const key of ["id", "companyId", "createdAt", "updatedAt", "nombre", "tipo", "origen", "titulo", "tipoTrabajo", "codigo", "numeroInterno", "numero", "concepto", "title", "fingerprint", "signalFingerprint", "recommendationFingerprint", "idempotencyKey", "correlationId", "conversationId", "messageId", "taskId", "followUpId", "automationRunId", "clientId", "clienteId", "workId", "obraId", "budgetId", "invoiceId", "entityId"]) if (row[key] != null) values[key] = row[key];
  return { table, id: String(row.id ?? ""), values, matchingPaths: matches.map(({ path }) => path).sort(), qaEvidence: qaEvidence(matches).map(({ path, value }) => ({ path, value: value.length > 160 ? `${value.slice(0, 160)}…` : value })).slice(0, 20) };
}
async function main() {
  const prisma = new PrismaClient({ log: [], datasources: { db: { url: productionUrl() } } });
  try {
    const tables = await schema(prisma);
    const rows = [];
    for (const table of tables) {
      const result = await prisma.$queryRawUnsafe(`SELECT row_to_json(candidate) AS row FROM ${quoteIdent(table.name)} candidate`);
      for (const item of result) rows.push({ table: table.name, row: item.row });
    }
    const parentIds = new Set([CLIENT_ID, WORK_ID]);
    const matched = [];
    for (const item of rows) {
      const strings = flatten(item.row);
      const matches = strings.filter(({ value }) => parentIds.has(value) || value.includes(CLIENT_ID) || value.includes(WORK_ID));
      if (!matches.length) continue;
      const parentRow = item.table === "Client" && item.row.id === CLIENT_ID || item.table === "Work" && item.row.id === WORK_ID;
      const evidence = qaEvidence(strings);
      const classification = evidence.length ? "QA_CONFIRMADO" : parentRow ? "AMBIGUO" : "AMBIGUO";
      matched.push({ ...compact(item.table, item.row, matches), classification, parentRow, _strings: strings });
    }
    const qaTraceTokens = new Set(matched.filter((item) => item.classification === "QA_CONFIRMADO").flatMap((item) => item._strings.filter(({ path, value }) => /fingerprint|idempotency|correlation|request/i.test(path) && value.length >= 8).map(({ value }) => value)));
    for (const item of matched) {
      if (item.classification !== "AMBIGUO") continue;
      if (item._strings.some(({ value }) => [...qaTraceTokens].some((token) => value.includes(token)))) item.classification = "QA_CONFIRMADO";
    }
    for (const item of matched) item._strings = undefined;
    const parentRows = matched.filter((item) => item.parentRow);
    const related = matched.filter((item) => !item.parentRow);
    const nonQaRelated = related.filter((item) => item.classification !== "QA_CONFIRMADO");
    const allParentRefs = related.filter((item) => item.matchingPaths.some((path) => path !== "id"));
    const output = {
      mode: "read-only-qa-ambiguity-audit",
      target: "railway-production",
      qaSuffix: QA_SUFFIX,
      parentIds: { clientId: CLIENT_ID, workId: WORK_ID },
      parentRows,
      relatedRows: related.sort((a, b) => `${a.table}:${a.id}`.localeCompare(`${b.table}:${b.id}`)),
      countsByTable: Object.fromEntries(Object.entries(Object.groupBy(allParentRefs, (row) => row.table)).map(([table, values]) => [table, values.length])),
      nonQaRelated,
      classification: { qaConfirmed: related.filter((item) => item.classification === "QA_CONFIRMADO").length, realConfirmed: 0, ambiguous: nonQaRelated.length },
      dateOnlySelectorUsed: false,
      safeToDeleteParents: parentRows.length === 2 && nonQaRelated.length === 0,
      conclusion: nonQaRelated.length === 0 ? "QA_PARENTS_CONFIRMED" : "AMBIGUOUS_EXTERNAL_REFERENCES_REMAIN",
    };
    console.log(JSON.stringify(output, null, 2));
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "QA_AMBIGUITY_AUDIT_FAILED"); process.exitCode = 1; });
