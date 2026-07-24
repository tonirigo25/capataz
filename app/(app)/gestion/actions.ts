"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  BudgetStatus,
  ClientStatus,
  CostBehavior,
  DocumentCategory,
  DocumentClassification,
  EventoAgendaEstado,
  EventoAgendaTipo,
  ExpenseCategory,
  ExpenseCashStatus,
  InvoiceStatus,
  MaterialStatus,
  PaymentType,
  Prisma,
  ReminderChannel,
  ReminderStatus,
  ReminderType,
  WorkPriority,
  WorkStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateBudgetTotals,
  normalizeLine,
  parseBudgetLines,
  serializeBudgetLines,
} from "@/lib/budget-lines";
import {
  clientDraftFromFormData,
  clientDuplicateRedirectUrl,
  findClientDuplicateCandidate,
} from "@/lib/client-crm";
import { ALLOWED_DOCUMENT_MIME_TYPES } from "@/lib/documents";
import { reserveDocumentNumberInTransaction } from "@/lib/numbering";
import { reevaluateProactiveAfterMutation } from "@/lib/proactive-evaluation";
import { deriveInvoiceStatus } from "@/lib/status";
import {
  assertScopedEntityAccess,
  requireApprovalAuthority,
  requireCapability,
  resolveAuthorization,
  resolveScopedEntityIds,
} from "@/lib/commercial/authorization";
import { requireCompanyContext } from "@/lib/auth/session";
import { managementCapability } from "@/lib/commercial/management-capabilities";
import { buildPortalManifest } from "@/lib/commercial/portal-manifest";

type ManualEntity =
  | "cliente"
  | "obra"
  | "presupuesto"
  | "factura"
  | "pago"
  | "gasto"
  | "material"
  | "recordatorio"
  | "eventoAgenda"
  | "contacto"
  | "notaInterna"
  | "documento"
  | "foto";

export async function saveManualRecord(formData: FormData) {
  const tipo = text(formData, "tipo") as ManualEntity;
  const id = optionalText(formData, "id");
  const auth = await requireCapability(managementCapability(tipo, Boolean(id)));
  const { companyId } = auth;
  await assertManualRecordScope(auth, tipo, id, formData);
  if (tipo === "presupuesto") {
    const pricing = await resolveAuthorization(auth, "sales.pricing.view");
    if (!pricing.allowed) throw new Error("SALES_PRICING_REQUIRED");
    const workId = optionalText(formData, "obraId");
    const clientId = optionalText(formData, "clienteId");
    if (workId)
      await assertScopedEntityAccess(
        auth,
        "sales.pricing.view",
        "Work",
        workId,
      );
    else if (clientId) {
      if (auth.scope === "SELECTED_WORKS" || pricing.scope === "SELECTED_WORKS")
        throw new Error("SCOPE_REQUIRED");
      await assertScopedEntityAccess(
        auth,
        "sales.pricing.view",
        "Client",
        clientId,
      );
    } else if (pricing.scope !== "COMPANY") throw new Error("SCOPE_REQUIRED");
  }
  if (tipo === "presupuesto" && number(formData, "descuento") > 0) {
    if (!(await resolveAuthorization(auth, "sales.discount.apply")).allowed)
      throw new Error("PERMISSION_REQUIRED");
    const subtotal = number(formData, "subtotal");
    await requireApprovalAuthority(auth, "discount.approve", {
      amount: number(formData, "total"),
      discountPercent:
        subtotal > 0 ? (number(formData, "descuento") / subtotal) * 100 : 100,
      workId: optionalText(formData, "obraId"),
      clientId: optionalText(formData, "clienteId"),
    });
  }
  if (
    tipo === "presupuesto" &&
    ["aceptado", "rechazado", "caducado"].includes(
      optionalText(formData, "estado") ?? "",
    )
  ) {
    if (!(await resolveAuthorization(auth, "sales.budgets.approve")).allowed)
      throw new Error("PERMISSION_REQUIRED");
    await requireApprovalAuthority(auth, "quote.approve", {
      amount: number(formData, "total"),
      marginPercent: number(formData, "margenEstimado"),
      workId: optionalText(formData, "obraId"),
      clientId: optionalText(formData, "clienteId"),
    });
  }
  if (tipo === "factura" && optionalText(formData, "estado") !== "borrador") {
    if (!(await resolveAuthorization(auth, "sales.invoices.issue")).allowed)
      throw new Error("PERMISSION_REQUIRED");
    await requireApprovalAuthority(auth, "invoice.issue", {
      amount: number(formData, "total"),
      workId: optionalText(formData, "obraId"),
      clientId: optionalText(formData, "clienteId"),
    });
  }
  if (tipo === "gasto")
    await requireApprovalAuthority(auth, "purchase.approve", {
      amount: number(formData, "importe"),
      workId: optionalText(formData, "obraId"),
    });
  const returnTo = optionalText(formData, "returnTo") ?? targetFor(tipo);

  switch (tipo) {
    case "cliente":
      await saveClient(formData, id);
      break;
    case "obra":
      await saveWork(formData, id);
      break;
    case "presupuesto":
      await saveBudget(formData, id);
      break;
    case "factura":
      await saveInvoice(formData, id);
      break;
    case "pago":
      await savePayment(formData, id);
      break;
    case "gasto":
      await saveExpense(formData, id);
      break;
    case "material":
      await saveMaterial(formData, id);
      break;
    case "recordatorio":
      await saveReminder(formData, id);
      break;
    case "eventoAgenda":
      await saveAgendaEvent(formData, id);
      break;
    case "contacto":
      await saveContact(formData, id);
      break;
    case "notaInterna":
      await saveInternalNote(formData, id);
      break;
    case "documento":
      await saveDocument(formData, id, auth);
      break;
    case "foto":
      await savePhoto(formData, id);
      break;
    default:
      throw new Error("Tipo de gestión no soportado.");
  }

  if (
    [
      "cliente",
      "obra",
      "presupuesto",
      "factura",
      "pago",
      "gasto",
      "material",
      "recordatorio",
      "eventoAgenda",
      "documento",
    ].includes(tipo)
  ) {
    await reevaluateProactiveAfterMutation({
      companyId,
      entityType: tipo,
      entityId: id,
      clientId:
        optionalText(formData, "clienteId") ??
        optionalText(formData, "clientId"),
      workId: optionalText(formData, "obraId"),
      invoiceId: optionalText(formData, "facturaId"),
      budgetId:
        optionalText(formData, "presupuestoId") ??
        optionalText(formData, "budgetId"),
      reason: `manual_${tipo}_saved`,
    });
  }

  revalidatePath("/hoy");
  revalidatePath("/clientes");
  revalidatePath("/obras");
  revalidatePath("/presupuestos");
  revalidatePath("/dinero");
  revalidatePath("/gastos-materiales");
  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
  revalidatePath("/documentos");
  revalidatePath("/notificaciones");
  revalidatePath("/buscar");
  redirect(returnTo);
}

