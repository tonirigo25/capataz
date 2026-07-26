import { invalidateActionPath as revalidatePath } from "@/lib/application/action-effects";
import { normalizeChatContext } from "@/lib/capataz-chat-engine";
import { CHAT_INACTIVITY_MS, shouldShowConversationInHistory } from "@/lib/chat-conversation-rules";
import { normalizeName } from "@/lib/capataz-chat-parser";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext, withCompanyContext } from "@/lib/auth/session";
import { requireCapability } from "@/lib/commercial/authorization";
import type { OrqenaEntityType, PendingConfirmation } from "@/lib/orqena/types";
import { appendMessageForCompany, archiveConversationForCompany, cancelPendingProposalForCompany, completeMessageForCompany, beginPendingProposalExecutionForCompany, createConversationForCompany, deleteConversationForCompany, failMessageForCompany, finishPendingProposalExecutionForCompany, getConversationForCompany, getMessageForCompany, listConversationsForCompany, logConversationActionForCompany, renameConversationForCompany, touchConversationForCompany, type ConversationTenantContext } from "@/lib/orqena/conversation-repository";
import { ChatActionResult, ChatCommandContext, ChatCommandResult, ChatHistoryConversation, ChatPerfTrace, conversationTenantContext } from "@/lib/orqena/application/capataz/orchestration";

export async function completeChatMessage(messageId: string | undefined, result: ChatCommandResult) {
  if (!messageId) return;
  const tenant = await conversationTenantContext();
  const sourceMessage = await getMessageForCompany(tenant, { id: messageId });
  const conversationId = sourceMessage?.conversationId;
  if (!conversationId) return;
  const metadata = toJsonValue({
    result,
    completedAt: new Date().toISOString()
  });
  await completeMessageForCompany(tenant, messageId, metadata);

  if (result.text) {
    await appendMessageForCompany(tenant, conversationId, {
        role: "assistant",
        content: result.text,
        status: "completed",
        metadata: toJsonValue({ replyTo: messageId, created: result.created ?? null, result: result.result ?? null })
    });
  }
  if (result.result) {
    await logConversationActionForCompany(tenant, conversationId, {
        messageId,
        stage: "action_result",
        actionType: result.result.entityType,
        status: result.result.type,
        idempotencyKey: sourceMessage.idempotencyKey ?? undefined,
        summary: result.result.title,
        result: toJsonValue(result.result),
        metadata: toJsonValue({ created: result.created ?? null })
    }).catch(() => undefined);
  }
  await updateConversationAfterResult(tenant, conversationId, result, sourceMessage.idempotencyKey);
}

export async function failChatMessage(messageId: string | undefined, error: unknown) {
  if (!messageId) return;
  const tenant = await conversationTenantContext();
  await failMessageForCompany(tenant, messageId, toJsonValue({
        failedAt: new Date().toISOString(),
        error: error instanceof Error ? sanitizeAIError(error.message) : "unknown"
  })).catch(() => undefined);
}

export async function loadChatConversations(includeArchived = false): Promise<ChatHistoryConversation[]> {
  const tenant = await conversationTenantContext();
  return loadChatConversationsForTenant(tenant, includeArchived);
}

async function loadChatConversationsForTenant(tenant: ConversationTenantContext, includeArchived = false): Promise<ChatHistoryConversation[]> {
  const conversations = await listConversationsForCompany(tenant, includeArchived);

  return conversations
    .filter((conversation) => shouldShowConversationInHistory(conversation.messages.length, isRecord(conversation.metadata) && conversation.metadata.keepVisible === true))
    .map((conversation) => chatConversationToHistory(conversation));
}

