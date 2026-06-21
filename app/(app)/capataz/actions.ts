"use server";

import { revalidatePath } from "next/cache";
import { calculateBudgetTotals, serializeBudgetLines } from "@/lib/budget-lines";
import { parseChatCommand, normalizeName, type ParsedBudgetCommand } from "@/lib/capataz-chat-parser";
import { nextDocumentNumber } from "@/lib/numbering";
import { prisma } from "@/lib/prisma";

export type ChatCommandResult = {
  handled: boolean;
  text: string;
  created?: {
    clientId?: string;
    workId?: string;
    budgetId?: string;
  };
};

export async function runChatCommand(text: string): Promise<ChatCommandResult> {
  const parsed = parseChatCommand(text);
  debugChat("received", { text });
  debugChat("parsed", parsed);
  if (!parsed) {
    debugChat("fallback", { reason: "parser_no_match" });
    return { handled: false, text: "" };
  }

  if (parsed.intent === "crear_presupuesto") {
    try {
      return await createBudgetDraftFromChat(parsed);
    } catch (error) {
      debugChat("error", error instanceof Error ? { message: error.message, stack: error.stack } : error);
      return {
        handled: true,
        text: "He entendido que quieres crear un presupuesto, pero no he podido guardarlo por un problema de base de datos. No he enviado nada al cliente. Revisa DATABASE_URL, Prisma y la migración pendiente antes de reintentarlo."
      };
    }
  }

  return { handled: false, text: "" };
}

async function createBudgetDraftFromChat(command: ParsedBudgetCommand): Promise<ChatCommandResult> {
  const clientMatches = await findClientMatches(command.clientName);
  if (clientMatches.length > 1) {
    return {
      handled: true,
      text: `He encontrado varios clientes parecidos a "${command.clientName}". Antes de crear nada, dime cuál quieres usar:\n${clientMatches.map((client, index) => `${index + 1}. ${client.nombre}${client.direccion ? ` · ${client.direccion}` : ""}`).join("\n")}`
    };
  }

  const existingClient = clientMatches[0] ?? null;
  if (existingClient) {
    const duplicateWork = await findSimilarWork(existingClient.id, command.workTitle);
    if (duplicateWork) {
      return {
        handled: true,
        text: `Ya existe una obra parecida para ${existingClient.nombre}: "${duplicateWork.titulo}". Para no duplicar basura, dime si quieres usar esa obra o crear una nueva.`
      };
    }
  }

  const company = await prisma.empresa.findFirst();
  const ivaPercent = company?.ivaDefecto ?? 21;
  const totals = calculateChatBudgetTotals(command.amount, command.ivaMode, ivaPercent);
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

    const work = await tx.work.create({
      data: {
        clienteId: client.id,
        titulo: command.workTitle,
        direccion: client.direccion && client.direccion !== "Dirección pendiente" ? client.direccion : "Dirección pendiente",
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
        ultimaInteraccion: new Date()
      }
    });

    return { client, work, budget };
  });

  revalidatePath("/capataz");
  revalidatePath("/documentos");
  revalidatePath("/presupuestos");
  revalidatePath(`/presupuestos/${result.budget.id}`);
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${result.client.id}`);
  revalidatePath("/obras");
  revalidatePath("/hoy");

  return {
    handled: true,
    created: {
      clientId: result.client.id,
      workId: result.work.id,
      budgetId: result.budget.id
    },
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

function debugChat(step: string, payload: unknown) {
  const enabled = process.env.CAPATAZ_CHAT_DEBUG === "true" || process.env.NEXT_PUBLIC_APP_ENV !== "production";
  if (!enabled) return;
  console.info(`[capataz-chat] ${step}`, JSON.stringify(payload, null, 2));
}

async function findClientMatches(name: string) {
  const target = normalizeName(name);
  const clients = await prisma.client.findMany({
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, direccion: true }
  });

  return clients.filter((client) => {
    const normalized = normalizeName(client.nombre);
    const first = normalized.split(" ")[0];
    return normalized === target || first === target || normalized.startsWith(`${target} `);
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

function calculateChatBudgetTotals(amount: number, ivaMode: ParsedBudgetCommand["ivaMode"], ivaPercent: number) {
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

function buildBudgetObservations(command: ParsedBudgetCommand) {
  const ivaNote =
    command.ivaMode === "included"
      ? "IVA incluido según instrucción del usuario."
      : command.ivaMode === "plus"
        ? "IVA añadido aparte según instrucción del usuario."
        : "IVA pendiente de confirmar: no queda claro si el importe incluye IVA o si hay que añadirlo aparte.";
  return `${ivaNote} Material incluido: ${command.materialIncluded ? "Sí" : "No indicado"}. Creado desde chat; no enviar sin confirmación explícita.`;
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
  ivaMode: ParsedBudgetCommand["ivaMode"];
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
