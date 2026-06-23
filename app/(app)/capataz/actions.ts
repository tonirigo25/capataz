"use server";

import { revalidatePath } from "next/cache";
import { parseBudgetLines, serializeBudgetLines, type BudgetLine } from "@/lib/budget-lines";
import {
  createBudgetCompletionContext,
  createInvoiceCompletionContext,
  createLastDocumentContext,
  createWorkSelectionContext,
  draftBudgetCommandFromContext,
  mergeBudgetCommandWithEntities,
  normalizeChatContext,
  planChatMessage,
  type ChatContext,
  type ChatEntities
} from "@/lib/capataz-chat-engine";
import {
  normalizeName,
  type IvaMode,
  type ParsedBudgetCommand,
  type ParsedBudgetFollowUp,
  type ParsedConvertBudgetCommand,
  type ParsedInvoiceCommand,
  type ParsedPdfCommand
} from "@/lib/capataz-chat-parser";
import { nextDocumentNumber } from "@/lib/numbering";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";

type ChatDocumentKind = "budget" | "invoice";
type PendingField = "iva" | "direccion_obra" | "datos_cliente" | "datos_fiscales";

export type ChatCommandContext = ChatContext;

export type ChatCommandResult = {
  handled: boolean;
  text: string;
  created?: {
    clientId?: string;
    workId?: string;
    budgetId?: string;
    invoiceId?: string;
  };
  context?: ChatCommandContext | null;
  clearContext?: boolean;
};

export async function runChatCommand(text: string, context?: ChatCommandContext | null): Promise<ChatCommandResult> {
  const plan = planChatMessage(text, context ?? null);
  debugChat("received", { text, context });
  debugChat("plan", plan);

  if (!plan.handled) {
    debugChat("fallback", { reason: "engine_no_match", entities: plan.entities });
    return { handled: false, text: "" };
  }

  if (plan.action === "ask_pending") {
    return {
      handled: true,
      text: plan.response ?? "Sigo con la acción anterior. Dime si quieres usar lo existente, crear algo nuevo o dejarlo pendiente.",
      context: plan.context
    };
  }

  if (plan.action === "use_existing_work_for_budget" || plan.action === "create_new_work_for_budget") {
    const draft = draftBudgetCommandFromContext(plan.context);
    if (!draft) {
      return {
        handled: true,
        text: "Tenía una decisión pendiente, pero falta el borrador del presupuesto. No he creado nada duplicado. Vuelve a pedirme el presupuesto con cliente, obra e importe.",
        context: null,
        clearContext: true
      };
    }

    const command = mergeBudgetCommandWithEntities(draft, plan.entities);
    try {
      return await createBudgetDraftFromChat(command, {
        existingClientId: plan.context.activeTask?.clienteId,
        existingWorkId: plan.action === "use_existing_work_for_budget" ? plan.context.activeTask?.obraId : undefined,
        forceNewWork: plan.action === "create_new_work_for_budget",
        followUp: plan.entities
      });
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido tu respuesta sobre la obra, pero no he podido continuar el presupuesto por un problema de base de datos. No he enviado nada al cliente.",
        context: plan.context
      };
    }
  }

  if (plan.action === "complete_budget") {
    try {
      return await applyBudgetFollowUp(plan.context, plan.entities);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que estás completando el presupuesto anterior, pero no he podido actualizarlo por un problema de base de datos. No he enviado nada al cliente.",
        context: plan.context
      };
    }
  }

  if (plan.action === "complete_invoice") {
    try {
      return await applyInvoiceFollowUp(plan.context, plan.entities);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que estás completando la factura anterior, pero no he podido actualizarla por un problema de base de datos. No he enviado nada al cliente.",
        context: plan.context
      };
    }
  }

  if (plan.action === "create_budget" && plan.command?.intent === "crear_presupuesto") {
    try {
      return await createBudgetDraftFromChat(plan.command);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que quieres crear un presupuesto, pero no he podido guardarlo por un problema de base de datos. No he enviado nada al cliente. Revisa DATABASE_URL, Prisma y la migración pendiente antes de reintentarlo."
      };
    }
  }

  if (plan.action === "create_invoice" && plan.command?.intent === "crear_factura") {
    try {
      return await createInvoiceDraftFromChat(plan.command);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que quieres crear una factura, pero no he podido guardarla por un problema de base de datos. No he enviado nada al cliente."
      };
    }
  }

  if (plan.action === "convert_budget_to_invoice" && plan.command?.intent === "convertir_presupuesto_en_factura") {
    try {
      return await convertBudgetToInvoiceFromChat(plan.command, plan.context);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que quieres convertir un presupuesto en factura, pero no he podido hacerlo por un problema de base de datos. No he enviado nada al cliente."
      };
    }
  }

  if (plan.action === "generate_pdf") {
    try {
      if ("command" in plan && plan.command?.intent === "generar_pdf") return await buildPdfResult(plan.command, plan.context);
      const result = buildPdfResultFromContext(plan.context);
      if (result.handled) return result;
      return { handled: true, text: "Dime de qué presupuesto o factura quieres el PDF.", context: plan.context };
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que quieres el PDF, pero no he podido localizar el documento. No he enviado nada al cliente."
      };
    }
  }

  if (plan.action === "select_document") {
    const selectedInvoiceId = plan.context.activeTask?.facturaId;
    const taskAction = String(plan.context.activeTask?.draftData?.action ?? "");
    if (selectedInvoiceId && taskAction === "mark_invoice_paid") return await markInvoicePaidFromChat({ ...plan.entities, invoiceStatus: "pagada" }, plan.context);
    if (selectedInvoiceId && taskAction === "register_payment") return await registerPaymentFromChat({ ...plan.entities, amount: Number(plan.context.activeTask?.draftData?.amount ?? plan.entities.amount) }, plan.context);
    if (selectedInvoiceId) return pdfResult("invoice", selectedInvoiceId, plan.context.activeTask?.clienteId, plan.context.activeTask?.obraId, plan.context.lastClientName);
    return { handled: true, text: "He seleccionado el documento, pero falta la acción a aplicar. Dime si quieres PDF, marcar pagada o registrar un pago.", context: plan.context };
  }

  if (plan.action === "mark_invoice_paid") {
    try {
      return await markInvoicePaidFromChat(plan.entities, plan.context);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que quieres marcar una factura como pagada, pero no he podido actualizarla por un problema de base de datos. No he enviado nada al cliente.",
        context: plan.context
      };
    }
  }

  if (plan.action === "register_payment") {
    try {
      return await registerPaymentFromChat(plan.entities, plan.context);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que quieres registrar un pago, pero no he podido guardarlo por un problema de base de datos.",
        context: plan.context
      };
    }
  }

  return { handled: false, text: "" };
}