export async function getOrCreateInitialConversation(preferredConversationId?: string | null): Promise<{ selected: ChatHistoryConversation; conversations: ChatHistoryConversation[]; reason: "restored_preferred" | "restored_recent" | "created_inactive" | "created_empty" }> {
  const tenant = await conversationTenantContext();
  const now = new Date();
  const threshold = new Date(now.getTime() - CHAT_INACTIVITY_MS);
  const preferred = preferredConversationId
    ? await getConversationForCompany(tenant, preferredConversationId, { activeOnly: true })
    : null;

  if (preferred && preferred.lastActivityAt >= threshold) {
    const conversations = await loadChatConversationsForTenant(tenant, false);
    safeChatLog("conversation:init", { conversationId: preferred.id, reason: "restored_preferred" });
    return { selected: chatConversationToHistory(preferred), conversations: includeSelectedConversation(conversations, preferred), reason: "restored_preferred" };
  }

  const recent = (await listConversationsForCompany(tenant, false)).find((item) => item.lastActivityAt >= threshold) ?? null;

  if (recent) {
    const conversations = await loadChatConversationsForTenant(tenant, false);
    safeChatLog("conversation:init", { conversationId: recent.id, reason: "restored_recent" });
    return { selected: chatConversationToHistory(recent), conversations: includeSelectedConversation(conversations, recent), reason: "restored_recent" };
  }

  const reusableEmpty = (await listConversationsForCompany(tenant, false)).filter((item) => item.messages.length === 0).slice(0, 5);
  const empty = reusableEmpty?.find((conversation) => !conversation.activeTask) ?? null;

  const selected = empty ?? await createConversationForCompany(tenant, {
      title: "Nueva conversación",
      status: "active",
      activeTask: undefined,
      metadata: toJsonValue({ reason: preferred ? "inactive_preferred" : "initial_empty" }),
      lastActivityAt: now
  });

  const conversations = await loadChatConversationsForTenant(tenant, false);
  const reason = preferred ? "created_inactive" as const : "created_empty" as const;
  safeChatLog("conversation:init", { conversationId: selected.id, previousConversationId: preferred?.id, reason });
  return { selected: chatConversationToHistory(selected), conversations: includeSelectedConversation(conversations, selected), reason };
}

function chatConversationToHistory(conversation: {
  id: string;
  title: string;
  status: string;
  activeTask?: unknown;
  metadata?: unknown;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    status: string;
    createdAt: Date;
    metadata: unknown;
  }>;
}): ChatHistoryConversation {
  return {
    id: conversation.id,
    title: conversation.title,
    status: conversation.status,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastActivityAt: conversation.lastActivityAt.toISOString(),
    activeTask: normalizeConversationContext(conversation.activeTask),
    metadata: conversation.metadata ?? undefined,
    messages: conversation.messages
      .filter((message) => message.role === "user" || message.role === "assistant" || message.role === "system")
      .map((message) => ({
        id: message.id,
        role: message.role as "assistant" | "user" | "system",
        text: message.content,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
        metadata: message.metadata ?? undefined,
        result: actionResultFromMessageMetadata(message.metadata)
      }))
  };
}

function includeSelectedConversation(conversations: ChatHistoryConversation[], selected: Parameters<typeof chatConversationToHistory>[0]) {
  if (conversations.some((conversation) => conversation.id === selected.id)) return conversations;
  return selected.messages.length ? [chatConversationToHistory(selected), ...conversations] : conversations;
}

export async function createChatConversation(title = "Nueva conversación") {
  const tenant = await conversationTenantContext();
  const conversation = await createConversationForCompany(tenant, {
      title: cleanConversationTitle(title) || "Nueva conversación",
      activeTask: undefined,
      metadata: toJsonValue({ createdFrom: "new_chat_button" }),
      lastActivityAt: new Date()
  });
  safeChatLog("conversation:new", { conversationId: conversation.id });
  revalidatePath("/capataz");
  return chatConversationToHistory(conversation);
}

export async function renameChatConversation(conversationId: string, title: string) {
  const tenant = await conversationTenantContext();
  const nextTitle = cleanConversationTitle(title);
  if (!nextTitle) return;
  await renameConversationForCompany(tenant, conversationId, nextTitle);
  revalidatePath("/capataz");
}