async function assertManualRecordScope(
  auth: Awaited<ReturnType<typeof requireCapability>>,
  tipo: ManualEntity,
  id: string | null,
  formData: FormData,
) {
  const { companyId, capability } = auth;
  if (tipo === "cliente") {
    if (!id) return;
    return assertScopedEntityAccess(auth, "clients.update", "Client", id);
  }
  const assertRelated = async (
    workId?: string | null,
    clientId?: string | null,
  ) => {
    if (workId)
      await assertScopedEntityAccess(auth, capability, "Work", workId);
    else if (clientId) {
      if (auth.scope === "SELECTED_WORKS") throw new Error("SCOPE_REQUIRED");
      await assertScopedEntityAccess(auth, capability, "Client", clientId);
    }
  };
  const submittedWorkId =
    optionalText(formData, "obraId") ?? optionalText(formData, "workId");
  const submittedClientId =
    optionalText(formData, "clienteId") ?? optionalText(formData, "clientId");
  await assertRelated(submittedWorkId, submittedClientId);
  if (tipo === "pago" && !id) {
    const facturaId = optionalText(formData, "facturaId");
    if (!facturaId) throw new Error("Factura obligatoria.");
    const invoice = await prisma.invoice.findFirstOrThrow({
      where: { id: facturaId, companyId },
      select: { obraId: true, clienteId: true },
    });
    return assertRelated(invoice.obraId, invoice.clienteId);
  }
  if (!id && !submittedWorkId && !submittedClientId && auth.scope !== "COMPANY")
    throw new Error("SCOPE_REQUIRED");
  if (!id) return;
  if (tipo === "obra")
    return assertScopedEntityAccess(auth, "work.update", "Work", id);
  if (tipo === "documento")
    return assertScopedEntityAccess(auth, "documents.manage", "Document", id);
  if (tipo === "recordatorio") {
    const item = await prisma.reminder.findFirstOrThrow({
      where: { id, companyId },
      select: { obraId: true, clienteId: true },
    });
    return assertRelated(item.obraId, item.clienteId);
  }
  if (tipo === "eventoAgenda") {
    const item = await prisma.eventoAgenda.findFirstOrThrow({
      where: { id, companyId },
      select: { obraId: true, clienteId: true },
    });
    return assertRelated(item.obraId, item.clienteId);
  }
  if (tipo === "foto") {
    const item = await prisma.workPhoto.findFirstOrThrow({
      where: { id, work: { companyId } },
      select: { obraId: true },
    });
    return assertScopedEntityAccess(auth, capability, "Work", item.obraId);
  }
  if (tipo === "material") {
    const item = await prisma.material.findFirstOrThrow({
      where: { id, companyId },
      select: { obraId: true },
    });
    return assertScopedEntityAccess(auth, capability, "Work", item.obraId);
  }
  if (tipo === "presupuesto") {
    const item = await prisma.budget.findFirstOrThrow({
      where: { id, companyId },
      select: {
        obraId: true,
        clienteId: true,
        estado: true,
        total: true,
        margenEstimado: true,
      },
    });
    if (item.estado === "aceptado") {
      if (!(await resolveAuthorization(auth, "sales.budgets.approve")).allowed)
        throw new Error("ACCEPTED_BUDGET_APPROVAL_REQUIRED");
      await requireApprovalAuthority(auth, "quote.approve", {
        amount: item.total,
        marginPercent: item.margenEstimado,
        workId: item.obraId,
        clientId: item.clienteId,
      });
    }
    return assertRelated(item.obraId, item.clienteId);
  }
  if (tipo === "factura") {
    const item = await prisma.invoice.findFirstOrThrow({
      where: { id, companyId },
      select: { obraId: true, clienteId: true },
    });
    return assertRelated(item.obraId, item.clienteId);
  }
  if (tipo === "pago") {
    const item = await prisma.payment.findFirstOrThrow({
      where: { id, companyId },
      select: { obraId: true, clienteId: true },
    });
    return assertRelated(item.obraId, item.clienteId);
  }
  if (tipo === "gasto") {
    const item = await prisma.expense.findFirstOrThrow({
      where: { id, companyId },
      select: { obraId: true, clienteId: true },
    });
    return assertRelated(item.obraId, item.clienteId);
  }
  if (tipo === "contacto") {
    const item = await prisma.contact.findFirstOrThrow({
      where: { id, companyId },
      select: { clientId: true },
    });
    return assertRelated(null, item.clientId);
  }
  if (tipo === "notaInterna") {
    const item = await prisma.internalNote.findFirstOrThrow({
      where: { id, companyId },
      select: { workId: true, clientId: true },
    });
    return assertRelated(item.workId, item.clientId);
  }
}

