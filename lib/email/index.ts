import { createHash } from "node:crypto";
import { Resend } from "resend";
import { brand } from "@/lib/brand";
import { FakeEmailProvider } from "@/lib/platform/providers/fake";
import { ResendEmailProvider } from "@/lib/platform/providers/production";
import type { EmailDeliveryProvider } from "@/lib/platform/providers/contracts";

const DEFAULT_FROM = `${brand.productName} · ${brand.companyName} <notificaciones@updates.orqenatech.com>`;
const APP_BASE_URL = "https://app.orqenatech.com";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export interface EmailProvider {
  readonly name: "resend" | "test" | "local";
  send(message: MailMessage): Promise<{ id?: string }>;
}

class DeliveryProviderAdapter implements EmailProvider {
  readonly name: "resend" | "local";

  constructor(private readonly provider: EmailDeliveryProvider) {
    this.name = provider.name === "resend" ? "resend" : "local";
  }

  async send(message: MailMessage) {
    const idempotencyKey = createHash("sha256")
      .update(`${message.to}\0${message.subject}\0${message.text}`)
      .digest("hex");
    const receipt = await this.provider.send({
      recipient: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
      idempotencyKey,
    } as Parameters<EmailDeliveryProvider["send"]>[0] & { html: string; replyTo?: string });
    return { id: receipt.reference };
  }
}

class SafeLocalProvider implements EmailProvider {
  readonly name = "local" as const;

  async send(message: MailMessage) {
    console.info("[email-local] retained", {
      recipientDomain: message.to.split("@")[1] ?? "unknown",
      subjectKey: message.subject.slice(0, 80),
    });
    return {};
  }
}

export class TestEmailProvider implements EmailProvider {
  readonly name = "test" as const;
  readonly messages: MailMessage[] = [];

  async send(message: MailMessage) {
    this.messages.push(structuredClone(message));
    return { id: `test-${this.messages.length}` };
  }
}

export function getEmailProviderStatus(environment = process.env) {
  const liveEnabled = environment.EMAIL_LIVE_ENABLED?.trim().toLowerCase() === "true";
  if (liveEnabled && environment.RESEND_API_KEY && (environment.RESEND_FROM_EMAIL || environment.EMAIL_FROM)) return "resend" as const;
  if (
    environment.NODE_ENV === "test"
    || environment.NODE_ENV === "development"
    || (environment.EMAIL_PROVIDER === "local" && ["development", "test", "staging"].includes(environment.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase() ?? ""))
  ) return "local" as const;
  return "missing" as const;
}

function createDeliveryProvider(environment: NodeJS.ProcessEnv): EmailDeliveryProvider {
  const status = getEmailProviderStatus(environment);
  if (status === "resend") {
    const from = environment.RESEND_FROM_EMAIL?.trim() || environment.EMAIL_FROM?.trim() || DEFAULT_FROM;
    return new ResendEmailProvider(new Resend(environment.RESEND_API_KEY!), from);
  }
  if (status === "local") return new FakeEmailProvider();
  if (environment.EMAIL_LIVE_ENABLED?.trim().toLowerCase() !== "true") throw new Error("EMAIL_LIVE_DISABLED");
  throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED:RESEND_API_KEY");
}

export function getEmailDeliveryProvider(): EmailDeliveryProvider {
  return createDeliveryProvider(process.env);
}

export function createEmailProvider(environment: NodeJS.ProcessEnv = process.env): EmailProvider {
  const status = getEmailProviderStatus(environment);
  if (status === "local") return new SafeLocalProvider();
  if (environment.EMAIL_LIVE_ENABLED?.trim().toLowerCase() !== "true") throw new Error("EMAIL_LIVE_DISABLED");
  return new DeliveryProviderAdapter(createDeliveryProvider(environment));
}

export async function sendTransactionalEmail(message: MailMessage, provider = createEmailProvider()) {
  return provider.send(message);
}

/** @deprecated Use queueEmailEvent so delivery is transactionally coupled to the business event. */
export async function sendVerificationEmail(to: string, token: string, provider?: EmailProvider) {
  const url = actionLink("/verificar-email", token);
  return sendTransactionalEmail({
    to,
    subject: `Verifica tu correo en ${brand.productName}`,
    text: `Verifica tu correo abriendo este enlace: ${url}`,
    html: `<p>Confirma tu correo para activar tu cuenta de ${brand.productName}.</p><p><a href="${escapeHtml(url)}">Verificar correo</a></p>`,
  }, provider);
}

/** @deprecated Use queueEmailEvent so delivery is transactionally coupled to the business event. */
export async function sendPasswordResetEmail(to: string, token: string, provider?: EmailProvider) {
  const url = actionLink("/restablecer-contrasena", token);
  return sendTransactionalEmail({
    to,
    subject: `Restablece tu contraseña de ${brand.productName}`,
    text: `Restablece tu contraseña abriendo este enlace: ${url}`,
    html: `<p>Se ha solicitado un cambio de contraseña para tu cuenta de ${brand.productName}.</p><p><a href="${escapeHtml(url)}">Restablecer contraseña</a></p><p>Si no lo solicitaste, ignora este mensaje.</p>`,
  }, provider);
}

export async function sendContactNotification(input: {
  name: string;
  email: string;
  company?: string;
  reason: string;
  message: string;
}, provider?: EmailProvider) {
  const text = [
    `Nombre: ${input.name}`,
    `Correo: ${input.email}`,
    `Empresa: ${input.company || "No indicada"}`,
    `Motivo: ${input.reason}`,
    "",
    input.message,
  ].join("\n");
  const html = `<p><strong>Nombre:</strong> ${escapeHtml(input.name)}</p><p><strong>Correo:</strong> ${escapeHtml(input.email)}</p><p><strong>Empresa:</strong> ${escapeHtml(input.company || "No indicada")}</p><p><strong>Motivo:</strong> ${escapeHtml(input.reason)}</p><hr><p>${escapeHtml(input.message).replaceAll("\n", "<br>")}</p>`;
  return sendTransactionalEmail({
    to: "hola@orqenatech.com",
    subject: `Contacto web · ${safeSubject(input.reason)}`,
    text,
    html,
    replyTo: input.email,
  }, provider);
}

export function applicationLink(pathname: string) {
  const path = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/";
  return `${configuredAppBase()}${path}`;
}

function actionLink(pathname: string, token: string) {
  const url = new URL(applicationLink(pathname));
  url.searchParams.set("token", token);
  return url.toString();
}

function configuredAppBase() {
  const configured = process.env.NEXT_PUBLIC_WEB_BASE_URL?.trim() || process.env.APP_BASE_URL?.trim();
  if (!configured) return APP_BASE_URL;
  try {
    const url = new URL(configured);
    if (process.env.NODE_ENV === "production" && url.hostname !== "app.orqenatech.com") {
      throw new Error("APP_BASE_URL_INVALID");
    }
    return url.origin;
  } catch {
    if (process.env.NODE_ENV === "production") throw new Error("APP_BASE_URL_INVALID");
    return APP_BASE_URL;
  }
}

function safeSubject(value: string) {
  return value.replace(/[\r\n\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80) || "Nueva solicitud";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