export async function archiveChatConversation(conversationId: string) {
  const tenant = await conversationTenantContext();
  await archiveConversationForCompany(tenant, conversationId);
  safeChatLog("conversation:archive", { conversationId });
  revalidatePath("/capataz");
}

export async function deleteChatConversation(conversationId: string) {
  const tenant = await conversationTenantContext();
  await deleteConversationForCompany(tenant, conversationId);
  safeChatLog("conversation:delete", { conversationId });
  revalidatePath("/capataz");
}

export function looksLikeExplicitWorkflowMutation(normalized:string){return /^(crea|crear) (una tarea|un seguimiento)\b|^(anota|registra) que no respondio|^(marca|completa|complétala|completala).*tarea|^completala$|^(pausala|páusala|pausa esta automatizacion|pausa esta automatización|reanúdala|reanudala|reanuda esta automatizacion|reanuda esta automatización|ejecutala en seco|ejecútala en seco)$/.test(normalized)}

export function looksLikeWorkflowContractMutation(normalized:string){return /(checklist|subtarea|dependencia|seguimiento|automatizaci[oó]n|nueva versi[oó]n|facturas con m[aá]s|cree una recomendaci[oó]n)|^(abre|muestra|archiva|reprograma|c[aá]mbiala|ejec[uú]tala|completa|reabre|a[nñ]ade|agrega|retira)/.test(normalized)}

const proposalEntityTypes = new Set<OrqenaEntityType>(["client", "work", "budget", "invoice", "supplier", "task", "document"]);

export async function preparePendingProposal(conversationId: string, proposal: { type: string; payload: Record<string, unknown>; review: Record<string, unknown> }): Promise<PendingConfirmation> {
  const authorization = await requireCapability("orqena.execute");
  if (authorization.scope !== "COMPANY") throw new Error("Conversación no disponible.");
  const tenant = { userId: authorization.userId, companyId: authorization.companyId, membershipId: authorization.membershipId };
  const conversation = await getConversationForCompany(tenant, conversationId, { activeOnly: true });
  if (!conversation || !proposalEntityTypes.has(proposal.type as OrqenaEntityType)) throw new Error("Conversación no disponible.");
  const now = new Date();
  const confirmation: PendingConfirmation = {
    id: crypto.randomUUID(),
    companyId: tenant.companyId,
    conversationId,
    userId: tenant.userId,
    membershipId: tenant.membershipId,
    action: `create_${proposal.type}`,
    entityType: proposal.type as OrqenaEntityType,
    payload: proposal.payload,
    review: proposal.review,
    status: "PENDING",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString()
  };
  await touchConversationForCompany(tenant, conversationId, { pendingConfirmation: toJsonValue(confirmation) });
  await logConversationActionForCompany(tenant, conversationId, { stage: "proposal_prepared", status: "pending", actionType: confirmation.entityType, summary: "Propuesta preparada", result: toJsonValue({ confirmationId: confirmation.id, expiresAt: confirmation.expiresAt }) });
  return confirmation;
}

export async function cancelPendingProposal(conversationId: string, confirmationId: string): Promise<{ status: "cancelled"; confirmationId: string; alreadyCancelled: boolean }> {
  const authorization = await requireCapability("orqena.execute");
  if (authorization.scope !== "COMPANY") throw new Error("Conversación no disponible.");
  const tenant = { userId: authorization.userId, companyId: authorization.companyId, membershipId: authorization.membershipId };
  const result = await cancelPendingProposalForCompany(tenant, conversationId, confirmationId);
  revalidatePath("/capataz");
  return { status: "cancelled", confirmationId, alreadyCancelled: result.alreadyCancelled };
}

export type PendingProposalOperation = "manual" | "payment" | "accept-budget" | "work-status" | "agenda-reprogram" | "agenda-status";