async function saveClient(formData: FormData, id: string | null) {
  const { companyId } = await requireCompanyContext();
  const draft = clientDraftFromFormData(formData);
  const duplicateConfirmed =
    optionalText(formData, "confirmDuplicate") === "true";
  if (!id && !duplicateConfirmed) {
    const duplicate = await findClientDuplicateCandidate(draft, companyId);
    if (duplicate) {
      const target = optionalText(formData, "returnTo") ?? "/clientes";
      redirect(
        `${clientDuplicateRedirectUrl(draft, duplicate)}&returnTo=${encodeURIComponent(target)}`,
      );
    }
  }

  const data = {
    companyId,
    nombre:
      draft.nombre ??
      draft.razonSocial ??
      draft.nombreComercial ??
      "Cliente sin nombre",
    nombreComercial: draft.nombreComercial,
    razonSocial: draft.razonSocial,
    nifCif: draft.nifCif,
    telefono: draft.telefono ?? "",
    email: draft.email,
    direccion: draft.direccion ?? "",
    direccionFiscal: draft.direccionFiscal,
    codigoPostal: draft.codigoPostal,
    municipio: draft.municipio,
    provincia: draft.provincia,
    pais: draft.pais ?? "España",
    emailFacturacion: draft.emailFacturacion,
    telefonoFacturacion: draft.telefonoFacturacion,
    contactoPrincipalNombre: draft.contactoPrincipalNombre,
    contactoPrincipalCargo: draft.contactoPrincipalCargo,
    contactoPrincipalTelefono: draft.contactoPrincipalTelefono,
    contactoPrincipalEmail: draft.contactoPrincipalEmail,
    contactoFacturacionNombre: draft.contactoFacturacionNombre,
    tipo: draft.tipo ?? "Particular",
    estado: (draft.estado ?? "pendiente_datos") as ClientStatus,
    origen: draft.origen ?? "Manual",
    notas: draft.notas,
    ultimaInteraccion: optionalDate(formData, "ultimaInteraccion"),
  };

  if (id) await prisma.client.updateMany({ where: { id, companyId }, data });
  else await prisma.client.create({ data });
}

