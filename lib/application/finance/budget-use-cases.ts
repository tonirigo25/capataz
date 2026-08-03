import { invalidateActionPath as revalidatePath, navigateAction as redirect } from "@/lib/application/action-effects";
import { prisma } from "@/lib/prisma";
import { assertBudgetRecordReconciled, calculateBudgetMargin, calculateBudgetTotals, lineTotal, normalizeLine, parseBudgetLines, serializeBudgetLines } from "@/lib/budget-lines";
import { findBudgetTemplate } from "@/lib/budget-templates";
import { reserveDocumentNumberInTransaction } from "@/lib/numbering";
import { reevaluateProactiveAfterMutation } from "@/lib/proactive-evaluation";
import { assertScopedEntityAccess, requireApprovalAuthority, requireCapability, resolveAuthorization } from "@/lib/commercial/authorization";
import type { BudgetStatus } from "@prisma/client";

async function budgetContext(id: string | undefined, capability: "sales.budgets.update" | "sales.budgets.approve" | "sales.budgets.create" | "sales.invoices.create") {
  const auth = await requireCapability(capability);
  const budget = id ? await prisma.budget.findFirst({ where: { id, companyId: auth.companyId }, include: { client: true } }) : null;
  if (budget?.obraId) await assertScopedEntityAccess(auth, capability, "Work", budget.obraId);
  else if (budget) await assertScopedEntityAccess(auth, capability, "Client", budget.clienteId);
  const pricing = await resolveAuthorization(auth, "sales.pricing.view");
  if (!pricing.allowed) throw new Error("SALES_PRICING_REQUIRED");
  if (budget?.obraId) await assertScopedEntityAccess(auth, "sales.pricing.view", "Work", budget.obraId);
  else if (budget) await assertScopedEntityAccess(auth, "sales.pricing.view", "Client", budget.clienteId);
  if (budget?.estado === "aceptado" && capability === "sales.budgets.update") {
    if (!(await resolveAuthorization(auth, "sales.budgets.approve")).allowed) throw new Error("ACCEPTED_BUDGET_APPROVAL_REQUIRED");
  }
  return { auth, budget };
}

function requiredBudgetMargin(budget: { partidas: string; descuento: number }) {
  const margin = calculateBudgetMargin(parseBudgetLines(budget.partidas), budget.descuento);
  if (!margin.complete || margin.percent === null || margin.amount === null || margin.cost === null) throw new Error("BUDGET_COSTS_REQUIRED");
  return margin;
}

export async function updateBudgetStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  if (!id || !estado) return;

  const capability = ["aceptado", "rechazado", "caducado"].includes(estado) ? "sales.budgets.approve" : "sales.budgets.update";
  const { auth, budget } = await budgetContext(id, capability);
  if (!budget) return;
  if (["enviado", "visto", "pendiente_respuesta", "aceptado"].includes(estado)) {
    assertBudgetRecordReconciled(parseBudgetLines(budget.partidas), budget);
  }
  if (estado === "aceptado") {
    const margin = requiredBudgetMargin(budget);
    await requireApprovalAuthority(auth, "quote.approve", { amount: budget.total, marginPercent: margin.percent!, workId: budget.obraId, clientId: budget.clienteId });
  }
  await prisma.budget.updateMany({
    where: { id, companyId: auth.companyId },
    data: {
      estado: estado as BudgetStatus,
      fechaEnvio: estado === "enviado" || estado === "pendiente_respuesta" ? new Date() : undefined
    }
  });

  if (estado === "aceptado") {
    await prisma.client.updateMany({ where: { id: budget.clienteId, companyId: auth.companyId }, data: { estado: "aceptado" } });
  }
  const updated = await prisma.budget.findFirst({ where: { id, companyId: auth.companyId }, select: { clienteId: true, obraId: true } });
  await reevaluateProactiveAfterMutation({ companyId: auth.companyId, entityType: "budget", entityId: id, clientId: updated?.clienteId, workId: updated?.obraId, budgetId: id, reason: "budget_status_updated" });

  revalidatePath("/presupuestos");
  revalidatePath(`/presupuestos/${id}`);
  revalidatePath("/hoy");
}

