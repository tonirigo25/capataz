import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { stableReference } from "@/lib/ai/redaction";
import { appendSensitiveAuditLog } from "@/lib/security/audit-chain";
import { assertDocumentCreationAllowed } from "@/lib/commercial/usage";
import { IMPORT_CATALOG, type ImportKind } from "@/lib/product/import-catalog";

export type { ImportKind } from "@/lib/product/import-catalog";

const DOCUMENT_CATEGORIES = new Set(["presupuesto", "factura", "contrato", "albaran", "ticket", "fotografia", "garantia", "certificado", "plano", "informe", "otro"]);
const DOCUMENT_CLASSIFICATIONS = new Set(["OPERATIONAL", "COMMERCIAL", "FINANCIAL", "RESTRICTED"]);
const WORK_STATUSES = new Set(["borrador", "pendiente_aprobacion", "planificada", "preparacion", "pendiente_inicio", "en_curso", "pausada", "parcialmente_terminada", "pendiente_material", "pendiente_cliente", "parada", "pendiente_remates", "finalizada", "facturada_parcialmente", "facturada", "pendiente_cobro", "cobrada", "cerrada", "archivada"]);
const WORK_PRIORITIES = new Set(["baja", "media", "alta", "urgente"]);
const TASK_STATUSES = new Set(["inbox", "planned", "in_progress", "blocked", "waiting", "completed", "cancelled", "archived"]);
const TASK_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const FOLLOW_UP_STATUSES = new Set(["planned", "due", "in_progress", "waiting_response", "promised", "completed", "unsuccessful", "cancelled", "archived"]);
const FOLLOW_UP_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const ACCOUNT_TYPES = new Set(["bank", "cash", "other"]);

type NormalizedRow = Record<string, string>;
type NormalizedImportRow = { rowNumber: number; data: NormalizedRow; errors: string[]; dedupeKey: string };
type Store = PrismaClient | Prisma.TransactionClient;

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
  const clean = value.replace(/^\uFEFF/, "").trim().replace(/\s+/g, " ").slice(0, 2_000);
  if (/^[=+@]/.test(clean) || /^-\D/.test(clean)) throw new Error("FORMULA_INJECTION");
  return clean;
}

function normalizeRows(kind: ImportKind, source: string) {
  const parsed = parseImportCsv(source);
  const definition = IMPORT_CATALOG[kind];
  const allowed = new Set(definition.fields.map((item) => item.name));
  const required = definition.fields.filter((item) => item.required).map((item) => item.name);
  const header = parsed[0].map((value) => value.replace(/^\uFEFF/, "").trim());
  const unknown = header.filter((value) => !allowed.has(value));
  if (unknown.length || new Set(header).size !== header.length) throw new Error("IMPORT_HEADERS_INVALID");
  if (required.some((name) => !header.includes(name))) throw new Error("IMPORT_REQUIRED_HEADER_MISSING");

  return parsed.slice(1).map((values, index) => {
    const errors: string[] = [];
    let data: NormalizedRow = {};
    try { data = Object.fromEntries(header.map((name, column) => [name, normalizeCell(values[column] ?? "")])); }
    catch (error) { errors.push(error instanceof Error ? error.message : "IMPORT_CELL_INVALID"); }
    if (values.length > header.length && values.slice(header.length).some((value) => value.trim())) errors.push("TOO_MANY_COLUMNS");
    for (const name of required) if (!data[name]) errors.push(`${name.toUpperCase()}_REQUIRED`);
    validateRow(kind, data, errors);
    return {
      rowNumber: index + 2,
      data,
      errors: [...new Set(errors)],
      dedupeKey: stableReference(dedupeValue(kind, data)),
    };
  });
}

