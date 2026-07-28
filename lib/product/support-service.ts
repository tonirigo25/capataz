import type { PrismaClient } from "@prisma/client";
import { stableReference } from "@/lib/ai/redaction";
import { getPrivateStorageService } from "@/lib/private-storage";
import { getRequestContext } from "@/lib/platform/request-context";
import { appendSensitiveAuditLog } from "@/lib/security/audit-chain";

const CATEGORIES = new Set(["ACCESS", "BILLING", "DOCUMENTS", "OPERATIONS", "PRIVACY", "OTHER"]);
const PRIORITIES = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);

export function supportSlaForPriority(priority: string, now = new Date()) {
  const hours = priority === "URGENT" ? [1, 8] : priority === "HIGH" ? [4, 48] : priority === "LOW" ? [72, 240] : [24, 120];
  return { firstResponseDueAt: new Date(now.getTime() + hours[0] * 3_600_000), resolutionDueAt: new Date(now.getTime() + hours[1] * 3_600_000) };
}

export function sanitizeSupportText(value: string, max = 4000): string {
  return value
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_SECRET]")
    .replace(/Bearer\s+[A-Za-z0-9._~-]{8,}/gi, "Bearer [REDACTED_SECRET]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(?:\+34[ .-]?)?[6789](?:[ .-]?\d){8}\b/g, "[REDACTED_PHONE]")
    .replace(/\b(?:[XYZ]\d{7,8}[A-Z]|[ABCDEFGHJNPQRSUVW]\d{7}[A-Z0-9]|\d{8}[A-Z])\b/gi, "[REDACTED_TAX_ID]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export async function createAuthenticatedSupportTicket(prisma: PrismaClient, input: {
  companyId: string;
  actorId: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  route?: string;
  attachment?: File;
}) {
  if (!CATEGORIES.has(input.category) || !PRIORITIES.has(input.priority)) throw new Error("SUPPORT_CLASSIFICATION_INVALID");
  const subject = sanitizeSupportText(input.subject, 160);
  const description = sanitizeSupportText(input.description);
  if (!subject || description.length < 10) throw new Error("SUPPORT_CONTENT_REQUIRED");
  const route = input.route?.trim().split("?")[0];
  if (route && (!route.startsWith("/") || route.length > 120 || /[\r\n]/.test(route))) throw new Error("SUPPORT_ROUTE_INVALID");
  const context = getRequestContext();
  const sla = supportSlaForPriority(input.priority);
  let storedObjectId: string | undefined;
  if (input.attachment && input.attachment.size > 0) {
    if (input.attachment.size > 5 * 1024 * 1024) throw new Error("SUPPORT_ATTACHMENT_TOO_LARGE");
    const stored = await getPrivateStorageService(prisma).put({
      companyId: input.companyId,
      bytes: new Uint8Array(await input.attachment.arrayBuffer()),
      originalName: input.attachment.name,
      mimeType: input.attachment.type,
      classification: "SUPPORT_CONFIDENTIAL",
      idempotencyKey: `support:${input.companyId}:${context?.requestId ?? stableReference(subject)}:${input.attachment.name}:${input.attachment.size}`,
    });
    storedObjectId = stored.id;
  }
  return prisma.$transaction(async (transaction) => {
    const ticket = await transaction.supportTicket.create({
      data: {
        companyId: input.companyId,
        actorIdHash: stableReference(input.actorId),
        category: input.category,
        priority: input.priority,
        subject,
        description,
        route: route || null,
        release: context?.release?.slice(0, 120) || null,
        requestId: context?.requestId,
        correlationId: context?.correlationId,
        context: { source: "authenticated-support", attachmentCount: storedObjectId ? 1 : 0 },
        firstResponseDueAt: sla.firstResponseDueAt,
        resolutionDueAt: sla.resolutionDueAt,
        attachments: storedObjectId ? { create: { storedObjectId } } : undefined,
      },
    });
    await appendSensitiveAuditLog(transaction, {
      companyId: input.companyId,
      userActorId: input.actorId,
      action: "support.ticket.created",
      targetType: "SupportTicket",
      targetId: ticket.id,
      requestId: context?.requestId,
      correlationId: context?.correlationId,
      metadata: { category: ticket.category, priority: ticket.priority, route: ticket.route, attachmentCount: storedObjectId ? 1 : 0 },
    });
    return ticket;
  });
}