export async function convertBudgetToWork(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { auth, budget } = await budgetContext(id, "sales.budgets.approve");
  await requireCapability("work.create");
  if (!budget) return;
  assertBudgetRecordReconciled(parseBudgetLines(budget.partidas), budget);
  const margin = requiredBudgetMargin(budget);
  await requireApprovalAuthority(auth, "quote.approve", { amount: budget.total, marginPercent: margin.percent!, workId: budget.obraId, clientId: budget.clienteId });

  if (budget.obraId) {
    await prisma.$transaction([
      prisma.budget.updateMany({ where: { id, companyId: auth.companyId }, data: { estado: "aceptado" } }),
      prisma.client.updateMany({ where: { id: budget.clienteId, companyId: auth.companyId }, data: { estado: "obra_activa" } }),
      prisma.work.updateMany({ where: { id: budget.obraId, companyId: auth.companyId }, data: { presupuestoAprobado: margin.revenue, costePrevisto: margin.cost!, margenEstimado: margin.amount! } })
    ]);
    await reevaluateProactiveAfterMutation({ companyId: auth.companyId, entityType: "budget", entityId: id, clientId: budget.clienteId, workId: budget.obraId, budgetId: id, reason: "budget_converted_existing_work" });
    revalidatePath("/presupuestos");
    revalidatePath("/obras");
    revalidatePath("/clientes");
    revalidatePath("/hoy");
    return;
  }

  const work = await prisma.work.create({
    data: {
      clienteId: budget.clienteId,
      companyId: auth.companyId,
      titulo: budget.titulo,
      direccion: budget.client.direccion,
      tipoTrabajo: budget.titulo,
      estado: "pendiente_inicio",
      fechaInicio: new Date(),
      fechaFinPrevista: null,
      presupuestoAprobado: margin.revenue,
      costePrevisto: margin.cost!,
      gastoReal: 0,
      margenEstimado: margin.amount!,
      notas: `Creada desde presupuesto ${budget.numero}.`
    }
  });

  await prisma.$transaction([
    prisma.budget.updateMany({ where: { id, companyId: auth.companyId }, data: { estado: "aceptado", obraId: work.id } }),
    prisma.client.updateMany({ where: { id: budget.clienteId, companyId: auth.companyId }, data: { estado: "obra_activa" } })
  ]);
  await reevaluateProactiveAfterMutation({ companyId: auth.companyId, entityType: "work", entityId: work.id, clientId: budget.clienteId, workId: work.id, budgetId: id, reason: "budget_converted_to_work" });

  revalidatePath("/presupuestos");
  revalidatePath("/obras");
  revalidatePath("/clientes");
  revalidatePath("/hoy");
}

export async function convertBudgetToInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { auth, budget } = await budgetContext(id, "sales.invoices.create");
  if (!budget) return;
  assertBudgetRecordReconciled(parseBudgetLines(budget.partidas), budget);

  const invoice = await prisma.$transaction(async (tx) => tx.invoice.create({
    data: {
      clienteId: budget.clienteId,
      companyId: auth.companyId,
      obraId: budget.obraId,
      numero: await reserveDocumentNumberInTransaction(tx, auth.companyId, "invoice"),
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
  }));
  await reevaluateProactiveAfterMutation({ companyId: auth.companyId, entityType: "invoice", entityId: invoice.id, clientId: budget.clienteId, workId: budget.obraId, invoiceId: invoice.id, budgetId: budget.id, reason: "budget_converted_to_invoice" });

  revalidatePath("/presupuestos");
  revalidatePath("/dinero");
  revalidatePath("/hoy");
  redirect(`/dinero/${invoice.id}`);
}