type BudgetDraftOptions = {
  existingClientId?: string;
  existingWorkId?: string;
  forceNewWork?: boolean;
  followUp?: ChatEntities;
};

async function createBudgetDraftFromChat(command: ParsedBudgetCommand, options: BudgetDraftOptions = {}): Promise<ChatCommandResult> {
  const clientMatches = options.existingClientId
    ? await findClientMatchesById(options.existingClientId)
    : await findClientMatches(command.clientName);
  if (clientMatches.length > 1) {
    return {
      handled: true,
      text: `He encontrado varios clientes parecidos a "${command.clientName}". Antes de crear nada, dime cuál quieres usar:\n${clientMatches.map((client, index) => `${index + 1}. ${client.nombre}${client.direccion ? ` · ${client.direccion}` : ""}`).join("\n")}`
    };
  }

  const existingClient = clientMatches[0] ?? null;
  if (existingClient && !options.forceNewWork && !options.existingWorkId) {
    const duplicateWork = await findSimilarWork(existingClient.id, command.workTitle);
    if (duplicateWork) {
      const question = `Ya existe una obra parecida para ${existingClient.nombre}: "${duplicateWork.titulo}". ¿Quieres usar esa obra o crear una nueva?`;
      return {
        handled: true,
        context: createWorkSelectionContext({
          clientId: existingClient.id,
          clientName: existingClient.nombre,
          workOption: { id: duplicateWork.id, label: duplicateWork.titulo, type: "work" },
          draftBudget: command,
          pendingFields: command.ivaMode === "unknown" ? ["iva", "direccion_obra", "datos_cliente"] : ["direccion_obra", "datos_cliente"],
          lastQuestion: question
        }),
        text: question
      };
    }
  }

  const company = await prisma.empresa.findFirst();
  const ivaPercent = company?.ivaDefecto ?? 21;
  const totals = calculateChatDocumentTotals(command.amount, command.ivaMode, ivaPercent);
  const line = {
    descripcion: command.lineDescription,
    cantidad: 1,
    unidad: "servicio",
    precioUnitario: totals.subtotal,
    total: totals.subtotal,
    categoria: command.materialIncluded ? "Material incluido" : "General"
  };
  const number = await nextDocumentNumber("budget");

  const result = await prisma.$transaction(async (tx) => {
    const client = existingClient ?? await tx.client.create({
      data: {
        nombre: command.clientName,
        telefono: "Pendiente",
        email: null,
        direccion: "Dirección pendiente",
        tipo: "Particular",
        estado: "pendiente_datos",
        origen: "Chat Capataz",
        notas: "Cliente provisional creado desde el chat. Faltan apellidos, teléfono, NIF/CIF, email y dirección fiscal.",
        ultimaInteraccion: new Date()
      }
    });

    const work = options.existingWorkId
      ? options.followUp?.workAddress
        ? await tx.work.update({
            where: { id: options.existingWorkId },
            data: { direccion: options.followUp.workAddress }
          })
        : await tx.work.findUniqueOrThrow({ where: { id: options.existingWorkId } })
      : await tx.work.create({
          data: {
            clienteId: client.id,
            titulo: command.workTitle,
            direccion: options.followUp?.workAddress ?? (client.direccion && client.direccion !== "Dirección pendiente" ? client.direccion : "Dirección pendiente"),
            tipoTrabajo: command.workTitle,
            estado: "pendiente_inicio",
            fechaInicio: null,
            fechaFinPrevista: null,
            presupuestoAprobado: 0,
            gastoReal: 0,
            margenEstimado: 0,
            notas: `Trabajo provisional creado desde chat. Material incluido: ${command.materialIncluded ? "Sí" : "No indicado"}.`
          }
        });

    const budget = await tx.budget.create({
      data: {
        clienteId: client.id,
        obraId: work.id,
        numero: number,
        titulo: command.workTitle,
        partidas: serializeBudgetLines([line]),
        subtotal: totals.subtotal,
        iva: totals.iva,
        descuento: 0,
        total: totals.total,
        margenEstimado: 0,
        estado: "borrador",
        fechaValidez: addDays(new Date(), 15),
        fechaSeguimiento: null,
        condiciones: company?.condicionesPorDefecto ?? "Borrador pendiente de revisar antes de enviar.",
        observaciones: buildBudgetObservations(command),
        formaPago: "Pendiente de acordar"
      }
    });

    await tx.client.update({
      where: { id: client.id },
      data: {
        estado: existingClient ? "presupuesto_pendiente" : "pendiente_datos",
        telefono: options.followUp?.phone ?? undefined,
        email: options.followUp?.email ?? undefined,
        notas: options.followUp?.nif ? appendNote(client.notas, `NIF/CIF indicado desde chat: ${options.followUp.nif}.`) : undefined,
        ultimaInteraccion: new Date()
      }
    });

    return { client, work, budget };
  });

  revalidateChatPaths(result.client.id, result.work.id, result.budget.id);

  const context = pendingBudgetContext({
    clientId: result.client.id,
    workId: result.work.id,
    budgetId: result.budget.id,
    clientName: result.client.nombre,
    ivaMode: command.ivaMode,
    pendingFields: budgetPendingFields(command.ivaMode, options.followUp)
  });

  return {
    handled: true,
    created: {
      clientId: result.client.id,
      workId: result.work.id,
      budgetId: result.budget.id
    },
    context,
    text: budgetCreatedMessage({
      clientName: result.client.nombre,
      workTitle: result.work.titulo,
      amount: command.amount,
      materialIncluded: command.materialIncluded,
      budgetId: result.budget.id,
      budgetNumber: result.budget.numero,
      ivaMode: command.ivaMode,
      clientWasCreated: !existingClient
    })
  };
}

