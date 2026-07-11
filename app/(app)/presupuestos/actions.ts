"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { calculateBudgetTotals, lineTotal, normalizeLine, parseBudgetLines, serializeBudgetLines } from "@/lib/budget-lines";
import { findBudgetTemplate } from "@/lib/budget-templates";
import { nextDocumentNumber } from "@/lib/numbering";
import { reevaluateProactiveAfterMutation } from "@/lib/proactive-evaluation";

export async function updateBudgetStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (!id || !estado) return;

  await prisma.budget.update({
    where: { id },
    data: {
      estado: estado as any,
      fechaEnvio: estado === "enviado" || estado === "pendiente_respuesta" ? new Date() : undefined
    }
  });

  if (estado === "aceptado") {
    const budget = await prisma.budget.findUnique({ where: { id }, include: { client: true } });
    if (budget) {
      await prisma.client.update({ where: { id: budget.clienteId }, data: { estado: "aceptado" } });
    }
  }
  const updated = await prisma.budget.findUnique({ where: { id }, select: { clienteId: true, obraId: true } });
  await reevaluateProactiveAfterMutation({ entityType: "budget", entityId: id, clientId: updated?.clienteId, workId: updated?.obraId, budgetId: id, reason: "budget_status_updated" });

  revalidatePath("/presupuestos");
  revalidatePath(`/presupuestos/${id}`);
  revalidatePath("/hoy");
}

export async function convertBudgetToWork(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const budget = await prisma.budget.findUnique({ where: { id }, include: { client: true } });
  if (!budget) return;

  if (budget.obraId) {
    await prisma.$transaction([
      prisma.budget.update({ where: { id }, data: { estado: "aceptado" } }),
      prisma.client.update({ where: { id: budget.clienteId }, data: { estado: "obra_activa" } })
    ]);
    await reevaluateProactiveAfterMutation({ entityType: "budget", entityId: id, clientId: budget.clienteId, workId: budget.obraId, budgetId: id, reason: "budget_converted_existing_work" });
    revalidatePath("/presupuestos");
    revalidatePath("/obras");
    revalidatePath("/clientes");
    revalidatePath("/hoy");
    return;
  }

  const work = await prisma.work.create({
    data: {
      clienteId: budget.clienteId,
      titulo: budget.titulo,
      direccion: budget.client.direccion,
      tipoTrabajo: budget.titulo,
      estado: "pendiente_inicio",
      fechaInicio: new Date(),
      fechaFinPrevista: null,
      presupuestoAprobado: budget.total,
      gastoReal: 0,
      margenEstimado: budget.margenEstimado,
      notas: `Creada desde presupuesto ${budget.numero}.`
    }
  });

  await prisma.$transaction([
    prisma.budget.update({ where: { id }, data: { estado: "aceptado", obraId: work.id } }),
    prisma.client.update({ where: { id: budget.clienteId }, data: { estado: "obra_activa" } })
  ]);
  await reevaluateProactiveAfterMutation({ entityType: "work", entityId: work.id, clientId: budget.clienteId, workId: work.id, budgetId: id, reason: "budget_converted_to_work" });

  revalidatePath("/presupuestos");
  revalidatePath("/obras");
  revalidatePath("/clientes");
  revalidatePath("/hoy");
}

export async function convertBudgetToInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const budget = await prisma.budget.findUnique({ where: { id }, include: { client: true } });
  if (!budget) return;

  const invoice = await prisma.invoice.create({
    data: {
      clienteId: budget.clienteId,
      obraId: budget.obraId,
      numero: await nextDocumentNumber("invoice"),
      concepto: `Factura de ${budget.titulo}`,
      partidas: budget.partidas,
      importeBase: budget.subtotal,
      iva: budget.iva,
      total: budget.total,
      pagado: 0,
      pendiente: budget.total,
      fechaEmision: new Date(),
      fechaVencimiento: addDays(7),
      estado: "borrador",
      observaciones: `Creada desde presupuesto aceptado ${budget.numero}. Revisar antes de enviar al cliente.`,
      metodoPago: budget.formaPago,
      datosBancarios: null
    }
  });
  await reevaluateProactiveAfterMutation({ entityType: "invoice", entityId: invoice.id, clientId: budget.clienteId, workId: budget.obraId, invoiceId: invoice.id, budgetId: budget.id, reason: "budget_converted_to_invoice" });

  revalidatePath("/presupuestos");
  revalidatePath("/dinero");
  revalidatePath("/hoy");
  redirect(`/dinero/${invoice.id}`);
}