export async function duplicateBudget(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { auth, budget } = await budgetContext(id, "sales.budgets.create");
  if (!budget) return;
  const margin = calculateBudgetMargin(parseBudgetLines(budget.partidas), budget.descuento);

  const copy = await prisma.$transaction(async (tx) => tx.budget.create({
    data: {
      clienteId: budget.clienteId,
      companyId: auth.companyId,
      obraId: budget.obraId,
      numero: await reserveDocumentNumberInTransaction(tx, auth.companyId, "budget"),
      titulo: `${budget.titulo} (copia)`,
      partidas: budget.partidas,
      subtotal: budget.subtotal,
      iva: budget.iva,
      descuento: budget.descuento,
      total: budget.total,
      margenEstimado: margin.amount ?? 0,
      estado: "borrador",
      fechaValidez: budget.fechaValidez,
      fechaSeguimiento: null,
      condiciones: budget.condiciones,
      observaciones: budget.observaciones,
      formaPago: budget.formaPago
    }
  }));
  await reevaluateProactiveAfterMutation({ companyId: auth.companyId, entityType: "budget", entityId: copy.id, clientId: budget.clienteId, workId: budget.obraId, budgetId: copy.id, reason: "budget_duplicated" });

  revalidatePath("/presupuestos");
  redirect(`/presupuestos/${copy.id}`);
}

export async function createBudgetFromTemplate(formData: FormData) {
  const auth = await requireCapability("sales.budgets.create");
  const pricing = await resolveAuthorization(auth, "sales.pricing.view");
  if (!pricing.allowed) throw new Error("SALES_PRICING_REQUIRED");
  const templateId = String(formData.get("templateId") ?? "");
  const clienteId = String(formData.get("clienteId") ?? "");
  const obraId = optionalText(formData, "obraId");
  const template = findBudgetTemplate(templateId);
  if (!template || !clienteId) return;

  const company = await prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } });
  const client = await prisma.client.findFirst({ where: { id: clienteId, companyId: auth.companyId }, select: { id: true } });
  const work = obraId ? await prisma.work.findFirst({ where: { id: obraId, companyId: auth.companyId }, select: { id: true, clienteId: true } }) : null;
  if (!client) return;
  if (obraId && (!work || work.clienteId !== clienteId)) throw new Error("BUDGET_WORK_CLIENT_MISMATCH");
  if (obraId) await assertScopedEntityAccess(auth, "sales.budgets.create", "Work", obraId);
  else await assertScopedEntityAccess(auth, "sales.budgets.create", "Client", clienteId);
  if (obraId) await assertScopedEntityAccess(auth, "sales.pricing.view", "Work", obraId);
  else {
    if (auth.scope === "SELECTED_WORKS" || pricing.scope === "SELECTED_WORKS") throw new Error("SCOPE_REQUIRED");
    await assertScopedEntityAccess(auth, "sales.pricing.view", "Client", clienteId);
  }
  const totals = calculateBudgetTotals(template.lines, company.defaultVat, 0);
  const margin = calculateBudgetMargin(template.lines, 0);
  const budget = await prisma.$transaction(async (tx) => tx.budget.create({
    data: {
      clienteId,
      companyId: auth.companyId,
      obraId,
      numero: await reserveDocumentNumberInTransaction(tx, auth.companyId, "budget"),
      titulo: template.name,
      partidas: serializeBudgetLines(template.lines),
      subtotal: totals.subtotal,
      iva: totals.iva,
      descuento: totals.descuento,
      total: totals.total,
      margenEstimado: margin.amount ?? 0,
      estado: "borrador",
      fechaValidez: addDays(15),
      condiciones: company.defaultConditions ?? "Validez 15 días. Precios y partidas editables antes de enviar.",
      observaciones: `Creado desde plantilla ${template.name}. Revisar importes antes de enviar.`,
      formaPago: "Transferencia / según acuerdo"
    }
  }));
  await reevaluateProactiveAfterMutation({ companyId: auth.companyId, entityType: "budget", entityId: budget.id, clientId: clienteId, workId: obraId, budgetId: budget.id, reason: "budget_created_from_template" });

  revalidatePath("/presupuestos");
  redirect(`/presupuestos/${budget.id}`);
}

