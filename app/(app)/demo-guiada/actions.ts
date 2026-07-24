"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";
import { requireCapability } from "@/lib/commercial/authorization";

function demoIds(companyId: string) {
  const suffix = companyId.replace(/[^a-zA-Z0-9_-]/g, "").slice(-32);
  return {
    client: `flow-client-bano-${suffix}`,
    visit: `flow-visit-bano-${suffix}`,
    budget: `flow-budget-bano-${suffix}`,
    budgetFollowUp: `flow-budget-follow-up-${suffix}`,
    work: `flow-work-bano-${suffix}`,
    expense: `flow-expense-bano-${suffix}`,
    material: `flow-material-bano-${suffix}`,
    invoice: `flow-invoice-bano-${suffix}`,
    partialPayment: `flow-payment-partial-${suffix}`,
    finalPayment: `flow-payment-final-${suffix}`,
    collectionReminder: `flow-collection-reminder-${suffix}`
  };
}

export async function runGuidedDemoStep(formData: FormData) {
  const auth = await requireCapability("company.update");
  const company = await prisma.company.findFirst({ where: { id: auth.companyId, isDemo: true }, select: { id: true } });
  if (!company) throw new Error("GUIDED_DEMO_NOT_AVAILABLE");
  await assertDemoOwnership(auth.companyId);
  const step = Number(formData.get("step") ?? 0);

  if (step === 0) {
    await resetGuidedDemo(auth.companyId);
  } else if (step >= 1 && step <= 12) {
    for (let current = 1; current <= step; current += 1) {
      await applyStep(current, auth.companyId);
    }
  }

  revalidateAll();
}

async function applyStep(step: number, companyId: string) {
  const ids = demoIds(companyId);
  switch (step) {
    case 1:
      await ensureClient(companyId, "nuevo", "Lead entrante desde llamada. Quiere reformar un baño.");
      return;
    case 2:
      await ensureClient(companyId, "visita_pendiente", "Datos completos. Quiere plato de ducha, alicatado y mampara.");
      return;
    case 3:
      await ensureClient(companyId, "visita_pendiente", "Visita agendada para tomar medidas.");
      await prisma.reminder.upsert({
        where: { id: ids.visit },
        update: {
          clienteId: ids.client,
          tipo: "confirmar_visita",
          canal: "interno",
          mensaje: "Visita para medir baño y revisar calidades.",
          fechaProgramada: dayAt(1, 10),
          estado: "programado",
          requiereConfirmacion: false,
          confirmadoPorUsuario: true
        },
        create: {
          id: ids.visit,
          companyId,
          clienteId: ids.client,
          tipo: "confirmar_visita",
          canal: "interno",
          mensaje: "Visita para medir baño y revisar calidades.",
          fechaProgramada: dayAt(1, 10),
          estado: "programado",
          requiereConfirmacion: false,
          confirmadoPorUsuario: true
        }
      });
      return;
    case 4:
      await prisma.budget.upsert({
        where: { id: ids.budget },
        update: budgetData(companyId, "borrador"),
        create: { id: ids.budget, ...budgetData(companyId, "borrador") }
      });
      await prisma.client.update({ where: { id: ids.client }, data: { estado: "presupuesto_pendiente" } });
      return;
    case 5:
      await prisma.budget.update({
        where: { id: ids.budget },
        data: { estado: "pendiente_respuesta", fechaEnvio: dayAt(-3, 12), fechaSeguimiento: dayAt(1, 10) }
      });
      await prisma.client.update({ where: { id: ids.client }, data: { estado: "seguimiento_pendiente" } });
      await prisma.reminder.upsert({
        where: { id: ids.budgetFollowUp },
        update: followUpData(companyId),
        create: { id: ids.budgetFollowUp, ...followUpData(companyId) }
      });
      return;
    case 6:
      await prisma.budget.update({ where: { id: ids.budget }, data: { estado: "aceptado" } });
      await prisma.work.upsert({
        where: { id: ids.work },
        update: workData(companyId, "en_curso"),
        create: { id: ids.work, ...workData(companyId, "en_curso") }
      });
      await prisma.budget.update({ where: { id: ids.budget }, data: { obraId: ids.work } });
      await prisma.reminder.updateMany({ where: { id: ids.visit }, data: { obraId: ids.work } });
      await prisma.client.update({ where: { id: ids.client }, data: { estado: "obra_activa" } });
      return;
    case 7:
      await prisma.expense.upsert({
        where: { id: ids.expense },
        update: expenseData(companyId),
        create: { id: ids.expense, ...expenseData(companyId) }
      });
      await prisma.material.upsert({
        where: { id: ids.material },
        update: materialData(companyId, "pendiente"),
        create: { id: ids.material, ...materialData(companyId, "pendiente") }
      });
      await prisma.work.update({ where: { id: ids.work }, data: { gastoReal: 420, margenEstimado: 520 } });
      return;
    case 8:
      await prisma.invoice.upsert({
        where: { id: ids.invoice },
        update: invoiceData(companyId, 0, 1500, "pendiente_pago"),
        create: { id: ids.invoice, ...invoiceData(companyId, 0, 1500, "pendiente_pago") }
      });
      await prisma.client.update({ where: { id: ids.client }, data: { estado: "pendiente_cobro" } });
      return;
    case 9:
      await upsertPayment(companyId, ids.partialPayment, 500, "pago_parcial", "Pago parcial de anticipo.");
      await recalculateInvoice(companyId);
      return;
    case 10:
      await prisma.reminder.upsert({
        where: { id: ids.collectionReminder },
        update: collectionReminderData(companyId),
        create: { id: ids.collectionReminder, ...collectionReminderData(companyId) }
      });
      return;
    case 11:
      await upsertPayment(companyId, ids.finalPayment, 1000, "pago_final", "Pago final recibido.");
      await recalculateInvoice(companyId);
      return;
    case 12:
      await prisma.work.update({ where: { id: ids.work }, data: { estado: "cerrada", fechaFinPrevista: dayAt(0, 18) } });
      await prisma.client.update({ where: { id: ids.client }, data: { estado: "finalizado" } });
      return;
  }
}