async function saveWork(formData: FormData, id: string | null) {
  const auth = await requireCompanyContext();
  const { companyId } = auth;
  const allowed = async (
    capability: Parameters<typeof resolveAuthorization>[1],
  ) => (await resolveAuthorization(auth, capability)).allowed;
  const canSales = await allowed("sales.budgets.view");
  const canInternalCost = await allowed("internal_cost.view");
  const canPurchaseCost = await allowed("purchase_cost.view");
  const canMargin =
    (await allowed("margin_amount.view")) ||
    (await allowed("margin_percent.view"));
  const data = {
    companyId,
    numeroInterno: optionalText(formData, "numeroInterno"),
    codigo: optionalText(formData, "codigo"),
    clienteId: text(formData, "clienteId"),
    contactoId: optionalText(formData, "contactoId"),
    contactoPrincipal: optionalText(formData, "contactoPrincipal"),
    contactoTelefono: optionalText(formData, "contactoTelefono"),
    contactoEmail: optionalText(formData, "contactoEmail"),
    titulo: text(formData, "titulo"),
    direccion: text(formData, "direccion"),
    latitud: optionalNumber(formData, "latitud"),
    longitud: optionalNumber(formData, "longitud"),
    tipoTrabajo: text(formData, "tipoTrabajo"),
    estado: text(formData, "estado") as WorkStatus,
    prioridad: text(formData, "prioridad") as WorkPriority,
    fechaInicioPrevista: optionalDate(formData, "fechaInicioPrevista"),
    fechaInicio: optionalDate(formData, "fechaInicio"),
    fechaInicioReal: optionalDate(formData, "fechaInicioReal"),
    fechaFinPrevista: optionalDate(formData, "fechaFinPrevista"),
    fechaFinReal: optionalDate(formData, "fechaFinReal"),
    responsable: optionalText(formData, "responsable"),
    comercial: optionalText(formData, "comercial"),
    jefeObra: optionalText(formData, "jefeObra"),
    descripcion: optionalText(formData, "descripcion"),
    observacionesInternas: optionalText(formData, "observacionesInternas"),
    notasPrivadas: optionalText(formData, "notasPrivadas"),
    ...(canSales && formData.has("presupuestoAprobado")
      ? { presupuestoAprobado: number(formData, "presupuestoAprobado") }
      : {}),
    ...(canInternalCost && formData.has("costePrevisto")
      ? { costePrevisto: number(formData, "costePrevisto") }
      : {}),
    ...(canPurchaseCost && formData.has("gastoReal")
      ? { gastoReal: number(formData, "gastoReal") }
      : {}),
    ...(canMargin && formData.has("margenEstimado")
      ? { margenEstimado: number(formData, "margenEstimado") }
      : {}),
    horasEstimadas: number(formData, "horasEstimadas"),
    horasReales: number(formData, "horasReales"),
    ...(canPurchaseCost && formData.has("subcontratasCoste")
      ? { subcontratasCoste: number(formData, "subcontratasCoste") }
      : {}),
    archivada: formData.get("archivada") === "on",
    archivadaAt:
      formData.get("archivada") === "on"
        ? (optionalDate(formData, "archivadaAt") ?? new Date())
        : null,
    notas: optionalText(formData, "notas"),
  };

  if (id) await prisma.work.updateMany({ where: { id, companyId }, data });
  else
    await prisma.work.create({
      data: {
        ...data,
        presupuestoAprobado: data.presupuestoAprobado ?? 0,
        costePrevisto: data.costePrevisto ?? 0,
        gastoReal: data.gastoReal ?? 0,
        margenEstimado: data.margenEstimado ?? 0,
        subcontratasCoste: data.subcontratasCoste ?? 0,
      },
    });
}

async function saveBudget(formData: FormData, id: string | null) {
  const auth = await requireCompanyContext();
  const { companyId } = auth;
  const canMargin =
    (await resolveAuthorization(auth, "margin_amount.view")).allowed ||
    (await resolveAuthorization(auth, "margin_percent.view")).allowed;
  const rawLines = parseBudgetLines(optionalText(formData, "partidas"));
  const lines = rawLines.length ? rawLines.map(normalizeLine) : [];
  const descuento = number(formData, "descuento");
  const calculated = calculateBudgetTotals(
    lines,
    number(formData, "ivaPercent", 21),
    descuento,
  );
  const subtotal = number(formData, "subtotal", calculated.subtotal);
  const iva = number(formData, "iva", calculated.iva);
  const total = number(
    formData,
    "total",
    Math.max(0, subtotal - descuento + iva),
  );
  const requestedNumero = optionalText(formData, "numero");
  const data = {
    companyId,
    clienteId: text(formData, "clienteId"),
    obraId: optionalText(formData, "obraId"),
    titulo: text(formData, "titulo"),
    partidas: lines.length
      ? serializeBudgetLines(lines)
      : normalizePartidas(optionalText(formData, "partidas"), subtotal),
    subtotal,
    iva,
    descuento,
    total,
    ...(canMargin && formData.has("margenEstimado")
      ? { margenEstimado: number(formData, "margenEstimado") }
      : {}),
    estado: text(formData, "estado") as BudgetStatus,
    fechaEnvio: optionalDate(formData, "fechaEnvio"),
    fechaValidez: optionalDate(formData, "fechaValidez"),
    fechaSeguimiento: optionalDate(formData, "fechaSeguimiento"),
    condiciones: optionalText(formData, "condiciones"),
    observaciones: optionalText(formData, "observaciones"),
    formaPago: optionalText(formData, "formaPago"),
  };

  if (id) {
    await prisma.budget.updateMany({
      where: { id, companyId },
      data: {
        ...data,
        ...(requestedNumero ? { numero: requestedNumero } : {}),
      },
    });
  } else {
    await prisma.$transaction(async (tx) =>
      tx.budget.create({
        data: {
          ...data,
          margenEstimado: data.margenEstimado ?? 0,
          numero:
            requestedNumero ??
            (await reserveDocumentNumberInTransaction(tx, companyId, "budget")),
        },
      }),
    );
  }
}