export async function executePendingProposal(conversationId: string, confirmationId: string, operation: PendingProposalOperation, formData: FormData): Promise<{ status: "confirmed"; confirmationId: string; alreadyConfirmed: boolean } | { status: "expired"; confirmationId: string; alreadyConfirmed: false }> {
  const authorization = await requireCapability("orqena.execute");
  if (authorization.scope !== "COMPANY") throw new Error("Conversación no disponible.");
  const tenant = { userId: authorization.userId, companyId: authorization.companyId, membershipId: authorization.membershipId };
  return withCompanyContext(authorization, async () => {
  let execution;
  try {
    execution = await beginPendingProposalExecutionForCompany(tenant, conversationId, confirmationId);
  } catch (error) {
    if (error instanceof Error && error.message === "Esta propuesta ha caducado") return { status: "expired", confirmationId, alreadyConfirmed: false };
    throw error;
  }
  if (execution.alreadyConfirmed) return { status: "confirmed", confirmationId, alreadyConfirmed: true };
  const entityType = execution.confirmation?.entityType;
  const manualType = String(formData.get("tipo") ?? "");
  const expectedEntityType = operation === "manual"
    ? ({ cliente: "client", presupuesto: "budget", factura: "invoice", gasto: "document", recordatorio: "task", eventoAgenda: "task" } as Record<string, string>)[manualType]
    : operation === "payment" ? "invoice"
      : operation === "accept-budget" || operation === "work-status" ? "work"
        : "task";
  if (!expectedEntityType || entityType !== expectedEntityType || !proposalTargetsMatch(execution.confirmation?.payload, operation, manualType, formData)) {
    await finishPendingProposalExecutionForCompany(tenant, conversationId, confirmationId, false);
    throw new Error("Propuesta no disponible.");
  }
  try {
    if (operation === "manual") await (await import("@/app/(app)/gestion/actions")).saveManualRecord(formData);
    else if (operation === "payment") await (await import("@/app/(app)/dinero/actions")).registerPayment(formData);
    else if (operation === "accept-budget") await (await import("@/app/(app)/presupuestos/actions")).convertBudgetToWork(formData);
    else if (operation === "work-status") await (await import("@/app/(app)/obras/actions")).updateWorkStatus(formData);
    else if (operation === "agenda-reprogram") await (await import("@/app/(app)/agenda/actions")).reprogramAgendaEvent(formData);
    else await (await import("@/app/(app)/agenda/actions")).updateAgendaEventStatus(formData);
  } catch (error) {
    if (isNextRedirect(error)) {
      await finishPendingProposalExecutionForCompany(tenant, conversationId, confirmationId, true);
      revalidatePath("/capataz");
      return { status: "confirmed", confirmationId, alreadyConfirmed: false };
    }
    await finishPendingProposalExecutionForCompany(tenant, conversationId, confirmationId, false).catch(() => undefined);
    throw error;
  }
  await finishPendingProposalExecutionForCompany(tenant, conversationId, confirmationId, true);
  revalidatePath("/capataz");
  return { status: "confirmed", confirmationId, alreadyConfirmed: false };
  });
}

function proposalTargetsMatch(payload: unknown, operation: PendingProposalOperation, manualType: string, formData: FormData) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const card = payload as Record<string, unknown>;
  const field = (name: string) => String(formData.get(name) ?? "");
  if (operation === "manual") {
    if (field("id")) return false;
    if (manualType === "cliente") return typeof card.clientName === "string";
    if (manualType === "presupuesto") return field("clienteId") === card.clientId;
    if (manualType === "factura") return field("clienteId") === card.clientId && field("obraId") === String(card.workId ?? "");
    if (manualType === "gasto") return field("obraId") === card.workId;
    if (manualType === "recordatorio") return field("clienteId") === card.clientId && field("presupuestoId") === String(card.budgetId ?? "") && field("facturaId") === String(card.invoiceId ?? "");
    if (manualType === "eventoAgenda") return field("clienteId") === card.clientId && field("obraId") === String(card.workId ?? "") && field("presupuestoId") === String(card.budgetId ?? "") && field("facturaId") === String(card.invoiceId ?? "");
    return false;
  }
  if (operation === "payment") return field("facturaId") === card.invoiceId;
  if (operation === "accept-budget") return field("id") === card.budgetId;
  if (operation === "work-status") return field("id") === card.workId;
  if (operation === "agenda-reprogram" || operation === "agenda-status") return field("id") === card.eventId;
  return false;
}

