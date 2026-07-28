const DEFAULT_FROM = "Capataz · Orqena Tech <notificaciones@updates.orqenatech.com>";
const DEFAULT_REPLY_TO = "soporte@orqenatech.com";
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

class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly defaultReplyTo: string,
  ) {}

  async send(message: MailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        reply_to: message.replyTo ?? this.defaultReplyTo,
      }),
    });
    if (!response.ok) throw new Error(`EMAIL_PROVIDER_${response.status}`);
    const body = await response.json() as { id?: string };
    return { id: body.id };
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

function localProviderAllowed() {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase();
  return process.env.EMAIL_PROVIDER === "local" && ["development", "test", "staging"].includes(appEnv ?? "");
}

export function getEmailProviderStatus() {
  if (process.env.RESEND_API_KEY) return "resend" as const;
  if (localProviderAllowed() || process.env.NODE_ENV === "test") return "local" as const;
  return "missing" as const;
}

export function createEmailProvider(environment = process.env): EmailProvider {
  if (environment.RESEND_API_KEY) {
    return new ResendEmailProvider(
      environment.RESEND_API_KEY,
      environment.RESEND_FROM_EMAIL?.trim() || environment.EMAIL_FROM?.trim() || DEFAULT_FROM,
      environment.RESEND_REPLY_TO?.trim() || DEFAULT_REPLY_TO,
    );
  }
  const appEnv = environment.NEXT_PUBLIC_APP_ENV?.trim().toLowerCase();
  if (
    environment.NODE_ENV === "test"
    || (environment.EMAIL_PROVIDER === "local" && ["development", "test", "staging"].includes(appEnv ?? ""))
    || environment.NODE_ENV === "development"
  ) {
    return new SafeLocalProvider();
  }
  throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED:RESEND_API_KEY");
}

export async function sendTransactionalEmail(message: MailMessage, provider = createEmailProvider()) {
  return provider.send(message);
}

export async function sendVerificationEmail(to: string, token: string, provider?: EmailProvider) {
  const url = appUrl("/verificar-email", token);
  return sendTransactionalEmail({
    to,
    subject: "Verifica tu correo en Capataz",
    text: `Verifica tu correo abriendo este enlace: ${url}`,
    html: `<p>Confirma tu correo para activar tu cuenta de Capataz.</p><p><a href="${escapeHtml(url)}">Verificar correo</a></p>`,
  }, provider);
}

export async function sendPasswordResetEmail(to: string, token: string, provider?: EmailProvider) {
  const url = appUrl("/restablecer-contrasena", token);
  return sendTransactionalEmail({
    to,
    subject: "Restablece tu contraseña de Capataz",
    text: `Restablece tu contraseña abriendo este enlace: ${url}`,
    html: `<p>Se ha solicitado un cambio de contraseña para tu cuenta de Capataz.</p><p><a href="${escapeHtml(url)}">Restablecer contraseña</a></p><p>Si no lo solicitaste, ignora este mensaje.</p>`,
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

function appUrl(pathname: string, token: string) {
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