async function saveInvoice(formData: FormData, id: string | null) {
  const { companyId } = await requireCompanyContext();
  const rawLines = parseBudgetLines(optionalText(formData, "partidas"));
  const lines = rawLines.length ? rawLines.map(normalizeLine) : [];
  const calculated = calculateBudgetTotals(
    lines,
    number(formData, "ivaPercent", 21),
    0,
  );
  const importeBase = number(formData, "importeBase", calculated.subtotal);
  const iva = number(formData, "iva", calculated.iva);
  const total = number(formData, "total", importeBase + iva);
  const pagado = number(formData, "pagado");
  const pendiente = number(formData, "pendiente", Math.max(0, total - pagado));
  const fechaVencimiento = requiredDate(formData, "fechaVencimiento");
  const manualStatus = optionalText(formData, "estado") as InvoiceStatus | null;
  const autoStatus = deriveInvoiceStatus(total, pendiente, fechaVencimiento);
  const requestedNumero = optionalText(formData, "numero");
  const data = {
    companyId,
    clienteId: text(formData, "clienteId"),
    obraId: optionalText(formData, "obraId"),
    concepto: text(formData, "concepto"),
    partidas: lines.length
      ? serializeBudgetLines(lines)
      : normalizePartidas(optionalText(formData, "partidas"), importeBase),
    importeBase,
    iva,
    total,
    pagado,
    pendiente,
    fechaEmision: requiredDate(formData, "fechaEmision"),
    fechaVencimiento,
    estado:
      manualStatus === "borrador"
        ? "borrador"
        : pendingStateRequiresAuto(total, pagado, pendiente, fechaVencimiento)
          ? autoStatus
          : (manualStatus ?? autoStatus),
    observaciones: optionalText(formData, "observaciones"),
    metodoPago: optionalText(formData, "metodoPago"),
    datosBancarios: optionalText(formData, "datosBancarios"),
  };

  if (id) {
    await prisma.invoice.updateMany({
      where: { id, companyId },
      data: {
        ...data,
        ...(requestedNumero ? { numero: requestedNumero } : {}),
      },
    });
  } else {
    await prisma.$transaction(async (tx) =>
      tx.invoice.create({
        data: {
          ...data,
          numero:
            requestedNumero ??
            (await reserveDocumentNumberInTransaction(
              tx,
              companyId,
              "invoice",
            )),
        },
      }),
    );
  }
}