async function resetGuidedDemo(companyId: string) {
  const ids = demoIds(companyId);
  await prisma.payment.deleteMany({ where: { id: { in: [ids.partialPayment, ids.finalPayment] }, companyId } });
  await prisma.reminder.deleteMany({ where: { id: { in: [ids.visit, ids.budgetFollowUp, ids.collectionReminder] }, companyId } });
  await prisma.material.deleteMany({ where: { id: ids.material, companyId } });
  await prisma.expense.deleteMany({ where: { id: ids.expense, companyId } });
  await prisma.invoice.deleteMany({ where: { id: ids.invoice, companyId } });
  await prisma.budget.deleteMany({ where: { id: ids.budget, companyId } });
  await prisma.work.deleteMany({ where: { id: ids.work, companyId } });
  await prisma.client.deleteMany({ where: { id: ids.client, companyId } });
}

async function ensureClient(companyId: string, estado: "nuevo" | "visita_pendiente" | "presupuesto_pendiente" | "seguimiento_pendiente", notas: string) {
  const ids = demoIds(companyId);
  await prisma.client.upsert({
    where: { id: ids.client },
    update: {
      nombre: "Laura Martín",
      telefono: "+34 655 123 456",
      email: "laura.martin@example.com",
      direccion: "Calle Azulejo 14, Madrid",
      tipo: "Particular",
      estado,
      origen: "Llamada",
      notas,
      ultimaInteraccion: new Date()
    },
    create: {
      id: ids.client,
      companyId,
      nombre: "Laura Martín",
      telefono: "+34 655 123 456",
      email: "laura.martin@example.com",
      direccion: "Calle Azulejo 14, Madrid",
      tipo: "Particular",
      estado,
      origen: "Llamada",
      notas,
      fechaCreacion: new Date(),
      ultimaInteraccion: new Date()
    }
  });
}

function budgetData(companyId: string, estado: "borrador" | "pendiente_respuesta") {
  const ids = demoIds(companyId);
  return {
    companyId,
    clienteId: ids.client,
    obraId: null,
    numero: "P-DEMO-BAÑO",
    titulo: "Reforma de baño Laura",
    partidas: JSON.stringify([
      { concepto: "Retirada bañera y desescombro", cantidad: 1, precio: 280 },
      { concepto: "Fontanería y plato de ducha", cantidad: 1, precio: 420 },
      { concepto: "Alicatado zona ducha", cantidad: 1, precio: 540 },
      { concepto: "Mampara y remates", cantidad: 1, precio: 260 }
    ]),
    subtotal: 1239.67,
    iva: 260.33,
    total: 1500,
    margenEstimado: 520,
    estado,
    fechaEnvio: estado === "pendiente_respuesta" ? dayAt(-3, 12) : null,
    fechaSeguimiento: dayAt(1, 10),
    condiciones: "Validez 15 días. Materiales de gama media incluidos."
  };
}

function workData(companyId: string, estado: "en_curso" | "cerrada") {
  const ids = demoIds(companyId);
  return {
    companyId,
    clienteId: ids.client,
    titulo: "Baño Laura Martín",
    direccion: "Calle Azulejo 14, Madrid",
    tipoTrabajo: "Reforma de baño",
    estado,
    fechaInicio: dayAt(2, 8),
    fechaFinPrevista: dayAt(8, 18),
    presupuestoAprobado: 1500,
    gastoReal: estado === "cerrada" ? 420 : 0,
    margenEstimado: estado === "cerrada" ? 520 : 0,
    notas: "Demo guiada: baño con plato de ducha, mampara y remates."
  };
}

function expenseData(companyId: string) {
  const ids = demoIds(companyId);
  return {
    companyId,
    obraId: ids.work,
    clienteId: ids.client,
    proveedor: "Suministros Baño Centro",
    concepto: "Plato, cemento cola y lechada",
    categoria: "material" as const,
    importe: 420,
    fecha: dayAt(0, 9),
    fotoTicketUrl: null,
    notas: "Gasto demo registrado desde flujo guiado."
  };
}

