"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  BudgetStatus,
  ClientStatus,
  CostBehavior,
  DocumentCategory,
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
  WorkStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateBudgetTotals, normalizeLine, parseBudgetLines, serializeBudgetLines } from "@/lib/budget-lines";
import { clientDraftFromFormData, clientDuplicateRedirectUrl, findClientDuplicateCandidate } from "@/lib/client-crm";
import { ALLOWED_DOCUMENT_MIME_TYPES } from "@/lib/documents";
import { nextDocumentNumber } from "@/lib/numbering";
import { reevaluateProactiveAfterMutation } from "@/lib/proactive-evaluation";
import { deriveInvoiceStatus } from "@/lib/status";

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
      await saveDocument(formData, id);
      break;
    case "foto":
      await savePhoto(formData, id);
      break;
    default:
      throw new Error("Tipo de gestión no soportado.");
  }

  if (["cliente", "obra", "presupuesto", "factura", "pago", "gasto", "material", "recordatorio", "eventoAgenda", "documento"].includes(tipo)) {
    await reevaluateProactiveAfterMutation({
      entityType: tipo,
      entityId: id,
      clientId: optionalText(formData, "clienteId") ?? optionalText(formData, "clientId"),
      workId: optionalText(formData, "obraId"),
      invoiceId: optionalText(formData, "facturaId"),
      budgetId: optionalText(formData, "presupuestoId") ?? optionalText(formData, "budgetId"),
      reason: `manual_${tipo}_saved`
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

async function saveClient(formData: FormData, id: string | null) {
  const draft = clientDraftFromFormData(formData);
  const duplicateConfirmed = optionalText(formData, "confirmDuplicate") === "true";
  if (!id && !duplicateConfirmed) {
    const duplicate = await findClientDuplicateCandidate(draft);
    if (duplicate) {
      const target = optionalText(formData, "returnTo") ?? "/clientes";
      redirect(`${clientDuplicateRedirectUrl(draft, duplicate)}&returnTo=${encodeURIComponent(target)}`);
    }
  }

  const data = {
    nombre: draft.nombre ?? draft.razonSocial ?? draft.nombreComercial ?? "Cliente sin nombre",
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
    ultimaInteraccion: optionalDate(formData, "ultimaInteraccion")
  };

  if (id) await prisma.client.update({ where: { id }, data });
  else await prisma.client.create({ data });
}

async function saveWork(formData: FormData, id: string | null) {
  const data = {
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
    presupuestoAprobado: number(formData, "presupuestoAprobado"),
    costePrevisto: number(formData, "costePrevisto"),
    gastoReal: number(formData, "gastoReal"),
    margenEstimado: number(formData, "margenEstimado"),
    horasEstimadas: number(formData, "horasEstimadas"),
    horasReales: number(formData, "horasReales"),
    subcontratasCoste: number(formData, "subcontratasCoste"),
    archivada: formData.get("archivada") === "on",
    archivadaAt: formData.get("archivada") === "on" ? optionalDate(formData, "archivadaAt") ?? new Date() : null,
    notas: optionalText(formData, "notas")
  };

  if (id) await prisma.work.update({ where: { id }, data });
  else await prisma.work.create({ data });
}

async function saveBudget(formData: FormData, id: string | null) {
  const rawLines = parseBudgetLines(optionalText(formData, "partidas"));
  const lines = rawLines.length ? rawLines.map(normalizeLine) : [];
  const descuento = number(formData, "descuento");
  const calculated = calculateBudgetTotals(lines, number(formData, "ivaPercent", 21), descuento);
  const subtotal = number(formData, "subtotal", calculated.subtotal);
  const iva = number(formData, "iva", calculated.iva);
  const total = number(formData, "total", Math.max(0, subtotal - descuento + iva));
  const data = {
    clienteId: text(formData, "clienteId"),
    obraId: optionalText(formData, "obraId"),
    numero: optionalText(formData, "numero") ?? await nextDocumentNumber("budget"),
    titulo: text(formData, "titulo"),
    partidas: lines.length ? serializeBudgetLines(lines) : normalizePartidas(optionalText(formData, "partidas"), subtotal),
    subtotal,
    iva,
    descuento,
    total,
    margenEstimado: number(formData, "margenEstimado"),
    estado: text(formData, "estado") as BudgetStatus,
    fechaEnvio: optionalDate(formData, "fechaEnvio"),
    fechaValidez: optionalDate(formData, "fechaValidez"),
    fechaSeguimiento: optionalDate(formData, "fechaSeguimiento"),
    condiciones: optionalText(formData, "condiciones"),
    observaciones: optionalText(formData, "observaciones"),
    formaPago: optionalText(formData, "formaPago")
  };

  if (id) await prisma.budget.update({ where: { id }, data });
  else await prisma.budget.create({ data });
}

async function saveInvoice(formData: FormData, id: string | null) {
  const rawLines = parseBudgetLines(optionalText(formData, "partidas"));
  const lines = rawLines.length ? rawLines.map(normalizeLine) : [];
  const calculated = calculateBudgetTotals(lines, number(formData, "ivaPercent", 21), 0);
  const importeBase = number(formData, "importeBase", calculated.subtotal);
  const iva = number(formData, "iva", calculated.iva);
  const total = number(formData, "total", importeBase + iva);
  const pagado = number(formData, "pagado");
  const pendiente = number(formData, "pendiente", Math.max(0, total - pagado));
  const fechaVencimiento = requiredDate(formData, "fechaVencimiento");
  const manualStatus = optionalText(formData, "estado") as InvoiceStatus | null;
  const autoStatus = deriveInvoiceStatus(total, pendiente, fechaVencimiento);
  const data = {
    clienteId: text(formData, "clienteId"),
    obraId: optionalText(formData, "obraId"),
    numero: optionalText(formData, "numero") ?? await nextDocumentNumber("invoice"),
    concepto: text(formData, "concepto"),
    partidas: lines.length ? serializeBudgetLines(lines) : normalizePartidas(optionalText(formData, "partidas"), importeBase),
    importeBase,
    iva,
    total,
    pagado,
    pendiente,
    fechaEmision: requiredDate(formData, "fechaEmision"),
    fechaVencimiento,
    estado: manualStatus === "borrador" ? "borrador" : pendingStateRequiresAuto(total, pagado, pendiente, fechaVencimiento) ? autoStatus : manualStatus ?? autoStatus,
    observaciones: optionalText(formData, "observaciones"),
    metodoPago: optionalText(formData, "metodoPago"),
    datosBancarios: optionalText(formData, "datosBancarios")
  };

  if (id) await prisma.invoice.update({ where: { id }, data });
  else await prisma.invoice.create({ data });
}

function pendingStateRequiresAuto(total: number, paid: number, pending: number, dueDate: Date) {
  return pending <= 0 || (paid > 0 && pending > 0) || dueDate < startOfToday() || pending < total;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function savePayment(formData: FormData, id: string | null) {
  const facturaId = text(formData, "facturaId");
  const invoice = await prisma.invoice.findUnique({ where: { id: facturaId } });
  if (!invoice) throw new Error("Factura no encontrada.");

  const data = {
    facturaId,
    clienteId: invoice.clienteId,
    obraId: invoice.obraId,
    importe: number(formData, "importe"),
    metodo: text(formData, "metodo"),
    fecha: requiredDate(formData, "fecha"),
    tipo: text(formData, "tipoPago") as PaymentType,
    notas: optionalText(formData, "notas")
  };

  if (id) await prisma.payment.update({ where: { id }, data });
  else await prisma.payment.create({ data });

  await recalculateInvoice(invoice.id);
}

async function saveExpense(formData: FormData, id: string | null) {
  const obraId = text(formData, "obraId");
  const work = await prisma.work.findUnique({ where: { id: obraId } });
  const data = {
    obraId,
    clienteId: work?.clienteId ?? null,
    proveedor: text(formData, "proveedor"),
    concepto: text(formData, "concepto"),
    categoria: text(formData, "categoria") as ExpenseCategory,
    importe: number(formData, "importe"),
    fecha: requiredDate(formData, "fecha"),
    paymentStatus: optionalText(formData, "paymentStatus") as ExpenseCashStatus | null,
    paymentDueDate: optionalDate(formData, "paymentDueDate"),
    paidAt: optionalDate(formData, "paidAt"),
    costBehavior: (optionalText(formData, "costBehavior") ?? "unknown") as CostBehavior,
    fotoTicketUrl: optionalText(formData, "fotoTicketUrl"),
    notas: optionalText(formData, "notas")
  };

  if (id) await prisma.expense.update({ where: { id }, data });
  else await prisma.expense.create({ data });
}

async function saveMaterial(formData: FormData, id: string | null) {
  const data = {
    obraId: text(formData, "obraId"),
    nombre: text(formData, "nombre"),
    cantidad: text(formData, "cantidad"),
    estado: text(formData, "estado") as MaterialStatus,
    notas: optionalText(formData, "notas")
  };

  if (id) await prisma.material.update({ where: { id }, data });
  else await prisma.material.create({ data });
}

async function saveReminder(formData: FormData, id: string | null) {
  const estado = text(formData, "estado") as ReminderStatus;
  const data = {
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
    requiereConfirmacion: estado === "pendiente_confirmacion" || formData.get("requiereConfirmacion") === "on",
    confirmadoPorUsuario: estado === "programado" || formData.get("confirmadoPorUsuario") === "on"
  };

  if (id) await prisma.reminder.update({ where: { id }, data });
  else await prisma.reminder.create({ data });
}

async function saveAgendaEvent(formData: FormData, id: string | null) {
  const estado = text(formData, "estado") as EventoAgendaEstado;
  const data = {
    titulo: text(formData, "titulo"),
    descripcion: optionalText(formData, "descripcion"),
    tipo: text(formData, "tipoEvento") as EventoAgendaTipo,
    estado,
    fechaInicio: requiredDate(formData, "fechaInicio"),
    fechaFin: optionalDate(formData, "fechaFin"),
    horaInicio: optionalText(formData, "horaInicio"),
    horaFin: optionalText(formData, "horaFin"),
    clienteId: optionalText(formData, "clienteId"),
    obraId: optionalText(formData, "obraId"),
    presupuestoId: optionalText(formData, "presupuestoId"),
    facturaId: optionalText(formData, "facturaId"),
    recordatorioId: optionalText(formData, "recordatorioId"),
    contactId: optionalText(formData, "contactId"),
    direccion: optionalText(formData, "direccion"),
    notas: optionalText(formData, "notas"),
    requiereConfirmacion: formData.get("requiereConfirmacion") === "on",
    confirmadoPorUsuario:
      ["confirmado", "realizado"].includes(estado) || formData.get("confirmadoPorUsuario") === "on"
  };

  if (id) await prisma.eventoAgenda.update({ where: { id }, data });
  else await prisma.eventoAgenda.create({ data });
}

async function saveContact(formData: FormData, id: string | null) {
  const clientId = text(formData, "clientId");
  const isPrimary = formData.get("isPrimary") === "on";
  const isBillingContact = formData.get("isBillingContact") === "on";
  const isSiteContact = formData.get("isSiteContact") === "on";
  const archivedAt = formData.get("archived") === "on" ? optionalDate(formData, "archivedAt") ?? new Date() : null;
  const data = {
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
    archivedAt
  };

  await prisma.$transaction(async (tx) => {
    const otherContacts = id ? { clientId, id: { not: id } } : { clientId };
    if (isPrimary) await tx.contact.updateMany({ where: otherContacts, data: { isPrimary: false } });
    if (isBillingContact) await tx.contact.updateMany({ where: otherContacts, data: { isBillingContact: false } });
    if (isSiteContact) await tx.contact.updateMany({ where: otherContacts, data: { isSiteContact: false } });
    const contact = id ? await tx.contact.update({ where: { id }, data }) : await tx.contact.create({ data });
    if (!contact.archivedAt) {
      await syncLegacyContactFields(tx, contact);
    }
  });
}

async function syncLegacyContactFields(tx: PrismaTransaction, contact: {
  clientId: string;
  nombre: string;
  apellidos: string | null;
  cargo: string | null;
  telefono: string | null;
  email: string | null;
  isPrimary: boolean;
  isBillingContact: boolean;
}) {
  const fullName = [contact.nombre, contact.apellidos].filter(Boolean).join(" ");
  if (contact.isPrimary) {
    await tx.client.update({
      where: { id: contact.clientId },
      data: {
        contactoPrincipalNombre: fullName,
        contactoPrincipalCargo: contact.cargo,
        contactoPrincipalTelefono: contact.telefono,
        contactoPrincipalEmail: contact.email
      }
    });
  }
  if (contact.isBillingContact) {
    await tx.client.update({
      where: { id: contact.clientId },
      data: {
        contactoFacturacionNombre: fullName,
        telefonoFacturacion: contact.telefono,
        emailFacturacion: contact.email
      }
    });
  }
}

async function saveInternalNote(formData: FormData, id: string | null) {
  const data = {
    clientId: optionalText(formData, "clientId"),
    workId: optionalText(formData, "workId"),
    invoiceId: optionalText(formData, "invoiceId"),
    budgetId: optionalText(formData, "budgetId"),
    authorId: optionalText(formData, "authorId"),
    content: text(formData, "content"),
    archivedAt: formData.get("archived") === "on" ? optionalDate(formData, "archivedAt") ?? new Date() : null
  };
  if (!data.clientId && !data.workId && !data.invoiceId && !data.budgetId) throw new Error("La nota interna debe estar asociada a una entidad.");
  if (id) await prisma.internalNote.update({ where: { id }, data });
  else await prisma.internalNote.create({ data });
}

async function saveDocument(formData: FormData, id: string | null) {
  const url = optionalText(formData, "url");
  const safeUrl = assertSafeDocumentUrl(url);
  const mimeType = optionalText(formData, "mimeType");
  if (mimeType && !ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType)) throw new Error("Tipo de archivo no permitido.");
  const data = {
    name: text(formData, "name"),
    originalName: optionalText(formData, "originalName"),
    mimeType,
    size: optionalInteger(formData, "size"),
    storageKey: optionalText(formData, "storageKey"),
    url: safeUrl,
    category: text(formData, "category") as DocumentCategory,
    clientId: optionalText(formData, "clientId"),
    workId: optionalText(formData, "workId"),
    budgetId: optionalText(formData, "budgetId"),
    invoiceId: optionalText(formData, "invoiceId"),
    expenseId: optionalText(formData, "expenseId"),
    uploadedById: optionalText(formData, "uploadedById"),
    archivedAt: formData.get("archived") === "on" ? optionalDate(formData, "archivedAt") ?? new Date() : null
  };
  if (!data.clientId && !data.workId && !data.budgetId && !data.invoiceId && !data.expenseId) throw new Error("El documento debe estar asociado a una entidad.");
  if (id) await prisma.document.update({ where: { id }, data });
  else await prisma.document.create({ data });
}

async function savePhoto(formData: FormData, id: string | null) {
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
    tomadaEn: requiredDate(formData, "tomadaEn")
  };
  if (id) await prisma.workPhoto.update({ where: { id }, data });
  else await prisma.workPhoto.create({ data });
}

async function recalculateInvoice(facturaId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: facturaId },
    include: { payments: true }
  });
  if (!invoice) return;

  const pagado = invoice.payments.reduce((sum, payment) => sum + payment.importe, 0);
  const pendiente = Math.max(0, invoice.total - pagado);

  await prisma.invoice.update({
    where: { id: facturaId },
    data: {
      pagado,
      pendiente,
      estado: deriveInvoiceStatus(invoice.total, pendiente, invoice.fechaVencimiento)
    }
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
    foto: "/obras"
  };
  return targets[tipo] ?? "/hoy";
}

function assertSafeDocumentUrl(value: string | null) {
  if (!value) return null;
  if (value.startsWith("/") || value.startsWith("https://")) return value;
  throw new Error("La URL del documento debe ser relativa o HTTPS.");
}

type PrismaTransaction = Prisma.TransactionClient;