function pendingStateRequiresAuto(
  total: number,
  paid: number,
  pending: number,
  dueDate: Date,
) {
  return (
    pending <= 0 ||
    (paid > 0 && pending > 0) ||
    dueDate < startOfToday() ||
    pending < total
  );
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function savePayment(formData: FormData, id: string | null) {
  const { companyId } = await requireCompanyContext();
  const facturaId = text(formData, "facturaId");
  const invoice = await prisma.invoice.findFirst({
    where: { id: facturaId, companyId },
  });
  if (!invoice) throw new Error("Factura no encontrada.");

  const data = {
    companyId,
    facturaId,
    clienteId: invoice.clienteId,
    obraId: invoice.obraId,
    importe: number(formData, "importe"),
    metodo: text(formData, "metodo"),
    fecha: requiredDate(formData, "fecha"),
    tipo: text(formData, "tipoPago") as PaymentType,
    notas: optionalText(formData, "notas"),
  };

  if (id) await prisma.payment.updateMany({ where: { id, companyId }, data });
  else await prisma.payment.create({ data });

  await recalculateInvoice(invoice.id);
}

async function saveExpense(formData: FormData, id: string | null) {
  const { companyId } = await requireCompanyContext();
  const obraId = text(formData, "obraId");
  const work = await prisma.work.findFirst({
    where: { id: obraId, companyId },
  });
  const data = {
    companyId,
    obraId,
    clienteId: work?.clienteId ?? null,
    proveedor: text(formData, "proveedor"),
    concepto: text(formData, "concepto"),
    categoria: text(formData, "categoria") as ExpenseCategory,
    importe: number(formData, "importe"),
    fecha: requiredDate(formData, "fecha"),
    paymentStatus: optionalText(
      formData,
      "paymentStatus",
    ) as ExpenseCashStatus | null,
    paymentDueDate: optionalDate(formData, "paymentDueDate"),
    paidAt: optionalDate(formData, "paidAt"),
    costBehavior: (optionalText(formData, "costBehavior") ??
      "unknown") as CostBehavior,
    fotoTicketUrl: optionalText(formData, "fotoTicketUrl"),
    notas: optionalText(formData, "notas"),
  };

  if (id) await prisma.expense.updateMany({ where: { id, companyId }, data });
  else await prisma.expense.create({ data });
}

async function saveMaterial(formData: FormData, id: string | null) {
  const { companyId } = await requireCompanyContext();
  const data = {
    companyId,
    obraId: text(formData, "obraId"),
    nombre: text(formData, "nombre"),
    cantidad: text(formData, "cantidad"),
    estado: text(formData, "estado") as MaterialStatus,
    notas: optionalText(formData, "notas"),
  };

  if (id) await prisma.material.updateMany({ where: { id, companyId }, data });
  else await prisma.material.create({ data });
}

async function saveReminder(formData: FormData, id: string | null) {
  const { companyId } = await requireCompanyContext();
  const estado = text(formData, "estado") as ReminderStatus;
  const data = {
    companyId,
    clienteId: optionalText(formData, "clienteId"),
    obraId: optionalText(formData, "obraId"),
    facturaId: optionalText(formData, "facturaId"),
    presupuestoId: optionalText(formData, "presupuestoId"),
    contactId: optionalText(formData, "contactId"),
    tipo: text(formData, "tipoRecordatorio") as ReminderType,
    canal: text(formData, "canal") as ReminderChannel,
    mensaje: text(formData, "mensaje"),
    fechaProgramada: requiredDate(formData, "fechaProgramada"),
    estado,
    requiereConfirmacion:
      estado === "pendiente_confirmacion" ||
      formData.get("requiereConfirmacion") === "on",
    confirmadoPorUsuario:
      estado === "programado" || formData.get("confirmadoPorUsuario") === "on",
  };

  if (id) await prisma.reminder.updateMany({ where: { id, companyId }, data });
  else await prisma.reminder.create({ data });
}

async function saveAgendaEvent(formData: FormData, id: string | null) {
  const auth = await requireCapability("agenda.manage");
  const { companyId } = auth;
  const estado = text(formData, "estado") as EventoAgendaEstado;
  let clienteId = optionalText(formData, "clienteId");
  const obraId = optionalText(formData, "obraId");
  const presupuestoId = optionalText(formData, "presupuestoId");
  const facturaId = optionalText(formData, "facturaId");
  const contactId = optionalText(formData, "contactId");
  const [work, budget, invoice, contact] = await Promise.all([
    obraId
      ? prisma.work.findFirst({
          where: { id: obraId, companyId },
          select: { clienteId: true },
        })
      : null,
    presupuestoId
      ? prisma.budget.findFirst({
          where: { id: presupuestoId, companyId },
          select: { clienteId: true, obraId: true },
        })
      : null,
    facturaId
      ? prisma.invoice.findFirst({
          where: { id: facturaId, companyId },
          select: { clienteId: true, obraId: true },
        })
      : null,
    contactId
      ? prisma.contact.findFirst({
          where: { id: contactId, companyId },
          select: { clientId: true },
        })
      : null,
  ]);
  if (obraId && !work) throw new Error("Trabajo no disponible.");
  const scopedWorkIds = await resolveScopedEntityIds(auth, "work.view", "Work");
  if (scopedWorkIds !== null && (!obraId || !scopedWorkIds.includes(obraId)))
    throw new Error("Trabajo no asignado.");
  if (work) clienteId = work.clienteId;
  if (
    (budget &&
      (budget.clienteId !== clienteId ||
        (obraId && budget.obraId && budget.obraId !== obraId))) ||
    (invoice &&
      (invoice.clienteId !== clienteId ||
        (obraId && invoice.obraId && invoice.obraId !== obraId))) ||
    (contact && contact.clientId !== clienteId)
  )
    throw new Error("Las relaciones de agenda no son compatibles.");
  const data = {
    companyId,
    titulo: text(formData, "titulo"),
    descripcion: optionalText(formData, "descripcion"),
    tipo: text(formData, "tipoEvento") as EventoAgendaTipo,
    estado,
    fechaInicio: requiredDate(formData, "fechaInicio"),
    fechaFin: optionalDate(formData, "fechaFin"),
    horaInicio: optionalText(formData, "horaInicio"),
    horaFin: optionalText(formData, "horaFin"),
    clienteId,
    obraId,
    presupuestoId,
    facturaId,
    recordatorioId: optionalText(formData, "recordatorioId"),
    contactId,
    direccion: optionalText(formData, "direccion"),
    notas: optionalText(formData, "notas"),
    requiereConfirmacion: formData.get("requiereConfirmacion") === "on",
    confirmadoPorUsuario:
      ["confirmado", "realizado"].includes(estado) ||
      formData.get("confirmadoPorUsuario") === "on",
  };

  if (id)
    await prisma.eventoAgenda.updateMany({ where: { id, companyId }, data });
  else await prisma.eventoAgenda.create({ data });
}

async function saveContact(formData: FormData, id: string | null) {
  const { companyId } = await requireCompanyContext();
  const clientId = text(formData, "clientId");
  const isPrimary = formData.get("isPrimary") === "on";
  const isBillingContact = formData.get("isBillingContact") === "on";
  const isSiteContact = formData.get("isSiteContact") === "on";
  const archivedAt =
    formData.get("archived") === "on"
      ? (optionalDate(formData, "archivedAt") ?? new Date())
      : null;
  if (
    !(await prisma.client.findFirst({
      where: { id: clientId, companyId },
      select: { id: true },
    }))
  )
    throw new Error("Cliente no disponible.");
  const data = {
    companyId,
    clientId,
    nombre: text(formData, "nombre"),
    apellidos: optionalText(formData, "apellidos"),
    cargo: optionalText(formData, "cargo"),
    telefono: optionalText(formData, "telefono"),
    email: optionalText(formData, "email"),
    isPrimary,
    isBillingContact,
    isSiteContact,
    notes: optionalText(formData, "notes"),
    archivedAt,
  };

  await prisma.$transaction(async (tx) => {
    const otherContacts = id
      ? { companyId, clientId, id: { not: id } }
      : { companyId, clientId };
    if (isPrimary)
      await tx.contact.updateMany({
        where: otherContacts,
        data: { isPrimary: false },
      });
    if (isBillingContact)
      await tx.contact.updateMany({
        where: otherContacts,
        data: { isBillingContact: false },
      });
    if (isSiteContact)
      await tx.contact.updateMany({
        where: otherContacts,
        data: { isSiteContact: false },
      });
    const ownedId = id
      ? (
          await tx.contact.findFirstOrThrow({
            where: { id, companyId },
            select: { id: true },
          })
        ).id
      : null;
    const contact = ownedId
      ? await tx.contact.update({ where: { id: ownedId }, data })
      : await tx.contact.create({ data });
    if (!contact.archivedAt) {
      await syncLegacyContactFields(tx, contact);
    }
  });
}

async function syncLegacyContactFields(
  tx: PrismaTransaction,
  contact: {
    clientId: string;
    nombre: string;
    apellidos: string | null;
    cargo: string | null;
    telefono: string | null;
    email: string | null;
    isPrimary: boolean;
    isBillingContact: boolean;
  },
) {
  const fullName = [contact.nombre, contact.apellidos]
    .filter(Boolean)
    .join(" ");
  if (contact.isPrimary) {
    await tx.client.update({
      where: { id: contact.clientId },
      data: {
        contactoPrincipalNombre: fullName,
        contactoPrincipalCargo: contact.cargo,
        contactoPrincipalTelefono: contact.telefono,
        contactoPrincipalEmail: contact.email,
      },
    });
  }
  if (contact.isBillingContact) {
    await tx.client.update({
      where: { id: contact.clientId },
      data: {
        contactoFacturacionNombre: fullName,
        telefonoFacturacion: contact.telefono,
        emailFacturacion: contact.email,
      },
    });
  }
}

async function saveInternalNote(formData: FormData, id: string | null) {
  const { companyId } = await requireCompanyContext();
  const data = {
    companyId,
    clientId: optionalText(formData, "clientId"),
    workId: optionalText(formData, "workId"),
    invoiceId: optionalText(formData, "invoiceId"),
    budgetId: optionalText(formData, "budgetId"),
    authorId: optionalText(formData, "authorId"),
    content: text(formData, "content"),
    archivedAt:
      formData.get("archived") === "on"
        ? (optionalDate(formData, "archivedAt") ?? new Date())
        : null,
  };
  if (!data.clientId && !data.workId && !data.invoiceId && !data.budgetId)
    throw new Error("La nota interna debe estar asociada a una entidad.");
  if (id)
    await prisma.internalNote.updateMany({ where: { id, companyId }, data });
  else await prisma.internalNote.create({ data });
}

async function saveDocument(
  formData: FormData,
  id: string | null,
  auth: Awaited<ReturnType<typeof requireCapability>>,
) {
  const { companyId, userId } = auth;
  const manifest = await buildPortalManifest(auth);
  const requestedClassification = (optionalText(formData, "classification") ??
    manifest.documentClasses[0]) as DocumentClassification | undefined;
  if (
    !requestedClassification ||
    !manifest.documentClasses.includes(requestedClassification)
  )
    throw new Error("DOCUMENT_CLASSIFICATION_FORBIDDEN");
  const url = optionalText(formData, "url");
  const safeUrl = assertSafeDocumentUrl(url);
  const mimeType = optionalText(formData, "mimeType");
  if (mimeType && !ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType))
    throw new Error("Tipo de archivo no permitido.");
  const data = {
    companyId,
    name: text(formData, "name"),
    originalName: optionalText(formData, "originalName"),
    mimeType,
    size: optionalInteger(formData, "size"),
    storageKey: optionalText(formData, "storageKey"),
    url: safeUrl,
    category: text(formData, "category") as DocumentCategory,
    classification: requestedClassification,
    clientId: optionalText(formData, "clientId"),
    workId: optionalText(formData, "workId"),
    budgetId: optionalText(formData, "budgetId"),
    invoiceId: optionalText(formData, "invoiceId"),
    expenseId: optionalText(formData, "expenseId"),
    uploadedById: userId,
    archivedAt:
      formData.get("archived") === "on"
        ? (optionalDate(formData, "archivedAt") ?? new Date())
        : null,
  };
  if (
    !data.clientId &&
    !data.workId &&
    !data.budgetId &&
    !data.invoiceId &&
    !data.expenseId
  )
    throw new Error("El documento debe estar asociado a una entidad.");
  if (id) await prisma.document.updateMany({ where: { id, companyId }, data });
  else await prisma.document.create({ data });
}

