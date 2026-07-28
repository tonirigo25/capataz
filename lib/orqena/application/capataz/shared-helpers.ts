import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { type BudgetLine } from "@/lib/budget-lines";
import { createBudgetCompletionContext, createLastDocumentContext, normalizeChatContext, type ChatEntities } from "@/lib/capataz-chat-engine";
import { normalizeName, type IvaMode, type ParsedActivityCommand, type ParsedBudgetCommand } from "@/lib/capataz-chat-parser";
import { type CapatazAIResult } from "@/lib/ai/capataz-ai";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/lib/auth/session";
import { findClientMatches } from "@/lib/orqena/application/capataz/conversation-use-cases";
import { ChatCommandContext, ChatDocumentKind, PendingField } from "@/lib/orqena/application/capataz/orchestration";

export async function findClientMatchesById(id: string) {
  const { companyId } = await requireCompanyContext();
  const client = await prisma.client.findFirst({
    where: { id, companyId },
    select: { id: true, nombre: true, direccion: true, notas: true }
  });
  return client ? [client] : [];
}

export async function findInvoiceCandidates(entities: ChatEntities, context: ChatCommandContext) {
  const { companyId } = await requireCompanyContext();
  const ids = contextIds(context);
  if (ids.invoiceId) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: ids.invoiceId, companyId },
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
    where: { companyId, clienteId: clientId },
    include: { client: true },
    orderBy: [{ pendiente: "desc" }, { fechaEmision: "desc" }]
  });
}

export async function findSimilarWork(clientId: string, title: string) {
  const { companyId } = await requireCompanyContext();
  const targetWords = new Set(normalizeName(title).split(" ").filter((word) => word.length > 2));
  const works = await prisma.work.findMany({
    where: { companyId, clienteId: clientId },
    select: { id: true, titulo: true, direccion: true, notas: true }
  });

  return works.find((work) => {
    const normalized = normalizeName(work.titulo);
    if (normalized === normalizeName(title)) return true;
    const words = normalized.split(" ").filter((word) => word.length > 2);
    const overlap = words.filter((word) => targetWords.has(word)).length;
    return targetWords.size >= 2 && overlap >= Math.min(2, targetWords.size);
  }) ?? null;
}

export function calculateChatDocumentTotals(amount: number, ivaMode: IvaMode, ivaPercent: number) {
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

export function activityDateTime(dateHint?: "today" | "tomorrow", eventTime?: string) {
  const date = new Date();
  if (dateHint === "tomorrow") date.setDate(date.getDate() + 1);
  if (eventTime) {
    const [hours, minutes] = eventTime.split(":").map(Number);
    date.setHours(hours || 0, minutes || 0, 0, 0);
  }
  return date;
}

export function activityLooksCompleted(notes: string) {
  const normalized = notes
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /(he tenido|ha sido|hemos revisado|hemos hablado|he hablado|he ido|visita ha sido|reunion ha sido)/.test(normalized);
}

export function activityPendingFields(command: ParsedActivityCommand) {
  const fields: string[] = [];
  if (command.materialsReviewed) fields.push("materiales_revisados");
  if (command.pendingConfirmation) {
    fields.push("pendiente_de_confirmar");
    fields.push("fecha_recordatorio");
  }
  return fields;
}

export function buildActivityNotes(command: ParsedActivityCommand) {
  const parts = [
    command.notes,
    command.materialsReviewed ? "Se revisaron materiales." : null,
    command.pendingConfirmation ? "Queda confirmación pendiente por parte del cliente." : null
  ].filter(Boolean);
  return parts.join("\n");
}

export function activityCreatedMessage({
  command,
  clientName,
  workTitle,
  eventId,
  pendingFields
}: {
  command: ParsedActivityCommand;
  clientName: string;
  workTitle?: string;
  eventId: string;
  pendingFields: string[];
}) {
  const typeLabel = command.eventType === "reunion" ? "reunión" : command.eventType;
  const time = command.eventTime ? ` a las ${command.eventTime}` : "";
  const work = workTitle ? ` sobre ${workTitle}` : "";
  const notes = [
    command.materialsReviewed ? "He anotado que revisasteis materiales." : null,
    command.pendingConfirmation ? `${clientName} tiene que confirmar.` : null
  ].filter(Boolean).join(" ");
  const questions = [
    pendingFields.includes("materiales_revisados") ? "¿Qué materiales revisasteis?" : null,
    pendingFields.includes("pendiente_de_confirmar") ? "¿Qué tiene que confirmar exactamente?" : null,
    pendingFields.includes("fecha_recordatorio") ? "¿Cuándo quieres que te recuerde llamarle si no responde?" : null
  ].filter(Boolean).map((question, index) => `${index + 1}. ${question}`).join("\n");

  return `He registrado la ${typeLabel} con ${clientName}${work}${time}.

${notes || "He guardado la nota en la agenda interna."}

${questions ? `Para dejar el seguimiento mejor preparado:\n\n${questions}` : `Puedes revisarla en /agenda?buscar=${encodeURIComponent(eventId)}.`}`;
}

export function reminderDateTime(message: string, entities: ChatEntities) {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const hint = entities.reminderDateHint ?? (normalized.includes("manana") ? "tomorrow" : normalized.includes("hoy") ? "today" : undefined);
  const weekday = weekdayDate(normalized);
  if (!hint && !weekday && !entities.reminderTime) return null;
  const date = weekday ?? new Date();
  if (hint === "tomorrow") date.setDate(date.getDate() + 1);
  const time = entities.reminderTime ?? "10:00";
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours || 10, minutes || 0, 0, 0);
  return date;
}