function materialData(companyId: string, estado: "pendiente" | "entregado") {
  const ids = demoIds(companyId);
  return {
    companyId,
    obraId: ids.work,
    nombre: "Mampara frontal",
    cantidad: "1 unidad",
    estado,
    notas: "Pendiente confirmar entrega con proveedor."
  };
}

function invoiceData(companyId: string, pagado: number, pendiente: number, estado: "pendiente_pago" | "parcialmente_pagada" | "pagada") {
  const ids = demoIds(companyId);
  return {
    companyId,
    clienteId: ids.client,
    obraId: ids.work,
    numero: "F-DEMO-BAÑO",
    concepto: "Reforma baño Laura Martín",
    importeBase: 1239.67,
    iva: 260.33,
    total: 1500,
    pagado,
    pendiente,
    fechaEmision: dayAt(0, 12),
    fechaVencimiento: dayAt(7, 12),
    estado
  };
}

async function upsertPayment(companyId: string, id: string, importe: number, tipo: "pago_parcial" | "pago_final", notas: string) {
  const ids = demoIds(companyId);
  await prisma.payment.upsert({
    where: { id },
    update: {
      importe,
      metodo: "transferencia",
      fecha: new Date(),
      tipo,
      notas
    },
    create: {
      id,
      companyId,
      facturaId: ids.invoice,
      clienteId: ids.client,
      obraId: ids.work,
      importe,
      metodo: "transferencia",
      fecha: new Date(),
      tipo,
      notas
    }
  });
}

async function recalculateInvoice(companyId: string) {
  const ids = demoIds(companyId);
  const invoice = await prisma.invoice.findFirst({
    where: { id: ids.invoice, companyId },
    include: { payments: true }
  });
  if (!invoice) return;

  const pagado = Math.min(invoice.total, invoice.payments.reduce((sum, payment) => sum + payment.importe, 0));
  const pendiente = Math.max(0, invoice.total - pagado);
  await prisma.invoice.update({
    where: { id: ids.invoice },
    data: { pagado, pendiente, estado: deriveInvoiceStatus(invoice.total, pendiente, invoice.fechaVencimiento) }
  });
}

function followUpData(companyId: string) {
  const ids = demoIds(companyId);
  return {
    companyId,
    clienteId: ids.client,
    obraId: null,
    presupuestoId: ids.budget,
    tipo: "seguimiento_presupuesto" as const,
    canal: "whatsapp" as const,
    mensaje: "Hola Laura, ¿qué tal? Te escribo por el presupuesto de la reforma del baño. ¿Has podido revisarlo?",
    fechaProgramada: dayAt(1, 10),
    estado: "programado" as const,
    requiereConfirmacion: false,
    confirmadoPorUsuario: true
  };
}

function collectionReminderData(companyId: string) {
  const ids = demoIds(companyId);
  return {
    companyId,
    clienteId: ids.client,
    obraId: ids.work,
    facturaId: ids.invoice,
    tipo: "recordatorio_factura" as const,
    canal: "whatsapp" as const,
    mensaje: "Buenos días. Te escribo para recordar que queda pendiente el resto de la factura de la reforma. Cuando puedas, ¿me confirmas si lo has podido revisar? Gracias.",
    fechaProgramada: dayAt(2, 10),
    estado: "programado" as const,
    requiereConfirmacion: false,
    confirmadoPorUsuario: true
  };
}

function dayAt(offset: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function assertDemoOwnership(companyId: string) {
  const ids = demoIds(companyId);
  const records = await Promise.all([
    prisma.client.findUnique({ where: { id: ids.client }, select: { companyId: true } }),
    prisma.work.findUnique({ where: { id: ids.work }, select: { companyId: true } }),
    prisma.budget.findUnique({ where: { id: ids.budget }, select: { companyId: true } }),
    prisma.invoice.findUnique({ where: { id: ids.invoice }, select: { companyId: true } }),
    prisma.expense.findUnique({ where: { id: ids.expense }, select: { companyId: true } }),
    prisma.material.findUnique({ where: { id: ids.material }, select: { companyId: true } }),
    prisma.payment.findMany({ where: { id: { in: [ids.partialPayment, ids.finalPayment] } }, select: { companyId: true } }),
    prisma.reminder.findMany({ where: { id: { in: [ids.visit, ids.budgetFollowUp, ids.collectionReminder] } }, select: { companyId: true } }),
  ]);
  const owners = records.flatMap((record) => Array.isArray(record) ? record : record ? [record] : []);
  if (owners.some((record) => record.companyId !== companyId)) throw new Error("GUIDED_DEMO_ID_CONFLICT");
}

function revalidateAll() {
  ["/demo-guiada", "/hoy", "/agenda", "/clientes", "/obras", "/presupuestos", "/dinero", "/gastos-materiales", "/recordatorios"].forEach((path) =>
    revalidatePath(path)
  );
}
