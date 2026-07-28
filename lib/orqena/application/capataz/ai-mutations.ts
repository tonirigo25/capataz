import { brand } from "@/lib/brand";
import { serializeBudgetLines } from "@/lib/budget-lines";
import { createActivityCompletionContext } from "@/lib/capataz-chat-engine";
import { type ParsedActivityCommand, type ParsedInvoiceCommand } from "@/lib/capataz-chat-parser";
import { type CapatazAIResult } from "@/lib/ai/capataz-ai";
import { reserveDocumentNumberInTransaction } from "@/lib/numbering";
import { prisma } from "@/lib/prisma";
import { createInvoiceDraftFromChat } from "@/lib/orqena/application/capataz/business-mutations";
import { findClientMatches } from "@/lib/orqena/application/capataz/conversation-use-cases";
import { ChatCommandResult, activeCompany } from "@/lib/orqena/application/capataz/orchestration";
import { activityCreatedMessage, activityDateTime, activityLooksCompleted, activityPendingFields, addDays, appendNote, buildAIBudgetLine, buildAIBudgetMessage, buildAIBudgetObservations, buildAIClientNotes, buildAILineDescription, buildAIWorkNotes, buildAIWorkTitle, buildActivityNotes, calculateChatDocumentTotals, clientTypeFromAI, findSimilarWork, ivaModeFromAI, pendingBudgetContext, pendingFieldsFromAI, revalidateActivityPaths, revalidateChatPaths, timeValue, titleCase, withQuestions } from "@/lib/orqena/application/capataz/shared-helpers";

export function aiHasAction(ai: CapatazAIResult, action: string) {
  return ai.actionPlan.some((item) => item.action === action);
}

export function canCreateAIBudget(ai: CapatazAIResult) {
  const clientName = ai.entities.empresa_facturacion ?? ai.entities.cliente_nombre ?? ai.entities.contacto_nombre;
  return Boolean(clientName && ai.entities.importe && buildAIWorkTitle(ai));
}

export function canCreateAIInvoice(ai: CapatazAIResult) {
  const clientName = ai.entities.empresa_facturacion ?? ai.entities.cliente_nombre ?? ai.entities.contacto_nombre;
  return Boolean(clientName && ai.entities.importe && buildAIWorkTitle(ai));
}