async function applyBudgetFollowUp(context: ChatCommandContext, followUp: ParsedBudgetFollowUp): Promise<ChatCommandResult> {
  const ids = contextIds(context);
  if (!ids.budgetId || !ids.clientId) {
    return { handled: true, text: "Tenía una acción pendiente, pero falta el identificador del presupuesto. Abre el presupuesto desde Documentos y edítalo manualmente.", clearContext: true };
  }

  const budget = await prisma.budget.findUnique({
    where: { id: ids.budgetId },
    include: { client: true, work: true }
  });

  if (!budget) {
    return { handled: true, text: "No encuentro el presupuesto anterior. No he creado duplicados. Puedes abrir Documentos y revisar los borradores.", clearContext: true };
  }

  const company = await prisma.empresa.findFirst();
  const ivaPercent = company?.ivaDefecto ?? 21;
  const updates: string[] = [];
  const remaining = new Set(context.activeTask?.pendingFields ?? []);

  await prisma.$transaction(async (tx) => {
    if (followUp.ivaMode) {
      const basis = amountForIvaUpdate(budget.subtotal, budget.iva, budget.total, followUp.ivaMode);
      const totals = calculateChatDocumentTotals(basis, followUp.ivaMode, ivaPercent);
      const lines = retotalLines(parseBudgetLines(budget.partidas), budget.titulo, totals.subtotal);
      await tx.budget.update({
        where: { id: budget.id },
        data: {
          partidas: serializeBudgetLines(lines),
          subtotal: totals.subtotal,
          iva: totals.iva,
          total: totals.total,
          observaciones: appendNote(budget.observaciones, ivaObservation(followUp.ivaMode))
        }
      });
      updates.push(ivaSummary(followUp.ivaMode));
      remaining.delete("iva");
    }

    if (followUp.workAddress && budget.obraId) {
      await tx.work.update({
        where: { id: budget.obraId },
        data: {
          direccion: followUp.workAddress,
          notas: appendNote(budget.work?.notas, `Dirección/localización completada desde chat: ${followUp.workAddress}.`)
        }
      });
      updates.push(`obra en ${followUp.workAddress}`);
      remaining.delete("direccion_obra");
    }

    const clientData: { telefono?: string; email?: string; notas?: string; ultimaInteraccion: Date } = { ultimaInteraccion: new Date() };
    if (followUp.phone) {
      clientData.telefono = followUp.phone;
      updates.push(`teléfono del cliente ${followUp.phone}`);
      remaining.delete("datos_cliente");
    }
    if (followUp.email) {
      clientData.email = followUp.email;
      updates.push(`email ${followUp.email}`);
      remaining.delete("datos_cliente");
    }
    if (followUp.nif) {
      clientData.notas = appendNote(budget.client.notas, `NIF/CIF indicado desde chat: ${followUp.nif}.`);
      updates.push(`NIF/CIF ${followUp.nif}`);
      remaining.delete("datos_cliente");
    }
    if (followUp.phone || followUp.email || followUp.nif) {
      await tx.client.update({ where: { id: budget.clienteId }, data: clientData });
    }
  });

  if (followUp.leavePending) {
    remaining.clear();
  }

  revalidateChatPaths(budget.clienteId, budget.obraId ?? undefined, budget.id);

  const nextContext = remaining.size
    ? createBudgetCompletionContext({
        clientId: budget.clienteId,
        workId: budget.obraId ?? undefined,
        budgetId: budget.id,
        clientName: budget.client.nombre,
        pendingFields: [...remaining],
        createdAt: context.activeTask?.createdAt
      })
    : latestDocumentContext("budget", budget.id, budget.clienteId, budget.obraId ?? undefined, budget.client.nombre);

  if (!updates.length && followUp.leavePending) {
    return {
      handled: true,
      text: `De acuerdo, dejo esos datos pendientes en el presupuesto de ${budget.client.nombre}. No he enviado nada al cliente.`,
      context: nextContext
    };
  }

  if (!updates.length) {
    return {
      handled: true,
      text: pendingBudgetQuestion(context),
      context
    };
  }

  return {
    handled: true,
    context: nextContext,
    created: {
      clientId: budget.clienteId,
      workId: budget.obraId ?? undefined,
      budgetId: budget.id
    },
    text: `Perfecto, he actualizado el presupuesto de ${budget.client.nombre}: ${joinNatural(updates)}. Ya puedes revisarlo o generar el PDF.`
  };
}

