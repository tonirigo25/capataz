import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { brand } from "@/lib/brand";
import { parseBudgetLines, serializeBudgetLines } from "@/lib/budget-lines";
import { createActivityCompletionContext, createBudgetCompletionContext, createInvoiceCompletionContext, createWorkSelectionContext, type ChatEntities } from "@/lib/capataz-chat-engine";
import { type IvaMode, type ParsedActivityCommand, type ParsedBudgetCommand, type ParsedConvertBudgetCommand, type ParsedInvoiceCommand, type ParsedPdfCommand } from "@/lib/capataz-chat-parser";
import { reserveDocumentNumberInTransaction } from "@/lib/numbering";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus } from "@/lib/status";
import { requireCompanyContext } from "@/lib/auth/session";
import { appendMessageForCompany, claimMessageForCompany, getMessageForCompany, updateMessageForCompany } from "@/lib/orqena/conversation-repository";
import { ensureChatConversation, findClientMatches, normalizeConversationContext, resultFromChatMetadata, toJsonValue, touchChatConversation } from "@/lib/orqena/application/capataz/conversation-use-cases";
import { ChatCommandContext, ChatCommandOptions, ChatCommandResult, ChatDocumentKind, activeCompany, conversationTenantContext } from "@/lib/orqena/application/capataz/orchestration";
import { BudgetDraftOptions } from "@/lib/orqena/application/capataz/result-context";
import { addDays, amountForIvaUpdate, appendNote, budgetCreatedMessage, budgetPendingFields, buildBudgetObservations, calculateChatDocumentTotals, contextIds, findClientMatchesById, findInvoiceCandidates, findSimilarWork, formatDateTime, formatEuros, invoiceIvaLabel, invoiceIvaObservation, ivaObservation, ivaSummary, joinNatural, latestDocumentContext, pendingBudgetContext, pendingBudgetQuestion, reminderDateTime, retotalLines, revalidateActivityPaths, revalidateChatPaths, revalidateInvoicePaths } from "@/lib/orqena/application/capataz/shared-helpers";

export async function completeActivityFromChat(context: ChatCommandContext, message: string, entities: ChatEntities): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const eventId = typeof context.activeTask?.draftData?.eventId === "string" ? context.activeTask.draftData.eventId : undefined;
  if (!eventId) {
    return {
      handled: true,
      text: "Tenía una visita o nota pendiente, pero falta identificarla. No he creado recordatorios duplicados.",
      clearContext: true
    };
  }

  const event = await prisma.eventoAgenda.findFirst({
    where: { id: eventId, companyId },
    include: { client: true, work: true }
  });
  if (!event) {
    return {
      handled: true,
      text: "No encuentro la visita anterior. No he creado recordatorios duplicados.",
      clearContext: true
    };
  }

  const cleanMessage = message.trim();
  const reminderDate = reminderDateTime(cleanMessage, entities);
  const remaining = new Set(context.activeTask?.pendingFields ?? []);
  const updates: string[] = [];
  let reminderId: string | undefined;

  await prisma.$transaction(async (tx) => {
    if (cleanMessage) {
      await tx.eventoAgenda.update({
        where: { id: event.id },
        data: {
          notas: appendNote(event.notas, `Detalle añadido en Orqena: ${cleanMessage}`),
          descripcion: appendNote(event.descripcion, `Detalle: ${cleanMessage}`)
        }
      });
      updates.push("detalle añadido a la visita");
    }

    if (reminderDate) {
      const reminder = await tx.reminder.create({
        data: {
          clienteId: event.clienteId,
          obraId: event.obraId,
          tipo: "confirmar_visita",
          canal: "interno",
          mensaje: `Llamar a ${event.client?.nombre ?? "cliente"} para seguimiento de ${event.work?.titulo ?? event.titulo}. ${cleanMessage}`,
          fechaProgramada: reminderDate,
          estado: "programado",
          requiereConfirmacion: true,
          confirmadoPorUsuario: true
        }
      });
      reminderId = reminder.id;
      updates.push(`recordatorio interno programado para ${formatDateTime(reminderDate)}`);
      remaining.delete("fecha_recordatorio");
    }
  });

  revalidateActivityPaths(event.clienteId ?? undefined, event.obraId ?? undefined, event.id);
  revalidatePath("/recordatorios");

  const nextContext = remaining.size
    ? createActivityCompletionContext({
        clientId: event.clienteId ?? undefined,
        workId: event.obraId ?? undefined,
        eventId: event.id,
        clientName: event.client?.nombre ?? context.lastClientName,
        pendingFields: [...remaining],
        createdAt: context.activeTask?.createdAt
      })
    : {
        lastClientId: event.clienteId ?? undefined,
        lastWorkId: event.obraId ?? undefined,
        lastClientName: event.client?.nombre ?? context.lastClientName
      };

  return {
    handled: true,
    created: {
      clientId: event.clienteId ?? undefined,
      workId: event.obraId ?? undefined,
      agendaEventId: event.id,
      reminderId
    },
    context: nextContext,
    clearContext: !remaining.size,
    text: updates.length
      ? `${joinNatural(updates)}. No he enviado WhatsApp ni email.`
      : "Sigo con esa visita. Dime qué tiene que confirmar el cliente o cuándo quieres que te lo recuerde."
  };
}

