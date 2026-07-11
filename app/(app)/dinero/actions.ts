"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PaymentType, ReminderChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reevaluateProactiveAfterMutation } from "@/lib/proactive-evaluation";
import { deriveInvoiceStatus } from "@/lib/status";

export async function registerPayment(formData: FormData) {
  const facturaId = String(formData.get("facturaId") ?? "");
  const importe = Number(formData.get("importe") ?? 0);
  const metodo = String(formData.get("metodo") ?? "transferencia");
  const tipo = String(formData.get("tipo") ?? "pago_parcial") as PaymentType;
  const notas = String(formData.get("notas") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  const redirectTo = String(formData.get("redirectTo") ?? "");

  if (!facturaId || !Number.isFinite(importe) || importe <= 0 || !confirmado) {
    throw new Error("Importe o factura no válidos.");
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: facturaId } });
  if (!invoice) throw new Error("Factura no encontrada.");

  const nuevoPagado = Math.min(invoice.total, invoice.pagado + importe);
  const nuevoPendiente = Math.max(0, invoice.total - nuevoPagado);
  const estado = deriveInvoiceStatus(invoice.total, nuevoPendiente, invoice.fechaVencimiento);

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        facturaId: invoice.id,
        clienteId: invoice.clienteId,
        obraId: invoice.obraId,
        importe,
        metodo,
        fecha: fecha ? new Date(fecha) : new Date(),
        tipo,
        notas: notas || null
      }
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        pagado: nuevoPagado,
        pendiente: nuevoPendiente,
        estado
      }
    })
  ]);
  await reevaluateProactiveAfterMutation({ entityType: "invoice", entityId: invoice.id, clientId: invoice.clienteId, workId: invoice.obraId, invoiceId: invoice.id, reason: "payment_registered" });

  revalidatePath("/dinero");
  revalidatePath(`/dinero/${facturaId}`);
  revalidatePath("/agenda");
  revalidatePath("/hoy");
  if (redirectTo) redirect(redirectTo);
}

export async function prepareCollectionReminder(formData: FormData) {
  const facturaId = String(formData.get("facturaId") ?? "");
  const canal = String(formData.get("canal") ?? "whatsapp") as ReminderChannel;
  const fecha = String(formData.get("fechaProgramada") ?? "");

  const invoice = await prisma.invoice.findUnique({
    where: { id: facturaId },
    include: { client: true, work: true }
  });
  if (!invoice) throw new Error("Factura no encontrada.");

  const fechaProgramada = fecha ? new Date(fecha) : tomorrowAtTen();
  const isOverdue = invoice.fechaVencimiento < new Date() && invoice.pendiente > 0;

  await prisma.reminder.create({
    data: {
      clienteId: invoice.clienteId,
      obraId: invoice.obraId,
      facturaId: invoice.id,
      tipo: isOverdue ? "factura_vencida" : "recordatorio_factura",
      canal,
      mensaje: buildCollectionMessage(invoice.client.nombre, invoice.numero, invoice.pendiente, isOverdue),
      fechaProgramada,
      estado: "pendiente_confirmacion",
      requiereConfirmacion: true,
      confirmadoPorUsuario: false
    }
  });
  await reevaluateProactiveAfterMutation({ entityType: "invoice", entityId: invoice.id, clientId: invoice.clienteId, workId: invoice.obraId, invoiceId: invoice.id, reason: "collection_reminder_prepared" });

  revalidatePath("/dinero");
  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
  revalidatePath("/hoy");
}

export async function markInvoicePaid(formData: FormData) {
  const facturaId = String(formData.get("facturaId") ?? "");
  const confirmado = String(formData.get("confirmadoPorUsuario") ?? "") === "true";
  if (!facturaId || !confirmado) throw new Error("Confirmación requerida.");

  const invoice = await prisma.invoice.findUnique({ where: { id: facturaId } });
  if (!invoice || invoice.pendiente <= 0) return;

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        facturaId: invoice.id,
        clienteId: invoice.clienteId,
        obraId: invoice.obraId,
        importe: invoice.pendiente,
        metodo: String(formData.get("metodo") ?? invoice.metodoPago ?? "transferencia"),
        fecha: new Date(),
        tipo: "pago_final",
        notas: "Marcada como pagada manualmente desde Capataz."
      }
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        pagado: invoice.total,
        pendiente: 0,
        estado: "pagada"
      }
    })
  ]);
  await reevaluateProactiveAfterMutation({ entityType: "invoice", entityId: invoice.id, clientId: invoice.clienteId, workId: invoice.obraId, invoiceId: invoice.id, reason: "invoice_marked_paid" });

  revalidatePath("/dinero");
  revalidatePath(`/dinero/${facturaId}`);
  revalidatePath("/hoy");
}

function tomorrowAtTen() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date;
}

function buildCollectionMessage(clientName: string, number: string, pending: number, isOverdue: boolean) {
  const amount = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(pending);
  if (isOverdue) {
    return `Hola ${clientName}, te dejo recordatorio de la factura ${number}, que aparece vencida con ${amount} pendiente. ¿Me confirmas si está previsto el pago?`;
  }

  return `Hola ${clientName}, te dejo recordatorio de la factura ${number}, con ${amount} pendiente. Cuando puedas me dices si está todo correcto.`;
}