async function applyInvoiceFollowUp(context: ChatCommandContext, entities: ChatEntities): Promise<ChatCommandResult> {
  const ids = contextIds(context);
  if (!ids.invoiceId && !ids.clientId) {
    return { handled: true, text: "Tenía una factura pendiente, pero falta identificarla. Abre Facturas o dime cliente y número de factura.", clearContext: true };
  }

  if (entities.invoiceStatus === "pagada") return markInvoicePaidFromChat(entities, context);
  if (entities.amount) return registerPaymentFromChat(entities, context);

  const invoice = ids.invoiceId
    ? await prisma.invoice.findUnique({ where: { id: ids.invoiceId }, include: { client: true, work: true } })
    : null;
  if (!invoice) {
    return { handled: true, text: "No encuentro la factura anterior. No he creado ni enviado nada.", clearContext: true };
  }

  const updates: string[] = [];
  await prisma.$transaction(async (tx) => {
    if (entities.workAddress && invoice.obraId) {
      await tx.work.update({ where: { id: invoice.obraId }, data: { direccion: entities.workAddress } });
      updates.push(`obra en ${entities.workAddress}`);
    }

    const clientData: { telefono?: string; email?: string; notas?: string; ultimaInteraccion: Date } = { ultimaInteraccion: new Date() };
    if (entities.phone) {
      clientData.telefono = entities.phone;
      updates.push(`teléfono ${entities.phone}`);
    }
    if (entities.email) {
      clientData.email = entities.email;
      updates.push(`email ${entities.email}`);
    }
    if (entities.nif) {
      clientData.notas = appendNote(invoice.client.notas, `NIF/CIF indicado desde chat: ${entities.nif}.`);
      updates.push(`NIF/CIF ${entities.nif}`);
    }
    if (entities.phone || entities.email || entities.nif) {
      await tx.client.update({ where: { id: invoice.clienteId }, data: clientData });
    }
  });

  revalidateInvoicePaths(invoice.clienteId, invoice.obraId ?? undefined, invoice.id);

  if (!updates.length) {
    return {
      handled: true,
      text: `Sigo con la factura ${invoice.numero} de ${invoice.client.nombre}. Puedes darme datos fiscales, registrar un pago o pedirme el PDF.`,
      context
    };
  }

  return {
    handled: true,
    created: { clientId: invoice.clienteId, workId: invoice.obraId ?? undefined, invoiceId: invoice.id },
    context: latestDocumentContext("invoice", invoice.id, invoice.clienteId, invoice.obraId ?? undefined, invoice.client.nombre),
    text: `Perfecto, he actualizado la factura ${invoice.numero} de ${invoice.client.nombre}: ${joinNatural(updates)}. No he enviado nada al cliente.`
  };
}

async function markInvoicePaidFromChat(entities: ChatEntities, context: ChatCommandContext): Promise<ChatCommandResult> {
  const invoices = await findInvoiceCandidates(entities, context);
  if (!invoices.length) {
    return { handled: true, text: "No encuentro una factura pendiente clara para marcar como pagada. Dime el cliente o el número de factura.", context };
  }

  if (invoices.length > 1) {
    const question = `He encontrado varias facturas. Dime cuál marco como pagada:\n${invoices.map((invoice, index) => `${index + 1}. ${invoice.numero} · ${invoice.client.nombre} · ${formatEuros(invoice.pendiente)} pendiente`).join("\n")}`;
    return {
      handled: true,
      text: question,
      context: {
        ...context,
        activeTask: {
          type: "register_payment",
          clienteId: invoices[0].clienteId,
          pendingDecision: {
            type: "select_document",
            options: invoices.map((invoice) => ({ id: invoice.id, label: invoice.numero, type: "invoice" }))
          },
          draftData: { action: "mark_invoice_paid" },
          lastQuestion: question,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    };
  }

  const invoice = invoices[0];
  if (invoice.pendiente <= 0) {
    return {
      handled: true,
      text: `La factura ${invoice.numero} de ${invoice.client.nombre} ya estaba pagada.`,
      context: latestDocumentContext("invoice", invoice.id, invoice.clienteId, invoice.obraId ?? undefined, invoice.client.nombre)
    };
  }

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        facturaId: invoice.id,
        clienteId: invoice.clienteId,
        obraId: invoice.obraId,
        importe: invoice.pendiente,
        metodo: invoice.metodoPago ?? "transferencia",
        fecha: new Date(),
        tipo: "pago_final",
        notas: "Marcada como pagada desde el chat de Capataz."
      }
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: { pagado: invoice.total, pendiente: 0, estado: "pagada" }
    })
  ]);

  revalidateInvoicePaths(invoice.clienteId, invoice.obraId ?? undefined, invoice.id);

  return {
    handled: true,
    created: { clientId: invoice.clienteId, workId: invoice.obraId ?? undefined, invoiceId: invoice.id },
    context: latestDocumentContext("invoice", invoice.id, invoice.clienteId, invoice.obraId ?? undefined, invoice.client.nombre),
    text: `He marcado como pagada la factura ${invoice.numero} de ${invoice.client.nombre} y he registrado el pago final de ${formatEuros(invoice.pendiente)}.`
  };
}

