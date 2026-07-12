type MailMessage = { to: string; subject: string; text: string; html: string };

export interface EmailProvider { send(message: MailMessage): Promise<void>; }

class ResendEmailProvider implements EmailProvider {
  constructor(private apiKey: string, private from: string) {}
  async send(message: MailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, ...message })
    });
    if (!response.ok) throw new Error(`EMAIL_PROVIDER_${response.status}`);
  }
}

class SafeDevelopmentProvider implements EmailProvider {
  async send(message: MailMessage) {
    console.info("[email-development] message retained", { recipientDomain: message.to.split("@")[1] ?? "unknown", subject: message.subject });
  }
}

function getProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (apiKey && from) return new ResendEmailProvider(apiKey, from);
  if (process.env.NODE_ENV === "production") throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
  return new SafeDevelopmentProvider();
}

function appUrl(path: string, token: string) {
  const base = process.env.APP_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    if (process.env.NODE_ENV === "production") throw new Error("APP_BASE_URL_NOT_CONFIGURED");
    return `http://localhost:3000${path}?token=${encodeURIComponent(token)}`;
  }
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = appUrl("/verificar-email", token);
  await getProvider().send({ to, subject: "Verifica tu correo en Capataz", text: `Verifica tu correo abriendo este enlace: ${url}`, html: `<p>Confirma tu correo para activar tu cuenta de Capataz.</p><p><a href="${url}">Verificar correo</a></p>` });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = appUrl("/restablecer-contrasena", token);
  await getProvider().send({ to, subject: "Restablece tu contraseña de Capataz", text: `Restablece tu contraseña abriendo este enlace: ${url}`, html: `<p>Se ha solicitado un cambio de contraseña para tu cuenta.</p><p><a href="${url}">Restablecer contraseña</a></p><p>Si no lo solicitaste, ignora este mensaje.</p>` });
}