function validateRow(kind: ImportKind, data: NormalizedRow, errors: string[]) {
  for (const name of ["email", "contactoEmail"]) if (data[name] && !isEmail(data[name])) errors.push(`${name.toUpperCase()}_INVALID`);
  for (const name of ["principal", "facturacion", "obra", "requiereConfirmacion", "activa"]) if (data[name] && !isBoolean(data[name])) errors.push(`${name.toUpperCase()}_INVALID`);

  if (["CONTACTS", "WORKS"].includes(kind) && !data.clienteNifCif && !data.clienteNombre) errors.push("CLIENT_REFERENCE_REQUIRED");
  if (kind === "INTERNAL_NOTES" && !data.clienteNifCif && !data.clienteNombre && !data.obraCodigo) errors.push("RELATED_ENTITY_REQUIRED");
  if (kind === "WORKS") {
    if (data.estado && !WORK_STATUSES.has(data.estado)) errors.push("WORK_STATUS_INVALID");
    if (data.prioridad && !WORK_PRIORITIES.has(data.prioridad)) errors.push("WORK_PRIORITY_INVALID");
    validateDate(data, "fechaInicioPrevista", errors);
    validateDate(data, "fechaFinPrevista", errors);
    validateMoney(data, "presupuestoAprobado", errors, false);
    validateMoney(data, "costePrevisto", errors, false);
  }
  if (kind === "TASKS") {
    if (data.estado && !TASK_STATUSES.has(data.estado)) errors.push("TASK_STATUS_INVALID");
    if (data.prioridad && !TASK_PRIORITIES.has(data.prioridad)) errors.push("TASK_PRIORITY_INVALID");
    validateDate(data, "fechaInicio", errors);
    validateDate(data, "fechaVencimiento", errors);
    validateInteger(data, "minutosEstimados", errors, 1, 100_000);
  }
  if (kind === "FOLLOW_UPS") {
    if (data.estado && !FOLLOW_UP_STATUSES.has(data.estado)) errors.push("FOLLOW_UP_STATUS_INVALID");
    if (data.prioridad && !FOLLOW_UP_PRIORITIES.has(data.prioridad)) errors.push("FOLLOW_UP_PRIORITY_INVALID");
    validateDate(data, "proximaAccion", errors);
    validateDate(data, "fechaLimite", errors);
  }
  if (kind === "SUPPLIERS" || kind === "SUBCONTRACTORS") validateInteger(data, "diasVencimiento", errors, 0, 365);
  if (kind === "FINANCIAL_ACCOUNTS") {
    if (!ACCOUNT_TYPES.has(data.tipo)) errors.push("ACCOUNT_TYPE_INVALID");
    if (!/^[A-Z]{3}$/.test(data.moneda ?? "")) errors.push("CURRENCY_INVALID");
    validateMoney(data, "saldoInicial", errors, true);
    validateMoney(data, "saldoMinimo", errors, true);
  }
  if (kind === "DOCUMENTS") {
    if (!DOCUMENT_CATEGORIES.has(data.category)) errors.push("CATEGORY_INVALID");
    if (!DOCUMENT_CLASSIFICATIONS.has(data.classification)) errors.push("CLASSIFICATION_INVALID");
    if (data.sha256 && !/^[a-f0-9]{64}$/i.test(data.sha256)) errors.push("SHA256_INVALID");
  }
}

