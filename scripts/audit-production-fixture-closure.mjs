import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertProductionTarget, EXCLUDED_REAL_TASK_ID } from "./production-fixture-cleanup-guards.mjs";

const BACKUP_SHA256 = "99430534df8d51dc28022f57adea4915ee7800cadd3eb18831eacaf151d8c9a7";
const BACKUP_MANIFEST_SHA256 = "2e245d34ca11f4fc23ee665594ca4178bdc048edae496fa4e0973325ac5eb881";
const PROVISIONAL_IDS = new Set([
  "cmrjjtdha01c0ml0pymwqg02u", "cmrjjtdhm01c1ml0pqzw68bo7",
  "cmrjjtdqo01ceml0p2jq147u2", "cmrjjtdr801chml0pov3igtwc",
  "cmrjjtdio01c4ml0pg5aiqnvj", "cmrjjtdio01c5ml0pbhpykyio",
  "cmrjjtdsv01ctml0pyz3qqbat", "cmrjjtdsv01cuml0pselcd8vh",
  "cmrhkz1jv0000vdd0tdyuykem", "cmrhkz1xc0002vdd01gjz7kni",
]);
const STRONG_MARKERS = [
  "4a33f773", "7a3b51a7", "7be843e2", "Q-4a33f773", "F-4a33f773",
  "qa-chat-query-4a33f773", "qa-chat-create-4a33f773", "contract-7a3b51a7",
];
const TRACE_NAMES = /(?:fingerprint|idempotency|correlation|causation|request|changehash|sourcekey|recommendationid|signalid)/i;
const ID_NAME = /(?:^id$|id$|^id|entity|reference|parent|task|client|work|obra|budget|invoice|factura|followup|conversation|message|automation|event|run|user|company|account)/i;
const SHARED_PARENT_NAME = /(?:companyid|userid|createdbyid|updatedbyid|accountid)/i;
const OPERATIONAL_TABLES = new Set([
  "Client", "Contact", "Work", "Budget", "Invoice", "Payment", "Expense", "Material", "Document",
  "InternalNote", "Reminder", "EventoAgenda", "Notification", "FinancialAccount", "CashMovement",
  "RecurringExpense", "ExpectedCashFlow", "ChatConversation", "BusinessSignalState", "BusinessRecommendation",
  "AutomationDefinition", "AutomationRun", "Task", "FollowUp",
]);

function quoteIdent(name) { return `"${name.replaceAll('"', '""')}"`; }
function canonical(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}
function stableStringify(value) { return JSON.stringify(canonical(value)); }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function scalarStrings(value, path = "", out = []) {
  if (typeof value === "string") out.push({ path, value });
  else if (Array.isArray(value)) value.forEach((item, index) => scalarStrings(item, `${path}[${index}]`, out));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => scalarStrings(item, path ? `${path}.${key}` : key, out));
  return out;
}
function looksLikeId(value) { return /^(cm[a-z0-9]{12,}|[0-9a-f]{8}-[0-9a-f-]{20,})$/i.test(value); }
function isStrongTraceValue(value) {
  return value.length >= 8 && (looksLikeId(value) || /[^A-Za-z_]/.test(value) || /(?:qa|contract|4a33|7a3b)/i.test(value));
}
function safeDate(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? value : undefined; }
function rowKey(table, row, primaryKey) {
  const values = primaryKey.map((field) => `${field}=${String(row[field] ?? "")}`);
  return `${table}:${values.join("|")}`;
}
function tableId(table, row) { return row.id == null ? rowKey(table, row, ["id"]) : String(row.id); }
function markerMatch(text, tokens) {
  for (const token of tokens) if (token && text.includes(token)) return token;
  return undefined;
}
function traceTokens(row) {
  return scalarStrings(row).filter(({ path, value }) => TRACE_NAMES.test(path) && isStrongTraceValue(value)).map(({ value }) => value);
}
function parsePrismaModels(source) {
  const models = [];
  for (const match of source.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    const fields = [];
    for (const line of match[2].split(/\r?\n/)) {
      const field = line.trim().match(/^(\w+)\s+(\w+)(?:\[\])?/);
      if (field && !line.trim().startsWith("@@")) fields.push({ name: field[1], type: field[2], json: field[2] === "Json", string: field[2] === "String" });
    }
    models.push({ name: match[1], fields });
  }
  return models.sort((a, b) => a.name.localeCompare(b.name));
}