function isNextRedirect(error: unknown) {
  return Boolean(error && typeof error === "object" && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT"));
}

export async function ensureChatConversation(tenant: ConversationTenantContext, conversationId: string | undefined, firstText: string) {
  if (conversationId) {
    const existing = await getConversationForCompany(tenant, conversationId, { activeOnly: true });
    if (existing) return existing;
    safeChatLog("conversation:missing_selected", { conversationId });
  }

  const created = await createConversationForCompany(tenant, {
      title: titleFromUserMessage(firstText),
      status: "active",
      activeTask: undefined,
      metadata: toJsonValue({ createdFrom: conversationId ? "missing_selected_fallback" : "message_without_conversation" }),
      lastActivityAt: new Date()
  });
  safeChatLog("conversation:create_for_message", { conversationId: created.id, previousConversationId: conversationId });
  return created;
}

async function updateConversationAfterResult(tenant: ConversationTenantContext, conversationId: string, result: ChatCommandResult, idempotencyKey?: string | null) {
  const conversation = await getConversationForCompany(tenant, conversationId);
  if (!conversation) return;
  const generic = !conversation.title || conversation.title === "Nueva conversación" || conversation.title === "Conversación anterior" || conversation.title === "Conversación principal";
  const firstUserMessage = generic
    ? conversation.messages.find((message) => message.role === "user")
    : null;
  const nextContext = result.clearContext ? null : result.context ?? undefined;
  await touchConversationForCompany(tenant, conversationId, {
      title: generic ? titleFromUserMessage(firstUserMessage?.content ?? result.text) : conversation.title,
      activeTask: nextContext === undefined ? undefined : toJsonValue(nextContext),
      lastActivityAt: new Date(),
      metadata: result.result ? toJsonValue({ lastResult: result.result, lastIdempotencyKey: idempotencyKey ?? null }) : undefined
  }).catch(() => undefined);
}

export async function touchChatConversation(conversationId: string, tenant?: ConversationTenantContext) {
  await touchConversationForCompany(tenant ?? await conversationTenantContext(), conversationId).catch(() => undefined);
}

function titleFromUserMessage(text: string) {
  const cleaned = cleanConversationTitle(text);
  if (!cleaned) return "Nueva conversación";
  const normalized = normalizeName(cleaned);
  if (normalized.includes("presupuesto")) return compactTitle(cleaned, "Presupuesto");
  if (normalized.includes("factura")) return compactTitle(cleaned, "Factura");
  if (normalized.includes("visita") || normalized.includes("reunion") || normalized.includes("llamada")) return compactTitle(cleaned, "Visita");
  if (normalized.includes("gasto") || normalized.includes("material")) return compactTitle(cleaned, "Gasto/material");
  if (normalized.includes("pago") || normalized.includes("pagado")) return compactTitle(cleaned, "Pago");
  return cleaned.slice(0, 58);
}

function compactTitle(text: string, prefix: string) {
  return `${prefix} ${text.replace(/^(haz|crea|crear|creame|créame|hacer|apunta|registrar|registra)\s+/i, "").slice(0, 48)}`.trim();
}

function cleanConversationTitle(title: string) {
  return title.replace(/\s+/g, " ").replace(/[\n\r\t]/g, " ").trim().slice(0, 80);
}

export async function logChatPerf(trace: ChatPerfTrace, stage: string, startedAt: number, status: string, metadata?: Record<string, unknown>) {
  const durationMs = Math.max(0, Math.round(nowMs() - startedAt));
  const payload = { stage, status, durationMs, messageId: trace.messageId, conversationId: trace.conversationId, ...(metadata ?? {}) };
  if (process.env.CAPATAZ_CHAT_DEBUG === "true" || process.env.NEXT_PUBLIC_APP_ENV !== "production") {
    console.info("[capataz-chat-perf]", JSON.stringify(payload));
  }

  if (!trace.conversationId) return;
  const tenant = await conversationTenantContext();
  await logConversationActionForCompany(tenant, trace.conversationId, {
      messageId: trace.messageId,
      stage,
      actionType: stage,
      status,
      idempotencyKey: trace.idempotencyKey,
      summary: typeof metadata?.action === "string" ? metadata.action : stage,
      durationMs,
      payload: toJsonValue({ stage, status }),
      metadata: toJsonValue(metadata ?? {})
  }).catch(() => undefined);
}

export function resultFromChatMetadata(value: unknown): ChatCommandResult | null {
  const metadata = isRecord(value) ? value : null;
  const result = isRecord(metadata?.result) ? metadata.result : null;
  if (!result || typeof result.text !== "string" || typeof result.handled !== "boolean") return null;
  return result as ChatCommandResult;
}

function actionResultFromMessageMetadata(value: unknown): ChatActionResult | undefined {
  const metadata = isRecord(value) ? value : null;
  const result = isRecord(metadata?.result) ? metadata.result : null;
  if (isChatActionResult(result)) return result;
  const commandResult = isRecord(result?.result) ? result.result : null;
  return isChatActionResult(commandResult) ? commandResult : undefined;
}

function isChatActionResult(value: unknown): value is ChatActionResult {
  if (!isRecord(value)) return false;
  return typeof value.type === "string"
    && typeof value.entityType === "string"
    && typeof value.title === "string"
    && isRecord(value.summary)
    && Array.isArray(value.actions);
}

export function normalizeConversationContext(value: unknown): ChatCommandContext | null {
  if (!isRecord(value)) return null;
  if (isRecord(value.activeTask) || isRecord(value.parkedTask) || isRecord(value.lastQuery) || typeof value.lastDocumentType === "string") {
    return normalizeChatContext(value as ChatCommandContext);
  }
  return null;
}

function safeChatLog(event: string, metadata: Record<string, unknown>) {
  const enabled = process.env.CAPATAZ_CHAT_DEBUG === "true" || process.env.NEXT_PUBLIC_APP_ENV !== "production";
  if (!enabled) return;
  console.info("[capataz-chat-state]", JSON.stringify({ event, ...metadata }));
}

export function toJsonValue(value: unknown) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value ?? null));
}