async function registerPaymentFromChat(entities: ChatEntities, context: ChatCommandContext): Promise<ChatCommandResult> {
  if (!entities.amount || entities.amount <= 0) {
    return { handled: true, text: "He entendido que quieres registrar un pago, pero me falta el importe.", context };
  }

  const invoices = await findInvoiceCandidates(entities, context);
  if (!invoices.length) {
    return { handled: true, text: "No encuentro una factura clara para ese pago. Dime el cliente o número de factura.", context };
  }

  if (invoices.length > 1) {
    const question = `He encontrado varias facturas. Dime en cuál registro el pago de ${formatEuros(entities.amount)}:\n${invoices.map((invoice, index) => `${index + 1}. ${invoice.numero} · ${invoice.client.nombre} · ${formatEuros(invoice.pendiente)} pendiente`).join("\n")}`;
    return {
      handled: true,
      text: question,
      context: {
        ...context,
        activeTask: {
          type: "register_payment",
          clienteId: invoices[0].clienteId,
          pendingDecision: {
            type: "select_document",
            options: invoices.map((invoice) => ({ id: invoice.id, label: invoice.numero, type: "invoice" }))
          },
          draftData: { action: "register_payment", amount: entities.amount },
          lastQuestion: question,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    };
  }

  const invoice = invoices[0];
  const nuevoPagado = Math.min(invoice.total, invoice.pagado + entities.amount);
  const nuevoPendiente = Math.max(0, invoice.total - nuevoPagado);
  const estado = deriveInvoiceStatus(invoice.total, nuevoPendiente, invoice.fechaVencimiento);

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        facturaId: invoice.id,
        clienteId: invoice.clienteId,
        obraId: invoice.obraId,
        importe: entities.amount,
        metodo: "transferencia",
        fecha: new Date(),
        tipo: nuevoPendiente <= 0 ? "pago_final" : "pago_parcial",
        notas: "Pago registrado desde el chat de Capataz."
      }
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: { pagado: nuevoPagado, pendiente: nuevoPendiente, estado }
    })
  ]);

  revalidateInvoicePaths(invoice.clienteId, invoice.obraId ?? undefined, invoice.id);

  return {
    handled: true,
    created: { clientId: invoice.clienteId, workId: invoice.obraId ?? undefined, invoiceId: invoice.id },
    context: latestDocumentContext("invoice", invoice.id, invoice.clienteId, invoice.obraId ?? undefined, invoice.client.nombre),
    text: `He registrado un pago de ${formatEuros(entities.amount)} en la factura ${invoice.numero} de ${invoice.client.nombre}. Pendiente actualizado: ${formatEuros(nuevoPendiente)}.`
  };
}

async function createInvoiceDraftFromChat(command: ParsedInvoiceCommand): Promise<ChatCommandResult> {
  const clientMatches = await findClientMatches(command.clientName);
  if (clientMatches.length > 1) {
    return {
      handled: true,
      text: `He encontrado varios clientes parecidos a "${command.clientName}". Antes de crear la factura, dime cuál quieres usar:\n${clientMatches.map((client, index) => `${index + 1}. ${client.nombre}${client.direccion ? ` · ${client.direccion}` : ""}`).join("\n")}`
    };
  }

  const existingClient = clientMatches[0] ?? null;
  const existingWork = existingClient ? await findSimilarWork(existingClient.id, command.workTitle) : null;
  const company = await prisma.empresa.findFirst();
  const ivaPercent = company?.ivaDefecto ?? 21;
  const totals = calculateChatDocumentTotals(command.amount, command.ivaMode, ivaPercent);
  const line = {
    descripcion: command.lineDescription,
    cantidad: 1,
    unidad: "servicio",
    precioUnitario: totals.subtotal,
    total: totals.subtotal,
    categoria: command.materialIncluded ? "Material incluido" : "General"
  };
  const number = await nextDocumentNumber("invoice");

  const result = await prisma.$transaction(async (tx) => {
    const client = existingClient ?? await tx.client.create({
      data: {
        nombre: command.clientName,
        telefono: "Pendiente",
        email: null,
        direccion: "Dirección pendiente",
        tipo: "Particular",
        estado: "pendiente_datos",
        origen: "Chat Capataz",
        notas: "Cliente provisional creado desde el chat para una factura. Faltan NIF/CIF y dirección fiscal.",
        ultimaInteraccion: new Date()
      }
    });

    const work = existingWork ?? await tx.work.create({
      data: {
        clienteId: client.id,
        titulo: command.workTitle,
        direccion: client.direccion && client.direccion !== "Dirección pendiente" ? client.direccion : "Dirección pendiente",
        tipoTrabajo: command.workTitle,
        estado: "pendiente_cobro",
        fechaInicio: null,
        fechaFinPrevista: null,
        presupuestoAprobado: totals.total,
        gastoReal: 0,
        margenEstimado: 0,
        notas: "Obra provisional creada desde chat para una factura. Revisar antes de enviar."
      }
    });

    const invoice = await tx.invoice.create({
      data: {
        clienteId: client.id,
        obraId: work.id,
        numero: number,
        concepto: command.workTitle,
        partidas: serializeBudgetLines([line]),
        importeBase: totals.subtotal,
        iva: totals.iva,
        total: totals.total,
        pagado: 0,
        pendiente: totals.total,
        fechaEmision: new Date(),
        fechaVencimiento: addDays(new Date(), 7),
        estado: "borrador",
        observaciones: `${invoiceIvaObservation(command.ivaMode)} Creada desde chat; revisar datos fiscales y no enviar sin confirmación explícita.`,
        metodoPago: "Pendiente de acordar",
        datosBancarios: company?.iban ?? null
      }
    });

    await tx.client.update({
      where: { id: client.id },
      data: {
        estado: existingClient ? "pendiente_cobro" : "pendiente_datos",
        ultimaInteraccion: new Date()
      }
    });

    return { client, work, invoice };
  });

  revalidateInvoicePaths(result.client.id, result.work.id, result.invoice.id);

  const context: ChatCommandContext = createInvoiceCompletionContext({
    clientId: result.client.id,
    workId: result.work.id,
    invoiceId: result.invoice.id,
    clientName: result.client.nombre,
    pendingFields: ["datos_fiscales"]
  });

  return {
    handled: true,
    created: {
      clientId: result.client.id,
      workId: result.work.id,
      invoiceId: result.invoice.id
    },
    context,
    text: `He creado una factura en borrador para ${result.client.nombre}.

Cliente: ${result.client.nombre}${existingClient ? "" : " (provisional)"}
Concepto: ${command.workTitle}
Importe: ${formatEuros(command.amount)}
IVA: ${invoiceIvaLabel(command.ivaMode)}
Factura: ${result.invoice.numero}

Antes de enviarla falta revisar NIF/CIF y dirección fiscal del cliente. PDF disponible aquí: /dinero/${result.invoice.id}/pdf`
  };
}

