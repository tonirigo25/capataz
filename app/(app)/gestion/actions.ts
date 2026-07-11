"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  BudgetStatus,
  ClientStatus,
  EventoAgendaEstado,
  EventoAgendaTipo,
  ExpenseCategory,
  InvoiceStatus,
  MaterialStatus,
  PaymentType,
  ReminderChannel,
  ReminderStatus,
  ReminderType,
  WorkStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateBudgetTotals, normalizeLine, parseBudgetLines, serializeBudgetLines } from "@/lib/budget-lines";
import { clientDraftFromFormData, clientDuplicateRedirectUrl, findClientDuplicateCandidate } from "@/lib/client-crm";
import { nextDocumentNumber } from "@/lib/numbering";
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
  | "eventoAgenda";

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
    default:
      throw new Error("Tipo de gestión no soportado.");
  }

  revalidatePath("/hoy");
  revalidatePath("/clientes");
  revalidatePath("/obras");
  revalidatePath("/presupuestos");
  revalidatePath("/dinero");
  revalidatePath("/gastos-materiales");
  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
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
    clienteId: text(formData, "clienteId"),
    titulo: text(formData, "titulo"),
    direccion: text(formData, "direccion"),
    tipoTrabajo: text(formData, "tipoTrabajo"),
    estado: text(formData, "estado") as WorkStatus,
    fechaInicio: optionalDate(formData, "fechaInicio"),
    fechaFinPrevista: optionalDate(formData, "fechaFinPrevista"),
    presupuestoAprobado: number(formData, "presupuestoAprobado"),
    gastoReal: number(formData, "gastoReal"),
    margenEstimado: number(formData, "margenEstimado"),
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
    direccion: optionalText(formData, "direccion"),
    notas: optionalText(formData, "notas"),
    requiereConfirmacion: formData.get("requiereConfirmacion") === "on",
    confirmadoPorUsuario:
      ["confirmado", "realizado"].includes(estado) || formData.get("confirmadoPorUsuario") === "on"
  };

  if (id) await prisma.eventoAgenda.update({ where: { id }, data });
  else await prisma.eventoAgenda.create({ data });
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
    eventoAgenda: "/agenda"
  };
  return targets[tipo] ?? "/hoy";
}
