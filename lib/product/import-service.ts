import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { stableReference } from "@/lib/ai/redaction";
import { appendSensitiveAuditLog } from "@/lib/security/audit-chain";
import { assertDocumentCreationAllowed } from "@/lib/commercial/usage";

export type ImportKind = "CLIENTS" | "DOCUMENTS";
const CLIENT_HEADERS = ["nombre", "telefono", "direccion", "tipo", "email", "nifCif"] as const;
const DOCUMENT_HEADERS = ["name", "category", "classification", "originalName", "mimeType", "sha256"] as const;
const DOCUMENT_CATEGORIES = new Set(["presupuesto", "factura", "contrato", "albaran", "ticket", "fotografia", "garantia", "certificado", "plano", "informe", "otro"]);
const DOCUMENT_CLASSIFICATIONS = new Set(["OPERATIONAL", "COMMERCIAL", "FINANCIAL", "RESTRICTED"]);

type NormalizedRow = Record<string, string>;

export function parseImportCsv(source: string): string[][] {
  if (Buffer.byteLength(source) > 512 * 1024) throw new Error("IMPORT_FILE_TOO_LARGE");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error("IMPORT_UNCLOSED_QUOTE");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error("IMPORT_ROWS_REQUIRED");
  if (rows.length > 501) throw new Error("IMPORT_ROW_LIMIT_EXCEEDED");
  return rows;
}

function normalizeCell(value: string): string {
  const clean = value.replace(/^\uFEFF/, "").trim().replace(/\s+/g, " ").slice(0, 255);
  if (/^[=+@]/.test(clean) || /^-\D/.test(clean)) throw new Error("FORMULA_INJECTION");
  return clean;
}

function normalizeRows(kind: ImportKind, source: string) {
  const parsed = parseImportCsv(source);
  const expected = kind === "CLIENTS" ? CLIENT_HEADERS : DOCUMENT_HEADERS;
  const header = parsed[0].map((value) => value.replace(/^\uFEFF/, "").trim());
  const unknown = header.filter((value) => !expected.includes(value as never));
  if (unknown.length || new Set(header).size !== header.length) throw new Error("IMPORT_HEADERS_INVALID");
  const required = kind === "CLIENTS" ? ["nombre", "telefono", "direccion", "tipo"] : ["name", "category", "classification"];
  if (required.some((name) => !header.includes(name))) throw new Error("IMPORT_REQUIRED_HEADER_MISSING");
  return parsed.slice(1).map((values, index) => {
    const errors: string[] = [];
    let data: NormalizedRow = {};
    try { data = Object.fromEntries(header.map((name, column) => [name, normalizeCell(values[column] ?? "")])); }
    catch (error) { errors.push(error instanceof Error ? error.message : "IMPORT_CELL_INVALID"); }
    if (values.length > header.length && values.slice(header.length).some((value) => value.trim())) errors.push("TOO_MANY_COLUMNS");
    if (kind === "CLIENTS") {
      if (!data.nombre) errors.push("NAME_REQUIRED");
      if (!data.telefono) errors.push("PHONE_REQUIRED");
      if (!data.direccion) errors.push("ADDRESS_REQUIRED");
      if (!data.tipo) errors.push("TYPE_REQUIRED");
      if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) errors.push("EMAIL_INVALID");
    } else {
      if (!data.name) errors.push("NAME_REQUIRED");
      if (!DOCUMENT_CATEGORIES.has(data.category)) errors.push("CATEGORY_INVALID");
      if (!DOCUMENT_CLASSIFICATIONS.has(data.classification)) errors.push("CLASSIFICATION_INVALID");
      if (data.sha256 && !/^[a-f0-9]{64}$/i.test(data.sha256)) errors.push("SHA256_INVALID");
    }
    const dedupeKey = kind === "CLIENTS"
      ? `${data.nombre ?? ""}|${data.telefono ?? ""}|${data.email ?? ""}`.toLowerCase()
      : `${data.name ?? ""}|${data.sha256 ?? ""}`.toLowerCase();
    return { rowNumber: index + 2, data, errors: [...new Set(errors)], dedupeKey: stableReference(dedupeKey) };
  });
}