async function convertBudgetToInvoiceFromChat(command: ParsedConvertBudgetCommand, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  let budgetId = context ? contextIds(context).budgetId : undefined;

  if (!budgetId && command.clientName) {
    const clientMatches = await findClientMatches(command.clientName);
    if (clientMatches.length > 1) {
      return {
        handled: true,
        text: `He encontrado varios clientes parecidos a "${command.clientName}". Dime cuál quieres usar antes de convertir el presupuesto.`
      };
    }
    const client = clientMatches[0] ?? null;
    if (!client) {
      return { handled: true, text: `No encuentro ningún cliente llamado ${command.clientName} con presupuesto aceptado. No he creado factura.` };
    }
    const acceptedBudget = await prisma.budget.findFirst({
      where: { clienteId: client.id, estado: "aceptado" },
      orderBy: { fechaCreacion: "desc" }
    });
    budgetId = acceptedBudget?.id;
  }

  if (!budgetId) {
    return { handled: true, text: "Necesito saber qué presupuesto aceptado quieres convertir en factura. Dime, por ejemplo: “convierte el presupuesto aceptado de Juana en factura”." };
  }

  const budget = await prisma.budget.findUnique({ where: { id: budgetId }, include: { client: true } });
  if (!budget) return { handled: true, text: "No encuentro ese presupuesto. No he creado factura." };
  if (budget.estado !== "aceptado") {
    return { handled: true, text: `He encontrado ${budget.numero}, pero todavía no está aceptado. Para evitar errores, márcalo como aceptado o confirma manualmente antes de convertirlo en factura.` };
  }

  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      clienteId: budget.clienteId,
      obraId: budget.obraId,
      observaciones: { contains: budget.numero }
    },
    orderBy: { fechaEmision: "desc" }
  });

  if (existingInvoice) {
    return {
      handled: true,
      context: latestDocumentContext("invoice", existingInvoice.id, budget.clienteId, budget.obraId ?? undefined, budget.client.nombre),
      text: `Ya existe una factura creada desde ${budget.numero}: ${existingInvoice.numero}. PDF disponible aquí: /dinero/${existingInvoice.id}/pdf`
    };
  }

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
      fechaVencimiento: addDays(new Date(), 7),
      estado: "borrador",
      observaciones: `Creada desde presupuesto aceptado ${budget.numero}. Revisar antes de enviar al cliente.`,
      metodoPago: budget.formaPago,
      datosBancarios: null
    }
  });

  revalidateInvoicePaths(budget.clienteId, budget.obraId ?? undefined, invoice.id);
  revalidatePath("/presupuestos");
  revalidatePath(`/presupuestos/${budget.id}`);

  return {
    handled: true,
    created: {
      clientId: budget.clienteId,
      workId: budget.obraId ?? undefined,
      invoiceId: invoice.id
    },
    context: latestDocumentContext("invoice", invoice.id, budget.clienteId, budget.obraId ?? undefined, budget.client.nombre),
    text: `He creado una factura en borrador desde el presupuesto aceptado ${budget.numero} de ${budget.client.nombre}. Revisa los datos fiscales antes de enviarla. PDF disponible aquí: /dinero/${invoice.id}/pdf`
  };
}

async function buildPdfResult(command: ParsedPdfCommand, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  if (context) {
    const fromContext = buildPdfResultFromContext(context, command.documentKind);
    if (fromContext.handled) return fromContext;
  }

  if (!command.clientName) {
    return { handled: true, text: "Dime de qué cliente o documento quieres el PDF, o abre primero un presupuesto/factura desde el chat." };
  }

  const clientMatches = await findClientMatches(command.clientName);
  const client = clientMatches[0] ?? null;
  if (!client) return { handled: true, text: `No encuentro documentos para ${command.clientName}.` };

  if (command.documentKind === "invoice") {
    const invoice = await prisma.invoice.findFirst({ where: { clienteId: client.id }, orderBy: { fechaEmision: "desc" } });
    if (!invoice) return { handled: true, text: `No encuentro facturas de ${client.nombre}.` };
    return pdfResult("invoice", invoice.id, client.id, invoice.obraId ?? undefined, client.nombre);
  }

  const budget = await prisma.budget.findFirst({ where: { clienteId: client.id }, orderBy: { fechaCreacion: "desc" } });
  if (!budget) return { handled: true, text: `No encuentro presupuestos de ${client.nombre}.` };
  return pdfResult("budget", budget.id, client.id, budget.obraId ?? undefined, client.nombre);
}