async function createBudgetDraftFromAI(ai: CapatazAIResult): Promise<ChatCommandResult> {
  const entities = ai.entities;
  const clientName = entities.empresa_facturacion ?? entities.cliente_nombre ?? entities.contacto_nombre;
  const workTitle = buildAIWorkTitle(ai);
  const amount = entities.importe;

  if (!clientName || !workTitle || !amount) {
    return {
      handled: true,
      text: withQuestions(ai.userResponse, ai.clarificationQuestions) || "He entendido que quieres preparar un presupuesto, pero me falta cliente, trabajo o importe. No he creado nada."
    };
  }

  const clientMatches = await findClientMatches(clientName);
  if (clientMatches.length > 1) {
    return {
      handled: true,
      text: `He encontrado varios clientes parecidos a "${clientName}". Antes de crear nada, dime cuál quieres usar:\n${clientMatches.map((client, index) => `${index + 1}. ${client.nombre}${client.direccion ? ` · ${client.direccion}` : ""}`).join("\n")}`
    };
  }

  const existingClient = clientMatches[0] ?? null;
  const company = await activeCompany();
  const ivaMode = ivaModeFromAI(ai);
  const ivaPercent = entities.iva_porcentaje ?? company.defaultVat;
  const totals = calculateChatDocumentTotals(amount, ivaMode, ivaPercent);
  const line = buildAIBudgetLine(ai, totals.subtotal);
  const pendingFields = pendingFieldsFromAI(ai, ivaMode);
  const result = await prisma.$transaction(async (tx) => {
    const number = await reserveDocumentNumberInTransaction(tx, company.id, "budget");
    const client = existingClient ?? await tx.client.create({
      data: {
        nombre: clientName,
        telefono: entities.contacto_telefono ?? "Pendiente",
        email: entities.contacto_email ?? null,
        direccion: entities.direccion_fiscal ?? entities.obra_direccion ?? entities.obra_localidad ?? "Dirección pendiente",
        tipo: clientTypeFromAI(ai),
        estado: pendingFields.length ? "pendiente_datos" : "presupuesto_pendiente",
        origen: brand.productName,
        notas: buildAIClientNotes(ai),
        ultimaInteraccion: new Date()
      }
    });

    const work = await tx.work.create({
      data: {
        clienteId: client.id,
        titulo: workTitle,
        direccion: entities.obra_direccion ?? entities.obra_localidad ?? (client.direccion && client.direccion !== "Dirección pendiente" ? client.direccion : "Dirección pendiente"),
        tipoTrabajo: entities.descripcion_trabajo ?? entities.obra_tipo ?? workTitle,
        estado: "pendiente_inicio",
        fechaInicio: null,
        fechaFinPrevista: null,
        presupuestoAprobado: 0,
        gastoReal: 0,
        margenEstimado: 0,
        notas: buildAIWorkNotes(ai)
      }
    });

    const budget = await tx.budget.create({
      data: {
        clienteId: client.id,
        obraId: work.id,
        numero: number,
        titulo: workTitle,
        partidas: serializeBudgetLines([line]),
        subtotal: totals.subtotal,
        iva: totals.iva,
        descuento: 0,
        total: totals.total,
        margenEstimado: 0,
        estado: "borrador",
        fechaValidez: addDays(new Date(), 15),
        fechaSeguimiento: null,
        condiciones: company?.condicionesPorDefecto ?? "Validez 15 días. Fechas sujetas a disponibilidad y revisión de datos.",
        observaciones: buildAIBudgetObservations(ai, ivaMode),
        formaPago: "Pendiente de acordar"
      }
    });

    await tx.client.update({
      where: { id: client.id },
      data: {
        estado: pendingFields.length ? "pendiente_datos" : "presupuesto_pendiente",
        ultimaInteraccion: new Date(),
        notas: existingClient ? appendNote(client.notas, buildAIClientNotes(ai)) : undefined
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
    contactName: entities.contacto_nombre,
    billingClientName: result.client.nombre,
    workName: `${result.work.titulo}${entities.obra_localidad ? ` en ${entities.obra_localidad}` : ""}`,
    amount,
    ivaMode,
    pendingFields
  });

  return {
    handled: true,
    created: {
      clientId: result.client.id,
      workId: result.work.id,
      budgetId: result.budget.id
    },
    context,
    text: buildAIBudgetMessage(ai, {
      clientName: result.client.nombre,
      contactName: entities.contacto_nombre,
      workTitle: result.work.titulo,
      amount,
      budgetId: result.budget.id,
      budgetNumber: result.budget.numero,
      ivaMode,
      pendingFields,
      clientWasCreated: !existingClient
    })
  };
}

async function createInvoiceDraftFromAI(ai: CapatazAIResult): Promise<ChatCommandResult> {
  const entities = ai.entities;
  const clientName = entities.empresa_facturacion ?? entities.cliente_nombre ?? entities.contacto_nombre;
  const workTitle = buildAIWorkTitle(ai);
  const amount = entities.importe;

  if (!clientName || !workTitle || !amount) {
    return {
      handled: true,
      text: withQuestions(ai.userResponse, ai.clarificationQuestions) || "He entendido que quieres preparar una factura, pero me falta cliente, concepto o importe. No he creado nada."
    };
  }

  const command: ParsedInvoiceCommand = {
    intent: "crear_factura",
    clientName,
    workTitle,
    lineDescription: buildAILineDescription(ai, workTitle),
    amount,
    currency: "EUR",
    ivaMode: ivaModeFromAI(ai),
    materialIncluded: entities.material_incluido === true
  };

  return createInvoiceDraftFromChat(command);
}

async function registerActivityFromAI(ai: CapatazAIResult): Promise<ChatCommandResult> {
  const entities = ai.entities;
  const clientName = entities.cliente_nombre ?? entities.contacto_nombre ?? entities.empresa_facturacion;
  const eventType = entities.tipo_actividad === "reunion"
    ? "reunion"
    : entities.tipo_actividad === "llamada"
      ? "llamada"
      : "visita";
  const workTitle = entities.obra_nombre ?? entities.descripcion_trabajo ?? entities.alcance;

  const command: ParsedActivityCommand = {
    intent: eventType === "reunion" ? "registrar_reunion" : eventType === "llamada" ? "registrar_llamada" : "registrar_visita",
    eventType,
    clientName,
    workTitle,
    eventTime: entities.hora,
    eventDateHint: undefined,
    topics: [entities.descripcion_trabajo, entities.alcance].filter(Boolean) as string[],
    materialsReviewed: Boolean(entities.material_incluido || entities.notas?.toLowerCase().includes("material")),
    pendingConfirmation: entities.datos_pendientes.some((field) => field.toLowerCase().includes("confirm")),
    notes: entities.notas ?? ai.userResponse
  };

  return registerActivityFromChat(command);
}

// Retained for deterministic AI compatibility; public chat emits proposals first.
void createBudgetDraftFromAI;
void createInvoiceDraftFromAI;
void registerActivityFromAI;

export async function registerActivityFromChat(command: ParsedActivityCommand): Promise<ChatCommandResult> {
  if (!command.clientName) {
    return {
      handled: true,
      text: "He entendido que es una visita, reunión, llamada o nota de obra, pero me falta el cliente. No he creado gastos ni importes. ¿Con quién fue?"
    };
  }

  const clientMatches = await findClientMatches(command.clientName);
  if (clientMatches.length > 1) {
    return {
      handled: true,
      text: `He encontrado varios clientes parecidos a "${command.clientName}". Antes de registrar la actividad, dime cuál quieres usar:\n${clientMatches.map((client, index) => `${index + 1}. ${client.nombre}${client.direccion ? ` · ${client.direccion}` : ""}`).join("\n")}`
    };
  }

  const existingClient = clientMatches[0] ?? null;
  const existingWork = existingClient && command.workTitle ? await findSimilarWork(existingClient.id, command.workTitle) : null;
  const activityDate = activityDateTime(command.eventDateHint, command.eventTime);
  const isPast = activityLooksCompleted(command.notes);
  const agendaType = command.eventType === "llamada" ? "llamada" : "visita";
  const displayType = command.eventType === "reunion" ? "reunión" : command.eventType;
  const normalizedWorkTitle = command.workTitle ?? "Trabajo pendiente de definir";
  const pendingFields = activityPendingFields(command);

  const result = await prisma.$transaction(async (tx) => {
    const client = existingClient ?? await tx.client.create({
      data: {
        nombre: command.clientName!,
        telefono: "Pendiente",
        email: null,
        direccion: "Dirección pendiente",
        tipo: "Particular",
        estado: command.pendingConfirmation ? "seguimiento_pendiente" : "visita_pendiente",
        origen: brand.productName,
        notas: "Cliente provisional creado desde una actividad registrada en Orqena.",
        ultimaInteraccion: new Date()
      }
    });

    const work = command.workTitle
      ? existingWork ?? await tx.work.create({
          data: {
            clienteId: client.id,
            titulo: normalizedWorkTitle,
            direccion: client.direccion && client.direccion !== "Dirección pendiente" ? client.direccion : "Dirección pendiente",
            tipoTrabajo: normalizedWorkTitle,
            estado: "pendiente_inicio",
            fechaInicio: null,
            fechaFinPrevista: null,
            presupuestoAprobado: 0,
            gastoReal: 0,
            margenEstimado: 0,
            notas: "Trabajo provisional creado desde una visita o nota de Orqena."
          }
        })
      : null;

    const activityNotes = buildActivityNotes(command);
    const event = await tx.eventoAgenda.create({
      data: {
        titulo: `${titleCase(displayType)} con ${client.nombre}`,
        descripcion: activityNotes,
        tipo: agendaType,
        estado: isPast ? "realizado" : "pendiente",
        fechaInicio: activityDate,
        fechaFin: null,
        horaInicio: command.eventTime ?? timeValue(activityDate),
        horaFin: null,
        clienteId: client.id,
        obraId: work?.id ?? null,
        direccion: work?.direccion && work.direccion !== "Dirección pendiente" ? work.direccion : null,
        notas: activityNotes,
        requiereConfirmacion: false,
        confirmadoPorUsuario: true
      }
    });

    await tx.client.update({
      where: { id: client.id },
      data: {
        estado: command.pendingConfirmation ? "seguimiento_pendiente" : undefined,
        notas: appendNote(client.notas, `Actividad registrada: ${activityNotes}`),
        ultimaInteraccion: new Date()
      }
    });

    if (work) {
      await tx.work.update({
        where: { id: work.id },
        data: { notas: appendNote(work.notas, `Actividad registrada: ${activityNotes}`) }
      });
    }

    return { client, work, event };
  });

  revalidateActivityPaths(result.client.id, result.work?.id, result.event.id);

  const context = pendingFields.length
    ? createActivityCompletionContext({
        clientId: result.client.id,
        workId: result.work?.id,
        eventId: result.event.id,
        clientName: result.client.nombre,
        pendingFields
      })
    : {
        lastClientId: result.client.id,
        lastWorkId: result.work?.id,
        lastClientName: result.client.nombre
      };

  return {
    handled: true,
    created: {
      clientId: result.client.id,
      workId: result.work?.id,
      agendaEventId: result.event.id
    },
    context,
    text: activityCreatedMessage({
      command,
      clientName: result.client.nombre,
      workTitle: result.work?.titulo,
      eventId: result.event.id,
      pendingFields
    })
  };
}