export async function saveBudgetLine(formData: FormData) {
  const budgetId = String(formData.get("budgetId") ?? "");
  const indexValue = String(formData.get("lineIndex") ?? "");
  const index = indexValue === "" ? -1 : Number(indexValue);
  const { budget } = await budgetContext(budgetId, "sales.budgets.update");
  if (!budget) return;

  const lines = parseBudgetLines(budget.partidas);
  const cantidad = requiredNumber(formData, "cantidad");
  const precioUnitario = requiredNumber(formData, "precioUnitario");
  const costeUnitario = requiredNumber(formData, "costeUnitario");
  const line = normalizeLine({
    descripcion: String(formData.get("descripcion") ?? "Partida"),
    cantidad,
    unidad: String(formData.get("unidad") ?? "ud"),
    precioUnitario,
    total: lineTotal(cantidad, precioUnitario),
    costeUnitario,
    costeTotal: lineTotal(cantidad, costeUnitario),
    categoria: String(formData.get("categoria") ?? "General")
  });

  if (Number.isInteger(index) && index >= 0 && index < lines.length) lines[index] = line;
  else lines.push(line);

  await updateBudgetLinesAndTotals(budgetId, lines, budget.descuento);
}

export async function deleteBudgetLine(formData: FormData) {
  const budgetId = String(formData.get("budgetId") ?? "");
  const index = Number(formData.get("lineIndex") ?? -1);
  const { budget } = await budgetContext(budgetId, "sales.budgets.update");
  if (!budget || !Number.isInteger(index)) return;

  const lines = parseBudgetLines(budget.partidas).filter((_, current) => current !== index);
  await updateBudgetLinesAndTotals(budgetId, lines, budget.descuento);
}

async function updateBudgetLinesAndTotals(budgetId: string, lines: ReturnType<typeof parseBudgetLines>, discount: number) {
  const { auth } = await budgetContext(budgetId, "sales.budgets.update");
  const company = await prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } });
  const totals = calculateBudgetTotals(lines, company.defaultVat, discount);
  const margin = calculateBudgetMargin(lines, discount);
  const current = await prisma.budget.findFirstOrThrow({ where: { id: budgetId, companyId: auth.companyId }, select: { estado: true, obraId: true, clienteId: true } });
  if (current.estado === "aceptado") {
    if (!(await resolveAuthorization(auth, "sales.budgets.approve")).allowed) throw new Error("ACCEPTED_BUDGET_APPROVAL_REQUIRED");
    if (margin.percent === null) throw new Error("BUDGET_COSTS_REQUIRED");
    await requireApprovalAuthority(auth, "quote.approve", { amount: totals.total, marginPercent: margin.percent, workId: current.obraId, clientId: current.clienteId });
  }
  await prisma.budget.updateMany({
    where: { id: budgetId, companyId: auth.companyId },
    data: {
      partidas: serializeBudgetLines(lines),
      subtotal: totals.subtotal,
      iva: totals.iva,
      descuento: totals.descuento,
      total: totals.total,
      margenEstimado: margin.amount ?? 0,
    }
  });
  const budget = await prisma.budget.findFirst({ where: { id: budgetId, companyId: auth.companyId }, select: { clienteId: true, obraId: true } });
  await reevaluateProactiveAfterMutation({ companyId: auth.companyId, entityType: "budget", entityId: budgetId, clientId: budget?.clienteId, workId: budget?.obraId, budgetId, reason: "budget_lines_updated" });

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

function requiredNumber(formData: FormData, key: string) {
  const value = optionalText(formData, key);
  if (value === null) throw new Error("BUDGET_LINE_VALUE_REQUIRED");
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("BUDGET_LINE_VALUE_INVALID");
  return parsed;
}