function buildPdfResultFromContext(context: ChatCommandContext, requestedKind?: ChatDocumentKind): ChatCommandResult {
  const ids = contextIds(context);
  const kind = context.lastDocumentType ?? (ids.invoiceId ? "invoice" : ids.budgetId ? "budget" : undefined);
  const id = kind === "invoice" ? ids.invoiceId : ids.budgetId;
  if (!kind || !id) return { handled: false, text: "" };
  if (requestedKind && requestedKind !== kind) return { handled: false, text: "" };
  return pdfResult(kind, id, ids.clientId, ids.workId, context.lastClientName);
}

function pdfResult(kind: ChatDocumentKind, id: string, clientId?: string, workId?: string, clientName?: string): ChatCommandResult {
  const path = kind === "budget" ? `/presupuestos/${id}/pdf` : `/dinero/${id}/pdf`;
  return {
    handled: true,
    context: latestDocumentContext(kind, id, clientId, workId, clientName),
    text: `PDF listo para revisar y descargar: ${path}. No he enviado nada al cliente.`
  };
}

function debugChat(step: string, payload: unknown) {
  const enabled = process.env.CAPATAZ_CHAT_DEBUG === "true" || process.env.NEXT_PUBLIC_APP_ENV !== "production";
  if (!enabled) return;
  console.info(`[capataz-chat] ${step}`, JSON.stringify(payload, null, 2));
}

async function findClientMatches(name: string) {
  const target = normalizeName(name);
  const clients = await prisma.client.findMany({
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, direccion: true, notas: true }
  });

  return clients.filter((client) => {
    const normalized = normalizeName(client.nombre);
    const first = normalized.split(" ")[0];
    return normalized === target || first === target || normalized.startsWith(`${target} `);
  });
}

async function findClientMatchesById(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, nombre: true, direccion: true, notas: true }
  });
  return client ? [client] : [];
}

async function findInvoiceCandidates(entities: ChatEntities, context: ChatCommandContext) {
  const ids = contextIds(context);
  if (ids.invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: ids.invoiceId },
      include: { client: true }
    });
    return invoice ? [invoice] : [];
  }

  let clientId = ids.clientId;
  if (entities.clientName) {
    const matches = await findClientMatches(entities.clientName);
    if (matches.length === 1) clientId = matches[0].id;
  }

  if (!clientId) return [];

  return prisma.invoice.findMany({
    where: { clienteId: clientId },
    include: { client: true },
    orderBy: [{ pendiente: "desc" }, { fechaEmision: "desc" }]
  });
}

async function findSimilarWork(clientId: string, title: string) {
  const targetWords = new Set(normalizeName(title).split(" ").filter((word) => word.length > 2));
  const works = await prisma.work.findMany({
    where: { clienteId: clientId },
    select: { id: true, titulo: true }
  });

  return works.find((work) => {
    const normalized = normalizeName(work.titulo);
    if (normalized === normalizeName(title)) return true;
    const words = normalized.split(" ").filter((word) => word.length > 2);
    const overlap = words.filter((word) => targetWords.has(word)).length;
    return targetWords.size >= 2 && overlap >= Math.min(2, targetWords.size);
  }) ?? null;
}

function calculateChatDocumentTotals(amount: number, ivaMode: IvaMode, ivaPercent: number) {
  if (ivaMode === "included") {
    const subtotal = roundMoney(amount / (1 + ivaPercent / 100));
    return {
      subtotal,
      iva: roundMoney(amount - subtotal),
      total: roundMoney(amount)
    };
  }

  if (ivaMode === "plus") {
    const iva = roundMoney(amount * (ivaPercent / 100));
    return {
      subtotal: roundMoney(amount),
      iva,
      total: roundMoney(amount + iva)
    };
  }

  return {
    subtotal: roundMoney(amount),
    iva: 0,
    total: roundMoney(amount)
  };
}

function amountForIvaUpdate(subtotal: number, iva: number, total: number, mode: IvaMode) {
  if (mode === "included") return roundMoney(total);
  if (mode === "plus") return iva > 0 ? roundMoney(subtotal) : roundMoney(total);
  return iva > 0 ? roundMoney(subtotal) : roundMoney(total);
}

function retotalLines(lines: BudgetLine[], title: string, newSubtotal: number) {
  const normalized = lines.length ? lines : [{ descripcion: title, cantidad: 1, unidad: "servicio", precioUnitario: newSubtotal, total: newSubtotal, categoria: "General" }];
  const currentSubtotal = normalized.reduce((sum, line) => sum + line.total, 0);
  if (currentSubtotal <= 0) {
    return normalized.map((line, index) => index === 0 ? { ...line, precioUnitario: newSubtotal, total: newSubtotal } : { ...line, precioUnitario: 0, total: 0 });
  }

  let accumulated = 0;
  return normalized.map((line, index) => {
    const isLast = index === normalized.length - 1;
    const total = isLast ? roundMoney(newSubtotal - accumulated) : roundMoney(line.total * (newSubtotal / currentSubtotal));
    accumulated += total;
    const cantidad = line.cantidad || 1;
    return { ...line, total, precioUnitario: roundMoney(total / cantidad) };
  });
}

function buildBudgetObservations(command: ParsedBudgetCommand) {
  const ivaNote = invoiceIvaObservation(command.ivaMode);
  return `${ivaNote} Material incluido: ${command.materialIncluded ? "Sí" : "No indicado"}. Creado desde chat; no enviar sin confirmación explícita.`;
}

function ivaObservation(mode: Exclude<IvaMode, "unknown">) {
  if (mode === "included") return "IVA incluido confirmado desde chat.";
  if (mode === "plus") return "IVA añadido aparte confirmado desde chat.";
  return "Presupuesto marcado sin IVA desde chat.";
}