export async function previewCompanyImport(prisma: PrismaClient, input: {
  companyId: string;
  actorId: string;
  kind: ImportKind;
  source: string;
}) {
  const rows = normalizeRows(input.kind, input.source);
  const sourceHash = createHash("sha256").update(`${input.kind}\0${input.source.replace(/\r\n/g, "\n")}`).digest("hex");
  const existingBatch = await prisma.companyImportBatch.findUnique({ where: { companyId_sourceHash_kind: { companyId: input.companyId, sourceHash, kind: input.kind } }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
  if (existingBatch) return existingBatch;
  const existingKeys = new Set<string>();
  if (input.kind === "CLIENTS") {
    const existing = await prisma.client.findMany({ where: { companyId: input.companyId, archivadoAt: null }, select: { nombre: true, telefono: true, email: true } });
    for (const item of existing) existingKeys.add(stableReference(`${item.nombre}|${item.telefono}|${item.email ?? ""}`.toLowerCase()));
  } else {
    const existing = await prisma.document.findMany({ where: { companyId: input.companyId, archivedAt: null }, select: { name: true, sha256: true } });
    for (const item of existing) existingKeys.add(stableReference(`${item.name}|${item.sha256 ?? ""}`.toLowerCase()));
  }
  const seen = new Set<string>();
  const classified = rows.map((row) => {
    const duplicate = existingKeys.has(row.dedupeKey) || seen.has(row.dedupeKey);
    seen.add(row.dedupeKey);
    return { ...row, duplicate, status: row.errors.length ? "INVALID" : duplicate ? "DUPLICATE" : "VALID" };
  });
  const id = createHash("sha256").update(`${input.companyId}:${input.kind}:${sourceHash}`).digest("hex").slice(0, 24);
  return prisma.companyImportBatch.create({
    data: {
      id,
      companyId: input.companyId,
      actorIdHash: stableReference(input.actorId),
      kind: input.kind,
      sourceHash,
      totalRows: classified.length,
      validRows: classified.filter((row) => row.status === "VALID").length,
      invalidRows: classified.filter((row) => row.status === "INVALID").length,
      duplicateRows: classified.filter((row) => row.status === "DUPLICATE").length,
      confirmationKey: `APPLY_BATCH:${id}`,
      rows: { create: classified.map((row) => ({ rowNumber: row.rowNumber, dedupeKey: row.dedupeKey, status: row.status, errorCodes: row.errors, normalizedData: row.data })) },
    },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });
}

export async function applyCompanyImport(prisma: PrismaClient, input: { companyId: string; actorId: string; batchId: string; confirmation: string }) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`import:${input.companyId}`}))`);
    const batch = await transaction.companyImportBatch.findFirstOrThrow({ where: { id: input.batchId, companyId: input.companyId }, include: { rows: { where: { status: "VALID" }, orderBy: { rowNumber: "asc" } } } });
    if (batch.status !== "PREVIEWED" || input.confirmation !== batch.confirmationKey) throw new Error("IMPORT_CONFIRMATION_REQUIRED");
    let appliedRows = 0;
    for (const row of batch.rows) {
      const data = row.normalizedData as NormalizedRow;
      let entityId: string;
      if (batch.kind === "CLIENTS") {
        const duplicate = await transaction.client.findFirst({ where: { companyId: input.companyId, archivadoAt: null, nombre: { equals: data.nombre, mode: "insensitive" }, OR: [{ telefono: data.telefono }, ...(data.email ? [{ email: { equals: data.email, mode: "insensitive" as const } }] : [])] }, select: { id: true } });
        if (duplicate) { await transaction.companyImportRow.update({ where: { id: row.id }, data: { status: "DUPLICATE_AT_APPLY", errorCodes: ["DUPLICATE_AT_APPLY"] } }); continue; }
        const created = await transaction.client.create({ data: { companyId: input.companyId, nombre: data.nombre, telefono: data.telefono, direccion: data.direccion, tipo: data.tipo, email: data.email || null, nifCif: data.nifCif || null, origen: `import:${batch.id}` } });
        entityId = created.id;
      } else {
        const duplicate = await transaction.document.findFirst({ where: { companyId: input.companyId, archivedAt: null, name: data.name, ...(data.sha256 ? { sha256: data.sha256.toLowerCase() } : {}) }, select: { id: true } });
        if (duplicate) { await transaction.companyImportRow.update({ where: { id: row.id }, data: { status: "DUPLICATE_AT_APPLY", errorCodes: ["DUPLICATE_AT_APPLY"] } }); continue; }
        await assertDocumentCreationAllowed(transaction, {
          companyId: input.companyId,
          actorId: input.actorId,
          origin: "company_import",
          targetId: row.id,
        });
        const created = await transaction.document.create({ data: { companyId: input.companyId, name: data.name, originalName: data.originalName || data.name, mimeType: data.mimeType || null, sha256: data.sha256?.toLowerCase() || null, category: data.category as never, classification: data.classification as never, uploadedById: input.actorId, status: "UPLOADED", metadata: { importBatchId: batch.id, metadataOnly: true } } });
        entityId = created.id;
      }
      await transaction.companyImportRow.update({ where: { id: row.id }, data: { status: "APPLIED", createdEntityId: entityId } });
      appliedRows += 1;
    }
    await transaction.companyImportBatch.update({ where: { id: batch.id }, data: { status: "APPLIED", appliedRows, appliedAt: new Date() } });
    await appendSensitiveAuditLog(transaction, { companyId: input.companyId, userActorId: input.actorId, action: "import.batch.applied", targetType: "CompanyImportBatch", targetId: batch.id, metadata: { kind: batch.kind, totalRows: batch.totalRows, appliedRows, invalidRows: batch.invalidRows, duplicateRows: batch.duplicateRows } });
    return { batchId: batch.id, appliedRows };
  }, { isolationLevel: "Serializable" });
}

export async function rollbackCompanyImport(prisma: PrismaClient, input: { companyId: string; actorId: string; batchId: string; confirmation: string }) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`import:${input.companyId}`}))`);
    const batch = await transaction.companyImportBatch.findFirstOrThrow({ where: { id: input.batchId, companyId: input.companyId }, include: { rows: { where: { status: "APPLIED", createdEntityId: { not: null } } } } });
    if (batch.status !== "APPLIED" || input.confirmation !== `ROLLBACK_BATCH:${batch.id}`) throw new Error("IMPORT_ROLLBACK_CONFIRMATION_REQUIRED");
    const ids = batch.rows.flatMap((row) => row.createdEntityId ? [row.createdEntityId] : []);
    const archivedAt = new Date();
    if (batch.kind === "CLIENTS") await transaction.client.updateMany({ where: { id: { in: ids }, companyId: input.companyId, origen: `import:${batch.id}` }, data: { archivadoAt: archivedAt } });
    else await transaction.document.updateMany({ where: { id: { in: ids }, companyId: input.companyId }, data: { archivedAt, status: "ARCHIVED" } });
    await transaction.companyImportRow.updateMany({ where: { batchId: batch.id, status: "APPLIED" }, data: { status: "ROLLED_BACK" } });
    await transaction.companyImportBatch.update({ where: { id: batch.id }, data: { status: "ROLLED_BACK", rolledBackAt: archivedAt } });
    await appendSensitiveAuditLog(transaction, { companyId: input.companyId, userActorId: input.actorId, action: "import.batch.rolled_back", targetType: "CompanyImportBatch", targetId: batch.id, metadata: { kind: batch.kind, rows: ids.length } });
    return { batchId: batch.id, rolledBackRows: ids.length };
  });
}
