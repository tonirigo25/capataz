import { createHash, createHmac } from "node:crypto";
import { Prisma, type EmailOutbox, type PrismaClient } from "@prisma/client";
import { hashToken } from "@/lib/auth/crypto";
import { authConfig } from "@/lib/auth/config";
import type { EmailDeliveryProvider } from "@/lib/platform/providers/contracts";
import { hashCanonical } from "@/lib/platform/idempotency";
import { verifyResendWebhook } from "@/lib/platform/webhooks";
import { getEmailDeliveryProvider } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const emailEventKeys = [
  "employee_invited", "employee_accepted", "owner_approval_requested", "employee_approved", "employee_rejected", "invitation_revoked", "invitation_expiring",
  "profile_changed", "permissions_changed", "membership_suspended", "membership_reactivated", "security_alert", "demo_requested", "email_verification",
  "password_reset", "billing_payment_failed", "support_update", "alert",
] as const;
export type EmailEventKey = (typeof emailEventKeys)[number];

type TemplateDefinition = { subject: string; text: string; html: string; allowedVariables: readonly string[]; trackingEnabled: false };
const templates: Record<EmailEventKey, TemplateDefinition> = {
  employee_invited: actionTemplate("Te han invitado a Orqena", "Tu empresa te ha invitado. Abre el enlace seguro para continuar.", "Aceptar invitación"),
  email_verification: actionTemplate("Verifica tu correo en Orqena", "Confirma tu correo para activar tu cuenta.", "Verificar correo"),
  password_reset: actionTemplate("Restablece tu contraseña de Orqena", "Se ha solicitado un cambio de contraseña. Si no fuiste tú, ignora este mensaje.", "Restablecer contraseña"),
  employee_accepted: staticTemplate("Invitación aceptada", "La persona invitada ha aceptado la invitación."),
  owner_approval_requested: staticTemplate("Acceso pendiente de aprobación", "Hay una solicitud de acceso pendiente de tu aprobación."),
  employee_approved: staticTemplate("Tu acceso a Orqena está activo", "El propietario ha aprobado tu acceso profesional."),
  employee_rejected: staticTemplate("Solicitud de acceso revisada", "La solicitud de acceso ha sido revisada."),
  invitation_revoked: staticTemplate("Invitación revocada", "La invitación ya no está activa."),
  invitation_expiring: staticTemplate("Tu invitación caduca pronto", "La invitación está próxima a caducar."),
  profile_changed: staticTemplate("Tu portal profesional ha cambiado", "Se ha actualizado tu perfil profesional."),
  permissions_changed: staticTemplate("Tu acceso ha cambiado", "Se han actualizado tus permisos."),
  membership_suspended: staticTemplate("Tu acceso está suspendido", "El acceso profesional está suspendido."),
  membership_reactivated: staticTemplate("Tu acceso vuelve a estar activo", "El acceso profesional vuelve a estar activo."),
  security_alert: staticTemplate("Aviso de seguridad", "Hay un aviso de seguridad que debes revisar."),
  demo_requested: staticTemplate("Nueva solicitud de demo", "Hay una nueva solicitud de demostración."),
  billing_payment_failed: staticTemplate("No se ha podido renovar tu suscripción", "Revisa el método de pago. Durante la gracia no se realizará ningún cargo oculto."),
  support_update: staticTemplate("Actualización de soporte", "Tu solicitud de soporte tiene una actualización."),
  alert: staticTemplate("Aviso de Orqena", "Hay un aviso que requiere tu atención."),
};

type QueueDb = Pick<Prisma.TransactionClient, "emailTemplateVersion" | "emailOutbox">;

