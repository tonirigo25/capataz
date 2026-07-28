import type { Prisma } from "@prisma/client";
import { createOpaqueToken, hashToken } from "@/lib/auth/crypto";
import { prisma } from "@/lib/prisma";
import { applicationLink, createEmailProvider, sendTransactionalEmail } from "@/lib/email";

export const emailEventKeys = ["employee_invited", "employee_accepted", "owner_approval_requested", "employee_approved", "employee_rejected", "invitation_revoked", "invitation_expiring", "profile_changed", "permissions_changed", "membership_suspended", "membership_reactivated", "security_alert", "demo_requested"] as const;
export type EmailEventKey = (typeof emailEventKeys)[number];

const subjects: Record<EmailEventKey, string> = {
  employee_invited: "Te han invitado a Orqena", employee_accepted: "Invitación aceptada", owner_approval_requested: "Acceso pendiente de aprobación",
  employee_approved: "Tu acceso a Orqena está activo", employee_rejected: "Solicitud de acceso revisada", invitation_revoked: "Invitación revocada",
  invitation_expiring: "Tu invitación caduca pronto", profile_changed: "Tu portal profesional ha cambiado", permissions_changed: "Tu acceso ha cambiado",
  membership_suspended: "Tu acceso está suspendido", membership_reactivated: "Tu acceso vuelve a estar activo", security_alert: "Aviso de seguridad",
  demo_requested: "Nueva solicitud de demo"
};

export async function queueEmailEvent(tx: typeof prisma, input: { companyId?: string; invitationId?: string; eventKey: EmailEventKey; recipient: string; createdById?: string; payload?: Record<string, unknown> }) {
  return tx.emailOutbox.create({ data: { companyId: input.companyId, invitationId: input.invitationId, eventKey: input.eventKey, templateKey: input.eventKey, templateVersion: 1, recipient: input.recipient, subject: subjects[input.eventKey], textBody: previewText(input.eventKey), htmlBody: `<p>${previewText(input.eventKey)}</p>`, payload: input.payload as Prisma.InputJsonValue | undefined, createdById: input.createdById } });
}

export async function processEmailOutboxItem(id: string, companyId: string) {
  const item = await prisma.emailOutbox.findFirstOrThrow({ where: { id, companyId } });
  if (!["PENDING", "FAILED", "RETRYING"].includes(item.status)) return { item, previewHtml: null as string | null };
  const attempt = item.attempts + 1;
  let previewHtml: string | null = null;
  await prisma.emailOutbox.update({ where: { id }, data: { status: "PROCESSING", attempts: attempt } });
  try {
    let token: string | undefined;
    if (item.invitationId && item.eventKey === "employee_invited") {
      token = createOpaqueToken();
      const invitation = await prisma.invitation.findFirstOrThrow({ where: { id: item.invitationId, companyId } });
      await prisma.invitation.update({ where: { id: invitation.id }, data: { tokenHash: hashToken(token) } });
    }
    const link = token ? `${applicationLink("/aceptar-invitacion")}?token=${encodeURIComponent(token)}` : undefined;
    previewHtml = link ? `<p>${previewText(item.eventKey as EmailEventKey)}</p><p><a href="${link}">Aceptar invitación</a></p>` : `<p>${previewText(item.eventKey as EmailEventKey)}</p>`;
    if (process.env.EMAIL_PROVIDER !== "local" && process.env.NEXT_PUBLIC_APP_ENV === "staging") throw new Error("STAGING_EXTERNAL_EMAIL_FORBIDDEN");
    const provider = createEmailProvider();
    await sendTransactionalEmail({
      to: item.recipient,
      subject: item.subject,
      text: item.textBody || previewText(item.eventKey as EmailEventKey),
      html: previewHtml,
    }, provider);
    await prisma.$transaction([
      prisma.emailDeliveryAttempt.create({ data: { outboxId: id, attempt, provider: provider.name, status: "SENT" } }),
      prisma.emailOutbox.update({ where: { id }, data: { status: "SENT", processedAt: new Date(), lastError: null, payload: { ...asObject(item.payload), linkGenerated: Boolean(link), deliveredBy: provider.name } } })
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "EMAIL_DELIVERY_FAILED";
    await prisma.$transaction([
      prisma.emailDeliveryAttempt.create({ data: { outboxId: id, attempt, provider: process.env.RESEND_API_KEY ? "resend" : "missing", status: "FAILED", errorCode: message.split(":")[0].slice(0, 100), errorDetail: message } }),
      prisma.emailOutbox.update({ where: { id }, data: { status: attempt < 3 ? "RETRYING" : "FAILED", lastError: message, availableAt: new Date(Date.now() + Math.min(attempt, 5) * 60_000) } })
    ]);
  }
  return { item: await prisma.emailOutbox.findFirstOrThrow({ where: { id, companyId } }), previewHtml };
}

function previewText(event: EmailEventKey) {
  if (event === "employee_invited") return "Tu empresa te ha invitado. El enlace seguro se genera únicamente durante el envío.";
  if (event === "owner_approval_requested") return "Hay una solicitud de acceso pendiente de tu aprobación.";
  if (event === "employee_approved") return "El propietario ha aprobado tu acceso profesional.";
  return subjects[event];
}

function asObject(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