function productionUrl() {
  const raw = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL_MISSING");
  const parsed = new URL(raw);
  if (!/(?:railway|rlwy)/i.test(parsed.hostname)) throw new Error("AUDIT_REQUIRES_RAILWAY_DATABASE");
  assertProductionTarget(process.env);
  return raw;
}

async function loadSchema(prisma) {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name AS name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `);
  const columns = await prisma.$queryRawUnsafe(`
    SELECT table_name AS "table", column_name AS "column", data_type AS "type", udt_name AS "udt"
    FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position
  `);
  const primaryKeys = await prisma.$queryRawUnsafe(`
    SELECT tc.table_name AS "table", kcu.column_name AS "column", kcu.ordinal_position AS "position"
    FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
    WHERE tc.table_schema='public' AND tc.constraint_type='PRIMARY KEY' ORDER BY tc.table_name,kcu.ordinal_position
  `);
  const foreignKeys = await prisma.$queryRawUnsafe(`
    SELECT tc.table_name AS "sourceTable", kcu.column_name AS "sourceColumn",
      ccu.table_name AS "targetTable", ccu.column_name AS "targetColumn", kcu.ordinal_position AS "position"
    FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
    WHERE tc.table_schema='public' AND tc.constraint_type='FOREIGN KEY'
    ORDER BY tc.table_name,kcu.column_name
  `);
  const byTable = new Map(tables.map(({ name }) => [name, { name, columns: [], primaryKey: [], foreignKeys: [] }]));
  for (const column of columns) byTable.get(column.table)?.columns.push(column);
  for (const key of primaryKeys) byTable.get(key.table)?.primaryKey.push(key.column);
  for (const key of foreignKeys) byTable.get(key.sourceTable)?.foreignKeys.push(key);
  for (const table of byTable.values()) if (!table.primaryKey.length && table.columns.some((column) => column.column === "id")) table.primaryKey = ["id"];
  return { tables: [...byTable.values()], foreignKeys };
}

async function loadRows(prisma, schema) {
  const all = [];
  for (const table of schema.tables) {
    if (!table.primaryKey.length) continue;
    const order = table.columns.some((column) => column.column === "id") ? ` ORDER BY ${quoteIdent("id")}` : "";
    const result = await prisma.$queryRawUnsafe(`SELECT row_to_json(candidate) AS row FROM ${quoteIdent(table.name)} candidate${order}`);
    for (const item of result) all.push({ table: table.name, row: item.row, key: rowKey(table.name, item.row, table.primaryKey), id: tableId(table.name, item.row) });
  }
  return all.sort((a, b) => `${a.table}:${a.id}`.localeCompare(`${b.table}:${b.id}`));
}

function readBackup() {
  const dir = resolve(process.cwd(), ".codex-backup", "production-fixture-backups");
  const files = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith(".json")) : [];
  const matching = files.filter((file) => file.includes(BACKUP_MANIFEST_SHA256));
  if (matching.length !== 1) throw new Error(`FIXTURE_BACKUP_COUNT_MISMATCH:${matching.length}`);
  const path = resolve(dir, matching[0]);
  const raw = readFileSync(path);
  if (sha256(raw) !== BACKUP_SHA256) throw new Error("FIXTURE_BACKUP_SHA256_MISMATCH");
  const backup = JSON.parse(raw.toString("utf8"));
  if (backup.manifestSha256 !== BACKUP_MANIFEST_SHA256 || backup.expectedRows !== 252) throw new Error("FIXTURE_BACKUP_MANIFEST_MISMATCH");
  const historical = [];
  for (const [table, rows] of Object.entries(backup.tables ?? {})) for (const row of rows) historical.push({ table, row });
  if (historical.length !== 252 || new Set(historical.map(({ row }) => row.id)).size !== 252) throw new Error("FIXTURE_BACKUP_ROW_COUNT_MISMATCH");
  return { path, backup, historical };
}

function buildSeeds(backup) {
  const historicalIds = new Set(backup.historical.map(({ row }) => String(row.id)));
  const tokens = new Set([...historicalIds, ...PROVISIONAL_IDS, ...STRONG_MARKERS]);
  for (const { row } of backup.historical) {
    for (const { path, value } of scalarStrings(row)) {
      const strong = STRONG_MARKERS.some((marker) => value.includes(marker)) || /^(QA |Obra QA |Task QA |Subtarea QA|FollowUp QA|Dependencia QA|revisar QA|Presupuesto QA|Factura QA|Publicada )/.test(value);
      if (strong && value.length <= 512) tokens.add(value);
      if (TRACE_NAMES.test(path) && isStrongTraceValue(value) && value.length <= 512) tokens.add(value);
    }
  }
  const externalIds = new Set();
  for (const { row } of backup.historical) for (const { value } of scalarStrings(row)) if (looksLikeId(value) && !historicalIds.has(value)) externalIds.add(value);
  return { historicalIds, tokens, externalIds };
}

function compactRecord(node, reasons) {
  const row = node.row;
  const values = {};
  for (const field of ["id", "companyId", "createdAt", "updatedAt", "fingerprint", "signalFingerprint", "recommendationFingerprint", "idempotencyKey", "lastIdempotencyKey", "correlationId", "causationId", "requestId", "sourceKey", "runId", "actionId", "entityId", "clientId", "workId", "budgetId", "invoiceId", "taskId", "followUpId", "conversationId", "messageId", "automationDefinitionId", "automationRunId", "parentTaskId", "signalId", "recommendationId", "name", "title", "numero", "numeroInterno", "codigo"]) {
    if (row[field] != null) values[field] = safeDate(row[field]) ?? row[field];
  }
  return { table: node.table, id: node.id, values, reasons: [...reasons].sort() };
}

async function main() {
  const databaseUrl = productionUrl();
  const backup = readBackup();
  const prisma = new PrismaClient({ log: [], datasources: { db: { url: databaseUrl } } });
  try {
    const schema = await loadSchema(prisma);
    const rows = await loadRows(prisma, schema);
    const prismaSchemaPath = resolve(process.cwd(), "prisma", "schema.prisma");
    const prismaSchema = readFileSync(prismaSchemaPath, "utf8");
    const prismaModels = parsePrismaModels(prismaSchema);
    const seeds = buildSeeds(backup);
    const byId = new Map();
    for (const node of rows) { const list = byId.get(node.id) ?? []; list.push(node); byId.set(node.id, list); }
    const candidates = new Map();
    const reasons = new Map();
    const excludedReasons = [];
    const addCandidate = (node, reason) => {
      if (node.id === EXCLUDED_REAL_TASK_ID) { excludedReasons.push({ table: node.table, id: node.id, reason }); return false; }
      const before = candidates.has(node.key);
      candidates.set(node.key, node);
      const list = reasons.get(node.key) ?? new Set(); list.add(reason); reasons.set(node.key, list);
      return !before;
    };
    for (const node of rows) {
      const text = stableStringify(node.row);
      const token = markerMatch(text, seeds.tokens);
      if (PROVISIONAL_IDS.has(node.id)) addCandidate(node, "known_provisional_residue_id");
      else if (token) addCandidate(node, `seed_token:${token}`);
    }
    let iterations = 0;
    while (true) {
      iterations += 1;
      const tokens = new Set(seeds.tokens);
      for (const node of candidates.values()) {
        tokens.add(node.id);
        for (const value of traceTokens(node.row)) tokens.add(value);
      }
      let added = 0;
      for (const node of rows) {
        if (candidates.has(node.key) || node.id === EXCLUDED_REAL_TASK_ID) continue;
        const hit = markerMatch(stableStringify(node.row), tokens);
        if (hit) { if (addCandidate(node, `transitive_token:${hit}`)) added += 1; }
      }
      if (!added || iterations > 100) break;
    }
    const candidateTokens = new Set(seeds.tokens);
    for (const node of candidates.values()) { candidateTokens.add(node.id); for (const value of traceTokens(node.row)) candidateTokens.add(value); }
    const ambiguities = [];
    const externalReferences = [];
    const edges = [];
    for (const node of candidates.values()) {
      for (const { path, value } of scalarStrings(node.row)) {
        const token = markerMatch(value, candidateTokens);
        if (token && !value.includes(node.id)) edges.push({ from: `${node.table}:${node.id}`, path, token, direction: "incoming-or-trace" });
        if (!looksLikeId(value) || path === "id") continue;
        const targetNodes = byId.get(value) ?? [];
        if (seeds.historicalIds.has(value)) edges.push({ from: `${node.table}:${node.id}`, path, to: `DELETED_FIXTURE:${value}`, classification: "FIXTURE_CONFIRMADO" });
        else if (value === EXCLUDED_REAL_TASK_ID) edges.push({ from: `${node.table}:${node.id}`, path, to: `Task:${value}`, classification: "DATO_REAL_CONFIRMADO" });
        else if (!targetNodes.length) { externalReferences.push({ from: `${node.table}:${node.id}`, path, value, classification: "missing-target" }); }
        else for (const target of targetNodes) {
          if (candidates.has(target.key)) edges.push({ from: `${node.table}:${node.id}`, path, to: `${target.table}:${target.id}`, classification: "FIXTURE_CONFIRMADO" });
          else if (SHARED_PARENT_NAME.test(path)) edges.push({ from: `${node.table}:${node.id}`, path, to: `${target.table}:${target.id}`, classification: "DATO_REAL_CONFIRMADO_SHARED_PARENT" });
          else { const item = { from: `${node.table}:${node.id}`, path, to: `${target.table}:${target.id}`, classification: "AMBIGUO" }; ambiguities.push(item); externalReferences.push(item); }
        }
      }
    }
    for (const node of rows) {
      if (candidates.has(node.key)) continue;
      const hit = markerMatch(stableStringify(node.row), candidateTokens);
      if (!hit) continue;
      if (node.id === EXCLUDED_REAL_TASK_ID) excludedReasons.push({ table: node.table, id: node.id, reason: `contains:${hit}` });
      else ambiguities.push({ table: node.table, id: node.id, reason: `unclassified_reference:${hit}` });
    }
    const candidateList = [...candidates.values()].sort((a, b) => `${a.table}:${a.id}`.localeCompare(`${b.table}:${b.id}`));
    const counts = Object.fromEntries([...new Set(rows.map((node) => node.table))].sort().map((table) => [table, candidateList.filter((node) => node.table === table).length]).filter(([, count]) => count));
    const manifestLines = candidateList.map((node) => `${node.table}:${node.id}`).sort();
    const manifestSha256 = sha256(manifestLines.join("\n"));
    const nullRows = rows.filter((node) => node.row.companyId == null && OPERATIONAL_TABLES.has(node.table));
    const fixtureNulls = nullRows.filter((node) => candidates.has(node.key)).length;
    const reportCore = {
      mode: "read-only-transitive-closure",
      target: "railway-production",
      historicalBackup: { sha256: BACKUP_SHA256, manifestSha256: BACKUP_MANIFEST_SHA256, rows: backup.historical.length },
      schema: {
        databaseTables: schema.tables.map((table) => ({ name: table.name, columns: table.columns.map(({ column, type, udt }) => ({ column, type, udt })), primaryKey: table.primaryKey, foreignKeys: table.foreignKeys })).sort((a, b) => a.name.localeCompare(b.name)),
        foreignKeyCount: schema.foreignKeys.length,
        prismaSchemaSha256: sha256(prismaSchema),
        prismaModels: prismaModels.map((model) => ({ name: model.name, jsonFields: model.fields.filter((field) => field.json).map((field) => field.name), stringFields: model.fields.filter((field) => field.string).map((field) => field.name) })),
      },
      fixedPoint: { iterations, candidateRows: candidateList.length, converged: iterations <= 100 },
      counts, total: candidateList.length, manifestLines, manifestSha256,
      candidates: candidateList.map((node) => compactRecord(node, reasons.get(node.key) ?? new Set())),
      edges: edges.sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))),
      ambiguities: ambiguities.sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))),
      externalReferences: externalReferences.sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))),
      realExcluded: [{ table: "Task", id: EXCLUDED_REAL_TASK_ID, classification: "DATO_REAL_CONFIRMADO", preserved: rows.some((node) => node.id === EXCLUDED_REAL_TASK_ID) }, ...excludedReasons],
      operationalNulls: { total: nullRows.length, fixture: fixtureNulls, legacyOrOther: nullRows.length - fixtureNulls },
      fingerprintExternalHits: rows.filter((node) => node.id !== EXCLUDED_REAL_TASK_ID && !candidates.has(node.key) && markerMatch(stableStringify(node.row), STRONG_MARKERS)).map((node) => `${node.table}:${node.id}`),
    };
    const reportSha256 = sha256(stableStringify(reportCore));
    const report = { ...reportCore, reportSha256 };
    const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
    if (outputArg) { const output = resolve(process.cwd(), outputArg.slice("--output=".length)); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8"); }
    console.log(JSON.stringify({
      mode: report.mode, target: report.target, fixedPoint: report.fixedPoint, counts: report.counts, total: report.total,
      manifestSha256, reportSha256, ambiguities: report.ambiguities, externalReferences: report.externalReferences,
      realExcluded: report.realExcluded, operationalNulls: report.operationalNulls, fingerprintExternalHits: report.fingerprintExternalHits,
    }, null, 2));
    if (report.ambiguities.length || report.externalReferences.some((item) => item.classification === "AMBIGUO" || item.classification === "missing-target")) process.exitCode = 2;
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "FIXTURE_CLOSURE_AUDIT_FAILED"); process.exitCode = 1; });