export async function previewCompanyImport(prisma: PrismaClient, input: { companyId: string; actorId: string; kind: ImportKind; source: string }) {
  const rows = normalizeRows(input.kind, input.source);
  await addReferenceErrors(prisma, input.companyId, input.kind, rows);
  const sourceHash = createHash("sha256").update(`${input.kind}\0${input.source.replace(/\r\n/g, "\n")}`).digest("hex");
  const existingBatch = await prisma.companyImportBatch.findUnique({ where: { companyId_sourceHash_kind: { companyId: input.companyId, sourceHash, kind: input.kind } }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
  if (existingBatch) return existingBatch;

  const existingKeys = await loadExistingKeys(prisma, input.companyId, input.kind);
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
    if (!(batch.kind in IMPORT_CATALOG)) throw new Error("IMPORT_KIND_INVALID");

    const caches = createReferenceCaches();
    let appliedRows = 0;
    for (const row of batch.rows) {
      const data = row.normalizedData as NormalizedRow;
      const entityId = await createImportedEntity(transaction, {
        companyId: input.companyId,
        actorId: input.actorId,
        batchId: batch.id,
        kind: batch.kind as ImportKind,
        rowId: row.id,
        data,
        caches,
      });
      if (!entityId) continue;
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
    await archiveImportedEntities(transaction, batch.kind as ImportKind, input.companyId, batch.id, ids, archivedAt);
    await transaction.companyImportRow.updateMany({ where: { batchId: batch.id, status: "APPLIED" }, data: { status: "ROLLED_BACK" } });
    await transaction.companyImportBatch.update({ where: { id: batch.id }, data: { status: "ROLLED_BACK", rolledBackAt: archivedAt } });
    await appendSensitiveAuditLog(transaction, { companyId: input.companyId, userActorId: input.actorId, action: "import.batch.rolled_back", targetType: "CompanyImportBatch", targetId: batch.id, metadata: { kind: batch.kind, rows: ids.length } });
    return { batchId: batch.id, rolledBackRows: ids.length };
  });
}

async function createImportedEntity(transaction: Prisma.TransactionClient, input: {
  companyId: string;
  actorId: string;
  batchId: string;
  kind: ImportKind;
  rowId: string;
  data: NormalizedRow;
  caches: ReturnType<typeof createReferenceCaches>;
}): Promise<string | null> {
  const { companyId, actorId, batchId, kind, rowId, data, caches } = input;
  const clientId = await resolveClientId(transaction, companyId, data, caches);
  const workId = await resolveWorkId(transaction, companyId, data.obraCodigo, caches);
  const partnerId = await resolvePartnerId(transaction, companyId, data.partnerNifCif, caches);

  if (["CONTACTS", "WORKS"].includes(kind) && !clientId) return rejectAtApply(transaction, rowId, "CLIENT_REFERENCE_NOT_FOUND_AT_APPLY");
  if (data.obraCodigo && !workId) return rejectAtApply(transaction, rowId, "WORK_REFERENCE_NOT_FOUND_AT_APPLY");
  if ((data.clienteNifCif || data.clienteNombre) && !clientId) return rejectAtApply(transaction, rowId, "CLIENT_REFERENCE_NOT_FOUND_AT_APPLY");
  if (data.partnerNifCif && !partnerId) return rejectAtApply(transaction, rowId, "PARTNER_REFERENCE_NOT_FOUND_AT_APPLY");

  if (kind === "CLIENTS") {
    const duplicate = await transaction.client.findFirst({ where: { companyId, archivadoAt: null, nombre: { equals: data.nombre, mode: "insensitive" }, OR: [{ telefono: data.telefono }, ...(data.email ? [{ email: { equals: data.email, mode: "insensitive" as const } }] : [])] }, select: { id: true } });
    if (duplicate) return rejectAtApply(transaction, rowId, "DUPLICATE_AT_APPLY");
    const created = await transaction.client.create({ data: { companyId, nombre: data.nombre, nombreComercial: nullable(data.nombreComercial), razonSocial: nullable(data.razonSocial), nifCif: nullable(data.nifCif), telefono: data.telefono, email: nullable(data.email), direccion: data.direccion, codigoPostal: nullable(data.codigoPostal), municipio: nullable(data.municipio), provincia: nullable(data.provincia), pais: data.pais || "España", tipo: data.tipo, notas: nullable(data.notas), origen: `import:${batchId}` } });
    return created.id;
  }
  if (kind === "CONTACTS") {
    const duplicate = await transaction.contact.findFirst({ where: { companyId, clientId: clientId!, archivedAt: null, nombre: { equals: data.nombre, mode: "insensitive" }, OR: [...(data.email ? [{ email: { equals: data.email, mode: "insensitive" as const } }] : []), ...(data.telefono ? [{ telefono: data.telefono }] : [])] }, select: { id: true } });
    if (duplicate) return rejectAtApply(transaction, rowId, "DUPLICATE_AT_APPLY");
    const created = await transaction.contact.create({ data: { companyId, clientId: clientId!, nombre: data.nombre, apellidos: nullable(data.apellidos), cargo: nullable(data.cargo), telefono: nullable(data.telefono), email: nullable(data.email), isPrimary: booleanValue(data.principal), isBillingContact: booleanValue(data.facturacion), isSiteContact: booleanValue(data.obra), notes: nullable(data.notas) } });
    return created.id;
  }
  if (kind === "WORKS") {
    const duplicate = await transaction.work.findFirst({ where: { companyId, codigo: data.codigo }, select: { id: true } });
    if (duplicate) return rejectAtApply(transaction, rowId, "DUPLICATE_AT_APPLY");
    const budget = numberValue(data.presupuestoAprobado);
    const cost = numberValue(data.costePrevisto);
    const margin = budget - cost;
    const created = await transaction.work.create({ data: { companyId, codigo: data.codigo, clienteId: clientId!, titulo: data.titulo, direccion: data.direccion, tipoTrabajo: data.tipoTrabajo, estado: (data.estado || "planificada") as never, prioridad: (data.prioridad || "media") as never, fechaInicioPrevista: dateValue(data.fechaInicioPrevista), fechaFinPrevista: dateValue(data.fechaFinPrevista), presupuestoAprobado: budget, presupuestoAprobadoDecimal: decimalValue(budget), costePrevisto: cost, costePrevistoDecimal: decimalValue(cost), margenEstimado: margin, margenEstimadoDecimal: decimalValue(margin), responsable: nullable(data.responsable), descripcion: nullable(data.descripcion) } });
    return created.id;
  }
  if (kind === "TASKS") {
    const dueAt = dateValue(data.fechaVencimiento);
    const duplicate = await transaction.task.findFirst({ where: { companyId, archivedAt: null, title: { equals: data.titulo, mode: "insensitive" }, dueAt }, select: { id: true } });
    if (duplicate) return rejectAtApply(transaction, rowId, "DUPLICATE_AT_APPLY");
    const created = await transaction.task.create({ data: { companyId, title: data.titulo, description: nullable(data.descripcion), category: data.categoria || "general", priority: (data.prioridad || "medium") as never, status: (data.estado || "planned") as never, origin: `import:${batchId}`, createdById: actorId, clientId, workId, startsAt: dateValue(data.fechaInicio), dueAt, estimatedMinutes: integerValue(data.minutosEstimados), requiresConfirmation: booleanValue(data.requiereConfirmacion) } });
    return created.id;
  }
  if (kind === "FOLLOW_UPS") {
    const nextActionAt = dateValue(data.proximaAccion);
    const duplicate = await transaction.followUp.findFirst({ where: { companyId, archivedAt: null, title: { equals: data.titulo, mode: "insensitive" }, nextActionAt }, select: { id: true } });
    if (duplicate) return rejectAtApply(transaction, rowId, "DUPLICATE_AT_APPLY");
    const created = await transaction.followUp.create({ data: { companyId, title: data.titulo, type: data.tipo || "general", status: (data.estado || "planned") as never, priority: (data.prioridad || "medium") as never, origin: `import:${batchId}`, createdById: actorId, clientId, workId, nextActionAt, dueAt: dateValue(data.fechaLimite), expectedOutcome: nullable(data.resultadoEsperado) } });
    return created.id;
  }
  if (kind === "SUPPLIERS" || kind === "SUBCONTRACTORS") {
    const partnerKind = kind === "SUPPLIERS" ? "SUPPLIER" : "SUBCONTRACTOR";
    const duplicate = await transaction.businessPartner.findFirst({ where: { companyId, kind: partnerKind, archivedAt: null, OR: [{ taxId: data.nifCif }, { commercialName: { equals: data.nombreComercial, mode: "insensitive" } }] }, select: { id: true } });
    if (duplicate) return rejectAtApply(transaction, rowId, "DUPLICATE_AT_APPLY");
    const created = await transaction.businessPartner.create({ data: { companyId, kind: partnerKind, commercialName: data.nombreComercial, legalName: data.razonSocial, taxId: data.nifCif, email: nullable(data.email), phone: nullable(data.telefono), address: nullable(data.direccion), city: nullable(data.municipio), province: nullable(data.provincia), postalCode: nullable(data.codigoPostal), country: data.pais || "España", contactPerson: nullable(data.personaContacto), paymentTerms: nullable(data.condicionesPago), paymentDueDays: integerValue(data.diasVencimiento) ?? 30, specialty: nullable(data.especialidad), notes: nullable(data.notas) } });
    return created.id;
  }
  if (kind === "FINANCIAL_ACCOUNTS") {
    const duplicate = await transaction.financialAccount.findFirst({ where: { companyId, archivedAt: null, name: { equals: data.nombre, mode: "insensitive" } }, select: { id: true } });
    if (duplicate) return rejectAtApply(transaction, rowId, "DUPLICATE_AT_APPLY");
    const opening = numberValue(data.saldoInicial);
    const minimum = data.saldoMinimo ? numberValue(data.saldoMinimo) : null;
    const created = await transaction.financialAccount.create({ data: { companyId, name: data.nombre, type: data.tipo as never, currency: data.moneda, openingBalance: opening, openingBalanceDecimal: decimalValue(opening), minimumBalance: minimum, minimumBalanceDecimal: minimum === null ? null : decimalValue(minimum), isActive: data.activa ? booleanValue(data.activa) : true } });
    return created.id;
  }
  if (kind === "INTERNAL_NOTES") {
    const duplicate = await transaction.internalNote.findFirst({ where: { companyId, archivedAt: null, content: data.contenido, clientId, workId }, select: { id: true } });
    if (duplicate) return rejectAtApply(transaction, rowId, "DUPLICATE_AT_APPLY");
    const created = await transaction.internalNote.create({ data: { companyId, clientId, workId, authorId: actorId, content: data.contenido } });
    return created.id;
  }

  const duplicate = await transaction.document.findFirst({ where: { companyId, archivedAt: null, name: data.name, ...(data.sha256 ? { sha256: data.sha256.toLowerCase() } : {}) }, select: { id: true } });
  if (duplicate) return rejectAtApply(transaction, rowId, "DUPLICATE_AT_APPLY");
  await assertDocumentCreationAllowed(transaction, { companyId, actorId, origin: "company_import", targetId: rowId });
  const created = await transaction.document.create({ data: { companyId, name: data.name, originalName: data.originalName || data.name, mimeType: nullable(data.mimeType), sha256: data.sha256?.toLowerCase() || null, category: data.category as never, classification: data.classification as never, clientId, workId, businessPartnerId: partnerId, uploadedById: actorId, status: "UPLOADED", metadata: { importBatchId: batchId, metadataOnly: true } } });
  return created.id;
}

async function archiveImportedEntities(transaction: Prisma.TransactionClient, kind: ImportKind, companyId: string, batchId: string, ids: string[], archivedAt: Date) {
  if (kind === "CLIENTS") await transaction.client.updateMany({ where: { id: { in: ids }, companyId, origen: `import:${batchId}` }, data: { archivadoAt: archivedAt } });
  else if (kind === "CONTACTS") await transaction.contact.updateMany({ where: { id: { in: ids }, companyId }, data: { archivedAt } });
  else if (kind === "WORKS") await transaction.work.updateMany({ where: { id: { in: ids }, companyId }, data: { archivada: true, archivadaAt: archivedAt, estado: "archivada" } });
  else if (kind === "TASKS") await transaction.task.updateMany({ where: { id: { in: ids }, companyId }, data: { archivedAt, status: "archived" } });
  else if (kind === "FOLLOW_UPS") await transaction.followUp.updateMany({ where: { id: { in: ids }, companyId }, data: { archivedAt, status: "archived" } });
  else if (kind === "SUPPLIERS") await transaction.businessPartner.updateMany({ where: { id: { in: ids }, companyId, kind: "SUPPLIER" }, data: { archivedAt, status: "INACTIVE" } });
  else if (kind === "SUBCONTRACTORS") await transaction.businessPartner.updateMany({ where: { id: { in: ids }, companyId, kind: "SUBCONTRACTOR" }, data: { archivedAt, status: "INACTIVE" } });
  else if (kind === "FINANCIAL_ACCOUNTS") await transaction.financialAccount.updateMany({ where: { id: { in: ids }, companyId }, data: { archivedAt, isActive: false } });
  else if (kind === "INTERNAL_NOTES") await transaction.internalNote.updateMany({ where: { id: { in: ids }, companyId }, data: { archivedAt } });
  else await transaction.document.updateMany({ where: { id: { in: ids }, companyId }, data: { archivedAt, status: "ARCHIVED" } });
}

async function addReferenceErrors(store: Store, companyId: string, kind: ImportKind, rows: NormalizedImportRow[]) {
  const requiresClients = ["CONTACTS", "WORKS", "TASKS", "FOLLOW_UPS", "INTERNAL_NOTES", "DOCUMENTS"].includes(kind);
  const requiresWorks = ["TASKS", "FOLLOW_UPS", "INTERNAL_NOTES", "DOCUMENTS"].includes(kind);
  const requiresPartners = kind === "DOCUMENTS";
  const [clients, works, partners] = await Promise.all([
    requiresClients ? store.client.findMany({ where: { companyId, archivadoAt: null }, select: { nifCif: true, nombre: true } }) : Promise.resolve([]),
    requiresWorks ? store.work.findMany({ where: { companyId, archivada: false }, select: { codigo: true } }) : Promise.resolve([]),
    requiresPartners ? store.businessPartner.findMany({ where: { companyId, archivedAt: null }, select: { taxId: true } }) : Promise.resolve([]),
  ]);
  const taxIds = new Set(clients.flatMap((item) => item.nifCif ? [normalizeReference(item.nifCif)] : []));
  const clientNames = new Map<string, number>();
  for (const item of clients) clientNames.set(normalizeReference(item.nombre), (clientNames.get(normalizeReference(item.nombre)) ?? 0) + 1);
  const workCodes = new Set(works.flatMap((item) => item.codigo ? [normalizeReference(item.codigo)] : []));
  const partnerTaxIds = new Set(partners.flatMap((item) => item.taxId ? [normalizeReference(item.taxId)] : []));

  for (const row of rows) {
    const { data, errors } = row;
    if (data.clienteNifCif && !taxIds.has(normalizeReference(data.clienteNifCif))) errors.push("CLIENT_REFERENCE_NOT_FOUND");
    else if (!data.clienteNifCif && data.clienteNombre) {
      const count = clientNames.get(normalizeReference(data.clienteNombre)) ?? 0;
      if (!count) errors.push("CLIENT_REFERENCE_NOT_FOUND");
      else if (count > 1) errors.push("CLIENT_REFERENCE_AMBIGUOUS");
    }
    if (data.obraCodigo && !workCodes.has(normalizeReference(data.obraCodigo))) errors.push("WORK_REFERENCE_NOT_FOUND");
    if (data.partnerNifCif && !partnerTaxIds.has(normalizeReference(data.partnerNifCif))) errors.push("PARTNER_REFERENCE_NOT_FOUND");
    row.errors = [...new Set(errors)];
  }
}

async function loadExistingKeys(store: Store, companyId: string, kind: ImportKind) {
  const values: string[] = [];
  if (kind === "CLIENTS") {
    const rows = await store.client.findMany({ where: { companyId, archivadoAt: null }, select: { nombre: true, telefono: true, email: true } });
    values.push(...rows.map((item) => `${item.nombre}|${item.telefono}|${item.email ?? ""}`));
  } else if (kind === "CONTACTS") {
    const rows = await store.contact.findMany({ where: { companyId, archivedAt: null }, select: { client: { select: { nifCif: true, nombre: true } }, nombre: true, email: true, telefono: true } });
    values.push(...rows.map((item) => `${item.client.nifCif || item.client.nombre}|${item.nombre}|${item.email || item.telefono || ""}`));
  } else if (kind === "WORKS") {
    const rows = await store.work.findMany({ where: { companyId, archivada: false }, select: { codigo: true } });
    values.push(...rows.map((item) => item.codigo ?? ""));
  } else if (kind === "TASKS") {
    const rows = await store.task.findMany({ where: { companyId, archivedAt: null }, select: { title: true, dueAt: true } });
    values.push(...rows.map((item) => `${item.title}|${dateKey(item.dueAt)}`));
  } else if (kind === "FOLLOW_UPS") {
    const rows = await store.followUp.findMany({ where: { companyId, archivedAt: null }, select: { title: true, nextActionAt: true } });
    values.push(...rows.map((item) => `${item.title}|${dateKey(item.nextActionAt)}`));
  } else if (kind === "SUPPLIERS" || kind === "SUBCONTRACTORS") {
    const rows = await store.businessPartner.findMany({ where: { companyId, kind: kind === "SUPPLIERS" ? "SUPPLIER" : "SUBCONTRACTOR", archivedAt: null }, select: { taxId: true, commercialName: true } });
    values.push(...rows.map((item) => `${item.taxId || ""}|${item.commercialName}`));
  } else if (kind === "FINANCIAL_ACCOUNTS") {
    const rows = await store.financialAccount.findMany({ where: { companyId, archivedAt: null }, select: { name: true } });
    values.push(...rows.map((item) => item.name));
  } else if (kind === "INTERNAL_NOTES") {
    const rows = await store.internalNote.findMany({ where: { companyId, archivedAt: null }, select: { content: true, clientId: true, workId: true } });
    values.push(...rows.map((item) => `${item.clientId || ""}|${item.workId || ""}|${item.content}`));
  } else {
    const rows = await store.document.findMany({ where: { companyId, archivedAt: null }, select: { name: true, sha256: true } });
    values.push(...rows.map((item) => `${item.name}|${item.sha256 ?? ""}`));
  }
  return new Set(values.map((value) => stableReference(value.toLowerCase())));
}

function dedupeValue(kind: ImportKind, data: NormalizedRow) {
  if (kind === "CLIENTS") return `${data.nombre}|${data.telefono}|${data.email ?? ""}`.toLowerCase();
  if (kind === "CONTACTS") return `${data.clienteNifCif || data.clienteNombre}|${data.nombre}|${data.email || data.telefono || ""}`.toLowerCase();
  if (kind === "WORKS") return (data.codigo ?? "").toLowerCase();
  if (kind === "TASKS") return `${data.titulo}|${dateKey(data.fechaVencimiento)}`.toLowerCase();
  if (kind === "FOLLOW_UPS") return `${data.titulo}|${dateKey(data.proximaAccion)}`.toLowerCase();
  if (kind === "SUPPLIERS" || kind === "SUBCONTRACTORS") return `${data.nifCif}|${data.nombreComercial}`.toLowerCase();
  if (kind === "FINANCIAL_ACCOUNTS") return (data.nombre ?? "").toLowerCase();
  if (kind === "INTERNAL_NOTES") return `${data.clienteNifCif || data.clienteNombre}|${data.obraCodigo}|${data.contenido}`.toLowerCase();
  return `${data.name}|${data.sha256 ?? ""}`.toLowerCase();
}

function createReferenceCaches() {
  return { clients: new Map<string, string | null>(), works: new Map<string, string | null>(), partners: new Map<string, string | null>() };
}

async function resolveClientId(store: Store, companyId: string, data: NormalizedRow, caches: ReturnType<typeof createReferenceCaches>) {
  const key = normalizeReference(data.clienteNifCif || data.clienteNombre || "");
  if (!key) return null;
  if (caches.clients.has(key)) return caches.clients.get(key) ?? null;
  const record = await store.client.findFirst({ where: { companyId, archivadoAt: null, ...(data.clienteNifCif ? { nifCif: { equals: data.clienteNifCif, mode: "insensitive" } } : { nombre: { equals: data.clienteNombre, mode: "insensitive" } }) }, select: { id: true } });
  caches.clients.set(key, record?.id ?? null);
  return record?.id ?? null;
}

async function resolveWorkId(store: Store, companyId: string, code: string | undefined, caches: ReturnType<typeof createReferenceCaches>) {
  const key = normalizeReference(code ?? "");
  if (!key) return null;
  if (caches.works.has(key)) return caches.works.get(key) ?? null;
  const record = await store.work.findFirst({ where: { companyId, archivada: false, codigo: { equals: code, mode: "insensitive" } }, select: { id: true } });
  caches.works.set(key, record?.id ?? null);
  return record?.id ?? null;
}

async function resolvePartnerId(store: Store, companyId: string, taxId: string | undefined, caches: ReturnType<typeof createReferenceCaches>) {
  const key = normalizeReference(taxId ?? "");
  if (!key) return null;
  if (caches.partners.has(key)) return caches.partners.get(key) ?? null;
  const record = await store.businessPartner.findFirst({ where: { companyId, archivedAt: null, taxId: { equals: taxId, mode: "insensitive" } }, select: { id: true } });
  caches.partners.set(key, record?.id ?? null);
  return record?.id ?? null;
}

async function rejectAtApply(transaction: Prisma.TransactionClient, rowId: string, code: string): Promise<null> {
  await transaction.companyImportRow.update({ where: { id: rowId }, data: { status: code === "DUPLICATE_AT_APPLY" ? "DUPLICATE_AT_APPLY" : "INVALID_AT_APPLY", errorCodes: [code] } });
  return null;
}

function isEmail(value: string) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value); }
function isBoolean(value: string) { return ["si", "sí", "no", "true", "false", "1", "0"].includes(value.toLowerCase()); }
function booleanValue(value: string | undefined) { return ["si", "sí", "true", "1"].includes((value ?? "").toLowerCase()); }
function nullable(value: string | undefined) { return value || null; }
function normalizeReference(value: string) { return value.trim().toLocaleLowerCase("es-ES"); }
function dateValue(value: string | undefined) { return value ? new Date(value) : null; }
function dateKey(value: string | Date | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}
function numberValue(value: string | undefined) { return value ? Number(value) : 0; }
function integerValue(value: string | undefined) { return value ? Number.parseInt(value, 10) : null; }
function decimalValue(value: number) { return new Prisma.Decimal(value.toFixed(2)); }

function validateDate(data: NormalizedRow, name: string, errors: string[]) {
  if (data[name] && Number.isNaN(Date.parse(data[name]))) errors.push(`${name.toUpperCase()}_INVALID`);
}

function validateMoney(data: NormalizedRow, name: string, errors: string[], allowNegative: boolean) {
  const value = data[name];
  if (!value) return;
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value)) || (!allowNegative && Number(value) < 0)) errors.push(`${name.toUpperCase()}_INVALID`);
}

function validateInteger(data: NormalizedRow, name: string, errors: string[], min: number, max: number) {
  const value = data[name];
  if (!value) return;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) errors.push(`${name.toUpperCase()}_INVALID`);
}