export async function duplicateBudget(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const budget = await prisma.budget.findUnique({ where: { id } });
  if (!budget) return;

  const copy = await prisma.budget.create({
    data: {
      clienteId: budget.clienteId,
      obraId: budget.obraId,
      numero: await nextDocumentNumber("budget"),
      titulo: `${budget.titulo} (copia)`,
      partidas: budget.partidas,
      subtotal: budget.subtotal,
      iva: budget.iva,
      descuento: budget.descuento,
      total: budget.total,
      margenEstimado: budget.margenEstimado,
      estado: "borrador",
      fechaValidez: budget.fechaValidez,
      fechaSeguimiento: null,
      condiciones: budget.condiciones,
      observaciones: budget.observaciones,
      formaPago: budget.formaPago
    }
  });
  await reevaluateProactiveAfterMutation({ entityType: "budget", entityId: copy.id, clientId: budget.clienteId, workId: budget.obraId, budgetId: copy.id, reason: "budget_duplicated" });

  revalidatePath("/presupuestos");
  redirect(`/presupuestos/${copy.id}`);
}

export async function createBudgetFromTemplate(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "");
  const clienteId = String(formData.get("clienteId") ?? "");
  const obraId = optionalText(formData, "obraId");
  const template = findBudgetTemplate(templateId);
  if (!template || !clienteId) return;

  const company = await prisma.empresa.findFirst();
  const totals = calculateBudgetTotals(template.lines, company?.ivaDefecto ?? 21, 0);
  const budget = await prisma.budget.create({
    data: {
      clienteId,
      obraId,
      numero: await nextDocumentNumber("budget"),
      titulo: template.name,
      partidas: serializeBudgetLines(template.lines),
      subtotal: totals.subtotal,
      iva: totals.iva,
      descuento: totals.descuento,
      total: totals.total,
      margenEstimado: 0,
      estado: "borrador",
      fechaValidez: addDays(15),
      condiciones: company?.condicionesPorDefecto ?? "Validez 15 días. Precios y partidas editables antes de enviar.",
      observaciones: `Creado desde plantilla ${template.name}. Revisar importes antes de enviar.`,
      formaPago: "Transferencia / según acuerdo"
    }
  });
  await reevaluateProactiveAfterMutation({ entityType: "budget", entityId: budget.id, clientId: clienteId, workId: obraId, budgetId: budget.id, reason: "budget_created_from_template" });

  revalidatePath("/presupuestos");
  redirect(`/presupuestos/${budget.id}`);
}

export async function saveBudgetLine(formData: FormData) {
  const budgetId = String(formData.get("budgetId") ?? "");
  const indexValue = String(formData.get("lineIndex") ?? "");
  const index = indexValue === "" ? -1 : Number(indexValue);
  const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
  if (!budget) return;

  const lines = parseBudgetLines(budget.partidas);
  const cantidad = number(formData, "cantidad", 1);
  const precioUnitario = number(formData, "precioUnitario", 0);
  const line = normalizeLine({
    descripcion: String(formData.get("descripcion") ?? "Partida"),
    cantidad,
    unidad: String(formData.get("unidad") ?? "ud"),
    precioUnitario,
    total: lineTotal(cantidad, precioUnitario),
    categoria: String(formData.get("categoria") ?? "General")
  });

  if (Number.isInteger(index) && index >= 0 && index < lines.length) lines[index] = line;
  else lines.push(line);

  await updateBudgetLinesAndTotals(budgetId, lines, budget.descuento);
}

export async function deleteBudgetLine(formData: FormData) {
  const budgetId = String(formData.get("budgetId") ?? "");
  const index = Number(formData.get("lineIndex") ?? -1);
  const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
  if (!budget || !Number.isInteger(index)) return;

  const lines = parseBudgetLines(budget.partidas).filter((_, current) => current !== index);
  await updateBudgetLinesAndTotals(budgetId, lines, budget.descuento);
}

async function updateBudgetLinesAndTotals(budgetId: string, lines: ReturnType<typeof parseBudgetLines>, discount: number) {
  const company = await prisma.empresa.findFirst();
  const totals = calculateBudgetTotals(lines, company?.ivaDefecto ?? 21, discount);
  await prisma.budget.update({
    where: { id: budgetId },
    data: {
      partidas: serializeBudgetLines(lines),
      subtotal: totals.subtotal,
      iva: totals.iva,
      descuento: totals.descuento,
      total: totals.total
    }
  });
  const budget = await prisma.budget.findUnique({ where: { id: budgetId }, select: { clienteId: true, obraId: true } });
  await reevaluateProactiveAfterMutation({ entityType: "budget", entityId: budgetId, clientId: budget?.clienteId, workId: budget?.obraId, budgetId, reason: "budget_lines_updated" });

  revalidatePath("/presupuestos");
  revalidatePath(`/presupuestos/${budgetId}`);
  revalidatePath("/hoy");
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function optionalText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(formData: FormData, key: string, fallback = 0) {
  const value = optionalText(formData, key);
  if (!value) return fallback;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}