async function savePhoto(formData: FormData, id: string | null) {
  const { companyId } = await requireCompanyContext();
  const url = assertSafeDocumentUrl(optionalText(formData, "url"));
  const data = {
    obraId: text(formData, "obraId"),
    documentId: optionalText(formData, "documentId"),
    categoria: text(formData, "categoria"),
    titulo: text(formData, "titulo"),
    url,
    autor: optionalText(formData, "autor"),
    ubicacion: optionalText(formData, "ubicacion"),
    notas: optionalText(formData, "notas"),
    tomadaEn: requiredDate(formData, "tomadaEn"),
  };
  if (
    !(await prisma.work.findFirst({
      where: { id: data.obraId, companyId },
      select: { id: true },
    }))
  )
    throw new Error("Obra no disponible.");
  if (
    data.documentId &&
    !(await prisma.document.findFirst({
      where: { id: data.documentId, companyId },
      select: { id: true },
    }))
  )
    throw new Error("Documento no disponible.");
  if (id) {
    const photo = await prisma.workPhoto.findFirst({
      where: { id, work: { companyId } },
      select: { id: true },
    });
    if (!photo) throw new Error("Foto no disponible.");
    await prisma.workPhoto.update({ where: { id: photo.id }, data });
  } else await prisma.workPhoto.create({ data });
}