export function nowMs() {
  return Date.now();
}

export function extractPotentialNameHints(text: string) {
  const matches = text.match(/\b[A-ZÁÉÍÓÚÑ][\p{L}ÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}ÁÉÍÓÚÑáéíóúñ]+){0,2}\b/gu) ?? [];
  const ignored = new Set(["Tengo", "Quiere", "Hemos", "Factura", "Presupuesto", "Capataz"]);
  return [...new Set(matches.map((match) => match.trim()).filter((match) => match.length > 2 && !ignored.has(match)))].slice(0, 6);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeAIError(message: string) {
  return message
    .replace(/sk-[A-Za-z0-9_*.-]+/g, "[OPENAI_API_KEY]")
    .replace(/\[OPENAI_API_KEY\][A-Za-z0-9_*.-]+/g, "[OPENAI_API_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 700);
}

export async function findClientMatches(name: string) {
  const { companyId } = await requireCompanyContext();
  const target = normalizeName(name);
  const clients = await prisma.client.findMany({
    where: { companyId },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, direccion: true, notas: true }
  });

  const exactMatches = clients.filter((client) => normalizeName(client.nombre) === target);
  if (exactMatches.length) return exactMatches;

  const targetTokens = target.split(" ").filter(Boolean);
  if (targetTokens.length < 2) return [];

  return clients.filter((client) => {
    const normalized = normalizeName(client.nombre);
    return normalized.startsWith(`${target} `);
  });
}