function invoiceIvaObservation(mode: IvaMode) {
  if (mode === "included") return "IVA incluido según instrucción del usuario.";
  if (mode === "plus") return "IVA añadido aparte según instrucción del usuario.";
  if (mode === "none") return "Sin IVA según instrucción del usuario.";
  return "IVA pendiente de confirmar: no queda claro si el importe incluye IVA o si hay que añadirlo aparte.";
}

function ivaSummary(mode: Exclude<IvaMode, "unknown">) {
  if (mode === "included") return "IVA incluido";
  if (mode === "plus") return "IVA aparte";
  return "sin IVA";
}

function invoiceIvaLabel(mode: IvaMode) {
  if (mode === "included") return "incluido";
  if (mode === "plus") return "añadido aparte";
  if (mode === "none") return "sin IVA";
  return "pendiente de confirmar";
}

function budgetCreatedMessage({
  clientName,
  workTitle,
  amount,
  materialIncluded,
  budgetId,
  budgetNumber,
  ivaMode,
  clientWasCreated
}: {
  clientName: string;
  workTitle: string;
  amount: number;
  materialIncluded: boolean;
  budgetId: string;
  budgetNumber: string;
  ivaMode: IvaMode;
  clientWasCreated: boolean;
}) {
  const ivaQuestion = ivaMode === "unknown"
    ? "1. ¿Los " + formatEuros(amount) + " son con IVA incluido o hay que añadir IVA aparte?"
    : "1. He aplicado el IVA según lo indicado. ¿Quieres revisarlo antes de enviar?";

  return `He preparado un presupuesto en borrador para ${clientName}.

Cliente: ${clientName}${clientWasCreated ? " (provisional)" : ""}
Trabajo: ${workTitle}
Importe: ${formatEuros(amount)}
Material incluido: ${materialIncluded ? "Sí" : "No indicado"}
Estado: Borrador
Presupuesto: ${budgetNumber}

Para dejarlo bien cerrado me falta confirmar:

${ivaQuestion}
2. ¿Dónde es la obra?
3. ¿Quieres completar los datos de ${clientName} con teléfono, apellidos, NIF/CIF o email?

Puedes revisarlo y editarlo aquí: /presupuestos/${budgetId}`;
}

function pendingBudgetQuestion(context: ChatCommandContext) {
  const clientName = context.lastClientName ?? "ese cliente";
  return `Sigo con el presupuesto de ${clientName}. Me falta IVA, dirección de la obra o datos del cliente. Puedes contestar algo como “con IVA y en Mallorca”, “más IVA y en calle Mayor 12” o “tel 65898784”.`;
}

function pendingBudgetContext({
  clientId,
  workId,
  budgetId,
  clientName,
  ivaMode,
  pendingFields
}: {
  clientId: string;
  workId: string;
  budgetId: string;
  clientName: string;
  ivaMode: IvaMode;
  pendingFields?: string[];
}): ChatCommandContext {
  return createBudgetCompletionContext({
    clientId,
    workId,
    budgetId,
    clientName,
    pendingFields: pendingFields ?? (ivaMode === "unknown" ? ["iva", "direccion_obra", "datos_cliente"] : ["direccion_obra", "datos_cliente"])
  });
}

function budgetPendingFields(ivaMode: IvaMode, followUp?: ChatEntities) {
  const fields = new Set<string>();
  if (ivaMode === "unknown" && !followUp?.ivaMode) fields.add("iva");
  if (!followUp?.workAddress) fields.add("direccion_obra");
  if (!followUp?.phone && !followUp?.email && !followUp?.nif) fields.add("datos_cliente");
  return [...fields];
}

function latestDocumentContext(kind: ChatDocumentKind, id: string, clientId?: string, workId?: string, clientName?: string): ChatCommandContext {
  return createLastDocumentContext({
    documentType: kind,
    documentId: id,
    clientId,
    workId,
    clientName
  });
}

function contextIds(context: ChatCommandContext) {
  const normalized = normalizeChatContext(context);
  const task = normalized.activeTask;
  return {
    clientId: task?.clienteId ?? normalized.lastClientId,
    workId: task?.obraId ?? normalized.lastWorkId,
    budgetId: task?.presupuestoId ?? normalized.lastBudgetId,
    invoiceId: task?.facturaId ?? normalized.lastInvoiceId
  };
}

function appendNote(current: string | null | undefined, note: string) {
  const cleanCurrent = (current ?? "").trim();
  if (cleanCurrent.includes(note)) return cleanCurrent || note;
  return cleanCurrent ? `${cleanCurrent}\n${note}` : note;
}

function joinNatural(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function revalidateChatPaths(clientId?: string, workId?: string, budgetId?: string) {
  revalidatePath("/capataz");
  revalidatePath("/documentos");
  revalidatePath("/presupuestos");
  if (budgetId) revalidatePath(`/presupuestos/${budgetId}`);
  revalidatePath("/clientes");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/obras");
  if (workId) revalidatePath(`/obras/${workId}`);
  revalidatePath("/hoy");
}

function revalidateInvoicePaths(clientId?: string, workId?: string, invoiceId?: string) {
  revalidatePath("/capataz");
  revalidatePath("/documentos");
  revalidatePath("/dinero");
  if (invoiceId) revalidatePath(`/dinero/${invoiceId}`);
  revalidatePath("/clientes");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/obras");
  if (workId) revalidatePath(`/obras/${workId}`);
  revalidatePath("/hoy");
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatEuros(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}