async function recalculateInvoice(facturaId: string) {
  const { companyId } = await requireCompanyContext();
  const invoice = await prisma.invoice.findFirst({
    where: { id: facturaId, companyId },
    include: { payments: true },
  });
  if (!invoice) return;

  const pagado = invoice.payments.reduce(
    (sum, payment) => sum + payment.importe,
    0,
  );
  const pendiente = Math.max(0, invoice.total - pagado);

  await prisma.invoice.updateMany({
    where: { id: facturaId, companyId },
    data: {
      pagado,
      pendiente,
      estado: deriveInvoiceStatus(
        invoice.total,
        pendiente,
        invoice.fechaVencimiento,
      ),
    },
  });
}

function text(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  if (!value) throw new Error(`Falta el campo ${key}.`);
  return value;
}

function optionalText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function number(formData: FormData, key: string, fallback = 0) {
  const value = optionalText(formData, key);
  if (!value) return fallback;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalInteger(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalDate(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  return value ? new Date(value) : null;
}

function requiredDate(formData: FormData, key: string) {
  return optionalDate(formData, key) ?? new Date();
}

function normalizePartidas(value: string | null, subtotal: number) {
  if (!value) return "[]";
  try {
    JSON.parse(value);
    return value;
  } catch {
    return JSON.stringify([{ concepto: value, cantidad: 1, precio: subtotal }]);
  }
}

function targetFor(tipo: ManualEntity) {
  const targets: Record<ManualEntity, string> = {
    cliente: "/clientes",
    obra: "/obras",
    presupuesto: "/presupuestos",
    factura: "/dinero",
    pago: "/dinero",
    gasto: "/gastos-materiales",
    material: "/gastos-materiales",
    recordatorio: "/recordatorios",
    eventoAgenda: "/agenda",
    contacto: "/clientes",
    notaInterna: "/hoy",
    documento: "/documentos",
    foto: "/obras",
  };
  return targets[tipo] ?? "/hoy";
}

function assertSafeDocumentUrl(value: string | null) {
  if (!value) return null;
  if (value.startsWith("/") || value.startsWith("https://")) return value;
  throw new Error("La URL del documento debe ser relativa o HTTPS.");
}

type PrismaTransaction = Prisma.TransactionClient;