function weekdayDate(normalized: string) {
  const weekdays: Record<string, number> = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6
  };
  const match = normalized.match(/\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/);
  if (!match?.[1]) return null;
  const target = weekdays[match[1]];
  const date = new Date();
  const delta = (target - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + delta);
  return date;
}

export function timeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function amountForIvaUpdate(subtotal: number, iva: number, total: number, mode: IvaMode) {
  if (mode === "included") return roundMoney(total);
  if (mode === "plus") return iva > 0 ? roundMoney(subtotal) : roundMoney(total);
  return iva > 0 ? roundMoney(subtotal) : roundMoney(total);
}

export function retotalLines(lines: BudgetLine[], title: string, newSubtotal: number) {
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

export function ivaModeFromAI(ai: CapatazAIResult): IvaMode {
  if (ai.entities.iva_porcentaje === 0) return "none";
  if (ai.entities.iva_incluido === true) return "included";
  if (ai.entities.iva_incluido === false) return "plus";
  return "unknown";
}

export function buildAIWorkTitle(ai: CapatazAIResult) {
  const entities = ai.entities;
  const base = entities.descripcion_trabajo ?? entities.alcance ?? entities.obra_nombre;
  if (!base) return null;

  let title = base;
  if (entities.cantidad && entities.unidad_cantidad && !title.includes(String(entities.cantidad))) {
    title = `${title} ${entities.cantidad} ${entities.unidad_cantidad}`;
  }
  const workPlaceType = entities.obra_tipo ?? (/hotel/i.test(entities.obra_nombre ?? "") ? entities.obra_nombre : null);
  if (workPlaceType && !title.toLowerCase().includes(workPlaceType.toLowerCase())) {
    title = `${title} en ${workPlaceType}`;
  }

  return sentenceLike(title);
}

export function buildAIBudgetLine(ai: CapatazAIResult, subtotal: number): BudgetLine {
  const firstLine = ai.entities.partidas[0];
  const quantity = firstLine?.cantidad ?? ai.entities.cantidad ?? 1;
  const total = firstLine?.total ?? subtotal;
  const safeQuantity = quantity > 0 ? quantity : 1;
  const description = firstLine?.descripcion ?? buildAILineDescription(ai, buildAIWorkTitle(ai) ?? "Trabajo");

  return {
    descripcion: description,
    cantidad: safeQuantity,
    unidad: firstLine?.unidad ?? ai.entities.unidad_cantidad ?? "servicio",
    precioUnitario: firstLine?.precioUnitario ?? roundMoney(total / safeQuantity),
    total: roundMoney(total),
    categoria: firstLine?.categoria ?? (ai.entities.material_incluido ? "Material incluido" : "General")
  };
}

export function buildAILineDescription(ai: CapatazAIResult, fallback: string) {
  const entities = ai.entities;
  const details = [
    entities.descripcion_trabajo ?? fallback,
    entities.alcance && !fallback.toLowerCase().includes(entities.alcance.toLowerCase()) ? entities.alcance : null,
    entities.material_incluido ? "material incluido" : null,
    entities.duracion_estimada ? `duración estimada ${entities.duracion_estimada}` : null
  ].filter(Boolean);
  return sentenceLike(details.join(", "));
}

export function pendingFieldsFromAI(ai: CapatazAIResult, ivaMode: IvaMode) {
  const fields = new Set<PendingField>();
  const pendingText = ai.entities.datos_pendientes.join(" ").toLowerCase();

  if (ivaMode === "unknown" || pendingText.includes("iva")) fields.add("iva");
  if (!ai.entities.obra_direccion || pendingText.includes("direccion obra") || pendingText.includes("dirección obra")) fields.add("direccion_obra");
  if (!ai.entities.contacto_telefono && !ai.entities.contacto_email) fields.add("datos_cliente");
  if (!ai.entities.cliente_nif || !ai.entities.direccion_fiscal || pendingText.includes("cif") || pendingText.includes("nif") || pendingText.includes("fiscal")) {
    fields.add("datos_fiscales");
  }

  return [...fields];
}

export function clientTypeFromAI(ai: CapatazAIResult) {
  if (ai.entities.empresa_facturacion) return "Empresa";
  if (ai.entities.cliente_tipo === "empresa") return "Empresa";
  if (ai.entities.cliente_tipo === "autonomo") return "Autónomo";
  return "Particular";
}

export function buildAIClientNotes(ai: CapatazAIResult) {
  const entities = ai.entities;
  const notes = [
    entities.contacto_nombre && entities.empresa_facturacion ? `Contacto operativo: ${entities.contacto_nombre}.` : null,
    entities.contacto_telefono ? `Teléfono contacto: ${entities.contacto_telefono}.` : null,
    entities.contacto_email ? `Email contacto: ${entities.contacto_email}.` : null,
    entities.cliente_nif ? `NIF/CIF: ${entities.cliente_nif}.` : null,
    entities.direccion_fiscal ? `Dirección fiscal: ${entities.direccion_fiscal}.` : null,
    entities.datos_pendientes.length ? `Datos pendientes: ${entities.datos_pendientes.join(", ")}.` : null
  ].filter(Boolean);

  return notes.join("\n") || "Cliente provisional preparado por Orqena. Faltan datos para emitir documentos definitivos.";
}

export function buildAIWorkNotes(ai: CapatazAIResult) {
  const entities = ai.entities;
  const notes = [
    entities.obra_tipo ? `Tipo de obra: ${entities.obra_tipo}.` : null,
    entities.obra_localidad ? `Localidad: ${entities.obra_localidad}.` : null,
    entities.alcance ? `Alcance: ${entities.alcance}.` : null,
    entities.cantidad && entities.unidad_cantidad ? `Cantidad: ${entities.cantidad} ${entities.unidad_cantidad}.` : null,
    entities.material_incluido === true ? "Material incluido en el precio." : null,
    entities.duracion_estimada ? `Duración estimada: ${entities.duracion_estimada}.` : null,
    entities.notas ? entities.notas : null
  ].filter(Boolean);

  return notes.join("\n") || "Trabajo provisional preparado por Orqena.";
}

export function buildAIBudgetObservations(ai: CapatazAIResult, ivaMode: IvaMode) {
  const notes = [
    invoiceIvaObservation(ivaMode),
    `Material incluido: ${ai.entities.material_incluido ? "Sí" : "No indicado"}.`,
    ai.entities.duracion_estimada ? `Duración estimada: ${ai.entities.duracion_estimada}.` : null,
    ai.entities.datos_pendientes.length ? `Pendiente de completar: ${ai.entities.datos_pendientes.join(", ")}.` : null
  ].filter(Boolean);

  return notes.join(" ");
}

export function buildAIBudgetMessage(ai: CapatazAIResult, details: {
  clientName: string;
  contactName?: string;
  workTitle: string;
  amount: number;
  budgetId: string;
  budgetNumber: string;
  ivaMode: IvaMode;
  pendingFields: string[];
  clientWasCreated: boolean;
}) {
  const pending = details.pendingFields.length || ai.clarificationQuestions.length
    ? `\n\nPara dejarlo bien cerrado me falta:\n\n${[
        ...new Set([
          ...ai.clarificationQuestions,
          details.pendingFields.includes("iva") ? `Confirmar si los ${formatEuros(details.amount)} son con IVA incluido o más IVA.` : null,
          details.pendingFields.includes("datos_fiscales") ? "CIF/NIF y dirección fiscal del cliente de facturación." : null,
          details.pendingFields.includes("direccion_obra") ? "Dirección exacta de la obra." : null,
          (details.contactName || details.pendingFields.includes("datos_cliente") || (!ai.entities.contacto_telefono && !ai.entities.contacto_email))
            ? `Teléfono o email de ${details.contactName ?? "contacto"}.`
            : null
        ].filter(Boolean) as string[])
      ].map((question, index) => `${index + 1}. ${question}`).join("\n")}`
    : "";
  const contact = details.contactName && details.contactName !== details.clientName ? `Contacto: ${details.contactName}\n` : "";
  const location = ai.entities.obra_localidad ? `\nUbicación: ${ai.entities.obra_localidad}` : "";
  const duration = ai.entities.duracion_estimada ? `\nDuración estimada: ${ai.entities.duracion_estimada}` : "";

  return `He preparado el nuevo trabajo en borrador.

${contact}Cliente de facturación: ${details.clientName}${details.clientWasCreated ? " (provisional)" : ""}
Obra: ${details.workTitle}${location}
Importe acordado: ${formatEuros(details.amount)}
Material incluido: ${ai.entities.material_incluido ? "Sí" : "No indicado"}${duration}
Presupuesto: ${details.budgetNumber}

Puedes revisarlo y editarlo aquí: /presupuestos/${details.budgetId}${pending}

No he enviado ningún documento al cliente.`;
}

export function buildAIClarificationResponse(ai: CapatazAIResult) {
  const entitySummary = [
    ai.entities.contacto_nombre ? `Contacto: ${ai.entities.contacto_nombre}` : null,
    ai.entities.empresa_facturacion ? `Cliente de facturación: ${ai.entities.empresa_facturacion}` : null,
    ai.entities.descripcion_trabajo ? `Trabajo: ${ai.entities.descripcion_trabajo}` : null,
    ai.entities.importe ? `Importe: ${formatEuros(ai.entities.importe)}` : null
  ].filter(Boolean).join("\n");
  const intro = entitySummary ? `He entendido estos datos:\n\n${entitySummary}` : "Necesito un poco más de contexto para preparar una acción segura.";
  return withQuestions(intro, ai.clarificationQuestions);
}

export function withQuestions(response: string, questions: string[]) {
  const clean = response.trim();
  if (!questions.length) return clean;
  const list = questions.map((question, index) => `${index + 1}. ${question}`).join("\n");
  return `${clean}\n\n${list}`.trim();
}

function sentenceLike(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : clean;
}

export function buildBudgetObservations(command: ParsedBudgetCommand) {
  const ivaNote = invoiceIvaObservation(command.ivaMode);
  return `${ivaNote} Material incluido: ${command.materialIncluded ? "Sí" : "No indicado"}. Revisar antes de enviar al cliente.`;
}

export function ivaObservation(mode: Exclude<IvaMode, "unknown">) {
  if (mode === "included") return "IVA incluido confirmado.";
  if (mode === "plus") return "IVA añadido aparte confirmado.";
  return "Presupuesto marcado sin IVA.";
}

export function invoiceIvaObservation(mode: IvaMode) {
  if (mode === "included") return "IVA incluido en el importe indicado.";
  if (mode === "plus") return "IVA añadido aparte sobre la base indicada.";
  if (mode === "none") return "Sin IVA.";
  return "IVA pendiente de confirmar: no queda claro si el importe incluye IVA o si hay que añadirlo aparte.";
}

export function ivaSummary(mode: Exclude<IvaMode, "unknown">) {
  if (mode === "included") return "IVA incluido";
  if (mode === "plus") return "IVA aparte";
  return "sin IVA";
}

export function invoiceIvaLabel(mode: IvaMode) {
  if (mode === "included") return "incluido";
  if (mode === "plus") return "añadido aparte";
  if (mode === "none") return "sin IVA";
  return "pendiente de confirmar";
}

export function budgetCreatedMessage({
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

export function pendingBudgetQuestion(context: ChatCommandContext) {
  const clientName = context.lastClientName ?? "ese cliente";
  return `Sigo con el presupuesto de ${clientName}. Me falta IVA, dirección de la obra o datos del cliente. Puedes contestar algo como “con IVA y en Mallorca”, “más IVA y en calle Mayor 12” o “tel 65898784”.`;
}

export function pendingBudgetContext({
  clientId,
  workId,
  budgetId,
  clientName,
  contactName,
  billingClientName,
  workName,
  amount,
  ivaMode,
  pendingFields
}: {
  clientId: string;
  workId: string;
  budgetId: string;
  clientName: string;
  contactName?: string;
  billingClientName?: string;
  workName?: string;
  amount?: number;
  ivaMode: IvaMode;
  pendingFields?: string[];
}): ChatCommandContext {
  return createBudgetCompletionContext({
    clientId,
    workId,
    budgetId,
    clientName,
    contactName,
    billingClientName,
    workName,
    pendingFields: pendingFields ?? (ivaMode === "unknown" ? ["iva", "direccion_obra", "datos_cliente"] : ["direccion_obra", "datos_cliente"]),
    draftData: amount ? { amount } : undefined
  });
}

export function budgetPendingFields(ivaMode: IvaMode, followUp?: ChatEntities) {
  const fields = new Set<string>();
  if (ivaMode === "unknown" && !followUp?.ivaMode) fields.add("iva");
  if (!followUp?.workAddress) fields.add("direccion_obra");
  if (!followUp?.phone && !followUp?.email && !followUp?.nif) fields.add("datos_cliente");
  return [...fields];
}

export function latestDocumentContext(kind: ChatDocumentKind, id: string, clientId?: string, workId?: string, clientName?: string): ChatCommandContext {
  return createLastDocumentContext({
    documentType: kind,
    documentId: id,
    clientId,
    workId,
    clientName
  });
}

export function contextIds(context: ChatCommandContext) {
  const normalized = normalizeChatContext(context);
  const task = normalized.activeTask;
  return {
    clientId: task?.clienteId ?? normalized.lastClientId,
    workId: task?.obraId ?? normalized.lastWorkId,
    budgetId: task?.presupuestoId ?? normalized.lastBudgetId,
    invoiceId: task?.facturaId ?? normalized.lastInvoiceId
  };
}

export function appendNote(current: string | null | undefined, note: string) {
  const cleanCurrent = (current ?? "").trim();
  if (cleanCurrent.includes(note)) return cleanCurrent || note;
  return cleanCurrent ? `${cleanCurrent}\n${note}` : note;
}

export function joinNatural(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function revalidateChatPaths(clientId?: string, workId?: string, budgetId?: string) {
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

export function revalidateInvoicePaths(clientId?: string, workId?: string, invoiceId?: string) {
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

export function revalidateActivityPaths(clientId?: string, workId?: string, eventId?: string) {
  revalidatePath("/capataz");
  revalidatePath("/agenda");
  revalidatePath("/recordatorios");
  revalidatePath("/clientes");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/obras");
  if (workId) revalidatePath(`/obras/${workId}`);
  if (eventId) revalidatePath(`/agenda?evento=${eventId}`);
  revalidatePath("/hoy");
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatEuros(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

export function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