export async function createBudgetDraftFromChat(command: ParsedBudgetCommand, options: BudgetDraftOptions = {}): Promise<ChatCommandResult> {
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

  const company = await activeCompany();
  const ivaPercent = company.defaultVat;
  const totals = calculateChatDocumentTotals(command.amount, command.ivaMode, ivaPercent);
  const line = {
    descripcion: command.lineDescription,
    cantidad: 1,
    unidad: "servicio",
    precioUnitario: totals.subtotal,
    total: totals.subtotal,
    categoria: command.materialIncluded ? "Material incluido" : "General"
  };
  const result = await prisma.$transaction(async (tx) => {
    const number = await reserveDocumentNumberInTransaction(tx, company.id, "budget");
    const client = existingClient ?? await tx.client.create({
      data: {
        nombre: command.clientName,
        telefono: "Pendiente",
        email: null,
        direccion: "Dirección pendiente",
        tipo: "Particular",
        estado: "pendiente_datos",
        origen: brand.productName,
        notas: "Cliente provisional preparado por Orqena. Faltan apellidos, teléfono, NIF/CIF, correo y dirección fiscal.",
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
            notas: `Trabajo provisional preparado por Orqena. Material incluido: ${command.materialIncluded ? "Sí" : "No indicado"}.`
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
        notas: options.followUp?.nif ? appendNote(client.notas, `NIF/CIF indicado en Orqena: ${options.followUp.nif}.`) : undefined,
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
    billingClientName: result.client.nombre,
    workName: result.work.titulo,
    amount: command.amount,
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

export async function applyBudgetFollowUp(context: ChatCommandContext, followUp: ChatEntities): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const ids = contextIds(context);
  if (!ids.budgetId || !ids.clientId) {
    return { handled: true, text: "Tenía una acción pendiente, pero falta el identificador del presupuesto. Abre el presupuesto desde Documentos y edítalo manualmente.", clearContext: true };
  }

  const budget = await prisma.budget.findFirst({
    where: { id: ids.budgetId, companyId },
    include: { client: true, work: true }
  });

  if (!budget) {
    return { handled: true, text: "No encuentro el presupuesto anterior. No he creado duplicados. Puedes abrir Documentos y revisar los borradores.", clearContext: true };
  }

  const company = await activeCompany();
  const ivaPercent = company.defaultVat;
  const updates: string[] = [];
  const remaining = new Set(context.activeTask?.pendingFields ?? []);
  let currentBudgetAmount = typeof context.activeTask?.draftData?.amount === "number"
    ? context.activeTask.draftData.amount
    : amountForIvaUpdate(budget.subtotal, budget.iva, budget.total, followUp.ivaMode ?? (budget.iva > 0 ? "plus" : "none"));
  let currentIvaMode: IvaMode = followUp.ivaMode ?? (context.activeTask?.iva === "included" || context.activeTask?.iva === "plus" || context.activeTask?.iva === "none" ? context.activeTask.iva : budget.iva > 0 ? "plus" : "none");

  await prisma.$transaction(async (tx) => {
    if (followUp.amount) {
      currentBudgetAmount = followUp.amount;
      currentIvaMode = followUp.ivaMode ?? currentIvaMode;
      const totals = calculateChatDocumentTotals(currentBudgetAmount, currentIvaMode, ivaPercent);
      const lines = retotalLines(parseBudgetLines(budget.partidas), budget.titulo, totals.subtotal);
      await tx.budget.update({
        where: { id: budget.id },
        data: {
          partidas: serializeBudgetLines(lines),
          subtotal: totals.subtotal,
          iva: totals.iva,
          total: totals.total,
          observaciones: appendNote(budget.observaciones, `Importe confirmado en Orqena: ${formatEuros(currentBudgetAmount)}${currentIvaMode === "plus" ? " + IVA" : currentIvaMode === "included" ? " IVA incluido" : ""}.`)
        }
      });
      updates.push(`importe ${formatEuros(currentBudgetAmount)}${currentIvaMode === "plus" ? " + IVA" : currentIvaMode === "included" ? " IVA incluido" : ""}`);
      if (followUp.ivaMode) remaining.delete("iva");
    }

    if (followUp.ivaMode && !followUp.amount) {
      currentIvaMode = followUp.ivaMode;
      const basis = amountForIvaUpdate(budget.subtotal, budget.iva, budget.total, followUp.ivaMode);
      currentBudgetAmount = basis;
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
          notas: appendNote(budget.work?.notas, `Dirección o localización completada en Orqena: ${followUp.workAddress}.`)
        }
      });
      updates.push(`obra en ${followUp.workAddress}`);
      remaining.delete("direccion_obra");
    }

    const clientData: { telefono?: string; email?: string; direccion?: string; notas?: string; ultimaInteraccion: Date } = { ultimaInteraccion: new Date() };
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
    if (followUp.fiscalAddress) {
      clientData.direccion = followUp.fiscalAddress;
      updates.push(`dirección fiscal ${followUp.fiscalAddress}`);
    }
    if (followUp.nif) {
      clientData.notas = appendNote(budget.client.notas, `NIF/CIF indicado en Orqena: ${followUp.nif}.`);
      updates.push(`NIF/CIF ${followUp.nif}`);
    }
    if (followUp.nif || followUp.fiscalAddress) {
      remaining.delete("datos_cliente");
      if (followUp.nif && followUp.fiscalAddress) remaining.delete("datos_fiscales");
    }
    if (followUp.phone || followUp.email || followUp.nif || followUp.fiscalAddress) {
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
        billingClientName: context.activeTask?.billingClientName ?? budget.client.nombre,
        contactName: context.activeTask?.contactName,
        workName: budget.work?.titulo ?? context.activeTask?.workName,
        pendingFields: [...remaining],
        draftData: { ...(typeof context.activeTask?.draftData === "object" && context.activeTask.draftData ? context.activeTask.draftData : {}), amount: currentBudgetAmount },
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
    text: `Perfecto, he actualizado el presupuesto de ${budget.client.nombre}: ${joinNatural(updates)}. Ya puedes revisarlo o generar el PDF. No he enviado nada al cliente.`
  };
}

export async function applyInvoiceFollowUp(context: ChatCommandContext, entities: ChatEntities): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  const ids = contextIds(context);
  if (!ids.invoiceId && !ids.clientId) {
    return { handled: true, text: "Tenía una factura pendiente, pero falta identificarla. Abre Facturas o dime cliente y número de factura.", clearContext: true };
  }

  if (entities.invoiceStatus === "pagada") return markInvoicePaidFromChat(entities, context);
  if (entities.amount) return registerPaymentFromChat(entities, context);

  const invoice = ids.invoiceId
    ? await prisma.invoice.findFirst({ where: { id: ids.invoiceId, companyId }, include: { client: true, work: true } })
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

    const clientData: { telefono?: string; email?: string; direccion?: string; notas?: string; ultimaInteraccion: Date } = { ultimaInteraccion: new Date() };
    if (entities.phone) {
      clientData.telefono = entities.phone;
      updates.push(`teléfono ${entities.phone}`);
    }
    if (entities.email) {
      clientData.email = entities.email;
      updates.push(`email ${entities.email}`);
    }
    if (entities.fiscalAddress) {
      clientData.direccion = entities.fiscalAddress;
      updates.push(`dirección fiscal ${entities.fiscalAddress}`);
    }
    if (entities.nif) {
      clientData.notas = appendNote(invoice.client.notas, `NIF/CIF indicado en Orqena: ${entities.nif}.`);
      updates.push(`NIF/CIF ${entities.nif}`);
    }
    if (entities.phone || entities.email || entities.nif || entities.fiscalAddress) {
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

export async function markInvoicePaidFromChat(entities: ChatEntities, context: ChatCommandContext): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
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
        companyId,
        facturaId: invoice.id,
        clienteId: invoice.clienteId,
        obraId: invoice.obraId,
        importe: invoice.pendiente,
        metodo: invoice.metodoPago ?? "transferencia",
        fecha: new Date(),
        tipo: "pago_final",
        notas: "Marcada como pagada desde Orqena."
      }
    }),
    prisma.invoice.updateMany({
      where: { id: invoice.id, companyId },
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

export async function registerPaymentFromChat(entities: ChatEntities, context: ChatCommandContext): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
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
        companyId,
        facturaId: invoice.id,
        clienteId: invoice.clienteId,
        obraId: invoice.obraId,
        importe: entities.amount,
        metodo: "transferencia",
        fecha: new Date(),
        tipo: nuevoPendiente <= 0 ? "pago_final" : "pago_parcial",
        notas: "Pago registrado desde Orqena."
      }
    }),
    prisma.invoice.updateMany({
      where: { id: invoice.id, companyId },
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

export async function createInvoiceDraftFromChat(command: ParsedInvoiceCommand): Promise<ChatCommandResult> {
  const clientMatches = await findClientMatches(command.clientName);
  if (clientMatches.length > 1) {
    return {
      handled: true,
      text: `He encontrado varios clientes parecidos a "${command.clientName}". Antes de crear la factura, dime cuál quieres usar:\n${clientMatches.map((client, index) => `${index + 1}. ${client.nombre}${client.direccion ? ` · ${client.direccion}` : ""}`).join("\n")}`
    };
  }

  const existingClient = clientMatches[0] ?? null;
  const existingWork = existingClient ? await findSimilarWork(existingClient.id, command.workTitle) : null;
  const company = await activeCompany();
  const ivaPercent = company.defaultVat;
  const totals = calculateChatDocumentTotals(command.amount, command.ivaMode, ivaPercent);
  const line = {
    descripcion: command.lineDescription,
    cantidad: 1,
    unidad: "servicio",
    precioUnitario: totals.subtotal,
    total: totals.subtotal,
    categoria: command.materialIncluded ? "Material incluido" : "General"
  };
  const result = await prisma.$transaction(async (tx) => {
    const number = await reserveDocumentNumberInTransaction(tx, company.id, "invoice");
    const client = existingClient ?? await tx.client.create({
      data: {
        nombre: command.clientName,
        telefono: "Pendiente",
        email: null,
        direccion: "Dirección pendiente",
        tipo: "Particular",
        estado: "pendiente_datos",
        origen: brand.productName,
        notas: "Cliente provisional preparado por Orqena para una factura. Faltan NIF/CIF y dirección fiscal.",
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
        notas: "Trabajo provisional preparado por Orqena para una factura. Revisar antes de enviar."
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
        observaciones: `${invoiceIvaObservation(command.ivaMode)} Revisar datos fiscales antes de enviar.`,
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

export async function convertBudgetToInvoiceFromChat(command: ParsedConvertBudgetCommand, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
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
      where: { companyId, clienteId: client.id, estado: "aceptado" },
      orderBy: { fechaCreacion: "desc" }
    });
    budgetId = acceptedBudget?.id;
  }

  if (!budgetId) {
    return { handled: true, text: "Necesito saber qué presupuesto aceptado quieres convertir en factura. Dime, por ejemplo: “convierte el presupuesto aceptado del cliente en factura”." };
  }

  const budget = await prisma.budget.findFirst({ where: { id: budgetId, companyId }, include: { client: true } });
  if (!budget) return { handled: true, text: "No encuentro ese presupuesto. No he creado factura." };
  if (budget.estado !== "aceptado") {
    return { handled: true, text: `He encontrado ${budget.numero}, pero todavía no está aceptado. Para evitar errores, márcalo como aceptado o confirma manualmente antes de convertirlo en factura.` };
  }

  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      companyId,
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

  const company = await activeCompany();
  const invoice = await prisma.$transaction(async (tx) => tx.invoice.create({
    data: {
      clienteId: budget.clienteId,
      obraId: budget.obraId,
      numero: await reserveDocumentNumberInTransaction(tx, company.id, "invoice"),
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
  }));

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

export async function buildPdfResult(command: ParsedPdfCommand, context: ChatCommandContext | null): Promise<ChatCommandResult> {
  const { companyId } = await requireCompanyContext();
  if (context) {
    const fromContext = buildPdfResultFromContext(context, command.documentKind);
    if (fromContext.handled) return fromContext;
  }

  if (!command.clientName) {
    return { handled: true, text: "Dime de qué cliente o documento quieres el PDF, o abre primero un presupuesto o una factura." };
  }

  const clientMatches = await findClientMatches(command.clientName);
  const client = clientMatches[0] ?? null;
  if (!client) return { handled: true, text: `No encuentro documentos para ${command.clientName}.` };

  if (command.documentKind === "invoice") {
    const invoice = await prisma.invoice.findFirst({ where: { companyId, clienteId: client.id }, orderBy: { fechaEmision: "desc" } });
    if (!invoice) return { handled: true, text: `No encuentro facturas de ${client.nombre}.` };
    return pdfResult("invoice", invoice.id, client.id, invoice.obraId ?? undefined, client.nombre);
  }

  const budget = await prisma.budget.findFirst({ where: { companyId, clienteId: client.id }, orderBy: { fechaCreacion: "desc" } });
  if (!budget) return { handled: true, text: `No encuentro presupuestos de ${client.nombre}.` };
  return pdfResult("budget", budget.id, client.id, budget.obraId ?? undefined, client.nombre);
}

export function buildPdfResultFromContext(context: ChatCommandContext, requestedKind?: ChatDocumentKind): ChatCommandResult {
  const ids = contextIds(context);
  const kind = context.lastDocumentType ?? (ids.invoiceId ? "invoice" : ids.budgetId ? "budget" : undefined);
  const id = kind === "invoice" ? ids.invoiceId : ids.budgetId;
  if (!kind || !id) return { handled: false, text: "" };
  if (requestedKind && requestedKind !== kind) return { handled: false, text: "" };
  return pdfResult(kind, id, ids.clientId, ids.workId, context.lastClientName);
}

export function pdfResult(kind: ChatDocumentKind, id: string, clientId?: string, workId?: string, clientName?: string): ChatCommandResult {
  const path = kind === "budget" ? `/presupuestos/${id}/pdf` : `/dinero/${id}/pdf`;
  return {
    handled: true,
    context: latestDocumentContext(kind, id, clientId, workId, clientName),
    result: {
      type: "generated",
      entityType: "pdf",
      entityId: id,
      title: "PDF generado",
      summary: {
        tipo: kind === "budget" ? "Presupuesto" : "Factura",
        cliente: clientName ?? null,
        url: `${path}?preview=1`
      },
      actions: [
        { label: "Ver PDF", href: `${path}?preview=1`, style: "primary" },
        { label: "Descargar PDF", href: path },
        { label: kind === "budget" ? "Editar presupuesto" : "Editar factura", href: kind === "budget" ? `/gestion?tipo=presupuesto&id=${id}&returnTo=/capataz` : `/gestion?tipo=factura&id=${id}&returnTo=/capataz` }
      ]
    },
    text: `PDF listo para revisar aquí: ${path}?preview=1
Descarga directa: ${path}.
No he enviado nada al cliente.`
  };
}

export function isParsedActivityCommand(command: { intent: string }): command is ParsedActivityCommand {
  return command.intent === "registrar_visita"
    || command.intent === "registrar_reunion"
    || command.intent === "registrar_llamada"
    || command.intent === "registrar_nota_obra";
}

export function debugChat(step: string, payload: unknown) {
  const enabled = process.env.CAPATAZ_CHAT_DEBUG === "true" || process.env.NEXT_PUBLIC_APP_ENV !== "production";
  if (!enabled) return;
  console.info(`[capataz-chat] ${step}`, JSON.stringify(payload, null, 2));
}

export async function persistIncomingChatMessage(text: string, context: ChatCommandContext | null, options: ChatCommandOptions) {
  const tenant = await conversationTenantContext();
  const idempotencyKey = options.idempotencyKey ?? options.messageId;
  const conversation = await ensureChatConversation(tenant, options.conversationId, text);
  const conversationId = conversation.id;
  const conversationContext = normalizeConversationContext(conversation.activeTask) ?? context ?? null;
  if (!idempotencyKey) {
    const message = await appendMessageForCompany(tenant, conversationId, {
        role: "user",
        content: text,
        status: "processing",
        context: toJsonValue(conversationContext),
        metadata: toJsonValue({ clientStartedAt: options.clientStartedAt })
    });
    await touchChatConversation(conversationId, tenant);
    return { messageId: message.id, conversationId, context: conversationContext, duplicate: false, result: null as ChatCommandResult | null };
  }

  const existing = await getMessageForCompany(tenant, { idempotencyKey });
  if (existing) {
    const completed = resultFromChatMetadata(existing.metadata);
    if (completed) return { messageId: existing.id, conversationId: existing.conversationId, context: conversationContext, duplicate: true, result: completed };
    if (existing.status === "processing") return { messageId: existing.id, conversationId: existing.conversationId, context: conversationContext, duplicate: true, result: null };
  }

  let message = existing;
  if (!message) message = await appendMessageForCompany(tenant, conversationId, {
      id: options.messageId,
      idempotencyKey,
      role: "user",
      content: text,
      status: "saved",
      context: toJsonValue(conversationContext),
      metadata: toJsonValue({ clientStartedAt: options.clientStartedAt })
  });
  else await updateMessageForCompany(tenant, message.id, { context: toJsonValue(conversationContext), metadata: toJsonValue({ clientStartedAt: options.clientStartedAt, retriedAt: new Date().toISOString() }) });
  await touchChatConversation(message.conversationId, tenant);

  const lock = await claimMessageForCompany(tenant, message.id);

  if (lock.count === 0) {
    const latest = await getMessageForCompany(tenant, { id: message.id });
    const completed = resultFromChatMetadata(latest?.metadata);
    return { messageId: message.id, conversationId: message.conversationId, context: conversationContext, duplicate: true, result: completed };
  }

  return { messageId: message.id, conversationId: message.conversationId, context: conversationContext, duplicate: false, result: null as ChatCommandResult | null };
}