export async function queueEmailEvent(tx: QueueDb, input: { companyId?: string; invitationId?: string; eventKey: EmailEventKey; recipient: string; createdById?: string; payload?: Record<string, unknown>; idempotencyKey?: string }) {
  const definition = templates[input.eventKey];
  if (!definition) throw new Error("EMAIL_TEMPLATE_UNKNOWN");
  assertNoSecretMaterial(input.payload);
  const recipient = normalizeEmail(input.recipient);
  if (input.idempotencyKey) {
    const existing = await tx.emailOutbox.findFirst({ where: { companyId: input.companyId ?? null, idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.eventKey !== input.eventKey || existing.recipientHash !== emailHash(recipient) || hashCanonical(existing.payload) !== hashCanonical(input.payload ?? null)) throw new Error("EMAIL_IDEMPOTENCY_CONFLICT");
      return existing;
    }
  }
  const contentHash = hashCanonical(definition);
  await tx.emailTemplateVersion.upsert({
    where: { templateKey_version: { templateKey: input.eventKey, version: 1 } },
    update: { subject: definition.subject, htmlSource: definition.html, textSource: definition.text, allowedVariables: [...definition.allowedVariables], contentHash, trackingEnabled: false, active: true },
    create: { templateKey: input.eventKey, version: 1, subject: definition.subject, htmlSource: definition.html, textSource: definition.text, allowedVariables: [...definition.allowedVariables], contentHash, trackingEnabled: false, active: true },
  });
  return tx.emailOutbox.create({ data: {
    companyId: input.companyId, invitationId: input.invitationId, eventKey: input.eventKey, templateKey: input.eventKey, templateVersion: 1,
    idempotencyKey: input.idempotencyKey, recipient, recipientHash: emailHash(recipient), subject: definition.subject, htmlBody: null, textBody: null,
    payload: (input.payload ?? {}) as Prisma.InputJsonValue, createdById: input.createdById, trackingEnabled: false,
  } });
}

export async function claimEmailBatch(db: PrismaClient, input: { batchSize?: number; now?: Date } = {}) {
  const batchSize = Math.max(1, Math.min(input.batchSize ?? 25, 100));
  const now = input.now ?? new Date();
  return db.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<EmailOutbox[]>`
      SELECT * FROM "EmailOutbox"
      WHERE "status" IN ('PENDING', 'RETRYING') AND "availableAt" <= ${now}
      ORDER BY "availableAt", "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    `;
    if (!rows.length) return [];
    await transaction.emailOutbox.updateMany({ where: { id: { in: rows.map((row) => row.id) }, status: { in: ["PENDING", "RETRYING"] } }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
    return transaction.emailOutbox.findMany({ where: { id: { in: rows.map((row) => row.id) } }, orderBy: { createdAt: "asc" } });
  });
}

export async function claimEmailItem(db: PrismaClient, input: { id: string; companyId: string; now?: Date }) {
  const now = input.now ?? new Date();
  return db.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<EmailOutbox[]>`
      SELECT * FROM "EmailOutbox"
      WHERE "id" = ${input.id} AND "companyId" = ${input.companyId}
        AND "status" IN ('PENDING', 'RETRYING') AND "availableAt" <= ${now}
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;
    if (!rows[0]) return null;
    return transaction.emailOutbox.update({ where: { id: input.id }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
  });
}

export async function processClaimedEmail(db: PrismaClient, item: EmailOutbox, provider: EmailDeliveryProvider, input: { now?: Date; maxAttempts?: number } = {}) {
  if (item.status !== "PROCESSING") throw new Error("EMAIL_ITEM_NOT_CLAIMED");
  const now = input.now ?? new Date();
  const maxAttempts = input.maxAttempts ?? 5;
  const suppressed = await db.emailSuppression.findFirst({ where: { emailHash: item.recipientHash ?? emailHash(item.recipient), active: true, OR: [{ companyId: item.companyId }, { companyId: null }] } });
  if (suppressed) {
    await db.$transaction([
      db.emailDeliveryAttempt.create({ data: { outboxId: item.id, attempt: item.attempts, provider: provider.name, status: "CANCELLED", errorCode: "EMAIL_SUPPRESSED" } }),
      db.emailOutbox.update({ where: { id: item.id }, data: { status: "CANCELLED", processedAt: now, lastError: "EMAIL_SUPPRESSED" } }),
    ]);
    return { status: "CANCELLED" as const, previewHtml: null as string | null };
  }
  let tokenHashUpdate: { kind: "invitation"; id: string; tokenHash: string } | { kind: "verification" | "reset"; userId: string; tokenHash: string } | null = null;
  const startedAt = Date.now();
  try {
    const definition = await db.emailTemplateVersion.findUniqueOrThrow({ where: { templateKey_version: { templateKey: item.templateKey, version: item.templateVersion } } });
    const allowed = asStringArray(definition.allowedVariables);
    const variables: Record<string, string> = {};
    if (allowed.includes("actionUrl")) {
      const token = deriveActionToken(item.id);
      variables.actionUrl = actionUrl(item.eventKey as EmailEventKey, token);
      if (item.eventKey === "employee_invited" && item.invitationId) tokenHashUpdate = { kind: "invitation", id: item.invitationId, tokenHash: hashToken(token) };
      if (["email_verification", "password_reset"].includes(item.eventKey)) {
        const userId = String(asObject(item.payload).userId ?? "");
        if (!userId) throw new Error("EMAIL_TOKEN_USER_REQUIRED");
        tokenHashUpdate = { kind: item.eventKey === "email_verification" ? "verification" : "reset", userId, tokenHash: hashToken(token) };
      }
    }
    const rendered = renderTemplate({ subject: definition.subject, text: definition.textSource ?? "", html: definition.htmlSource, allowed }, variables);
    const receipt = await provider.send({ recipient: item.recipient, subject: rendered.subject, text: rendered.text, idempotencyKey: item.idempotencyKey ?? `outbox:${item.id}` });
    await db.$transaction(async (transaction) => {
      if (tokenHashUpdate?.kind === "invitation") await transaction.invitation.update({ where: { id: tokenHashUpdate.id }, data: { tokenHash: tokenHashUpdate.tokenHash } });
      if (tokenHashUpdate?.kind === "verification") {
        await transaction.emailVerificationToken.updateMany({ where: { userId: tokenHashUpdate.userId, usedAt: null }, data: { usedAt: now } });
        await transaction.emailVerificationToken.create({ data: { userId: tokenHashUpdate.userId, tokenHash: tokenHashUpdate.tokenHash, expiresAt: new Date(now.getTime() + authConfig.verificationMinutes * 60_000) } });
      }
      if (tokenHashUpdate?.kind === "reset") {
        await transaction.passwordResetToken.updateMany({ where: { userId: tokenHashUpdate.userId, usedAt: null }, data: { usedAt: now } });
        await transaction.passwordResetToken.create({ data: { userId: tokenHashUpdate.userId, tokenHash: tokenHashUpdate.tokenHash, expiresAt: new Date(now.getTime() + authConfig.resetMinutes * 60_000) } });
      }
      await transaction.emailDeliveryAttempt.create({ data: { outboxId: item.id, attempt: item.attempts, provider: provider.name, status: "SENT", providerMessageId: receipt.reference, latencyMs: Math.max(0, Date.now() - startedAt) } });
      await transaction.emailOutbox.update({ where: { id: item.id }, data: { status: "SENT", processedAt: now, lastError: null, providerMessageId: receipt.reference } });
    });
    return { status: "SENT" as const, previewHtml: provider.mode === "fake" ? rendered.html : null };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "EMAIL_DELIVERY_FAILED";
    const dead = item.attempts >= maxAttempts;
    const retryAt = new Date(now.getTime() + Math.min(24 * 60, 2 ** Math.min(item.attempts, 10)) * 60_000);
    await db.$transaction([
      db.emailDeliveryAttempt.create({ data: { outboxId: item.id, attempt: item.attempts, provider: provider.name, status: "FAILED", errorCode: "EMAIL_DELIVERY_FAILED", errorDetail: message, retryAt: dead ? null : retryAt } }),
      db.emailOutbox.update({ where: { id: item.id }, data: { status: dead ? "FAILED" : "RETRYING", lastError: message, availableAt: retryAt, deadLetteredAt: dead ? now : null } }),
    ]);
    return { status: dead ? "FAILED" as const : "RETRYING" as const, previewHtml: null as string | null };
  }
}

export async function processEmailOutboxItem(id: string, companyId: string) {
  const selected = await prisma.emailOutbox.findFirstOrThrow({ where: { id, companyId } });
  if (!["PENDING", "FAILED", "RETRYING"].includes(selected.status)) return { item: selected, previewHtml: null as string | null };
  if (selected.status === "FAILED") await prisma.emailOutbox.update({ where: { id }, data: { status: "RETRYING", availableAt: new Date(), deadLetteredAt: null } });
  const claimed = await claimEmailItem(prisma, { id, companyId });
  if (!claimed) return { item: await prisma.emailOutbox.findUniqueOrThrow({ where: { id } }), previewHtml: null as string | null };
  const result = await processClaimedEmail(prisma, claimed, getEmailDeliveryProvider());
  return { item: await prisma.emailOutbox.findUniqueOrThrow({ where: { id } }), previewHtml: result.previewHtml };
}

export async function replayDeadLetter(db: PrismaClient, input: { outboxId: string; companyId: string; adminUserId: string }) {
  return db.$transaction(async (transaction) => {
    const item = await transaction.emailOutbox.findFirstOrThrow({ where: { id: input.outboxId, companyId: input.companyId, status: "FAILED", deadLetteredAt: { not: null } } });
    await transaction.auditLog.create({ data: { companyId: input.companyId, userActorId: input.adminUserId, action: "email.dead_letter.replayed", targetType: "EmailOutbox", targetId: item.id } });
    return transaction.emailOutbox.update({ where: { id: item.id }, data: { status: "RETRYING", availableAt: new Date(), deadLetteredAt: null, lastError: null } });
  });
}

export async function ingestResendWebhook(db: PrismaClient, input: { rawBody: string; id: string; timestamp: string; signature: string; secret: string }) {
  const verified = await verifyResendWebhook(input);
  if (!verified) throw new Error("RESEND_WEBHOOK_SIGNATURE_INVALID");
  const body = JSON.parse(input.rawBody) as { type?: string; created_at?: string; data?: { email_id?: string; id?: string; to?: string[]; email?: string } };
  const eventType = String(body.type ?? "");
  const externalEventId = input.id;
  if (!eventType || !externalEventId) throw new Error("RESEND_WEBHOOK_INVALID");
  const providerMessageId = body.data?.email_id ?? body.data?.id ?? null;
  const outbox = providerMessageId ? await db.emailOutbox.findFirst({ where: { providerMessageId } }) : null;
  try {
    const event = await db.$transaction(async (transaction) => {
      const created = await transaction.emailWebhookEvent.create({ data: { companyId: outbox?.companyId, outboxId: outbox?.id, provider: "resend", externalEventId, providerMessageId, eventType, payload: { bodyHash: createHash("sha256").update(input.rawBody).digest("hex") }, signatureVerified: true, occurredAt: body.created_at ? new Date(body.created_at) : new Date() } });
      if (outbox && eventType === "email.delivered") await transaction.emailOutbox.update({ where: { id: outbox.id }, data: { status: "SENT", lastError: null } });
      if (outbox && eventType === "email.delivery_delayed") await transaction.emailOutbox.update({ where: { id: outbox.id }, data: { lastError: eventType } });
      if (outbox && ["email.failed", "email.bounced", "email.complained", "email.suppressed"].includes(eventType)) await transaction.emailOutbox.update({ where: { id: outbox.id }, data: { status: "FAILED", lastError: eventType, deadLetteredAt: new Date() } });
      const recipient = body.data?.email ?? body.data?.to?.[0] ?? outbox?.recipient;
      if (recipient && ["email.bounced", "email.complained", "email.suppressed"].includes(eventType)) {
        const digest = emailHash(recipient);
        const existing = await transaction.emailSuppression.findFirst({ where: { companyId: outbox?.companyId ?? null, emailHash: digest } });
        if (existing) await transaction.emailSuppression.update({ where: { id: existing.id }, data: { active: true, reason: eventType, source: "resend_webhook" } });
        else await transaction.emailSuppression.create({ data: { companyId: outbox?.companyId, emailHash: digest, reason: eventType, source: "resend_webhook" } });
      }
      return created;
    });
    return { event, replayed: false };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    return { event: await db.emailWebhookEvent.findUniqueOrThrow({ where: { provider_externalEventId: { provider: "resend", externalEventId } } }), replayed: true };
  }
}

export function validateEmailDomainConfiguration(env: Record<string, string | undefined> = process.env) {
  const provider = env.EMAIL_PROVIDER?.trim().toLowerCase() ?? "local";
  if (provider === "local") return { ready: true, mode: "local" as const };
  const required = ["EMAIL_FROM", "EMAIL_REPLY_TO", "EMAIL_SENDING_DOMAIN", "RESEND_API_KEY", "RESEND_WEBHOOK_SECRET"] as const;
  const missing: string[] = required.filter((key) => !env[key]);
  if (env.EMAIL_DKIM_STATUS !== "verified") missing.push("EMAIL_DKIM_STATUS");
  if (env.EMAIL_SPF_STATUS !== "verified") missing.push("EMAIL_SPF_STATUS");
  if (!["quarantine", "reject"].includes(env.EMAIL_DMARC_POLICY ?? "")) missing.push("EMAIL_DMARC_POLICY");
  if (env.EMAIL_TRACKING_ENABLED === "true") throw new Error("EMAIL_TRACKING_MUST_REMAIN_DISABLED_BY_DEFAULT");
  if (missing.length) throw new Error(`EMAIL_DOMAIN_CONFIGURATION_INCOMPLETE:${[...new Set(missing)].join(",")}`);
  return { ready: true, mode: "resend" as const };
}

function renderTemplate(template: { subject: string; text: string; html: string; allowed: string[] }, variables: Record<string, string>) {
  const supplied = Object.keys(variables);
  if (supplied.some((key) => !template.allowed.includes(key)) || template.allowed.some((key) => !variables[key])) throw new Error("EMAIL_TEMPLATE_VARIABLES_INVALID");
  const replace = (source: string) => source.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, key: string) => escapeTemplateValue(variables[key] ?? ""));
  const rendered = { subject: replace(template.subject), text: replace(template.text), html: replace(template.html) };
  if (/\{\{[^}]+\}\}/.test(`${rendered.subject}${rendered.text}${rendered.html}`)) throw new Error("EMAIL_TEMPLATE_VARIABLE_MISSING");
  return rendered;
}

function actionTemplate(subject: string, text: string, action: string): TemplateDefinition { return { subject, text: `${text}\n\n{{actionUrl}}`, html: `<p>${text}</p><p><a href="{{actionUrl}}">${action}</a></p>`, allowedVariables: ["actionUrl"], trackingEnabled: false }; }
function staticTemplate(subject: string, text: string): TemplateDefinition { return { subject, text, html: `<p>${text}</p>`, allowedVariables: [], trackingEnabled: false }; }
function normalizeEmail(value: string) { const email = value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("EMAIL_RECIPIENT_INVALID"); return email; }
function emailHash(value: string) { return createHash("sha256").update(normalizeEmail(value)).digest("hex"); }
function asObject(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function asStringArray(value: unknown) { return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : []; }
function escapeTemplateValue(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function deriveActionToken(outboxId: string) { const secret = process.env.EMAIL_TOKEN_DERIVATION_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "orqena-local-email-token-secret-change-me"); if (secret.length < 32) throw new Error("EMAIL_TOKEN_DERIVATION_SECRET_REQUIRED"); return createHmac("sha256", secret).update(`email-action:v1:${outboxId}`).digest("base64url"); }
function actionUrl(event: EmailEventKey, token: string) { const base = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000"); if (!base) throw new Error("APP_BASE_URL_NOT_CONFIGURED"); const path = event === "employee_invited" ? "/aceptar-invitacion" : event === "email_verification" ? "/verificar-email" : "/restablecer-contrasena"; return `${base}${path}?token=${encodeURIComponent(token)}`; }
function assertNoSecretMaterial(value: unknown, path = "payload") { if (value === null || value === undefined) return; if (Array.isArray(value)) return value.forEach((item, index) => assertNoSecretMaterial(item, `${path}.${index}`)); if (typeof value !== "object") return; for (const [key, item] of Object.entries(value as Record<string, unknown>)) { if (/(^|_)(token|secret|password|authorization|html|actionurl)(_|$)/i.test(key)) throw new Error(`EMAIL_SECRET_MATERIAL_FORBIDDEN:${path}.${key}`); assertNoSecretMaterial(item, `${path}.${key}`); } }
